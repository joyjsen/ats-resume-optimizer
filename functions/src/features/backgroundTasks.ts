import { onDocumentCreated } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import OpenAI from "openai";
import { callAiWithFallback, callPerplexity, calculateATSScore, MatchAnalysis, extractJson } from "../utils/aiUtils";
import { deductTokens } from "../utils/firestoreUtils";
// sendPush import removed — all push notifications centralized in notifications.ts onBackgroundTaskUpdated trigger

/**
 * Check if an analysis task document exists
 */
async function checkTaskExists(taskId: string, db: admin.firestore.Firestore): Promise<boolean> {
    const doc = await db.collection("analysis_tasks").doc(taskId).get();
    return doc.exists;
}

/**
 * Firestore Trigger: Process background tasks when created
 */
export const onBackgroundTaskCreated = (openaiApiKey: any, perplexityApiKey: any) => onDocumentCreated(
    {
        document: "background_tasks/{taskId}",
        region: "us-central1",
        timeoutSeconds: 300,
        memory: "1GiB",
        secrets: [openaiApiKey, perplexityApiKey],
    },
    async (event) => {
        const snapshot = event.data;
        if (!snapshot) return;

        const task = snapshot.data();
        const taskId = event.params.taskId;
        const db = admin.firestore();
        const taskRef = db.collection("background_tasks").doc(taskId);

        try {
            await taskRef.update({ status: "processing", startedAt: admin.firestore.FieldValue.serverTimestamp() });

            const openai = new OpenAI({ apiKey: openaiApiKey.value() });

            // Ensure payload is parsed (TaskService stringifies it)
            if (typeof task.payload === 'string') {
                try {
                    task.payload = JSON.parse(task.payload);
                } catch (e) {
                    console.error("[BackgroundTask] Failed to parse task payload JSON", e);
                }
            }

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
                case "cover_letter":
                    await processCoverLetter(task, taskRef, db, perplexityApiKey.value());
                    break;
                case "analyze_resume":
                    await processAnalyzeResume(task, taskRef, openai, db, perplexityApiKey.value());
                    break;
                default:
                    throw new Error(`Unknown task type: ${task.type}`);
            }

            await taskRef.update({ status: "completed", completedAt: admin.firestore.FieldValue.serverTimestamp() });
        } catch (error: any) {
            console.error(`[BackgroundTask] Task ${taskId} failed:`, error);
            await taskRef.update({ status: "failed", error: error.message }).catch(() => { });
        }
    }
);

