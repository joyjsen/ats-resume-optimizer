import { jobParserService } from '../services/ai/jobParser';
import { resumeParserService } from '../services/ai/resumeParser';
import { gapAnalyzerService } from '../services/ai/gapAnalyzer';
import { historyService } from '../services/firebase/historyService';
import { taskService } from '../services/firebase/taskService';
import { generateHash } from '../utils/hashUtils';

import { resumeOptimizerService } from '../services/ai/resumeOptimizer';

// ... other imports

export const executeAnalysisTask = async (taskId: string, payload: any, type: string = 'analyze_resume') => {
    try {
        if (type === 'optimize_resume') {
            return await executeOptimizationTask(taskId, payload);
        } else if (type === 'add_skill') {
            return await executeAddSkillTask(taskId, payload);
        }

        const { jobUrl, jobText, resumeText, resumeFiles, jobHash, resumeHash } = payload;

        // ... existing analyze logic ...

        let job;
        // 1. Parse Job
        if (payload.screenshots && payload.screenshots.length > 0) {
            await taskService.updateProgress(taskId, 20, `Processing ${payload.screenshots.length} screenshot(s)...`);
            job = await jobParserService.parseJobFromImage(payload.screenshots);
        } else {
            const hasValidText = jobText && jobText.trim().length > 50;
            if (hasValidText) {
                job = await jobParserService.parseJobFromText(jobText);
            } else if (jobUrl) {
                // Note: Direct scraping might be limited here if running strictly in background without WebView
                // For now, assume simple fetch or previous import. 
                // In a real background scenario, we might need a robust scraper service.
                // Assuming jobText was pre-filled via import in UI for this version.
                throw new Error("Direct URL scraping in background not fully supported without pre-import.");
            } else {
                throw new Error("No job input provided");
            }
        }

        await taskService.updateProgress(taskId, 40, 'Parsing resume...');

        // 2. Parse Resume
        let resume;
        if (resumeText && resumeText.trim().length > 0) {
            resume = await resumeParserService.parseResumeFromContent(resumeText);
        } else if (resumeFiles && resumeFiles.length > 0) {
            // resumeFiles are URIs. React Native can read these if permission persists.
            // If app was killed, temp URIs might be invalid. 
            // Ideally we upload to Storage first. specific to this environment:
            resume = await resumeParserService.parseResume(resumeFiles);
        } else {
            throw new Error("No resume input provided");
        }

        await taskService.updateProgress(taskId, 70, 'Analyzing fit...');

        // 3. Gap Analysis
        const analysis = await gapAnalyzerService.analyzeJobFit(resume, job);

        await taskService.updateProgress(taskId, 90, 'Saving results...');

        // 4. Save Result
        const savedId = await historyService.saveAnalysis(
            analysis,
            job,
            resume,
            undefined,
            undefined,
            jobHash,
            resumeHash
        );

        await taskService.completeTask(taskId, savedId);
        return savedId;

    } catch (error: any) {
        console.error("Task failed:", error);
        await taskService.failTask(taskId, error.message || "Unknown error");
        throw error;
    }
};

const executeOptimizationTask = async (taskId: string, payload: any) => {
    try {
        const { resume, job, currentAnalysis } = payload;

        await taskService.updateProgress(taskId, 20, 'Analyzing skill gaps...');

        // Call the AI Optimizer
        // Note: resumeOptimizerService.optimizeResume calls AI which takes time
        const { optimizedResume, changes } = await resumeOptimizerService.optimizeResume(
            resume,
            job,
            currentAnalysis
        );

        await taskService.updateProgress(taskId, 80, 'Finalizing optimization...');

        // Auto-save the update (AS DRAFT)
        if (currentAnalysis.id) {
            await historyService.updateAnalysis(
                currentAnalysis.id,
                currentAnalysis, // base object (will be merged in service, but service expects base)
                job,
                resume,
                optimizedResume,
                changes,
                true // isDraft
            );
        } else {
            // New save if for some reason ID is missing (AS DRAFT)
            await historyService.saveAnalysis(
                currentAnalysis,
                job,
                resume,
                optimizedResume,
                changes,
                undefined,
                undefined,
                true // isDraft
            );
        }

        await taskService.completeTask(taskId, currentAnalysis.id);
        return currentAnalysis.id;

    } catch (error: any) {
        console.error("Optimization Task failed:", error);
        await taskService.failTask(taskId, error.message || "Optimization error");
        throw error;
    }
};

