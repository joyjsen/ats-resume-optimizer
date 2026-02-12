"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performGapAnalysis = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const openai_1 = require("openai");
const aiUtils_1 = require("../utils/aiUtils");
/**
 * Determine if user is ready to apply
 */
function determineReadiness(atsScore, gaps) {
    const criticalGaps = gaps.criticalGaps || [];
    const hasFewCriticalGaps = criticalGaps.length <= 5;
    const meetsMinimumScore = atsScore > 40;
    return meetsMinimumScore || hasFewCriticalGaps;
}
const performGapAnalysis = (openaiApiKey, perplexityApiKey) => (0, https_1.onCall)({
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [openaiApiKey, perplexityApiKey],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in to perform analysis.");
    }
    const { taskId, resume, job } = request.data;
    if (!taskId || !resume || !job) {
        throw new https_1.HttpsError("invalid-argument", "taskId, resume, and job are required.");
    }
    const db = admin.firestore();
    const taskRef = db.collection("analysis_tasks").doc(taskId);
    try {
        await taskRef.update({
            status: "processing",
            progress: 50,
            currentStep: "Analyzing fit (server-side)...",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const openai = new openai_1.default({
            apiKey: openaiApiKey.value(),
            maxRetries: 2,
            timeout: 30000,
        });
        const systemInstruction = `
You are an expert career advisor and ATS specialist. Analyze if this candidate is ready to apply for this job.
Perform a comprehensive, exhaustive analysis and return a JSON object with matchAnalysis and gaps.

IMPORTANT RULES:
- Read the FULL job description, not just structured requirements. Identify ALL skills, tools, technologies, frameworks, methodologies, certifications, and soft skills mentioned anywhere.
- Every identified requirement MUST be categorized into exactly one of: matchedSkills, partialMatches, or missingSkills.
- For partialMatches, identify transferable/adjacent skills the candidate has.
- Do NOT stop listing skills early. Include ALL skills even if the list is long.
- The total count across matchedSkills + partialMatches + missingSkills MUST account for EVERY requirement in the JD.

Importance Classification:
- critical: Explicitly "required" or "must-have" or in minimum qualifications
- high: Strongly emphasized, mentioned multiple times
- medium: "preferred", "nice-to-have", mentioned once
- low: Implied by role context

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
${JSON.stringify(resume, null, 2)}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}

FULL JOB DESCRIPTION (Analyze this for ALL requirements/skills):
${job.description || ''}

STRUCTURED REQUIREMENTS (Reference):
${JSON.stringify(job.requirements, null, 2)}

Provide the COMPLETE analysis JSON. List EVERY skill from the job description.`.trim();
        const aiResult = await (0, aiUtils_1.callAiWithFallback)(openai, perplexityApiKey.value(), systemInstruction, userContent, { maxTokens: 4096 });
        const analysisResult = JSON.parse(aiResult);
        // Normalize results
        const matchAnalysis = {
            matchedSkills: Array.isArray(analysisResult.matchAnalysis?.matchedSkills)
                ? analysisResult.matchAnalysis.matchedSkills : [],
            partialMatches: Array.isArray(analysisResult.matchAnalysis?.partialMatches)
                ? analysisResult.matchAnalysis.partialMatches : [],
            missingSkills: Array.isArray(analysisResult.matchAnalysis?.missingSkills)
                ? analysisResult.matchAnalysis.missingSkills : [],
            keywordDensity: analysisResult.matchAnalysis?.keywordDensity || 0,
            experienceMatch: analysisResult.matchAnalysis?.experienceMatch || { match: 0 },
        };
        const gaps = {
            criticalGaps: Array.isArray(analysisResult.gaps?.criticalGaps)
                ? analysisResult.gaps.criticalGaps : [],
            minorGaps: Array.isArray(analysisResult.gaps?.minorGaps)
                ? analysisResult.gaps.minorGaps : [],
            totalGapScore: analysisResult.gaps?.totalGapScore || 0,
        };
        const atsScore = (0, aiUtils_1.calculateATSScore)(matchAnalysis);
        const readyToApply = determineReadiness(atsScore, gaps);
        await taskRef.update({
            progress: 80,
            currentStep: "Analysis complete",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
            success: true,
            matchAnalysis,
            gaps,
            atsScore,
            readyToApply,
        };
    }
    catch (error) {
        console.error(`[GapAnalysis] Failed for task ${taskId}:`, error);
        await taskRef.update({
            status: "failed",
            error: error.message || "Analysis failed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(console.error);
        throw new https_1.HttpsError("internal", error.message || "Failed to perform gap analysis.");
    }
});
exports.performGapAnalysis = performGapAnalysis;
//# sourceMappingURL=gapAnalysis.js.map