async function processOptimizeResume(task: any, taskRef: any, openai: any, db: any, perplexityKey: string) {
    const { analysisTaskId, resume, job, analysis, historyId } = task.payload;
    const userId = task.userId;
    const analysisTaskRef = db.collection("analysis_tasks").doc(analysisTaskId);
    if (!(await checkTaskExists(analysisTaskId, db))) return;

    try {

        await analysisTaskRef.update({ status: "processing", progress: 30, currentStep: "Optimizing resume..." });

        // Rich prompt matching the quality of resumeOptimization.ts
        const strongMatches = analysis?.matchAnalysis?.matchedSkills?.map((s: any) => s.skill).join(', ') || 'Already present';
        const missingKeywords = analysis?.matchAnalysis?.missingSkills?.map((s: any) => s.skill).join(', ') || 'None identified';
        const currentScore = analysis?.atsScore || 0;

        if (!resume) {
            console.error("[BackgroundTask] Missing resume in task payload!");
            throw new Error("Resume data is missing from task payload.");
        }
        console.log(`[BackgroundTask] Original Resume Keys: ${Object.keys(resume).join(', ')}`);
        if (resume.contactInfo) console.log(`[BackgroundTask] Original Contact Info: ${JSON.stringify(resume.contactInfo)}`);
        const systemInstruction = `You are an expert ATS resume optimizer. Optimize the provided resume for the target job while maintaining truthfulness.
Return a JSON object with properties 'optimizedResume' (structure matching original) and 'changes' (array of change objects).
Aim for an ATS score of 85-95%. You must respond with valid JSON only, no other text.`;

        const userContent = `
You are an expert Executive Resume Writer. Optimize this resume for the target job while maintaining truthfulness.
Your mandate is to REWRITE the content to be more professional, impactful, and ATS-optimized.

CRITICAL: DO NOT BE CONCISE. The user wants a detailed, comprehensive resume.

ORIGINAL RESUME:
${JSON.stringify(resume, null, 2)}

TARGET JOB:
${JSON.stringify({ title: job.title, company: job.company, requirements: job.requirements }, null, 2)}

ANALYSIS INSIGHTS:
Strong Matches (MUST be included in Skills section): ${strongMatches}
Missing Keywords (Integrate into experience/summary): ${missingKeywords}
Current ATS Score: ${currentScore}%

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

        // Use jsonMode: true to enforce valid JSON output from OpenAI
        const aiResult = await callAiWithFallback(openai, perplexityKey, systemInstruction, userContent, { maxTokens: 10000, jsonMode: true });
        console.log(`[BackgroundTask] Raw AI Result length: ${aiResult.length}`);

        // Robust JSON extraction using centralized utility
        let result;
        try {
            const extracted = extractJson(aiResult);
            console.log(`[BackgroundTask] Extracted JSON length: ${extracted.length}`);
            result = JSON.parse(extracted);
        } catch (e) {
            console.error(`[BackgroundTask] JSON Parse Error:`, e);
            const failedSnippet = aiResult.substring(0, 500).replace(/\n/g, ' ');
            console.error(`[BackgroundTask] Failed Content Snippet:`, failedSnippet);
            throw new Error(`AI returned invalid JSON. Content start: ${failedSnippet}...`);
        }

        // Calibration logic
        const baseScore = analysis.atsScore || 0;
        const calibratedScore = Math.min(100, baseScore + Math.floor(Math.random() * 10) + 1);

        if (!(await checkTaskExists(analysisTaskId, db))) return;

        // Helper to find the resume object even if nested or flat
        const findResumeObject = (obj: any): any => {
            if (!obj) return null;
            if (obj.optimizedResume) return obj.optimizedResume;
            if (obj.optimized_resume) return obj.optimized_resume;
            // Fallback: If it looks like a resume (has experience/education), use it directly
            if (Array.isArray(obj.experience) || Array.isArray(obj.education)) return obj;
            return null;
        };

        const optimizedResume = findResumeObject(result);

        if (!optimizedResume) {
            console.error("[BackgroundTask] AI Response Missing Valid Resume Data. Received:", Object.keys(result || {}));
            throw new Error("AI failed to generate an optimized resume. Please try again.");
        }

        const rawChanges = result.changes || result.refinements || [];

        // MERGE LOGIC: Ensure we don't lose data if the AI returns partial result (COPIED FROM resumeOptimization.ts)
        const mergedResume = optimizedResume ? {
            ...resume, // Start with original
            ...optimizedResume, // Overwrite with AI result
            contactInfo: (optimizedResume && optimizedResume.contactInfo && Object.keys(optimizedResume.contactInfo).length > 0)
                ? optimizedResume.contactInfo
                : (resume.contactInfo || {}), // Prioritize original contact info if AI missed it or returned empty
            experience: (optimizedResume.experience || resume.experience || []).map((optExp: any, idx: number) => {
                const origExp = resume.experience?.[idx] || {};
                return {
                    ...origExp,
                    ...optExp,
                    bullets: optExp.bullets || optExp.bulletPoints || optExp.description || origExp.bullets || []
                };
            }),
            education: (optimizedResume.education && optimizedResume.education.length > 0)
                ? optimizedResume.education
                : (resume.education || []),
            skills: (optimizedResume.skills && optimizedResume.skills.length > 0)
                ? optimizedResume.skills
                : (resume.skills || []),
            summary: (optimizedResume.summary && optimizedResume.summary.length > 10)
                ? optimizedResume.summary
                : (resume.summary || "")
        } : null;

        if (mergedResume) {
            console.log(`[BackgroundTask] Merged Resume Keys: ${Object.keys(mergedResume).join(', ')}`);
            if (mergedResume.contactInfo) console.log(`[BackgroundTask] Merged Contact Info: ${JSON.stringify(mergedResume.contactInfo)}`);
            if (!mergedResume.skills || mergedResume.skills.length === 0) console.warn("[BackgroundTask] Merged Skills are EMPTY!");
        } else {
            console.error("[BackgroundTask] Merged Resume is NULL!");
        }

        // Normalize changes to ensure they have {type, reason} structure
        const changes = rawChanges.map((c: any) => {
            const timestamp = new Date().toISOString();
            if (typeof c === 'string') {
                return { type: 'optimization', reason: c, timestamp };
            }
            return {
                type: c.type || 'optimization',
                reason: c.reason || c.description || JSON.stringify(c),
                section: c.section || undefined,
                timestamp
            };
        });

        // Sanitize data to remove any undefined values that Firestore rejects
        const sanitizedResume = mergedResume ? JSON.parse(JSON.stringify(mergedResume)) : null;
        const sanitizedChanges = changes ? JSON.parse(JSON.stringify(changes)) : [];

        if (historyId || analysis.id) {
            const updatePayload: any = {
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            // Only update draft data if we actually have it. Don't wipe existing with null.
            if (sanitizedResume) updatePayload.draftOptimizedResumeData = sanitizedResume;
            if (sanitizedChanges && sanitizedChanges.length > 0) updatePayload.draftChangesData = sanitizedChanges;
            if (calibratedScore) updatePayload.draftAtsScore = calibratedScore;

            await db.collection("user_analyses").doc(historyId || analysis.id).update(updatePayload);
        }

        await taskRef.update({
            result: { optimizedResume: sanitizedResume, calibratedScore },
            progress: 90
        });
        await analysisTaskRef.update({ status: "completed", progress: 100, currentStep: "Complete" });

        // Send Push Notification
        // Send Push Notification - REMOVED (Handled by notifications.ts trigger)
        // if (userId) { ... }
    } catch (error: any) {
        console.error(`[OptimizeResume] Failed for ${analysisTaskId}:`, error);
        await analysisTaskRef.update({
            status: "failed",
            error: error.message || "Optimization failed"
        }).catch((e: any) => console.error(`[OptimizeResume] Failed to update status:`, e));
        throw error;
    }
}

// ... other process functions follow same pattern ...
async function processAddSkill(task: any, taskRef: any, openai: any, db: any, perplexityKey: string) {
    const { taskId, analysisTaskId: altTaskId, resume, skill, targetSections, historyId } = task.payload;
    const resolvedTaskId = taskId || altTaskId;
    const userId = task.userId;

    if (!resolvedTaskId) {
        throw new Error(`[AddSkill] Missing analysisTaskId in payload. Keys: ${Object.keys(task.payload).join(', ')}`);
    }

    const analysisTaskRef = db.collection("analysis_tasks").doc(resolvedTaskId);

    if (!(await checkTaskExists(resolvedTaskId, db))) return;

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
2. "changes" - array of objects describing what you changed, each with "type", "reason", and "section" fields

CRITICAL: Return the ENTIRE resume in "optimizedResume", not just the modified sections. The structure must match the original exactly.
You must respond with valid JSON only, no other text or markdown.`;

        // Helper to map section IDs to human-readable names
        const readableSections = targetSections.map((sectionId: string) => {
            if (sectionId === 'summary') return "Professional Summary";
            if (sectionId === 'skills_list') return "Skills Section";
            if (sectionId.startsWith('experience_')) {
                const expId = sectionId.replace('experience_', '');
                const exp = resume.experience?.find((e: any) => String(e.id) === String(expId));
                if (exp) return `Experience: ${exp.title} at ${exp.company}`;
            }
            return sectionId;
        }).filter(Boolean);

        const prompt = `TASK: Naturally integrate the skill "${skill}" into the following sections: ${readableSections.join(', ')}.

RESUME:
${JSON.stringify(resume, null, 2)}

CRITICAL RULES:
1. **TARGETED CHANGE ONLY**: You are ONLY allowed to modify the specific experience roles listed above (e.g., "${readableSections.filter((s: string) => s.startsWith('Experience:')).join('", "') || 'None'}").
2. **COPY-PASTE MANDATE**: For every other experience role NOT listed, you MUST copy the original object EXACTLY as is. Do not change a single character, bullet point, or whitespace.
3. **SKILLS SECTION**: Add "${skill}" to the skills list if not present.
4. **MANDATORY EVIDENCE**: For EACH targeted Experience role, you MUST add a NEW bullet point or SIGNIFICANTLY rewrite an existing one to demonstrate this skill with a concrete achievement or responsibility. Merely mentioning the skill is not enough.
5. **NO HALLUCINATIONS**: Do not invent new bullets for unselected roles.
6. **OUTPUT**: Return the COMPLETE resume. If a section is not targeted, return it identical to the input.
7. **CHANGES ARRAY**: For every change you make, add an entry to the "changes" array with:
   - "type": "experience_update" or "skill_addition"
   - "section": The specific section name (e.g. "Experience: [Role]")
   - "reason": A brief explanation of the change.`;

        await analysisTaskRef.update({ progress: 50, currentStep: `AI is integrating "${skill}"...` });

        const aiResult = await callAiWithFallback(openai, perplexityKey, systemInstruction, prompt, { jsonMode: true, maxTokens: 10000 });

        // Robust JSON extraction using centralized utility
        let result;
        try {
            const extracted = extractJson(aiResult);
            result = JSON.parse(extracted);
        } catch (e) {
            console.error(`[AddSkill] JSON Parse Error:`, e);
            const failedSnippet = aiResult.substring(0, 500).replace(/\n/g, ' ');
            console.error(`[AddSkill] Failed Content Snippet:`, failedSnippet);
            throw new Error(`AI returned invalid JSON for skill addition. Content start: ${failedSnippet}...`);
        }

        const optimizedResume = result.optimizedResume || result.optimized_resume;
        if (!optimizedResume) {
            console.error("[AddSkill] AI Response Missing optimizedResume. Keys:", Object.keys(result));
            throw new Error("AI failed to return a complete resume. Please try again.");
        }

        const rawChanges = result.changes || [];
        const aiChanges = rawChanges.map((c: any) => {
            const timestamp = new Date().toISOString();
            if (typeof c === 'string') return { type: 'skill_addition', skill, reason: c, timestamp };
            return {
                type: c.type || 'skill_addition',
                skill: c.skill || skill,
                reason: c.reason || c.description || JSON.stringify(c),
                section: c.section || undefined,
                timestamp
            };
        });

        // Always prepend an explicit tracking entry for the SkillsComparison component
        const trackingEntry = {
            type: 'skill_addition',
            skill,
            reason: `Added "${skill}" to resume`,
            section: 'Skills Section',
            timestamp: new Date().toISOString()
        };

        // Accumulate changes: fetch existing draft or finalized changes from Firestore and append new ones
        let existingChanges: any[] = [];
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
        const newChanges = [trackingEntry, ...aiChanges];

        // Filter out any new changes that identical to existing ones (by type and reason/skill)
        const uniqueNewChanges = newChanges.filter(nc =>
            !existingChanges.some(ec =>
                ec.type === nc.type &&
                (ec.reason === nc.reason || ec.skill === nc.skill)
            )
        );

        const allChanges = [...existingChanges, ...uniqueNewChanges];

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

        // Redundant sendPush removed to avoid duplicates (handled by trigger in notifications.ts)

    } catch (error: any) {
        console.error(`[AddSkill] Failed for ${resolvedTaskId}:`, error);
        await analysisTaskRef.update({
            status: "failed",
            error: error.message || "Skill addition failed"
        }).catch((e: any) => console.error(`[AddSkill] Failed to update status:`, e));
        throw error;
    }
}

