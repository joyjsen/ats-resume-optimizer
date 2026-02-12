"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onBackgroundTaskCreated = void 0;
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const openai_1 = require("openai");
const aiUtils_1 = require("../utils/aiUtils");
const firestoreUtils_1 = require("../utils/firestoreUtils");
const notificationUtils_1 = require("../utils/notificationUtils");
/**
 * Check if an analysis task document exists
 */
async function checkTaskExists(taskId, db) {
    const doc = await db.collection("analysis_tasks").doc(taskId).get();
    return doc.exists;
}
/**
 * Firestore Trigger: Process background tasks when created
 */
const onBackgroundTaskCreated = (openaiApiKey, perplexityApiKey) => (0, firestore_1.onDocumentCreated)({
    document: "background_tasks/{taskId}",
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "1GiB",
    secrets: [openaiApiKey, perplexityApiKey],
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot)
        return;
    const task = snapshot.data();
    const taskId = event.params.taskId;
    const db = admin.firestore();
    const taskRef = db.collection("background_tasks").doc(taskId);
    try {
        await taskRef.update({ status: "processing", startedAt: admin.firestore.FieldValue.serverTimestamp() });
        const openai = new openai_1.default({ apiKey: openaiApiKey.value() });
        switch (task.type) {
            case "optimize_resume":
                await processOptimizeResume(task, taskRef, openai, db, perplexityApiKey.value());
                break;
            case "add_skill":
                await processAddSkill(task, taskRef, openai, db, perplexityApiKey.value());
                break;
            case "prep_guide":
                await processPrepGuide(task, taskRef, openai, db, perplexityApiKey.value());
                break;
            case "cover_letter":
                await processCoverLetter(task, taskRef, db, perplexityApiKey.value());
                break;
            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }
        await taskRef.update({ status: "completed", completedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    catch (error) {
        console.error(`[BackgroundTask] Task ${taskId} failed:`, error);
        await taskRef.update({ status: "failed", error: error.message }).catch(() => { });
    }
});
exports.onBackgroundTaskCreated = onBackgroundTaskCreated;
async function processOptimizeResume(task, taskRef, openai, db, perplexityKey) {
    const { analysisTaskId, resume, job, analysis, historyId } = task.payload;
    const analysisTaskRef = db.collection("analysis_tasks").doc(analysisTaskId);
    if (!(await checkTaskExists(analysisTaskId, db)))
        return;
    try {
        await analysisTaskRef.update({ status: "processing", progress: 30, currentStep: "Optimizing resume..." });
        // Rich prompt matching the quality of resumeOptimization.ts
        const missingKeywords = analysis?.matchAnalysis?.missingSkills?.map((s) => s.skill).join(', ') || 'None identified';
        const currentScore = analysis?.atsScore || 0;
        const systemInstruction = `You are an expert ATS resume optimizer. Optimize the provided resume for the target job while maintaining truthfulness.
Return a JSON object with properties 'optimizedResume' (structure matching original) and 'changes' (array of change objects).
Aim for an ATS score of 85-95%. You must respond with valid JSON only, no other text.`;
        const userContent = `You are an expert Executive Resume Writer. Optimize this resume for the target job while maintaining truthfulness.
Your mandate is to REWRITE the content to be more professional, impactful, and ATS-optimized.

CRITICAL: DO NOT BE CONCISE. The user wants a detailed, comprehensive resume.
- Expand on bullet points to explain HOW and WHY, not just WHAT.
- Use full sentences with strong impact.
- Aim for 2-3 lines per bullet point if necessary to convey depth.

ORIGINAL RESUME:
${JSON.stringify(resume, null, 2)}

TARGET JOB:
${JSON.stringify({ title: job.title, company: job.company, requirements: job.requirements }, null, 2)}

ANALYSIS INSIGHTS:
Missing Keywords: ${missingKeywords}
Current ATS Score: ${currentScore}%

OPTIMIZATION INSTRUCTIONS:
1. **Professional Summary**: WRITE A COMPLETELY NEW summary. It must be 3-4 lines, punchy, include key achievements, and naturally integrate the top 5 keywords.
2. **Experience Section (CRITICAL)**:
   - For EACH and EVERY role, rewrite the bullet points.
   - **EXPAND** on them. Do not simplify.
   - Transform passive responsibilities into active achievements (e.g., "Responsible for sales" -> "Spearheaded sales strategy delivering 20% growth by leveraging X and Y...").
   - INTEGRATE the missing keywords naturally into these bullets.
   - Use strong power verbs.
   - Provide context (team size, budget, technologies used).
3. **Skills**: Reorder and categorize them to match the job description priorities.
4. **General**: Correction of grammar, tone, and clarity is required.

STRICT RULES:
- DO NOT add skills or experiences the user clearly doesn't have.
- DO NOT be brief or concise. Detail is preferred.
- DO rephrase existing experience to sound more impressive and relevant.
- DO generate a "changes" list that explains EXACTLY what you did.

Return JSON:
{
  "optimizedResume": { ... full resume object matching the original structure ... },
  "changes": [
    {
      "type": "professional_summary_rewrite",
      "reason": "Rewrote professional summary to include key skills X, Y, Z and highlight relevant achievements"
    },
    {
      "type": "experience_enhancement",
      "section": "Software Engineer at Company",
      "reason": "Expanded bullet points with quantified achievements and integrated missing keywords"
    },
    {
      "type": "keyword_integration",
      "reason": "Added missing keywords: Docker, Kubernetes naturally into experience bullets"
    }
  ]
}`;
        // Use jsonMode: false to avoid OpenAI 400 error about 'json' word in messages.
        // We handle JSON extraction manually below.
        const aiResult = await (0, aiUtils_1.callAiWithFallback)(openai, perplexityKey, systemInstruction, userContent, { maxTokens: 10000, jsonMode: false });
        console.log(`[BackgroundTask] Raw AI Result length: ${aiResult.length}`);
        // Robust JSON extraction: strip markdown fences, find first { and last }
        let result;
        try {
            const cleaned = aiResult.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
            const firstBrace = cleaned.indexOf('{');
            const lastBrace = cleaned.lastIndexOf('}');
            let jsonStr = cleaned;
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
            }
            console.log(`[BackgroundTask] Extracted JSON length: ${jsonStr.length}`);
            result = JSON.parse(jsonStr);
        }
        catch (e) {
            console.error(`[BackgroundTask] JSON Parse Error:`, e);
            console.error(`[BackgroundTask] Failed Content (first 500):`, aiResult.substring(0, 500));
            throw new Error("AI returned invalid JSON.");
        }
        // Calibration logic
        const baseScore = analysis.atsScore || 0;
        const calibratedScore = Math.min(100, baseScore + Math.floor(Math.random() * 10) + 1);
        if (!(await checkTaskExists(analysisTaskId, db)))
            return;
        if (!result || (!result.optimizedResume && !result.optimized_resume)) {
            console.error("[BackgroundTask] AI Response Missing Keys. Received:", Object.keys(result));
            throw new Error("AI failed to generate an optimized resume. Please try again.");
        }
        const optimizedResume = result.optimizedResume || result.optimized_resume;
        const rawChanges = result.changes || result.refinements || [];
        // Normalize changes to ensure they have {type, reason} structure
        const changes = rawChanges.map((c) => {
            if (typeof c === 'string') {
                return { type: 'optimization', reason: c };
            }
            return {
                type: c.type || 'optimization',
                reason: c.reason || c.description || JSON.stringify(c),
                section: c.section || undefined,
            };
        });
        // Sanitize data to remove any undefined values that Firestore rejects
        const sanitizedResume = optimizedResume ? JSON.parse(JSON.stringify(optimizedResume)) : null;
        const sanitizedChanges = changes ? JSON.parse(JSON.stringify(changes)) : [];
        if (historyId || analysis.id) {
            await db.collection("user_analyses").doc(historyId || analysis.id).update({
                draftOptimizedResumeData: sanitizedResume,
                draftChangesData: sanitizedChanges,
                draftAtsScore: calibratedScore,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        await taskRef.update({
            result: { optimizedResume: sanitizedResume, calibratedScore },
            progress: 90
        });
        await analysisTaskRef.update({ status: "completed", progress: 100, currentStep: "Complete" });
    }
    catch (error) {
        console.error(`[OptimizeResume] Failed for ${analysisTaskId}:`, error);
        await analysisTaskRef.update({
            status: "failed",
            error: error.message || "Optimization failed"
        }).catch((e) => console.error(`[OptimizeResume] Failed to update status:`, e));
        throw error;
    }
}
// ... other process functions follow same pattern ...
async function processAddSkill(task, taskRef, openai, db, perplexityKey) {
    const { taskId, analysisTaskId: altTaskId, resume, skill, targetSections, historyId } = task.payload;
    const resolvedTaskId = taskId || altTaskId;
    const userId = task.userId;
    if (!resolvedTaskId) {
        throw new Error(`[AddSkill] Missing analysisTaskId in payload. Keys: ${Object.keys(task.payload).join(', ')}`);
    }
    const analysisTaskRef = db.collection("analysis_tasks").doc(resolvedTaskId);
    if (!(await checkTaskExists(resolvedTaskId, db)))
        return;
    try {
        // Note: tokens are already deducted by the frontend before task creation (15 tokens via activityService)
        // No need to deduct again here
        await analysisTaskRef.update({
            status: "processing",
            progress: 30,
            currentStep: `Adding skill "${skill}"...`,
        });
        const systemInstruction = `You are an expert ATS Resume Editor. Add the skill "${skill}" to the resume naturally.
You MUST return a JSON object with two properties:
1. "optimizedResume" - the COMPLETE resume object with the SAME structure as the input, with the skill integrated
2. "changes" - array of objects describing what you changed, each with "type" and "reason" fields

CRITICAL: Return the ENTIRE resume in "optimizedResume", not just the modified sections. The structure must match the original exactly.
You must respond with valid JSON only, no other text or markdown.`;
        const prompt = `TASK: Naturally integrate the skill "${skill}" into the following sections: ${targetSections.join(', ')}.

RESUME:
${JSON.stringify(resume, null, 2)}

RULES:
- Add "${skill}" naturally into the specified sections
- Keep all other content exactly the same
- In the experience section, enhance 1-2 bullet points to reference "${skill}" where relevant
- Add "${skill}" to the skills section if it exists and the skill isn't already there
- Return the COMPLETE resume object in "optimizedResume" with all sections intact
- List all changes made in the "changes" array`;
        await analysisTaskRef.update({ progress: 50, currentStep: `AI is integrating "${skill}"...` });
        const aiResult = await (0, aiUtils_1.callAiWithFallback)(openai, perplexityKey, systemInstruction, prompt, { jsonMode: true, maxTokens: 10000 });
        // Robust JSON extraction (matching processOptimizeResume pattern)
        let result;
        try {
            const cleaned = aiResult.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
            const firstBrace = cleaned.indexOf('{');
            const lastBrace = cleaned.lastIndexOf('}');
            let jsonStr = cleaned;
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
            }
            result = JSON.parse(jsonStr);
        }
        catch (e) {
            console.error(`[AddSkill] JSON Parse Error:`, e);
            console.error(`[AddSkill] Failed Content (first 500):`, aiResult.substring(0, 500));
            throw new Error("AI returned invalid JSON for skill addition.");
        }
        const optimizedResume = result.optimizedResume || result.optimized_resume;
        if (!optimizedResume) {
            console.error("[AddSkill] AI Response Missing optimizedResume. Keys:", Object.keys(result));
            throw new Error("AI failed to return a complete resume. Please try again.");
        }
        const rawChanges = result.changes || [];
        const aiChanges = rawChanges.map((c) => {
            if (typeof c === 'string')
                return { type: 'skill_addition', skill, reason: c };
            return {
                type: c.type || 'skill_addition',
                skill: c.skill || skill,
                reason: c.reason || c.description || JSON.stringify(c),
                section: c.section || undefined,
            };
        });
        // Always prepend an explicit tracking entry for the SkillsComparison component
        const trackingEntry = { type: 'skill_addition', skill, reason: `Added "${skill}" to resume` };
        // Accumulate changes: fetch existing draft or finalized changes from Firestore and append new ones
        let existingChanges = [];
        let existingBaseScore = 0;
        if (historyId) {
            const historyDoc = await db.collection("user_analyses").doc(historyId).get();
            if (historyDoc.exists) {
                const historyData = historyDoc.data();
                // Fallback sequence: Draft -> Finalized -> Baseline (empty)
                existingChanges = historyData?.draftChangesData || historyData?.changesData || [];
                existingBaseScore = historyData?.draftAtsScore || historyData?.atsScore || 0;
            }
        }
        // Combine: existing changes + tracking entry + new AI changes (deduplicated)
        const allChanges = [...existingChanges, trackingEntry, ...aiChanges];
        // Sanitize for Firestore
        const sanitizedResume = JSON.parse(JSON.stringify(optimizedResume));
        const sanitizedChanges = JSON.parse(JSON.stringify(allChanges));
        // Calculate new ATS score (small boost for adding a skill)
        // Use the accumulated base score we just fetched
        const currentAnalysis = task.payload.currentAnalysis;
        const baseScore = existingBaseScore || currentAnalysis?.atsScore || currentAnalysis?.analysisData?.atsScore || 0;
        const calibratedScore = Math.min(100, baseScore + Math.floor(Math.random() * 5) + 2);
        await analysisTaskRef.update({ progress: 80, currentStep: "Saving results..." });
        if (historyId) {
            await db.collection("user_analyses").doc(historyId).update({
                draftOptimizedResumeData: sanitizedResume,
                draftChangesData: sanitizedChanges,
                draftAtsScore: calibratedScore,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        // Update background task with result
        await taskRef.update({
            result: { optimizedResume: sanitizedResume, calibratedScore },
            progress: 90
        });
        // Mark analysis_tasks as completed (THIS WAS MISSING!)
        await analysisTaskRef.update({ status: "completed", progress: 100, currentStep: "Complete" });
        console.log(`[AddSkill] Successfully added "${skill}" for task ${resolvedTaskId}. New score: ${calibratedScore}`);
    }
    catch (error) {
        console.error(`[AddSkill] Failed for ${resolvedTaskId}:`, error);
        await analysisTaskRef.update({
            status: "failed",
            error: error.message || "Skill addition failed"
        }).catch((e) => console.error(`[AddSkill] Failed to update status:`, e));
        throw error;
    }
}
async function processPrepGuide(task, taskRef, openai, db, perplexityKey) {
    const { applicationId, companyName, company, jobTitle, jobDescription, optimizedResume, matchedSkills, missingSkills } = task.payload;
    const resolvedCompany = companyName || company || 'Unknown Company';
    const userId = task.userId;
    const appRef = db.collection("user_applications").doc(applicationId);
    console.log(`[PrepGuide] Starting for ${resolvedCompany} (appId: ${applicationId})`);
    try {
        // Note: tokens are already deducted by the frontend before task creation
        // No need to deduct again here
        await appRef.update({
            "prepGuide.status": "generating",
            "prepGuide.startedAt": admin.firestore.FieldValue.serverTimestamp(),
            "prepGuide.progress": 2,
            "prepGuide.currentStep": "Researching company..."
        });
        const sections = {};
        const resumeContext = optimizedResume ? `\nCANDIDATE RESUME:\n${optimizedResume}` : '';
        const skillsContext = matchedSkills?.length ? `\nMATCHED SKILLS: ${matchedSkills.join(', ')}` : '';
        const missingContext = missingSkills?.length ? `\nSKILL GAPS: ${missingSkills.join(', ')}` : '';
        // 1. Company Intelligence (Perplexity for real-time web research)
        sections.companyIntelligence = await (0, aiUtils_1.callPerplexity)(perplexityKey, "You are a company research analyst providing detailed, CURRENT information for interview preparation.", `Research ${resolvedCompany} for a ${jobTitle} candidate. Include:\n- Company mission, values, and culture\n- Key products/services and recent developments (last 90 days)\n- Competitive landscape\n- Interview process and culture\n- Recent news and announcements`, false);
        await appRef.update({ "prepGuide.progress": 15, "prepGuide.sections.companyIntelligence": sections.companyIntelligence });
        // 2. Role Analysis & Strategy
        await appRef.update({ "prepGuide.progress": 20, "prepGuide.currentStep": "Analyzing role requirements..." });
        sections.roleAnalysis = await (0, aiUtils_1.callAiWithFallback)(openai, perplexityKey, "You are an expert interview coach.", `Provide a detailed role analysis for ${jobTitle} at ${resolvedCompany}.\nJOB DESCRIPTION: ${jobDescription || "Not provided"}\n\nInclude:\n- Key responsibilities breakdown\n- Required vs nice-to-have qualifications\n- What the hiring manager is likely looking for\n- How this role fits within the organization\n- Career growth potential`, { maxTokens: 3000, jsonMode: false });
        await appRef.update({ "prepGuide.progress": 30, "prepGuide.sections.roleAnalysis": sections.roleAnalysis });
        // 3. Technical Preparation
        await appRef.update({ "prepGuide.progress": 35, "prepGuide.currentStep": "Building technical prep..." });
        sections.technicalPrep = await (0, aiUtils_1.callAiWithFallback)(openai, perplexityKey, "You are a senior technical interviewer.", `Create a technical preparation guide for ${jobTitle} at ${resolvedCompany}.\nJOB DESCRIPTION: ${jobDescription || "Not provided"}${skillsContext}${missingContext}\n\nInclude:\n- Core technical concepts to review\n- Likely coding/system design topics\n- Technical questions with sample answers\n- Hands-on exercises to practice\n- Common pitfalls to avoid`, { maxTokens: 4000, jsonMode: false });
        await appRef.update({ "prepGuide.progress": 45, "prepGuide.sections.technicalPrep": sections.technicalPrep });
        // 4. Behavioral Framework
        await appRef.update({ "prepGuide.progress": 50, "prepGuide.currentStep": "Crafting behavioral framework..." });
        sections.behavioralFramework = await (0, aiUtils_1.callAiWithFallback)(openai, perplexityKey, "You are an expert interview coach specializing in behavioral interviews.", `Create a behavioral interview framework for ${jobTitle} at ${resolvedCompany}.\nJOB DESCRIPTION: ${jobDescription || "Not provided"}\n\nInclude:\n- Top 10 likely behavioral questions with explanation of what interviewers look for\n- STAR method templates for each question\n- Tips for structuring compelling answers\n- Red flags to avoid\n- How to handle curveball questions`, { maxTokens: 4000, jsonMode: false });
        await appRef.update({ "prepGuide.progress": 60, "prepGuide.sections.behavioralFramework": sections.behavioralFramework });
        // 5. Story Mapping (personalized to candidate's resume)
        await appRef.update({ "prepGuide.progress": 65, "prepGuide.currentStep": "Mapping your stories..." });
        sections.storyMapping = await (0, aiUtils_1.callAiWithFallback)(openai, perplexityKey, "You are an expert interview coach. Create personalized story mappings from the candidate's actual experience.", `Map the candidate's resume experiences to likely interview questions for ${jobTitle} at ${resolvedCompany}.${resumeContext}\nJOB DESCRIPTION: ${jobDescription || "Not provided"}\n\nFor each major resume experience:\n- Identify 2-3 interview questions it could answer\n- Create a STAR outline (Situation, Task, Action, Result)\n- Highlight quantifiable achievements to emphasize\n- Suggest how to connect each story to the role's requirements`, { maxTokens: 4000, jsonMode: false });
        await appRef.update({ "prepGuide.progress": 75, "prepGuide.sections.storyMapping": sections.storyMapping });
        // 6. Questions to Ask
        await appRef.update({ "prepGuide.progress": 80, "prepGuide.currentStep": "Preparing strategic questions..." });
        sections.questionsToAsk = await (0, aiUtils_1.callAiWithFallback)(openai, perplexityKey, "You are a career strategist.", `Generate thoughtful questions for a ${jobTitle} candidate to ask during interviews at ${resolvedCompany}.\nJOB DESCRIPTION: ${jobDescription || "Not provided"}\n\nCategories:\n- Role-specific questions (day-to-day work, team structure)\n- Growth and development questions\n- Company culture and values questions\n- Technical/product questions showing genuine interest\n- Strategic questions that demonstrate business acumen\n\nFor each question, explain WHY it's impressive and what insight it provides.`, { maxTokens: 3000, jsonMode: false });
        await appRef.update({ "prepGuide.progress": 88, "prepGuide.sections.questionsToAsk": sections.questionsToAsk });
        // 7. Interview Day Strategy
        await appRef.update({ "prepGuide.progress": 90, "prepGuide.currentStep": "Creating interview strategy..." });
        sections.interviewStrategy = await (0, aiUtils_1.callAiWithFallback)(openai, perplexityKey, "You are an executive career coach.", `Create an interview day strategy guide for ${jobTitle} at ${resolvedCompany}.\n\nInclude:\n- Pre-interview preparation checklist (night before & morning of)\n- First impression tips specific to this company's culture\n- How to structure your opening pitch / \"Tell me about yourself\" (2 min max)\n- Salary negotiation preparation and market rate context\n- Follow-up strategy (thank you notes, timeline expectations)\n- Body language and communication tips\n- How to handle multi-round/panel interviews`, { maxTokens: 3000, jsonMode: false });
        await appRef.update({ "prepGuide.progress": 95, "prepGuide.sections.interviewStrategy": sections.interviewStrategy });
        // Finalize
        await appRef.update({
            "prepGuide.status": "completed",
            "prepGuide.progress": 100,
            "prepGuide.currentStep": "Complete",
            "prepGuide.generatedAt": admin.firestore.FieldValue.serverTimestamp(),
        });
        await taskRef.update({ result: { sections }, progress: 100 });
        // Send Push Notification directly
        console.log(`[PrepGuide] Attempting to send push to userId: ${userId}`);
        if (userId) {
            try {
                await (0, notificationUtils_1.sendPush)(userId, "Interview Prep Guide Ready", `Your prep guide for ${jobTitle} at ${resolvedCompany} is ready.`, { applicationId, route: "/(tabs)/applications", action: "viewPrep" });
                console.log(`[PrepGuide] Push notification sent successfully.`);
            }
            catch (pushError) {
                console.error(`[PrepGuide] FAILED to send push notification:`, pushError);
            }
        }
        else {
            console.error(`[PrepGuide] Cannot send push: No userId found in task.`);
        }
    }
    catch (error) {
        console.error(`[PrepGuide] Failed for ${applicationId}:`, error);
        await appRef.update({
            "prepGuide.status": "failed",
            "prepGuide.error": error.message || "Generation failed"
        }).catch((e) => console.error(`[PrepGuide] Failed to update status:`, e));
        throw error;
    }
}
async function processCoverLetter(task, taskRef, db, perplexityKey) {
    const { applicationId, resume, jobTitle, company, jobDescription } = task.payload;
    const userId = task.userId;
    const appRef = db.collection("user_applications").doc(applicationId);
    try {
        // 1. Indicate processing started - Use set-merge to ensure map exists
        await appRef.set({
            coverLetter: {
                status: "generating",
                startedAt: admin.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });
        // 2. Deduct tokens
        await (0, firestoreUtils_1.deductTokens)(userId, 15, 'cover_letter_generation', `Generated Cover Letter for ${company}`, applicationId, db, 'perplexity');
        const prompt = `Write a compelling cover letter for "${jobTitle}" at "${company}".
RESUME: ${JSON.stringify(resume, null, 2)}
JD: ${jobDescription || "Not provided"}`;
        const coverLetterText = await (0, aiUtils_1.callPerplexity)(perplexityKey, "Professional Executive Resume Writer. Output ONLY the letter text in markdown. No placeholders.", prompt, false);
        // Use set-merge to robustly update/create the completion state
        await appRef.set({
            coverLetter: {
                status: "completed",
                content: coverLetterText,
                completedAt: admin.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });
        await taskRef.update({ result: { content: coverLetterText }, progress: 100 });
    }
    catch (error) {
        console.error(`[CoverLetter] Failed to generate for ${applicationId}:`, error);
        // Ensure the application reflects the failure
        await appRef.set({
            coverLetter: {
                status: "failed",
                error: error.message || "Generation failed"
            }
        }, { merge: true }).catch((e) => console.error(`[CoverLetter] Failed to update failure status for ${applicationId}:`, e));
        throw error; // Propagate to main handler to mark Task as failed
    }
}
//# sourceMappingURL=backgroundTasks.js.map