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

        const { jobUrl, jobText, jobTitle, jobCompany, resumeText, resumeFiles, jobHash, resumeHash } = payload;

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
            try {
                await taskService.updateProgress(taskId, 20, 'Parsing job details...');
            } catch (ignore) { }

            if (payload.screenshots && payload.screenshots.length > 0) {
                console.log(`[Worker] Parsing job from ${payload.screenshots.length} snapshots...`);
                return await jobParserService.parseJobFromImage(payload.screenshots);
            } else {
                const hasValidText = jobText && jobText.trim().length > 50;
                if (hasValidText) {
                    console.log("[Worker] Parsing job from provided text (respecting edits)...");
                    return await jobParserService.parseJobFromText(jobText, jobTitle, jobCompany);
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
            try {
                await taskService.updateProgress(taskId, 30, 'Extracting resume text...');
            } catch (ignore) { }

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

        // 3. Gap Analysis - Force local execution to ensure we use the updated hiring consultant prompt and metrics
        console.log("[Worker] Running Local Gap Analysis for enhanced metrics...");
        let analysis: any;
        analysis = await gapAnalyzerService.analyzeJobFit(resume, job);

        /* 
        // TEMPORARILY DISABLED: Favor local analysis for latest high-fidelity metrics
        try {
            // ... cloud logic ...
        } catch (cloudError: any) {
            // ... fallback ...
        }
        */

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

        // Local notifications removed to prevent duplicates (backend handles this)

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