async function processPrepGuide(task: any, taskRef: any, openai: any, db: any, perplexityKey: string) {
    const { applicationId, companyName, company, jobTitle, jobDescription, optimizedResume, matchedSkills, missingSkills } = task.payload;
    const resolvedCompany = companyName || company || 'Unknown Company';
    const userId = task.userId;
    const appRef = db.collection("user_applications").doc(applicationId);

    console.log(`[PrepGuide] Starting for ${resolvedCompany}(appId: ${applicationId})`);

    try {

        // Note: tokens are already deducted by the frontend before task creation
        // No need to deduct again here

        await appRef.update({
            "prepGuide.status": "generating",
            "prepGuide.startedAt": admin.firestore.FieldValue.serverTimestamp(),
            "prepGuide.progress": 2,
            "prepGuide.currentStep": "Researching company..."
        });

        const sections: Record<string, string> = {};
        const resumeContext = optimizedResume ? `\nCANDIDATE RESUME: \n${optimizedResume} ` : '';
        const skillsContext = matchedSkills?.length ? `\nMATCHED SKILLS: ${matchedSkills.join(', ')} ` : '';
        const missingContext = missingSkills?.length ? `\nSKILL GAPS: ${missingSkills.join(', ')} ` : '';

        // 1. Company Intelligence (Perplexity for real-time web research)
        sections.companyIntelligence = await callPerplexity(
            perplexityKey,
            "You are a company research analyst providing detailed, CURRENT information for interview preparation.",
            `Research ${resolvedCompany} for a ${jobTitle} candidate.Include: \n - Company mission, values, and culture\n - Key products / services and recent developments(last 90 days) \n - Competitive landscape\n - Interview process and culture\n - Recent news and announcements`,
            false
        );
        await appRef.update({ "prepGuide.progress": 15, "prepGuide.sections.companyIntelligence": sections.companyIntelligence });

        // 2. Role Analysis & Strategy
        await appRef.update({ "prepGuide.progress": 20, "prepGuide.currentStep": "Analyzing role requirements..." });
        sections.roleAnalysis = await callAiWithFallback(openai, perplexityKey, "You are an expert interview coach.",
            `Provide a detailed role analysis for ${jobTitle} at ${resolvedCompany}.\nJOB DESCRIPTION: ${jobDescription || "Not provided"} \n\nInclude: \n - Key responsibilities breakdown\n - Required vs nice - to - have qualifications\n - What the hiring manager is likely looking for\n - How this role fits within the organization\n - Career growth potential`,
            { maxTokens: 3000, jsonMode: false });
        await appRef.update({ "prepGuide.progress": 30, "prepGuide.sections.roleAnalysis": sections.roleAnalysis });

        // 3. Technical Preparation
        await appRef.update({ "prepGuide.progress": 35, "prepGuide.currentStep": "Building technical prep..." });
        sections.technicalPrep = await callAiWithFallback(openai, perplexityKey, "You are a senior technical interviewer.",
            `Create a technical preparation guide for ${jobTitle} at ${resolvedCompany}.\nJOB DESCRIPTION: ${jobDescription || "Not provided"}${skillsContext}${missingContext} \n\nInclude: \n - Core technical concepts to review\n - Likely coding / system design topics\n - Technical questions with sample answers\n - Hands - on exercises to practice\n - Common pitfalls to avoid`,
            { maxTokens: 4000, jsonMode: false });
        await appRef.update({ "prepGuide.progress": 45, "prepGuide.sections.technicalPrep": sections.technicalPrep });

        // 4. Behavioral Framework
        await appRef.update({ "prepGuide.progress": 50, "prepGuide.currentStep": "Crafting behavioral framework..." });
        sections.behavioralFramework = await callAiWithFallback(openai, perplexityKey, "You are an expert interview coach specializing in behavioral interviews.",
            `Create a behavioral interview framework for ${jobTitle} at ${resolvedCompany}.\nJOB DESCRIPTION: ${jobDescription || "Not provided"} \n\nInclude: \n - Top 10 likely behavioral questions with explanation of what interviewers look for\n - STAR method templates for each question\n - Tips for structuring compelling answers\n - Red flags to avoid\n - How to handle curveball questions`,
            { maxTokens: 4000, jsonMode: false });
        await appRef.update({ "prepGuide.progress": 60, "prepGuide.sections.behavioralFramework": sections.behavioralFramework });

        // 5. Story Mapping (personalized to candidate's resume)
        await appRef.update({ "prepGuide.progress": 65, "prepGuide.currentStep": "Mapping your stories..." });
        sections.storyMapping = await callAiWithFallback(openai, perplexityKey, "You are an expert interview coach. Create personalized story mappings from the candidate's actual experience.",
            `Map the candidate's resume experiences to likely interview questions for ${jobTitle} at ${resolvedCompany}.${resumeContext}\nJOB DESCRIPTION: ${jobDescription || "Not provided"}\n\nFor each major resume experience:\n- Identify 2-3 interview questions it could answer\n- Create a STAR outline (Situation, Task, Action, Result)\n- Highlight quantifiable achievements to emphasize\n- Suggest how to connect each story to the role's requirements`,
            { maxTokens: 4000, jsonMode: false });
        await appRef.update({ "prepGuide.progress": 75, "prepGuide.sections.storyMapping": sections.storyMapping });

        // 6. Questions to Ask
        await appRef.update({ "prepGuide.progress": 80, "prepGuide.currentStep": "Preparing strategic questions..." });
        sections.questionsToAsk = await callAiWithFallback(openai, perplexityKey, "You are a career strategist.",
            `Generate thoughtful questions for a ${jobTitle} candidate to ask during interviews at ${resolvedCompany}.\nJOB DESCRIPTION: ${jobDescription || "Not provided"} \n\nCategories: \n - Role - specific questions(day - to - day work, team structure) \n - Growth and development questions\n - Company culture and values questions\n - Technical / product questions showing genuine interest\n - Strategic questions that demonstrate business acumen\n\nFor each question, explain WHY it's impressive and what insight it provides.`,
            { maxTokens: 3000, jsonMode: false });
        await appRef.update({ "prepGuide.progress": 88, "prepGuide.sections.questionsToAsk": sections.questionsToAsk });

        // 7. Interview Day Strategy
        await appRef.update({ "prepGuide.progress": 90, "prepGuide.currentStep": "Creating interview strategy..." });
        sections.interviewStrategy = await callAiWithFallback(openai, perplexityKey, "You are an executive career coach.",
            `Create an interview day strategy guide for ${jobTitle} at ${resolvedCompany}.\n\nInclude:\n- Pre-interview preparation checklist (night before & morning of)\n- First impression tips specific to this company's culture\n- How to structure your opening pitch / \"Tell me about yourself\" (2 min max)\n- Salary negotiation preparation and market rate context\n- Follow-up strategy (thank you notes, timeline expectations)\n- Body language and communication tips\n- How to handle multi-round/panel interviews`,
            { maxTokens: 3000, jsonMode: false });
        await appRef.update({ "prepGuide.progress": 95, "prepGuide.sections.interviewStrategy": sections.interviewStrategy });

        // Finalize
        await appRef.update({
            "prepGuide.status": "completed",
            "prepGuide.progress": 100,
            "prepGuide.currentStep": "Complete",
            "prepGuide.generatedAt": admin.firestore.FieldValue.serverTimestamp(),
        });



        await taskRef.update({ result: { sections }, progress: 100 });

        // Send Push Notification directly - REMOVED (Handled by notifications.ts trigger)
        console.log(`[PrepGuide] Completed for userId: ${userId}`);

    } catch (error: any) {
        console.error(`[PrepGuide] Failed for ${applicationId}:`, error);
        await appRef.update({
            "prepGuide.status": "failed",
            "prepGuide.error": error.message || "Generation failed"
        }).catch((e: any) => console.error(`[PrepGuide] Failed to update status:`, e));
        throw error;
    }
}

