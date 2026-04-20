import { Alert } from 'react-native';

export const executeAnalysisTask = async (taskId: string, payload: any, type: string = 'analyze_resume') => {
    const { BackgroundWorker } = await import('../services/background/backgroundWorker');
    console.log(`[Worker] Starting task: ${taskId} (${type})`);

    return BackgroundWorker.start(async () => {
        try {
            if (type === 'optimize_resume') {
                return await executeOptimizationTask(taskId, payload);
            } else if (type === 'add_skill') {
                return await executeAddSkillTask(taskId, payload);
            } else if (['cover_letter', 'prep_guide', 'prep_guide_refresh', 'course_completion', 'resume_validation'].includes(type)) {
                console.log(`[Worker] Skipping execution for client-side task: ${taskId} (${type})`);
                return;
            }

            const { jobTitle, jobCompany, jobText, resumeText, resumeFiles, jobHash, resumeHash, resume: preParsedResume, job: preParsedJob } = payload;

            const { taskService } = await import('../services/firebase/taskService');
            await taskService.updateProgress(taskId, 15, 'Parsing inputs locally...').catch(() => { });

            const jobParsePromise = (async () => {
                if (preParsedJob?.requirements) return preParsedJob;
                if (payload.screenshots?.length > 0) {
                    const { jobParserService } = await import('../services/ai/jobParser');
                    return await jobParserService.parseJobFromImage(payload.screenshots);
                }
                return {
                    title: jobTitle || 'Detected Job',
                    company: jobCompany || 'Detected Company',
                    description: jobText || '',
                    requirements: { mustHaveSkills: [], niceToHaveSkills: [], keywords: [] },
                    id: 'raw_job_' + Date.now(),
                    parsedAt: new Date()
                };
            })();

            const resumeParsePromise = (async () => {
                if (preParsedResume?.experience?.length > 0) return preParsedResume;
                if (resumeText?.trim()) return { text: resumeText, skills: [], experience: [], education: [] };
                if (resumeFiles?.length > 0) {
                    const { resumeParserService } = await import('../services/ai/resumeParser');
                    const rawText = await resumeParserService.extractContentFromFiles(resumeFiles);
                    return { text: rawText, skills: [], experience: [], education: [] };
                }
                throw new Error("No resume input provided");
            })();

            const [job, resume] = await Promise.all([jobParsePromise, resumeParsePromise]);
            await taskService.updateProgress(taskId, 30, 'Sending to cloud analyzer...').catch(() => { });

            const needsBackendParsing = !resume.experience?.length || !job.requirements;
            const { backgroundTaskService } = await import('../services/firebase/backgroundTaskService');

            return new Promise<void>((resolve, reject) => {
                backgroundTaskService.createTask(
                    'analyze_resume',
                    {
                        analysisTaskId: taskId,
                        job,
                        resume,
                        jobHash,
                        resumeHash,
                        jobTitle: job.title || '',
                        jobCompany: job.company || '',
                        jobText: job.description || '',
                        resumeText: resume.text || '',
                        requiresParsing: needsBackendParsing
                    },
                    () => resolve(),
                    async (bgTask: any) => {
                        try {
                            const { taskService: localTaskService } = await import('../services/firebase/taskService');
                            await localTaskService.failTask(taskId, bgTask.error || "Background analysis failed");
                        } catch (e: any) {
                            // Task document may have been deleted during cancellation — safe to ignore
                            if (!e.message?.includes('NOT_FOUND')) console.error('[Worker] Failed to mark task as failed:', e.message);
                        }
                        reject(new Error(bgTask.error || 'Background analysis failed'));
                    }
                ).catch(reject);
            });

        } catch (error: any) {
            console.error(`[Worker] Task ${taskId} FAILED:`, error);
            try {
                const { taskService: localTaskService } = await import('../services/firebase/taskService');
                await localTaskService.failTask(taskId, error.message || "Unknown error");
            } catch (e: any) {
                // Task document may have been deleted during cancellation — safe to ignore
                if (!e.message?.includes('NOT_FOUND')) console.error('[Worker] Failed to mark task as failed:', e.message);
            }
            throw error;
        }
    }, taskId, type);
};

const executeOptimizationTask = async (taskId: string, payload: any) => {
    const { resume, job, currentAnalysis } = payload;
    const { taskService: localTaskService } = await import('../services/firebase/taskService');
    await localTaskService.updateProgress(taskId, 20, 'Starting optimization...').catch(() => { });

    const { backgroundTaskService } = await import('../services/firebase/backgroundTaskService');
    return new Promise<void>((resolve, reject) => {
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
            () => resolve(),
            async (bgTask: any) => {
                if (isCancelled) return;
                const task = await localTaskService.getTask(taskId);
                if (!task) {
                    isCancelled = true;
                    backgroundTaskService.stopListening(bgTask.id);
                    return resolve();
                }
                try {
                    await localTaskService.failTask(taskId, bgTask.error || "Background task failed");
                } catch (e: any) {
                    if (!e.message?.includes('NOT_FOUND')) console.error('[Worker] Failed to mark optimization task as failed:', e.message);
                }
                reject(new Error(bgTask.error));
            }
        ).catch(reject);
    });
};

const executeAddSkillTask = async (taskId: string, payload: any) => {
    const { currentAnalysis, resume, skill, targetSections } = payload;
    const { taskService: localTaskService } = await import('../services/firebase/taskService');
    await localTaskService.updateProgress(taskId, 20, `Adding ${skill} to resume...`).catch(() => { });

    const { backgroundTaskService } = await import('../services/firebase/backgroundTaskService');
    return new Promise<void>((resolve, reject) => {
        backgroundTaskService.createTask(
            'add_skill',
            {
                analysisTaskId: taskId,
                resume,
                skill,
                targetSections,
                historyId: currentAnalysis.id,
                currentAnalysis,
                job: currentAnalysis.job || currentAnalysis.jobData,
            },
            () => resolve(),
            async (bgTask: any) => {
                try {
                    await localTaskService.failTask(taskId, bgTask.error || "Background task failed");
                } catch (e: any) {
                    if (!e.message?.includes('NOT_FOUND')) console.error('[Worker] Failed to mark skill task as failed:', e.message);
                }
                reject(new Error(bgTask.error));
            }
        ).catch(reject);
    });
};
