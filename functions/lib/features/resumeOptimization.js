"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addSkillToResume = exports.optimizeResume = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const openai_1 = require("openai");
const aiUtils_1 = require("../utils/aiUtils");
/**
 * Cloud Function: Optimize Resume
 */
const optimizeResume = (openaiApiKey, perplexityApiKey) => (0, https_1.onCall)({
    region: "us-central1",
    timeoutSeconds: 180,
    memory: "1GiB",
    secrets: [openaiApiKey, perplexityApiKey],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in.");
    }
    const { taskId, resume, job, analysis } = request.data;
    if (!taskId || !resume || !job || !analysis) {
        throw new https_1.HttpsError("invalid-argument", "taskId, resume, job, and analysis are required.");
    }
    const db = admin.firestore();
    const taskRef = db.collection("analysis_tasks").doc(taskId);
    try {
        await taskRef.update({
            status: "processing",
            progress: 30,
            currentStep: "Optimizing resume (server-side)...",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const openai = new openai_1.default({
            apiKey: openaiApiKey.value(),
            maxRetries: 2,
            timeout: 90000,
        });
        const systemInstruction = `
You are an expert RiResume engine. Optimize the provided resume for the target job while maintaining truthfulness.
Return a JSON object with properties 'optimizedResume' (structure matching original) and 'changes' (array of change objects).
Aim for an ATS score of 85-95%.`.trim();
        const userContent = `
You are an expert Executive Resume Writer. Optimize this resume for the target job while maintaining truthfulness.
Your mandate is to REWRITE the content to be more professional, impactful, and ATS-optimized.

CRITICAL: DO NOT BE CONCISE. The user wants a detailed, comprehensive resume.

ORIGINAL RESUME:
${JSON.stringify(resume, null, 2)}

TARGET JOB:
${JSON.stringify({ title: job.title, company: job.company, requirements: job.requirements }, null, 2)}

ANALYSIS INSIGHTS:
Missing Keywords: ${analysis.matchAnalysis?.missingSkills?.map((s) => s.skill).join(', ') || 'None'}
Current ATS Score: ${analysis.atsScore}%

Return JSON:
{
  "optimizedResume": { ... },
  "changes": [{ "type": "...", "reason": "..." }]
}`.trim();
        const aiResult = await (0, aiUtils_1.callAiWithFallback)(openai, perplexityApiKey.value(), systemInstruction, userContent, { maxTokens: 10000 });
        const result = JSON.parse(aiResult);
        await taskRef.update({
            progress: 90,
            currentStep: "Optimization complete",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
            success: true,
            optimizedResume: result.optimizedResume,
            changes: result.changes || [],
        };
    }
    catch (error) {
        console.error(`[optimizeResume] Failed:`, error);
        await taskRef.update({
            status: "failed",
            error: error.message || "Optimization failed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(console.error);
        throw new https_1.HttpsError("internal", error.message || "Failed to optimize resume.");
    }
});
exports.optimizeResume = optimizeResume;
/**
 * Cloud Function: Add Skill to Resume
 */
const addSkillToResume = (openaiApiKey, perplexityApiKey) => (0, https_1.onCall)({
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [openaiApiKey, perplexityApiKey],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in.");
    }
    const { taskId, resume, skill, targetSections } = request.data;
    if (!taskId || !resume || !skill || !targetSections) {
        throw new https_1.HttpsError("invalid-argument", "taskId, resume, skill, and targetSections are required.");
    }
    const db = admin.firestore();
    const taskRef = db.collection("analysis_tasks").doc(taskId);
    try {
        await taskRef.update({
            status: "processing",
            progress: 30,
            currentStep: `Adding skill "${skill}" (server-side)...`,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const openai = new openai_1.default({
            apiKey: openaiApiKey.value(),
            maxRetries: 2,
            timeout: 60000,
        });
        const systemInstruction = `
You are an expert Resume Editor. Your task is to surgically add a specific skill to a resume in the requested sections.
Return a JSON object with 'optimizedResume' and 'changes'.`.trim();
        const prompt = `
TASK: Add the skill "${skill}" to the following sections: ${targetSections.join(', ')}.

RESUME:
${JSON.stringify(resume, null, 2)}

INSTRUCTIONS:
1. Contextual Integration: Do not just append keywords. Write natural, impactful sentences or bullet points.
2. Professional Summary: If selected, rewrite the summary to naturally include "${skill}".
3. Experience: If a specific role ID is selected, find that role and ADD a new bullet point that demonstrates usage of "${skill}".
4. Skills Section: If selected, ensure "${skill}" is present in the skills list.

OUTPUT JSON:
{
  "optimizedResume": { ... },
  "changes": [
    { "type": "skill_addition", "skill": "${skill}", "reason": "..." }
  ]
}`.trim();
        const aiResult = await (0, aiUtils_1.callAiWithFallback)(openai, perplexityApiKey.value(), systemInstruction, prompt);
        const result = JSON.parse(aiResult);
        await taskRef.update({
            progress: 90,
            currentStep: "Skill addition complete",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
            success: true,
            optimizedResume: result.optimizedResume,
            changes: result.changes || [],
        };
    }
    catch (error) {
        console.error(`[addSkillToResume] Failed:`, error);
        await taskRef.update({
            status: "failed",
            error: error.message || "Skill addition failed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(console.error);
        throw new https_1.HttpsError("internal", error.message || "Failed to add skill.");
    }
});
exports.addSkillToResume = addSkillToResume;
//# sourceMappingURL=resumeOptimization.js.map