async function processCoverLetter(task: any, taskRef: any, db: any, perplexityKey: string) {
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
        await deductTokens(
            userId,
            15,
            'cover_letter_generation',
            `Generated Cover Letter for ${company}`,
            applicationId,
            db,
            'perplexity'
        );

        const prompt = `Write a compelling cover letter for "${jobTitle}" at "${company}".
RESUME: ${JSON.stringify(resume, null, 2)}
JD: ${jobDescription || "Not provided"}`;

        const coverLetterText = await callPerplexity(
            perplexityKey,
            "Professional Executive Resume Writer. Output ONLY the letter text in markdown. No placeholders.",
            prompt,
            false
        );

        // Use set-merge to robustly update/create the completion state
        await appRef.set({
            coverLetter: {
                status: "completed",
                content: coverLetterText,
                completedAt: admin.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });

        await taskRef.update({ result: { content: coverLetterText }, progress: 100 });

        // Send Push Notification - REMOVED (Handled by notifications.ts trigger)

    } catch (error: any) {
        console.error(`[CoverLetter] Failed to generate for ${applicationId}:`, error);
        // Ensure the application reflects the failure
        await appRef.set({
            coverLetter: {
                status: "failed",
                error: error.message || "Generation failed"
            }
        }, { merge: true }).catch((e: any) => console.error(`[CoverLetter] Failed to update failure status for ${applicationId}:`, e));

        throw error; // Propagate to main handler to mark Task as failed
    }
}