const executeAddSkillTask = async (taskId: string, payload: any) => {
    try {
        const { currentAnalysis, resume, skill, targetSections } = payload;

        await taskService.updateProgress(taskId, 20, `Adding ${skill} to resume...`);

        // 1. Call Optimizer to add skill
        const { optimizedResume, changes } = await resumeOptimizerService.addSkillToResume(
            resume, // Note: This should be the latest resume (draft or original) passed in payload
            skill,
            targetSections
        );

        // 1.5. Re-analyze to get new score and match analysis
        // We need the job data to analyze fit
        const job = currentAnalysis.job || currentAnalysis.jobData;
        let newAnalysis = await gapAnalyzerService.analyzeJobFit(optimizedResume, job);

        // FORCE INJECTION: Ensure added skills count as 'Matched'
        // This guarantees the score increases as per user formula: f(Matched + New)
        // We manually move them from Missing/Partial to Matched in the data object before saving.
        const addedSkills = changes
            .filter((c: any) => c.type === 'skill_addition')
            .map((c: any) => c.skill)
            .filter(Boolean);

        if (addedSkills.length > 0) {
            console.log("Force Injecting Skills into Analysis:", addedSkills);
            const matches = newAnalysis.matchAnalysis.matchedSkills;
            const partials = newAnalysis.matchAnalysis.partialMatches;
            const missing = newAnalysis.matchAnalysis.missingSkills;

            addedSkills.forEach((skillName: string) => {
                // If not already in matched (case insensitive)
                if (!matches.find(m => m.skill.toLowerCase() === skillName.toLowerCase())) {
                    // Find it in partial/missing to get importance/confidence
                    const existing = partials.find(p => p.skill.toLowerCase() === skillName.toLowerCase())
                        || missing.find(m => m.skill.toLowerCase() === skillName.toLowerCase())
                        || { skill: skillName, importance: 'high', confidence: 100, userHas: true }; // Default to high if unknown

                    // Add to Matched
                    matches.push({ ...existing, skill: skillName, userHas: true, confidence: 100 });

                    // Remove from Partial/Missing
                    newAnalysis.matchAnalysis.partialMatches = partials.filter(p => p.skill.toLowerCase() !== skillName.toLowerCase());
                    newAnalysis.matchAnalysis.missingSkills = missing.filter(m => m.skill.toLowerCase() !== skillName.toLowerCase());
                }
            });

            // Recalculate Score with the injected matches
            newAnalysis.atsScore = gapAnalyzerService.calculateATSScore(newAnalysis.matchAnalysis);

            // SAFEGUARD: Ensure strictly positive delta (Monotonic increase)
            const baselineScore = currentAnalysis.draftAtsScore || currentAnalysis.atsScore || 0;
            if (newAnalysis.atsScore <= baselineScore) {
                console.log(`Safeguard: New score ${newAnalysis.atsScore} <= Baseline ${baselineScore}. Bumping.`);
                newAnalysis.atsScore = Math.min(100, baselineScore + 1);
            }

            console.log("Recalculated Score (Forced):", newAnalysis.atsScore);
        }

        await taskService.updateProgress(taskId, 90, 'Saving updates...');

        // 2. Save as Draft
        // Fix: content object uses 'changes', DB uses 'changesData'. Check both.
        const existingDraft = currentAnalysis.draftChangesData;
        const existingFinal = currentAnalysis.changes || currentAnalysis.changesData;
        const existingChanges = existingDraft || existingFinal || [];

        const mergedChanges = [...existingChanges, ...changes];

        // Update history
        if (currentAnalysis.id) {
            await historyService.updateAnalysis(
                currentAnalysis.id,
                currentAnalysis,
                job,
                currentAnalysis.resumeData,
                optimizedResume,
                mergedChanges,
                true, // isDraft
                newAnalysis.atsScore,           // New Draft Score
                newAnalysis.matchAnalysis       // New Draft Match Analysis
            );
        }

        await taskService.completeTask(taskId, currentAnalysis.id);
        return currentAnalysis.id;

    } catch (error: any) {
        console.error("Add Skill Task failed:", error);
        await taskService.failTask(taskId, error.message || "Skill addition error");
        throw error;
    }
}
