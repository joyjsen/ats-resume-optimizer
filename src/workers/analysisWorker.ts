import { AppState } from 'react-native';
import { BackgroundWorker } from '../services/background/backgroundWorker';
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

    // Wrap the entire execution in BackgroundWorker to ensure it runs even if backgrounded
    return BackgroundWorker.start(async () => {
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

            // 1. Parsing (Keep Local - Fast & Requires Files)
            // We still parse locally because handling file uploads/imports on the server is complex.
            // It's fast enough to do before backgrounding.
            try {
                await taskService.updateProgress(taskId, 15, 'Parsing inputs locally...');
            } catch (updateError: any) {
                if (updateError.message?.includes('no longer exists')) return;
                throw updateError;
            }

            const jobParsePromise = (async () => {
                await BackgroundWorker.updateProgress("Extracting Job Details...");
                if (payload.screenshots && payload.screenshots.length > 0) {
                    // For images, we still need OCR. We can't avoid this network call easily without uploading images.
                    // But we can skip the "Structuring" step.
                    // Ideally, we'd upload images, but for now let's hope OCR is fast enough or user is using text.
                    // If user processes TEXT (which handles the vast majority of "stuck" cases), this is instant.
                    return await jobParserService.parseJobFromImage(payload.screenshots);
                } else {
                    const hasValidText = jobText && jobText.trim().length > 50;
                    if (hasValidText) {
                        // SKIP AI STRUCTURING LOCALLY
                        return {
                            title: jobTitle || 'Detected Job',
                            company: jobCompany || 'Detected Company',
                            description: jobText,
                            requirements: { mustHaveSkills: [], niceToHaveSkills: [], keywords: [] },
                            id: 'raw_job_' + Date.now(),
                            parsedAt: new Date()
                        };
                    } else if (jobUrl) {
                        throw new Error("Direct URL scraping in background not fully supported without pre-import.");
                    } else {
                        throw new Error("No job input provided");
                    }
                }
            })();

            const resumeParsePromise = (async () => {
                await BackgroundWorker.updateProgress("Extracting Resume Text...");
                if (resumeText && resumeText.trim().length > 0) {
                    // SKIP AI STRUCTURING LOCALLY
                    return { text: resumeText, skills: [], experience: [], education: [] };
                } else if (resumeFiles && resumeFiles.length > 0) {
                    // This uses Mammoth (local) for DOCX, but OpenAI for Images.
                    // We get RAW TEXT here.
                    const rawText = await resumeParserService.extractContentFromFiles(resumeFiles);
                    return { text: rawText, skills: [], experience: [], education: [] };
                } else {
                    throw new Error("No resume input provided");
                }
            })();

            const [job, resume] = await Promise.all([jobParsePromise, resumeParsePromise]);

            console.log(`[Worker] Extraction complete (Raw/Semi-Parsed). Offloading to cloud...`);

            try {
                await taskService.updateProgress(taskId, 30, 'Sending to cloud analyzer...');
            } catch (ignore) { }

            // 2. Offload to Background Task Service (Server-Side)
            await new Promise<string>((resolve, reject) => {
                backgroundTaskService.createTask(
                    'analyze_resume',
                    {
                        analysisTaskId: taskId,
                        // Send RAW or Semi-Parsed data
                        job,
                        resume,
                        jobHash,
                        resumeHash,
                        jobTitle: job.title,
                        jobCompany: job.company,
                        jobText: job.description || jobText,
                        resumeText: resume.text || resumeText,
                        // Flag to tell backend it needs to do the heavy parsing
                        requiresParsing: true
                    },
                    async (bgTask) => {
                        console.log("[Worker] Background analysis completed!");
                        // The Cloud Function updates the analysis task status and resultId.
                        // We just resolve here.
                        // We can return the resultId if it's in the background task result.
                        resolve(bgTask.result?.savedId);
                    },
                    async (bgTask) => {
                        // If the error is just "task cancelled" or "not found", we shouldn't error out loudly
                        const isNotFoundError = bgTask.error?.includes('NOT_FOUND') || bgTask.error?.includes('No document to update');

                        if (!isNotFoundError) {
                            console.error("[Worker] Background analysis failed:", bgTask.error);
                            await taskService.failTask(taskId, bgTask.error || "Background analysis failed");
                        } else {
                            console.log("[Worker] Background analysis stopped (Task cancelled/deleted).");
                        }

                        reject(new Error(bgTask.error));
                    }
                ).catch(err => {
                    if (err?.message?.includes('NOT_FOUND') || err?.message?.includes('No document to update')) {
                        console.log("[Worker] Background task creation aborted (Task cancelled/deleted).");
                    } else {
                        console.error("[Worker] Failed to create background task:", err);
                    }
                    reject(err);
                });
            });

        } catch (error: any) {
            console.error(`[Worker] Task ${taskId} FAILED:`, error);
            await taskService.failTask(taskId, error.message || "Unknown error");
            throw error;
        }
    }, taskId, type);
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

                        // Local notification disabled to prevent duplication with Cloud Function push
                        // resolve(currentAnalysis.id);
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

                    // Local notification disabled to prevent duplication with Cloud Function push
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