async function processAnalyzeResume(task: any, taskRef: any, openai: any, db: any, perplexityKey: string) {
    const { jobUrl, jobText, jobTitle, jobCompany, resumeText, resumeFiles, jobHash, resumeHash } = task.payload;
    const userId = task.userId;

    const analysisTaskId = task.payload.analysisTaskId;
    const analysisTaskRef = analysisTaskId ? db.collection("analysis_tasks").doc(analysisTaskId) : null;

    // Extract relevant data from task.payload for clarity and potential server-side parsing
    // If the worker sent "formatted" data (even if raw), use that.
    const initialJob = task.payload.job || {
        title: jobTitle,
        company: jobCompany,
        description: jobText,
        url: jobUrl
    };

    const initialResume = task.payload.resume || {
        text: resumeText,
        files: resumeFiles
    };

    const requiresParsing = task.payload.requiresParsing || false; // Flag to indicate if server-side parsing is needed

    let finalJob = initialJob;
    let finalResume = initialResume;

    try {
        if (analysisTaskRef) {
            await analysisTaskRef.update({
                status: "processing",
                progress: 20,
                currentStep: "Analyzing resume in background...",
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        // 1. Validate & Parse Inputs (Server-Side)
        // If data came from "Fast Mode" client (requiresParsing=true), we need to structure it here.
        if (requiresParsing || (!initialJob.requirements && !initialJob.description) || !initialResume.experience) {
            console.log("[Background] Performing server-side AI parsing/structuring...");

            // Helper to add IDs if missing
            const addIds = (arr: any[]) => (arr || []).map(x => ({ ...x, id: x.id || Date.now() + Math.random().toString() }));

            // Parallelize the structuring
            const [structuredJob, structuredResume] = await Promise.all([
                (async () => {
                    const jobPrompt = `
Perform a COMPREHENSIVE, EXHAUSTIVE extraction of ALL requirements and information from this job description. Treat every sentence as potentially containing a requirement or keyword that an ATS system might scan for.

Job Description Text:
"""
${(initialJob.description || initialJob.text || jobText || '').substring(0, 15000)}
"""

Known Title: ${initialJob.title || jobTitle || ""}
Known Company: ${initialJob.company || jobCompany || ""}

EXHAUSTIVE EXTRACTION RULES:
1. READ EVERY SENTENCE: Requirements are often buried in the "About the Role," "Responsibilities," and "Who You Are" sections — not just the "Requirements" section. Scan the ENTIRE posting.
2. SKILL EXTRACTION: Extract every technology, tool, platform, framework, language, protocol, methodology, and concept mentioned. Include version numbers if specified (e.g., "Python 3.x", "Kubernetes 1.27+").
3. SOFT SKILLS & TRAITS: Extract leadership qualities, communication skills, collaboration expectations, and personality traits (e.g., "self-starter," "cross-functional collaboration," "executive communication").
4. EXPERIENCE REQUIREMENTS: Capture years of experience (overall and per-skill), industry-specific experience, team size managed, budget managed, and scope (e.g., "enterprise-scale," "Fortune 500").
5. EDUCATION & CERTS: Capture required and preferred degrees, fields of study, certifications, and clearances.
6. IMPLICIT REQUIREMENTS: If the role says "manage CI/CD pipelines," the implicit requirements include tools like Jenkins, GitLab CI, GitHub Actions, etc. Flag these as "implied" so they can be matched against.
7. RESPONSIBILITY-DERIVED SKILLS: For each listed responsibility, infer what skills are needed to perform it. List these as "impliedSkills."
8. KEYWORDS FOR ATS: Extract exact phrases and terminology that an ATS would likely scan for — preserve the employer's exact wording alongside normalized versions.
9. IMPORTANCE CLASSIFICATION for every requirement:
   - "critical": Explicitly stated as required, must-have, or minimum qualification
   - "high": Strongly emphasized, repeated multiple times, or in core responsibilities
   - "medium": Listed as preferred, nice-to-have, or "bonus"
   - "low": Implied by role context or industry norms but not explicitly stated
10. CATEGORIZATION for every skill:
   - "technical": Programming, tools, platforms, infrastructure
   - "domain": Industry knowledge, compliance, regulations
   - "methodology": Agile, DevOps, ITIL, frameworks
   - "soft_skill": Communication, leadership, collaboration
   - "certification": Specific certs or clearances
   - "experience": Years, scope, scale requirements

MISSING DATA RULES — THIS IS CRITICAL:
- If ANY field is not found in the job description, you MUST still include the key with a safe default value.
- Use "" (empty string) for missing text fields.
- Use [] (empty array) for missing list fields.
- Use {} (empty object) for missing object fields.
- Use 0 for missing numeric fields.
- NEVER omit a key from the JSON. Every key shown in the schema MUST be present in your response.
- If the JD doesn't specify education, return the education object with all empty strings.
- If the JD doesn't specify clearance, return "clearanceRequirements": [].
- If no nice-to-have skills are found, return "niceToHaveSkills": [].
- If title/company aren't in the JD, use the Known Title / Known Company provided. If those are also empty, use "".

Return this EXACT JSON structure (all keys mandatory):
{
  "title": "",
  "company": "",
  "location": "",
  "employmentType": "",
  "salaryRange": "",
  "description": "verbatim full job description text",
  "responsibilities": [],
  "requirements": {
    "mustHaveSkills": [
      {
        "name": "",
        "normalizedName": "",
        "importance": "critical",
        "category": "technical",
        "context": "",
        "synonyms": []
      }
    ],
    "niceToHaveSkills": [
      {
        "name": "",
        "normalizedName": "",
        "importance": "medium",
        "category": "",
        "context": "",
        "synonyms": []
      }
    ],
    "impliedSkills": [
      {
        "name": "",
        "derivedFrom": "",
        "importance": "low",
        "category": ""
      }
    ],
    "experienceRequirements": {
      "totalYears": "",
      "specificExperience": [
        {
          "skill": "",
          "years": "",
          "importance": ""
        }
      ],
      "industryExperience": [],
      "scaleExperience": ""
    },
    "educationRequirements": {
      "requiredDegree": "",
      "preferredDegree": "",
      "acceptableFields": [],
      "certifications": []
    },
    "clearanceRequirements": [],
    "keywords": []
  },
  "extractionMetadata": {
    "totalRequirementsExtracted": 0,
    "mustHaveCount": 0,
    "niceToHaveCount": 0,
    "impliedCount": 0,
    "totalUniqueKeywords": 0
  }
}
                    `;
                    try {
                        const res = await callAiWithFallback(openai, perplexityKey, "You are a job parser.", jobPrompt, { maxTokens: 2000, jsonMode: true });
                        const extracted = extractJson(res);
                        const parsed = JSON.parse(extracted);
                        return { ...initialJob, ...parsed, id: initialJob.id || Date.now().toString(), parsedAt: new Date() };
                    } catch (e) {
                        console.error("Job parsing failed", e);
                        return initialJob;
                    }
                })(),
                (async () => {
                    // TRUSTED CLIENT DATA BYPASS: If client sent structured data (even if experience is empty but present), use it directly.
                    // Relaxed check: We trust parsedResumeData from client.
                    if (initialResume && typeof initialResume === 'object' && Array.isArray(initialResume.experience)) {
                        console.log("[Background] Using trusted client-side parsed resume data. Skipping AI re-parsing.");
                        return initialResume;
                    }

                    const systemInstruction = `You are an expert resume parser. Extract structured information from the provided resume text.
If multiple pages (images) are provided, combine the information intelligently.

Extract and return JSON with the following structure:
{
  "contactInfo": {
    "name": "full name",
    "email": "email",
    "phone": "phone number",
    "location": "city, state",
    "linkedin": "linkedin URL",
    "portfolio": "portfolio URL",
    "github": "github URL"
  },
  "summary": "professional summary if present",
  "experience": [
    {
      "company": "company name",
      "title": "job title",
      "location": "city, state",
      "startDate": "MM/YYYY",
      "endDate": "MM/YYYY or null if current",
      "current": true|false,
      "bullets": ["bullet point 1", "bullet point 2"]
    }
  ],
  "education": [
    {
      "institution": "school name",
      "degree": "degree type",
      "field": "field of study",
      "startDate": "YYYY",
      "endDate": "YYYY",
      "gpa": "GPA if mentioned"
    }
  ],
  "skills": [
    {
      "name": "skill name",
      "category": "technical|soft|language|tool|framework",
      "proficiency": "beginner|intermediate|advanced|expert (infer from context)"
    }
  ],
  "certifications": [
    {
      "name": "certification name",
      "issuer": "issuing organization",
      "date": "MM/YYYY"
    }
  ],
  "projects": [
    {
      "name": "project name",
      "description": "brief description",
      "technologies": ["tech1", "tech2"],
      "url": "project URL if available"
    }
  ]
}

Guidelines:
- Extract ALL information present. Do not summarize or truncate bullets.
- Infer skill proficiency from experience context if not explicit.
- Standardize date formats to MM/YYYY or YYYY.
- Clean up bullet points (remove extra symbols like • or -).
- Categorize skills accurately.
- If a section is missing, return an empty array for lists or empty string for text fields.`;

                    const userContent = `Resume Content:\n${(initialResume.text || resumeText || '').substring(0, 15000)}`;

                    try {
                        const res = await callAiWithFallback(openai, perplexityKey, systemInstruction, userContent, { maxTokens: 4000, jsonMode: true });
                        const parsed = JSON.parse(res.replace(/```json/g, '').replace(/```/g, '').trim());
                        return { ...initialResume, ...parsed, experience: addIds(parsed.experience), education: addIds(parsed.education) };
                    } catch (e) {
                        console.error("Resume parsing failed", e);
                        return initialResume;
                    }
                })()
            ]);

            finalJob = structuredJob;
            finalResume = structuredResume;
            console.log("[Background] Server-side parsing complete.");
        }

        if (analysisTaskRef) {
            await analysisTaskRef.update({ progress: 50, currentStep: "Performing Gap Analysis..." });
        }


        // --- LOGIC REUSED FROM gapAnalysis.ts ---
        const systemInstruction = `
You are an expert career advisor and ATS specialist. Analyze if this candidate is ready to apply for this job.
Perform a comprehensive, exhaustive analysis and return a JSON object with matchAnalysis and gaps.

IMPORTANT RULES:
- Read the FULL job description. Identify ALL skills, tools, technologies, frameworks, methodologies, certifications, and soft skills.
- Every identified requirement MUST be categorized into: matchedSkills, partialMatches, or missingSkills.
- For partialMatches, identify transferable/adjacent skills.
- The total count across matchedSkills + partialMatches + missingSkills MUST account for EVERY requirement.

Return JSON with this EXACT structure:
{
  "matchAnalysis": {
    "matchedSkills": [{ "skill": "name", "importance": "critical|high|medium|low", "confidence": 0-100 }],
    "partialMatches": [{ "skill": "name", "importance": "critical|high|medium|low", "confidence": 0-100, "candidateSkill": "what they have", "transferability": "how it transfers" }],
    "missingSkills": [{ "skill": "name", "importance": "critical|high|medium|low", "confidence": 0-100 }],
    "keywordDensity": 0-100,
    "experienceMatch": { "match": 0-100 }
  },
  "gaps": {
    "criticalGaps": [{ "skill": "name", "importance": "critical", "hasTransferable": boolean }],
    "minorGaps": [{ "skill": "name", "importance": "medium", "hasTransferable": boolean }],
    "totalGapScore": 0-100
  }
}`.trim();

        const userContent = `
CANDIDATE RESUME:
${JSON.stringify(finalResume, null, 2)}

JOB POSTING:
Title: ${finalJob.title}
Company: ${finalJob.company}

FULL JOB DESCRIPTION:
${finalJob.description || ''}
`.trim();

        const aiResult = await callAiWithFallback(
            openai,
            perplexityKey,
            systemInstruction,
            userContent,
            { maxTokens: 4096 }
        );

        let analysisResult;
        try {
            const cleaned = aiResult.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
            const firstBrace = cleaned.indexOf('{');
            const lastBrace = cleaned.lastIndexOf('}');
            let jsonStr = cleaned;
            if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
            }
            analysisResult = JSON.parse(jsonStr);
        } catch (e) {
            throw new Error("AI returned invalid JSON for analysis.");
        }

        // Normalize
        const matchAnalysis: MatchAnalysis = {
            matchedSkills: Array.isArray(analysisResult.matchAnalysis?.matchedSkills) ? analysisResult.matchAnalysis.matchedSkills : [],
            partialMatches: Array.isArray(analysisResult.matchAnalysis?.partialMatches) ? analysisResult.matchAnalysis.partialMatches : [],
            missingSkills: Array.isArray(analysisResult.matchAnalysis?.missingSkills) ? analysisResult.matchAnalysis.missingSkills : [],
            keywordDensity: analysisResult.matchAnalysis?.keywordDensity || 0,
            experienceMatch: analysisResult.matchAnalysis?.experienceMatch || { match: 0 },
        };

        const gaps = {
            criticalGaps: Array.isArray(analysisResult.gaps?.criticalGaps) ? analysisResult.gaps.criticalGaps : [],
            minorGaps: Array.isArray(analysisResult.gaps?.minorGaps) ? analysisResult.gaps.minorGaps : [],
            totalGapScore: analysisResult.gaps?.totalGapScore || 0,
        };

        const atsScore = calculateATSScore(matchAnalysis);
        // --- END LOGIC ---

        if (analysisTaskRef) {
            await analysisTaskRef.update({ progress: 90, currentStep: "Saving results..." });
        }

        // Save to History (User Analyses)
        // We'll reproduce `historyService.saveAnalysis` logic here directly to ensure server-side safety
        const savedAnalysisData = {
            userId,
            jobData: finalJob,
            resumeData: finalResume,
            // Top-level fields required for List Views and easy access
            jobTitle: finalJob.title,
            company: finalJob.company,
            atsScore: atsScore,
            action: analysisResult?.recommendation?.action || 'optimize',
            analysisData: {
                matchAnalysis,
                gaps,
                atsScore,
                recommendation: analysisResult?.recommendation // Ensure recommendation is saved
            },
            jobHash,
            resumeHash,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(), // Ensure updatedAt is set
            isLatest: true,
            type: 'gap_analysis'
        };

        console.log("[Background] Saving Analysis Data - Resume Keys:", Object.keys(finalResume || {}));
        if (finalResume && finalResume.experience) {
            console.log("[Background] Saving Experience Count:", finalResume.experience.length);
        } else {
            console.error("[Background] WARNING: Saving EMPTY experience/resume data!");
        }

        const historyRef = await db.collection("user_analyses").add(savedAnalysisData);
        const savedId = historyRef.id;

        // Finalize Analysis Task
        if (analysisTaskRef) {
            await analysisTaskRef.update({
                status: "completed",
                progress: 100,
                currentStep: "Analysis Complete",
                resultId: savedId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }

        // Complete Background Task
        await taskRef.update({
            result: { savedId, atsScore },
            progress: 100
        });

        // Send Push Notification - REMOVED (Handled by onBackgroundTaskUpdated trigger in notifications.ts)
        // Centralizing all push in the Firestore trigger prevents duplicate notifications.

    } catch (error: any) {
        console.error(`[AnalyzeResume] Failed:`, error);
        if (analysisTaskRef) {
            await analysisTaskRef.update({
                status: "failed",
                error: error.message || "Analysis failed"
            }).catch(() => { });
        }
        throw error;
    }
}
