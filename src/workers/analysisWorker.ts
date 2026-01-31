import { AppState } from 'react-native';
import { jobParserService } from '../services/ai/jobParser';
import { resumeParserService } from '../services/ai/resumeParser';
import { gapAnalyzerService } from '../services/ai/gapAnalyzer';
import { historyService } from '../services/firebase/historyService';
import { taskService } from '../services/firebase/taskService';
import { activityService } from '../services/firebase/activityService';
import { generateHash } from '../utils/hashUtils';
import { notificationService } from '../services/firebase/notificationService';
import { backgroundTaskService, BackgroundTask } from '../services/firebase/backgroundTaskService';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../services/firebase/config';

import { resumeOptimizerService } from '../services/ai/resumeOptimizer';

// Initialize Firebase Functions
const functions = getFunctions(app, 'us-central1');

// Cloud Functions for server-side processing (used as fallback)
const performGapAnalysisCloud = httpsCallable(functions, 'performGapAnalysis');
const generateRecommendationCloud = httpsCallable(functions, 'generateRecommendation');

export const executeAnalysisTask = async (taskId: string, payload: any, type: string = 'analyze_resume') => {
    console.log(`[Worker] Starting task: ${taskId} (${type})`);
    try {
        if (type === 'optimize_resume') {
            return await executeOptimizationTask(taskId, payload);
        } else if (type === 'add_skill') {
            return await executeAddSkillTask(taskId, payload);
        } else if (type === 'cover_letter' || type === 'prep_guide' || type === 'prep_guide_refresh' || type === 'course_completion' || type === 'resume_validation') {
            // These are "ghost" tasks created by the client to trigger notifications.
            // They are already completed or handled on the client-side.
            console.log(`[Worker] Skipping execution for client-side task: ${taskId} (${type})`);
            return;
        }

        const { jobUrl, jobText, resumeText, resumeFiles, jobHash, resumeHash } = payload;

        // OPTIMIZATION: Parse Job and Resume in PARALLEL to reduce total time
        try {
            await taskService.updateProgress(taskId, 15, 'Parsing job and resume...');
        } catch (updateError: any) {
            if (updateError.message?.includes('no longer exists')) {
                console.warn(`[Worker] Task ${taskId} was cancelled, stopping execution.`);
                return;
            }
            throw updateError;
        }

        // Create job parsing promise
        const jobParsePromise = (async () => {
            if (payload.screenshots && payload.screenshots.length > 0) {
                console.log(`[Worker] Parsing job from ${payload.screenshots.length} snapshots...`);
                return await jobParserService.parseJobFromImage(payload.screenshots);
            } else {
                const hasValidText = jobText && jobText.trim().length > 50;
                if (hasValidText) {
                    console.log("[Worker] Parsing job from provided text...");
                    return await jobParserService.parseJobFromText(jobText);
                } else if (jobUrl) {
                    console.log("[Worker] Parsing job from URL (Note: fallback text expected)...");
                    throw new Error("Direct URL scraping in background not fully supported without pre-import.");
                } else {
                    throw new Error("No job input provided");
                }
            }
        })();

        // Create resume parsing promise
        const resumeParsePromise = (async () => {
            if (resumeText && resumeText.trim().length > 0) {
                console.log("[Worker] Parsing resume from text...");
                return await resumeParserService.parseResumeFromContent(resumeText);
            } else if (resumeFiles && resumeFiles.length > 0) {
                console.log(`[Worker] Parsing resume from ${resumeFiles.length} files...`);
                return await resumeParserService.parseResume(resumeFiles);
            } else {
                throw new Error("No resume input provided");
            }
        })();

        // Execute both in parallel
        const [job, resume] = await Promise.all([jobParsePromise, resumeParsePromise]);

        console.log(`[Worker] Job parsed: ${job.title} @ ${job.company}`);
        console.log(`[Worker] Resume parsed for: ${resume.contactInfo.name || 'User'}`);

        try {
            await taskService.updateProgress(taskId, 50, 'Analyzing fit...');
        } catch (updateError: any) {
            if (updateError.message?.includes('no longer exists')) {
                console.warn(`[Worker] Task ${taskId} was cancelled, stopping execution.`);
                return;
            }
            throw updateError;
        }

        // 3. Gap Analysis - Try Cloud Function first (runs server-side, won't be interrupted by backgrounding)
        console.log("[Worker] Running Gap Analysis...");
        let analysis;

        try {
            // OPTIMIZATION: If app is in background, log it but don't fail immediately.
            // We now send a push notification to warn the user to come back.
            if (AppState.currentState !== 'active') {
                console.log("[Worker] App in background, relying on timeouts and user return...");
                // throw new Error("App in background, force local"); <-- REMOVED to allow rescue
            }

            console.log("[Worker] Attempting server-side analysis via Cloud Function...");
            const cloudResult = await performGapAnalysisCloud({
                taskId,
                resume,
                job
            });

            const data = cloudResult.data as any;

            if (data.success) {
                console.log("[Worker] Server-side analysis complete.");

                // Build analysis result from cloud response
                const matchAnalysis = data.matchAnalysis;
                const gaps = data.gaps;
                const atsScore = data.atsScore;
                const readyToApply = data.readyToApply;

                // Generate recommendation if not ready to apply
                let recommendation;
                if (readyToApply) {
                    recommendation = {
                        action: 'optimize' as const,
                        confidence: atsScore,
                        reasoning: atsScore >= 70
                            ? `Your profile is a strong match! With an ATS score of ${atsScore}%, you're qualified for this role.`
                            : `You're a potential match (ATS: ${atsScore}%) but there are some missing keywords.`,
                    };
                } else {
                    // Get recommendation from cloud
                    try {
                        const recResult = await generateRecommendationCloud({ resume, job, gaps });
                        const recData = recResult.data as any;

                        const totalGapScore = gaps.totalGapScore || 0;
                        let action: 'upskill' | 'apply_junior' | 'not_suitable';
                        let reasoning: string;

                        if (totalGapScore <= 40) {
                            action = 'upskill';
                            reasoning = `You're close! With an ATS score of ${atsScore}%, you have ${gaps.criticalGaps?.length || 0} critical skill gap(s).`;
                        } else if (totalGapScore <= 70) {
                            action = 'apply_junior';
                            reasoning = `This role requires skills you haven't developed yet (ATS: ${atsScore}%).`;
                        } else {
                            action = 'not_suitable';
                            reasoning = `This role requires significantly more experience and skills (ATS: ${atsScore}%).`;
                        }

                        recommendation = {
                            action,
                            confidence: 100 - totalGapScore,
                            reasoning,
                            upskillPath: recData.upskillPath,
                            alternativeJobs: recData.alternativeJobs,
                        };
                    } catch (recError) {
                        console.warn("[Worker] Failed to get recommendation from cloud, using minimal:", recError);
                        recommendation = {
                            action: 'upskill' as const,
                            confidence: 100 - (gaps.totalGapScore || 50),
                            reasoning: `Analysis complete. ATS Score: ${atsScore}%`,
                        };
                    }
                }

                analysis = {
                    id: `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    resumeId: '',
                    jobId: job.id,
                    atsScore,
                    readyToApply,
                    matchAnalysis,
                    gaps,
                    recommendation,
                    analyzedAt: new Date(),
                };
            } else {
                throw new Error("Cloud function returned unsuccessful result");
            }
        } catch (cloudError: any) {
            console.warn("[Worker] Cloud Function failed:", cloudError.message);

            // If it's a token error, do NOT fall back to local (free) analysis
            if (cloudError.message?.includes('Insufficient tokens') || cloudError.message?.includes('unauthenticated')) {
                throw cloudError;
            }

            // Fallback to local analysis for other non-token related infrastructure errors
            console.log("[Worker] Falling back to local analysis calculation...");
            analysis = await gapAnalyzerService.analyzeJobFit(resume, job);
        }

        console.log(`[Worker] Analysis complete. Score: ${analysis.atsScore}`);

        try {
            await taskService.updateProgress(taskId, 90, 'Saving results...');
        } catch (updateError: any) {
            if (updateError.message?.includes('no longer exists')) {
                console.warn(`[Worker] Task ${taskId} was cancelled, stopping execution.`);
                return;
            }
            throw updateError;
        }

        // 4. Save Result
        console.log("[Worker] Saving analysis to Firestore...");
        const savedId = await historyService.saveAnalysis(
            analysis,
            job,
            resume,
            undefined,
            undefined,
            jobHash,
            resumeHash
        );

        if (savedId) {
            console.log(`[Worker] Analysis saved successfully with ID: ${savedId}`);
        } else {
            console.warn("[Worker] HistoryService.saveAnalysis returned empty ID.");
        }

        await taskService.completeTask(taskId, savedId);
        console.log(`[Worker] Task ${taskId} marked as COMPLETED.`);

        // Send local push notification for analysis completion
        await notificationService.notifyAnalysisComplete(
            job.title,
            job.company,
            analysis.atsScore,
            savedId
        ).catch((e: any) => console.error("Worker notification failed:", e));

        return savedId;

    } catch (error: any) {
        console.error(`[Worker] Task ${taskId} FAILED:`, error);
        await taskService.failTask(taskId, error.message || "Unknown error");
        throw error;
    }
};

const executeOptimizationTask = async (taskId: string, payload: any) => {
    console.log(`[Worker] executeOptimizationTask started for task ${taskId}`);
    console.log(`[Worker] Payload keys:`, Object.keys(payload));

    try {
        const { resume, job, currentAnalysis } = payload;

        console.log(`[Worker] Extracted from payload - resume:`, !!resume, 'job:', !!job, 'currentAnalysis:', !!currentAnalysis);

        try {
            console.log(`[Worker] Attempting to update progress to 20%...`);
            await taskService.updateProgress(taskId, 20, 'Starting optimization...');
        } catch (updateError: any) {
            if (updateError.message?.includes('no longer exists')) {
                console.warn(`[Worker] Task ${taskId} was cancelled, stopping execution.`);
                return;
            }
            throw updateError;
        }

        console.log("[Worker] Creating background task for server-side optimization...");

        return new Promise<string>((resolve, reject) => {
            let isCancelled = false;

            backgroundTaskService.createTask(
                'optimize_resume',
                {
                    analysisTaskId: taskId,
                    resume,
                    job,
                    analysis: currentAnalysis,
                    historyId: currentAnalysis.id,
                },
                // onComplete callback
                async (bgTask: BackgroundTask) => {
                    if (isCancelled) return;
                    try {
                        // Check if the main task still exists before final updates
                        const task = await taskService.getTask(taskId);
                        if (!task) {
                            console.log(`[Worker] Task ${taskId} was cancelled. Skipping completion.`);
                            isCancelled = true;
                            backgroundTaskService.stopListening(bgTask.id);
                            return;
                        }

                        console.log("[Worker] Background optimization task completed");
                        // Note: Push notification is sent by Cloud Function, not client
                        // This ensures notifications work even when app is in background

                        resolve(currentAnalysis.id);
                    } catch (error: any) {
                        console.error("[Worker] Error in onComplete:", error);
                        reject(error);
                    }
                },
                // onError callback
                async (bgTask: BackgroundTask) => {
                    if (isCancelled) return;
                    const errorMsg = bgTask.error || "Background task failed";

                    // Check if task still exists (was not cancelled/deleted)
                    const task = await taskService.getTask(taskId);
                    if (!task) {
                        console.log(`[Worker] Task ${taskId} was cancelled. Skipping failTask.`);
                        isCancelled = true;
                        backgroundTaskService.stopListening(bgTask.id);
                        return; // Don't reject, just exit gracefully
                    }

                    // Only log as error if it's a real failure, not a cancellation
                    console.error("[Worker] Background optimization task failed:", errorMsg);
                    await taskService.failTask(taskId, errorMsg);

                    reject(new Error(errorMsg));
                }
            ).catch(err => {
                if (!isCancelled) reject(err);
            });
        });

    } catch (error: any) {
        console.error("Optimization Task failed:", error);
        await taskService.failTask(taskId, error.message || "Optimization error");
        throw error;
    }
};

const executeAddSkillTask = async (taskId: string, payload: any) => {
    try {
        const { currentAnalysis, resume, skill, targetSections } = payload;
        const job = currentAnalysis.job || currentAnalysis.jobData;

        try {
            await taskService.updateProgress(taskId, 20, `Adding ${skill} to resume...`);
        } catch (updateError: any) {
            if (updateError.message?.includes('no longer exists')) {
                console.warn(`[Worker] Task ${taskId} was cancelled, stopping execution.`);
                return;
            }
            throw updateError;
        }

        // Use fire-and-forget pattern: create a background task and let the Cloud Function process it
        // The Cloud Function does ALL the work including re-analysis and saving to Firestore
        console.log("[Worker] Creating background task for server-side skill addition...");

        return new Promise<string>((resolve, reject) => {
            backgroundTaskService.createTask(
                'add_skill',
                {
                    analysisTaskId: taskId,
                    resume,
                    skill,
                    targetSections,
                    historyId: currentAnalysis.id,
                    currentAnalysis,
                    job,
                },
                // onComplete - Cloud Function already did all the work
                async (bgTask: BackgroundTask) => {
                    console.log("[Worker] Background skill addition task completed - data already saved by Cloud Function");
                    // Note: Push notification is sent by Cloud Function, not client
                    // This ensures notifications work even when app is in background

                    resolve(currentAnalysis.id);
                },
                // onError
                async (bgTask: BackgroundTask) => {
                    const errorMsg = bgTask.error || "Background task failed";
                    console.error("[Worker] Background skill addition task failed:", errorMsg);
                    await taskService.failTask(taskId, errorMsg);
                    reject(new Error(errorMsg));
                }
            ).catch(reject);
        });

    } catch (error: any) {
        console.error("Add Skill Task failed:", error);
        await taskService.failTask(taskId, error.message || "Skill addition error");
        throw error;
    }
}
