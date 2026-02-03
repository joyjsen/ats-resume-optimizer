"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTrainingSlideshow = exports.onBackgroundTaskCreated = exports.generateCoverLetter = exports.generatePrepGuide = exports.addSkillToResume = exports.optimizeResume = exports.generateRecommendation = exports.performGapAnalysis = void 0;
const https_1 = require("firebase-functions/v2/https");
const firestore_1 = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const params_1 = require("firebase-functions/params");
const openai_1 = require("openai");
const axios_1 = require("axios");
// Define secrets for API keys
const openaiApiKey = (0, params_1.defineSecret)("OPENAI_API_KEY");
const perplexityApiKey = (0, params_1.defineSecret)("PERPLEXITY_API_KEY");
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
/**
 * Check if an analysis task document exists
 */
async function checkTaskExists(taskId, db) {
    const doc = await db.collection("analysis_tasks").doc(taskId).get();
    return doc.exists;
}
/**
 * Call Perplexity API as fallback
 */
async function callPerplexity(perplexityKey, systemContent, userContent, returnJson = true) {
    console.log("[AI Fallback] Calling Perplexity...");
    // Only add JSON instruction when needed (for structured data parsing)
    const finalUserContent = returnJson
        ? userContent + "\n\nIMPORTANT: Return ONLY valid JSON."
        : userContent + "\n\nFormat your response as clear, well-structured markdown with headings and bullet points.";
    const response = await axios_1.default.post(PERPLEXITY_API_URL, {
        model: "sonar-pro",
        messages: [
            { role: "system", content: systemContent },
            { role: "user", content: finalUserContent }
        ],
        temperature: 0.3,
        max_tokens: 4000,
    }, {
        headers: {
            "Authorization": `Bearer ${perplexityKey}`,
            "Content-Type": "application/json"
        },
        timeout: 60000,
    });
    const content = response.data.choices[0]?.message?.content;
    if (!content)
        throw new Error("No content from Perplexity");
    return content.trim();
}
/**
 * Calculate ATS score from match analysis
 */
function calculateATSScore(matchAnalysis) {
    const weights = {
        matchedSkills: 0.5,
        keywordDensity: 0.2,
        experienceMatch: 0.2,
    };
    const matchedSkills = matchAnalysis.matchedSkills || [];
    const partialMatches = matchAnalysis.partialMatches || [];
    const missingSkills = matchAnalysis.missingSkills || [];
    const importantMatched = matchedSkills.filter(s => s.importance === "critical" || s.importance === "high").length;
    const importantPartial = partialMatches.filter(s => s.importance === "critical" || s.importance === "high").length;
    const importantMissing = missingSkills.filter(s => s.importance === "critical" || s.importance === "high").length;
    const totalImportant = importantMatched + importantPartial + importantMissing;
    const skillMatchScore = totalImportant > 0
        ? ((importantMatched * 1.0 + importantPartial * 0.5) / totalImportant) * 100
        : 0;
    const score = (skillMatchScore * weights.matchedSkills) +
        ((matchAnalysis.keywordDensity || 0) * weights.keywordDensity) +
        ((matchAnalysis.experienceMatch?.match || 0) * weights.experienceMatch);
    return Math.round(Math.min(100, Math.max(0, score)));
}
/**
 * Determine if user is ready to apply
 */
function determineReadiness(atsScore, gaps) {
    const criticalGaps = gaps.criticalGaps || [];
    const hasFewCriticalGaps = criticalGaps.length <= 5;
    const meetsMinimumScore = atsScore > 40;
    return meetsMinimumScore || hasFewCriticalGaps;
}
/**
 * Helper: Transactional token deduction and activity logging
 */
async function deductTokens(userId, cost, type, description, resourceId, db) {
    console.log(`[deductTokens] START: ${userId} requesting -${cost} for ${type} (${resourceId})`);
    try {
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection("users").doc(userId);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists) {
                console.error(`[deductTokens] FAILED: User profile not found for ${userId}`);
                throw new Error("User profile not found for token deduction");
            }
            const userData = userSnap.data();
            const currentBalance = userData?.tokenBalance || 0;
            console.log(`[deductTokens] Current balance for ${userId}: ${currentBalance}`);
            if (currentBalance < cost) {
                console.error(`[deductTokens] FAILED: Insufficient tokens for ${userId}. Balance: ${currentBalance}, Cost: ${cost}`);
                throw new Error(`Insufficient tokens. Balance: ${currentBalance}, Required: ${cost}`);
            }
            const newBalance = currentBalance - cost;
            // 1. Update Balance
            transaction.update(userRef, {
                tokenBalance: newBalance,
                totalTokensUsed: (userData?.totalTokensUsed || 0) + cost,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            // 2. Log Activity
            const activityRef = db.collection("activities").doc();
            transaction.set(activityRef, {
                userId,
                uid: userId,
                type,
                description,
                resourceId,
                tokensUsed: cost,
                tokenBalance: newBalance,
                status: "completed",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`[deductTokens] SUCCESS: ${userId} new balance: ${newBalance}`);
        });
    }
    catch (error) {
        console.error(`[deductTokens] TRANSACTION ERROR for ${userId}:`, error.message);
        throw error; // Rethrow to fail the Cloud Function
    }
}
/**
 * Cloud Function: Perform AI Gap Analysis
 * This runs server-side so it won't be interrupted when the app is backgrounded
 */
exports.performGapAnalysis = (0, https_1.onCall)({
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [openaiApiKey, perplexityApiKey],
}, async (request) => {
    // 1. Authenticate user
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in to perform analysis.");
    }
    const { taskId, resume, job } = request.data;
    if (!taskId || !resume || !job) {
        throw new https_1.HttpsError("invalid-argument", "taskId, resume, and job are required.");
    }
    const db = admin.firestore();
    // Note: Token deduction now handled at task start in analyze.tsx
    const taskRef = db.collection("analysis_tasks").doc(taskId);
    try {
        // Update task status
        await taskRef.update({
            status: "processing",
            progress: 50,
            currentStep: "Analyzing fit (server-side)...",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[GapAnalysis] Starting for task ${taskId}`);
        // Initialize OpenAI
        const openai = new openai_1.default({
            apiKey: openaiApiKey.value(),
            maxRetries: 2,
            timeout: 30000,
        });
        const systemInstruction = `
You are an expert career advisor and ATS specialist. Analyze if this candidate is ready to apply for this job.
Perform a comprehensive analysis and return a JSON object with matchAnalysis and gaps.

Return JSON with this EXACT structure:
{
  "matchAnalysis": {
    "matchedSkills": [{ "skill": "name", "importance": "critical|high|medium|low", "confidence": 0-100 }],
    "partialMatches": [{ "skill": "name", "importance": "critical|high", "confidence": 0-100 }],
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
Requirements: ${JSON.stringify(job.requirements, null, 2)}

Provide the analysis JSON.`.trim();
        let analysisResult;
        try {
            // Try OpenAI first
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: userContent }
                ],
                response_format: { type: "json_object" },
                max_tokens: 2000,
            });
            const content = response.choices[0].message.content;
            if (!content)
                throw new Error("No content from OpenAI");
            analysisResult = JSON.parse(content);
        }
        catch (openaiError) {
            console.warn(`[GapAnalysis] OpenAI failed: ${openaiError.message}, trying Perplexity...`);
            // Fallback to Perplexity
            const perplexityResult = await callPerplexity(perplexityApiKey.value(), systemInstruction, userContent);
            // Clean up markdown if present
            const cleanContent = perplexityResult
                .replace(/```json\s*/gi, "")
                .replace(/```\s*/g, "")
                .trim();
            analysisResult = JSON.parse(cleanContent);
        }
        // Ensure nested objects exist
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
        // Calculate ATS score and readiness
        const atsScore = calculateATSScore(matchAnalysis);
        const readyToApply = determineReadiness(atsScore, gaps);
        console.log(`[GapAnalysis] Complete. Score: ${atsScore}, Ready: ${readyToApply}`);
        // Update task with results
        await taskRef.update({
            progress: 80,
            currentStep: "Analysis complete",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Return the analysis result
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
        // Update task with error
        await taskRef.update({
            status: "failed",
            error: error.message || "Analysis failed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(console.error);
        throw new https_1.HttpsError("internal", error.message || "Failed to perform gap analysis.");
    }
});
/**
 * Cloud Function: Generate Recommendation (for non-ready users)
 * Generates upskill path and alternative jobs
 */
exports.generateRecommendation = (0, https_1.onCall)({
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [openaiApiKey, perplexityApiKey],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in.");
    }
    const { resume, job, gaps } = request.data;
    if (!resume || !job || !gaps) {
        throw new https_1.HttpsError("invalid-argument", "resume, job, and gaps are required.");
    }
    const openai = new openai_1.default({
        apiKey: openaiApiKey.value(),
        maxRetries: 2,
        timeout: 30000,
    });
    try {
        // Run upskill path and alternative jobs in parallel
        const [upskillPath, alternativeJobs] = await Promise.all([
            generateUpskillPath(openai, perplexityApiKey.value(), resume, job, gaps),
            findAlternativeJobs(openai, perplexityApiKey.value(), resume, job)
        ]);
        return {
            success: true,
            upskillPath,
            alternativeJobs,
        };
    }
    catch (error) {
        console.error("[generateRecommendation] Failed:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to generate recommendation.");
    }
});
async function generateUpskillPath(openai, perplexityKey, resume, job, gaps) {
    const allGaps = [...(gaps.criticalGaps || []), ...(gaps.minorGaps || [])];
    const prompt = `
Create a personalized learning path for this candidate.

Candidate's Current Skills: ${resume.skills?.map((s) => s.name).join(", ") || "Not specified"}
Skill Gaps: ${JSON.stringify(allGaps, null, 2)}
Target Job: ${job.title} at ${job.company}

Return JSON:
{
  "totalDuration": "total estimated time",
  "priority": 1-5,
  "skills": [
    {
      "skill": "skill name",
      "priority": 1-5,
      "estimatedTime": "learning duration",
      "courses": [{ "platform": "name", "name": "course", "duration": "time", "cost": "free or number" }],
      "projectIdeas": ["project 1", "project 2"]
    }
  ]
}`.trim();
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_tokens: 2500,
        });
        const content = response.choices[0].message.content;
        if (!content)
            throw new Error("No content");
        return JSON.parse(content);
    }
    catch (error) {
        console.warn("[generateUpskillPath] OpenAI failed, trying Perplexity...");
        const result = await callPerplexity(perplexityKey, "You are a career advisor.", prompt);
        const clean = result.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        return JSON.parse(clean);
    }
}
async function findAlternativeJobs(openai, perplexityKey, resume, job) {
    const prompt = `
Suggest 3-5 alternative job titles that would be a better fit than "${job.title}".

Resume Skills: ${resume.skills?.map((s) => s.name).join(", ") || "Not specified"}
Experience: ${resume.experience?.length || 0} positions
Original Job: ${job.title}

Return JSON:
{
  "alternatives": [
    { "title": "job title", "estimatedScore": 75-95, "reason": "why this fits" }
  ]
}`.trim();
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
            max_tokens: 500,
        });
        const content = response.choices[0].message.content;
        if (!content)
            return [];
        const result = JSON.parse(content);
        return result.alternatives || [];
    }
    catch (error) {
        console.warn("[findAlternativeJobs] OpenAI failed, trying Perplexity...");
        const result = await callPerplexity(perplexityKey, "You are a career advisor.", prompt);
        const clean = result.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        const parsed = JSON.parse(clean);
        return parsed.alternatives || [];
    }
}
// ============================================================================
// RESUME OPTIMIZATION CLOUD FUNCTION
// ============================================================================
/**
 * Cloud Function: Optimize Resume
 * Runs server-side so it won't be interrupted when app is backgrounded
 */
exports.optimizeResume = (0, https_1.onCall)({
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
        console.log(`[optimizeResume] Starting for task ${taskId}`);
        const openai = new openai_1.default({
            apiKey: openaiApiKey.value(),
            maxRetries: 2,
            timeout: 90000,
        });
        const systemInstruction = `
You are an expert RiResume engine. Optimize the provided resume for the target job while maintaining truthfulness.
Return a JSON object with properties 'optimizedResume' (structure matching original) and 'changes' (array of change objects).
Aim for an ATS score of 85-95%.
            `.trim();
        const userContent = `
You are an expert Executive Resume Writer. Optimize this resume for the target job while maintaining truthfulness.
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
Missing Keywords: ${analysis.matchAnalysis?.missingSkills?.map((s) => s.skill).join(', ') || 'None'}
Current ATS Score: ${analysis.atsScore}%

OPTIMIZATION INSTRUCTIONS:
1. **Professional Summary**: WRITE A COMPLETELY NEW summary. It must be 3-4 lines, punchy, include key achievements.
2. **Experience Section (CRITICAL)**:
   - For EACH and EVERY role, rewrite the bullet points.
   - **EXPAND** on them. Do not simplify.
   - Transform passive responsibilities into active achievements.
   - INTEGRATE missing keywords naturally.
   - Use strong power verbs.
3. **Skills**: Reorder and categorize them to match job description priorities.
4. **General**: Correction of grammar, tone, and clarity is required.

STRICT RULES:
- DO NOT add skills or experiences the user clearly doesn't have.
- DO NOT be brief or concise. Detail is preferred.
- DO rephrase existing experience to sound more impressive and relevant.
- DO generate a "changes" list that explains EXACTLY what you did.

Return JSON:
{
  "optimizedResume": { ... },
  "changes": [
    { "type": "summary_rewrite", "reason": "..." },
    { "type": "experience_improvement", "reason": "..." }
  ]
}
            `.trim();
        let result;
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: userContent }
                ],
                response_format: { type: "json_object" },
                max_tokens: 10000,
            });
            const content = response.choices[0].message.content;
            if (!content)
                throw new Error("No content from OpenAI");
            result = JSON.parse(content);
        }
        catch (openaiError) {
            console.warn(`[optimizeResume] OpenAI failed: ${openaiError.message}, trying Perplexity...`);
            const perplexityResult = await callPerplexity(perplexityApiKey.value(), systemInstruction, userContent);
            const cleanContent = perplexityResult
                .replace(/```json\s*/gi, "")
                .replace(/```\s*/g, "")
                .trim();
            result = JSON.parse(cleanContent);
        }
        console.log(`[optimizeResume] Complete for task ${taskId}`);
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
        console.error(`[optimizeResume] Failed for task ${taskId}:`, error);
        await taskRef.update({
            status: "failed",
            error: error.message || "Optimization failed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(console.error);
        throw new https_1.HttpsError("internal", error.message || "Failed to optimize resume.");
    }
});
// ============================================================================
// ADD SKILL CLOUD FUNCTION
// ============================================================================
/**
 * Cloud Function: Add Skill to Resume
 */
exports.addSkillToResume = (0, https_1.onCall)({
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
        console.log(`[addSkillToResume] Starting for task ${taskId}, skill: ${skill}`);
        const openai = new openai_1.default({
            apiKey: openaiApiKey.value(),
            maxRetries: 2,
            timeout: 60000,
        });
        const systemInstruction = `
You are an expert Resume Editor. Your task is to surgically add a specific skill to a resume in the requested sections.
Return a JSON object with 'optimizedResume' and 'changes'.
            `.trim();
        const prompt = `
TASK: Add the skill "${skill}" to the following sections: ${targetSections.join(', ')}.

RESUME:
${JSON.stringify(resume, null, 2)}

INSTRUCTIONS:
1. **Contextual Integration**: Do not just append keywords. Write natural, impactful sentences or bullet points.
2. **Professional Summary**: If selected, rewrite the summary to naturally include "${skill}".
3. **Experience**: If a specific role ID is selected (e.g. "experience_[ID]"), find that role and ADD a new bullet point that demonstrates usage of "${skill}".
    - Make up a plausible achievement based on the role title and the skill.
    - E.g. If adding "Python" to "Data Analyst", add: "Leveraged Python scripts to automate data cleaning..."
4. **Skills Section**: If selected, ensure "${skill}" is present in the skills list.
5. **Preserve Integrity**: Do NOT remove existing content unless necessary for flow in the summary. For experience, append the new bullet.

OUTPUT JSON:
{
  "optimizedResume": { ... },
  "changes": [
    {
      "type": "skill_addition",
      "skill": "${skill}",
      "reason": "Added '${skill}' to [Section Name]..."
    }
  ]
}
            `.trim();
        let result;
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemInstruction },
                    { role: "user", content: prompt }
                ],
                response_format: { type: "json_object" },
            });
            const content = response.choices[0].message.content;
            if (!content)
                throw new Error("No content from OpenAI");
            result = JSON.parse(content);
        }
        catch (openaiError) {
            console.warn(`[addSkillToResume] OpenAI failed: ${openaiError.message}, trying Perplexity...`);
            const perplexityResult = await callPerplexity(perplexityApiKey.value(), systemInstruction, prompt);
            const cleanContent = perplexityResult
                .replace(/```json\s*/gi, "")
                .replace(/```\s*/g, "")
                .trim();
            result = JSON.parse(cleanContent);
        }
        console.log(`[addSkillToResume] Complete for task ${taskId}`);
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
        console.error(`[addSkillToResume] Failed for task ${taskId}:`, error);
        await taskRef.update({
            status: "failed",
            error: error.message || "Skill addition failed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(console.error);
        throw new https_1.HttpsError("internal", error.message || "Failed to add skill.");
    }
});
// ============================================================================
// PREP GUIDE CLOUD FUNCTION
// ============================================================================
/**
 * Cloud Function: Generate Interview Prep Guide
 * This is a complex multi-step generation that runs server-side
 */
exports.generatePrepGuide = (0, https_1.onCall)({
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "1GiB",
    secrets: [openaiApiKey, perplexityApiKey],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in.");
    }
    const { applicationId, companyName, jobTitle, jobDescription, optimizedResume, atsScore, matchedSkills, partialMatches, missingSkills, newSkillsAcquired } = request.data;
    if (!applicationId || !companyName || !jobTitle) {
        throw new https_1.HttpsError("invalid-argument", "applicationId, companyName, and jobTitle are required.");
    }
    const db = admin.firestore();
    const appRef = db.collection("user_applications").doc(applicationId);
    try {
        // Update status to generating
        await appRef.update({
            "prepGuide.status": "generating",
            "prepGuide.startedAt": admin.firestore.FieldValue.serverTimestamp(),
            "prepGuide.progress": 0,
            "prepGuide.currentStep": "Starting generation (server-side)...",
        });
        console.log(`[generatePrepGuide] Starting for ${applicationId}`);
        const openai = new openai_1.default({
            apiKey: openaiApiKey.value(),
            maxRetries: 2,
            timeout: 60000,
        });
        const sections = {};
        // Helper function for GPT calls
        const callGpt = async (prompt, taskName) => {
            try {
                const response = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "You are an expert technical interview coach." },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 5000,
                    temperature: 0.5,
                });
                const content = response.choices[0]?.message?.content;
                if (!content)
                    throw new Error(`No content for ${taskName}`);
                return content.trim();
            }
            catch (error) {
                console.warn(`[generatePrepGuide] GPT failed for ${taskName}, trying Perplexity...`);
                return await callPerplexity(perplexityApiKey.value(), "You are an expert technical interview coach.", prompt);
            }
        };
        // Step 1: Company Research (15%)
        await appRef.update({
            "prepGuide.progress": 5,
            "prepGuide.currentStep": "Researching company...",
        });
        const companyResearchPrompt = `Research ${companyName} for interview preparation for a ${jobTitle} role.
Provide detailed, CURRENT information including:
1. Company overview (mission, values, culture, size)
2. Recent news & developments (last 30-90 days)
3. Company culture & work environment
4. Key products & business units
5. Competitive landscape
6. Interview culture & process
Be specific and actionable for interview preparation.`;
        sections.companyIntelligence = await callPerplexity(perplexityApiKey.value(), "You are a company research analyst providing detailed, CURRENT information for interview preparation.", companyResearchPrompt);
        await appRef.update({
            "prepGuide.progress": 15,
            "prepGuide.currentStep": "Analyzing role requirements...",
            "prepGuide.sections.companyIntelligence": sections.companyIntelligence,
        });
        // Step 2: Role Analysis (30%)
        const roleAnalysisPrompt = `Analyze this job for interview preparation.

JOB TITLE: ${jobTitle}
COMPANY: ${companyName}
JOB DESCRIPTION: ${jobDescription || "N/A"}

Provide:
1. Detailed role breakdown
2. Success metrics (30/90/365 days)
3. Career progression paths
4. Key competencies being evaluated
5. Top 10 predicted interview questions`;
        sections.roleAnalysis = await callGpt(roleAnalysisPrompt, "Role Analysis");
        await appRef.update({
            "prepGuide.progress": 30,
            "prepGuide.currentStep": "Creating technical prep plan...",
            "prepGuide.sections.roleAnalysis": sections.roleAnalysis,
        });
        // Step 3: Technical Prep (50%)
        const technicalPrepPrompt = `Create a technical preparation guide for a ${jobTitle} interview at ${companyName}.

CANDIDATE'S SKILLS:
- Matched skills: ${matchedSkills?.join(', ') || 'N/A'}
- Transferable skills: ${partialMatches?.join(', ') || 'N/A'}
- Skills to develop: ${missingSkills?.join(', ') || 'N/A'}

JOB DESCRIPTION: ${jobDescription || "N/A"}

Provide:
1. Core technical topics to review (prioritized)
2. Technology stack deep dive
3. System design interview prep
4. Coding interview prep (with specific problems)
5. Study plan (1-week, 2-week, 1-month options)`;
        sections.technicalPrep = await callGpt(technicalPrepPrompt, "Technical Prep");
        await appRef.update({
            "prepGuide.progress": 50,
            "prepGuide.currentStep": "Generating behavioral framework...",
            "prepGuide.sections.technicalPrep": sections.technicalPrep,
        });
        // Step 4: Behavioral Framework (70%)
        const behavioralPrompt = `Create a behavioral interview guide using STAR method.

CANDIDATE RESUME: ${optimizedResume || "N/A"}
COMPANY: ${companyName}
ROLE: ${jobTitle}
JOB DESCRIPTION: ${jobDescription || "N/A"}

Provide:
1. STAR method explanation
2. ${companyName}-specific competencies
3. Top 20 behavioral questions with guidance
4. Behavioral interview tips`;
        sections.behavioralFramework = await callGpt(behavioralPrompt, "Behavioral Framework");
        await appRef.update({
            "prepGuide.progress": 70,
            "prepGuide.currentStep": "Mapping your experience to questions...",
            "prepGuide.sections.behavioralFramework": sections.behavioralFramework,
        });
        // Step 5: Story Mapping (85%)
        const storyMappingPrompt = `Map the candidate's experiences to interview questions.

CANDIDATE'S RESUME: ${optimizedResume || "N/A"}
COMPANY: ${companyName}
ROLE: ${jobTitle}
SKILLS: Matched: ${matchedSkills?.join(', ')}, Developing: ${missingSkills?.join(', ')}, New: ${newSkillsAcquired?.join(', ')}

Create SPECIFIC, PERSONALIZED story frameworks:
1. For each major experience, provide STAR framework outlines
2. Identify story gaps
3. Create skill development stories
4. Quick reference summary`;
        sections.storyMapping = await callGpt(storyMappingPrompt, "Story Mapping");
        await appRef.update({
            "prepGuide.progress": 85,
            "prepGuide.currentStep": "Finalizing questions & strategy...",
            "prepGuide.sections.storyMapping": sections.storyMapping,
        });
        // Step 6: Questions & Strategy (parallel, 95%)
        const questionsPrompt = `Create smart questions for a ${jobTitle} candidate to ask at ${companyName} interviews.
Include questions for: Engineering Manager, Technical Interviewer, Recruiter.
Also list questions to avoid with better alternatives.`;
        const strategyPrompt = `Create an interview day strategy guide for ${jobTitle} at ${companyName}.
Include: Pre-interview checklist, day-of routine, virtual/onsite tips, mindset advice.`;
        const [questionsToAsk, interviewStrategy] = await Promise.all([
            callGpt(questionsPrompt, "Questions To Ask"),
            callGpt(strategyPrompt, "Interview Strategy")
        ]);
        sections.questionsToAsk = questionsToAsk;
        sections.interviewStrategy = interviewStrategy;
        // Final update
        await appRef.update({
            "prepGuide.status": "completed",
            "prepGuide.progress": 100,
            "prepGuide.currentStep": "Complete",
            "prepGuide.completedAt": admin.firestore.FieldValue.serverTimestamp(),
            "prepGuide.sections.questionsToAsk": questionsToAsk,
            "prepGuide.sections.interviewStrategy": interviewStrategy,
        });
        console.log(`[generatePrepGuide] Complete for ${applicationId}`);
        return {
            success: true,
            sections,
        };
    }
    catch (error) {
        console.error(`[generatePrepGuide] Failed for ${applicationId}:`, error);
        await appRef.update({
            "prepGuide.status": "failed",
            "prepGuide.progress": 0,
            "prepGuide.currentStep": `Failed: ${error.message}`,
        }).catch(console.error);
        throw new https_1.HttpsError("internal", error.message || "Failed to generate prep guide.");
    }
});
// ============================================================================
// COVER LETTER CLOUD FUNCTION
// ============================================================================
/**
 * Cloud Function: Generate Cover Letter
 */
exports.generateCoverLetter = (0, https_1.onCall)({
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [openaiApiKey, perplexityApiKey],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in.");
    }
    const { applicationId, resume, jobTitle, company, jobDescription } = request.data;
    if (!applicationId || !resume || !jobTitle || !company) {
        throw new https_1.HttpsError("invalid-argument", "applicationId, resume, jobTitle, and company are required.");
    }
    const db = admin.firestore();
    const appRef = db.collection("user_applications").doc(applicationId);
    try {
        await appRef.update({
            "coverLetter.status": "generating",
            "coverLetter.startedAt": admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[generateCoverLetter] Starting for ${applicationId}`);
        const prompt = `
You are an expert career coach and professional copywriter.
Write a compelling, professional cover letter for the following candidate applying for the position of "${jobTitle}" at "${company}".

THE GOAL:
- The cover letter must be tailored specifically to the job opportunities and requirements implied by the role.
- Highlight the candidate's most relevant skills and experiences from their resume.
- Maintain a professional, enthusiastic, and confident tone.
- Use standard business letter formatting (Header, Salutation, Body, Closing).
- Do not include placeholders like "[Your Name]" or "[Phone Number]" in the body if the data is available in the resume. Use the actual data.
- If specific contact data is missing, omit that line rather than using a placeholder.

CANDIDATE RESUME:
${JSON.stringify(resume, null, 2)}

JOB DETAILS:
Title: ${jobTitle}
Company: ${company}
Description: ${jobDescription || "N/A"}

Please output ONLY the text of the cover letter, starting with the header. Do not include markdown naming blocks or introductory conversational text.
            `;
        let coverLetterText;
        // Try Perplexity first (it's better for cover letters)
        try {
            coverLetterText = await callPerplexity(perplexityApiKey.value(), "You are a helpful, professional career assistant.", prompt);
        }
        catch (perplexityError) {
            console.warn(`[generateCoverLetter] Perplexity failed: ${perplexityError.message}, trying OpenAI...`);
            const openai = new openai_1.default({
                apiKey: openaiApiKey.value(),
                maxRetries: 2,
                timeout: 60000,
            });
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are a helpful, professional career assistant." },
                    { role: "user", content: prompt }
                ],
                max_tokens: 2000,
                temperature: 0.7,
            });
            const content = response.choices[0]?.message?.content;
            if (!content)
                throw new Error("No content from OpenAI");
            coverLetterText = content.trim();
        }
        // Update application with cover letter
        await appRef.update({
            "coverLetter.status": "completed",
            "coverLetter.text": coverLetterText,
            "coverLetter.completedAt": admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[generateCoverLetter] Complete for ${applicationId}`);
        return {
            success: true,
            coverLetter: coverLetterText,
        };
    }
    catch (error) {
        console.error(`[generateCoverLetter] Failed for ${applicationId}:`, error);
        await appRef.update({
            "coverLetter.status": "failed",
            "coverLetter.error": error.message,
        }).catch(console.error);
        throw new https_1.HttpsError("internal", error.message || "Failed to generate cover letter.");
    }
});
// ============================================================================
// FIRESTORE TRIGGER-BASED FUNCTIONS (Fire and Forget Pattern)
// These functions are triggered automatically when a task is created in Firestore
// The client doesn't need to wait for a response - just creates the task document
// ============================================================================
/**
 * Firestore Trigger: Process background tasks when created
 * This is the key to background execution - the client just creates a task document
 * and the Cloud Function processes it automatically, regardless of app state
 */
exports.onBackgroundTaskCreated = (0, firestore_1.onDocumentCreated)({
    document: "background_tasks/{taskId}",
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "1GiB",
    secrets: [openaiApiKey, perplexityApiKey],
}, async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        console.log("No data in snapshot");
        return;
    }
    const task = snapshot.data();
    const taskId = event.params.taskId;
    const taskType = task.type;
    const db = admin.firestore();
    const taskRef = db.collection("background_tasks").doc(taskId);
    console.log(`[BackgroundTask] Processing task ${taskId} of type ${taskType}`);
    try {
        // Mark task as processing
        await taskRef.update({
            status: "processing",
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const openai = new openai_1.default({
            apiKey: openaiApiKey.value(),
            maxRetries: 2,
            timeout: 90000,
        });
        switch (taskType) {
            case "optimize_resume":
                await processOptimizeResume(task, taskRef, openai, db);
                break;
            case "add_skill":
                await processAddSkill(task, taskRef, openai, db);
                break;
            case "prep_guide":
                await processPrepGuide(task, taskRef, openai, db);
                break;
            case "cover_letter":
                await processCoverLetter(task, taskRef, db);
                break;
            default:
                throw new Error(`Unknown task type: ${taskType}`);
        }
        // Mark task as completed
        await taskRef.update({
            status: "completed",
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Send push notification to user
        // MOVED to notifications.ts (onBackgroundTaskUpdated)
        console.log(`[BackgroundTask] Task ${taskId} completed successfully`);
    }
    catch (error) {
        console.error(`[BackgroundTask] Task ${taskId} failed:`, error);
        await taskRef.update({
            status: "failed",
            error: error.message || "Unknown error",
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(console.error);
    }
});
// Helper function: Process optimize_resume task
// This does ALL the work server-side so the client doesn't need to process anything
async function processOptimizeResume(task, taskRef, openai, db) {
    const { analysisTaskId, resume, job, analysis, historyId } = task.payload;
    // Note: Token deduction now handled at task start in analysis-result.tsx
    // Update the original analysis_tasks document
    const analysisTaskRef = db.collection("analysis_tasks").doc(analysisTaskId);
    if (!(await checkTaskExists(analysisTaskId, db))) {
        console.warn(`[processOptimizeResume] Analysis task ${analysisTaskId} no longer exists. Aborting.`);
        return;
    }
    await analysisTaskRef.update({
        status: "processing",
        progress: 30,
        currentStep: "Optimizing resume (server-side)...",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(e => console.warn(`[processOptimizeResume] Update failed: ${e.message}`));
    const systemInstruction = `
You are an expert RiResume engine. Optimize the provided resume for the target job while maintaining truthfulness.
Return a JSON object with properties 'optimizedResume' (structure matching original) and 'changes' (array of change objects).
Aim for an ATS score of 85-95%.
    `.trim();
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
}
    `.trim();
    let result;
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: userContent }
            ],
            response_format: { type: "json_object" },
            max_tokens: 10000,
        });
        const content = response.choices[0].message.content;
        if (!content)
            throw new Error("No content from OpenAI");
        result = JSON.parse(content);
    }
    catch (openaiError) {
        console.warn(`[processOptimizeResume] OpenAI failed: ${openaiError.message}, trying Perplexity...`);
        const perplexityResult = await callPerplexity(perplexityApiKey.value(), systemInstruction, userContent);
        const cleanContent = perplexityResult.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        result = JSON.parse(cleanContent);
    }
    // CALIBRATION: Initial Optimization Score Increase (randomized 1-10%)
    const baseScore = analysis.atsScore || 0;
    const randomIncrease = Math.floor(Math.random() * 10) + 1; // Random 1-10
    const calibratedScore = Math.min(100, baseScore + randomIncrease);
    // Calculate baseline data for future skill additions
    const partialCount = analysis.matchAnalysis?.partialMatches?.length || 0;
    const missingCount = analysis.matchAnalysis?.missingSkills?.length || 0;
    const totalSkillsNeeded = partialCount + missingCount;
    // CHECK: Was the task cancelled during AI processing?
    // If so, don't save results - user cancelled before completion
    if (!(await checkTaskExists(analysisTaskId, db))) {
        console.warn(`[processOptimizeResume] Task ${analysisTaskId} was cancelled during processing. Skipping save.`);
        return;
    }
    // Save directly to user_analyses collection (the history document)
    // This is the key change - we do ALL the work server-side
    if (historyId || analysis.id) {
        const historyRef = db.collection("user_analyses").doc(historyId || analysis.id);
        await historyRef.update({
            draftOptimizedResumeData: result.optimizedResume,
            draftChangesData: result.changes || [],
            draftAtsScore: calibratedScore,
            draftMatchAnalysis: analysis.matchAnalysis,
            baselineAtsScore: calibratedScore,
            baselineTotalSkills: totalSkillsNeeded,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[processOptimizeResume] Saved draft to history ${historyId || analysis.id}. Baseline: ${calibratedScore}%, Total Skills: ${totalSkillsNeeded}`);
    }
    // Store result in the task document
    await taskRef.update({
        result: {
            optimizedResume: result.optimizedResume,
            changes: result.changes || [],
            calibratedScore,
        },
        progress: 90,
    });
    // Mark analysis task as completed
    await analysisTaskRef.update({
        status: "completed",
        progress: 100,
        currentStep: "Optimization complete",
        resultId: historyId || analysis.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(e => console.warn(`[processOptimizeResume] Final update failed (likely deleted): ${e.message}`));
    // Log activity
    // Note: Deducted at start now
    console.log(`[processOptimizeResume] Complete. Score: ${baseScore} -> ${calibratedScore}`);
}
// Helper function: Process add_skill task
// This does ALL the work server-side including re-analysis and saving
async function processAddSkill(task, taskRef, openai, db) {
    const { analysisTaskId, resume, skill, targetSections, historyId, currentAnalysis, job } = task.payload;
    // Note: Token deduction now handled at task start in analysis-result.tsx
    const analysisTaskRef = db.collection("analysis_tasks").doc(analysisTaskId);
    if (!(await checkTaskExists(analysisTaskId, db))) {
        console.warn(`[processAddSkill] Analysis task ${analysisTaskId} deleted. Aborting.`);
        return;
    }
    await analysisTaskRef.update({
        status: "processing",
        progress: 30,
        currentStep: `Adding skill "${skill}" (server-side)...`,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(e => console.warn(`[processAddSkill] Update failed: ${e.message}`));
    const systemInstruction = `
You are an expert Resume Editor. Your task is to surgically add a specific skill to ONLY the specified sections of the resume.
CRITICAL: You must ONLY modify the sections and experience entries explicitly listed. Do NOT modify ANY other sections or experience entries.
Return a JSON object with 'optimizedResume' and 'changes'.
    `.trim();
    // Parse target sections to identify specific experience entries
    const targetExperienceIds = [];
    const genericSections = [];
    targetSections.forEach((section) => {
        if (section.startsWith('experience_')) {
            targetExperienceIds.push(section.replace('experience_', ''));
        }
        else if (section === 'skills_list') {
            genericSections.push('skills');
        }
        else {
            genericSections.push(section);
        }
    });
    // Build section-specific instructions
    const sectionInstructions = [];
    if (genericSections.includes('summary') || genericSections.includes('professionalSummary')) {
        sectionInstructions.push(`- Professional Summary: Rewrite to naturally incorporate "${skill}".`);
    }
    // Handle specific experience entries
    if (targetExperienceIds.length > 0 && resume.experience) {
        targetExperienceIds.forEach(expId => {
            const exp = resume.experience.find((e) => e.id === expId);
            if (exp) {
                sectionInstructions.push(`- Experience: Add ONE new bullet point to ONLY the role "${exp.title}" at "${exp.company}" demonstrating "${skill}". Do NOT modify any other experience entries.`);
            }
        });
    }
    if (genericSections.includes('skills')) {
        sectionInstructions.push(`- Skills Section: Add "${skill}" to the skills list.`);
    }
    // Build list of experience entries to modify for clarity
    const experienceTargets = targetExperienceIds.length > 0
        ? targetExperienceIds.map(id => {
            const exp = resume.experience?.find((e) => e.id === id);
            return exp ? `${exp.title} at ${exp.company}` : id;
        }).join(', ')
        : 'NONE';
    const prompt = `
TASK: Add the skill "${skill}" to ONLY these sections: ${[...genericSections, ...targetExperienceIds.map(id => `experience entry ${id}`)].join(', ')}.

${targetExperienceIds.length > 0 ? `SPECIFIC EXPERIENCE ENTRIES TO MODIFY: ${experienceTargets}` : ''}
${targetExperienceIds.length > 0 ? `DO NOT MODIFY ANY OTHER EXPERIENCE ENTRIES. LEAVE THEM EXACTLY AS THEY ARE.` : ''}

RESUME:
${JSON.stringify(resume, null, 2)}

STRICT INSTRUCTIONS:
1. ONLY modify the sections listed above. Leave ALL other sections EXACTLY as they are.
2. Do NOT add "${skill}" to sections not in the list.
3. For experience: ONLY modify the specific experience entries listed (by company/title). Do NOT add bullet points to other experiences.
${sectionInstructions.map(s => s).join('\n')}

CHANGES TO MAKE:
${sectionInstructions.length > 0 ? sectionInstructions.join('\n') : '- No valid sections specified'}

PRESERVE: Do NOT remove or alter any existing content except for the targeted modifications. Do NOT modify experience entries not explicitly listed.

OUTPUT JSON:
{
  "optimizedResume": { ... complete resume with ONLY the targeted sections/entries modified ... },
  "changes": [
    { "type": "skill_addition", "skill": "${skill}", "section": "<section_name>", "experienceId": "<id if applicable>", "reason": "..." }
  ]
}

Each change entry must include:
- "section": The section that was modified (e.g., "summary", "experience", "skills")
- "experienceId": If modifying experience, include the experience entry ID
- "reason": Brief description of what was changed
    `.trim();
    let result;
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
        });
        const content = response.choices[0].message.content;
        if (!content)
            throw new Error("No content from OpenAI");
        result = JSON.parse(content);
    }
    catch (openaiError) {
        console.warn(`[processAddSkill] OpenAI failed, trying Perplexity...`);
        const perplexityResult = await callPerplexity(perplexityApiKey.value(), systemInstruction, prompt);
        const cleanContent = perplexityResult.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
        result = JSON.parse(cleanContent);
    }
    // Calculate new score with added skill
    // Force inject the skill into matched skills
    const addedSkills = result.changes
        ?.filter((c) => c.type === "skill_addition")
        .map((c) => c.skill)
        .filter(Boolean) || [skill];
    const matchAnalysis = currentAnalysis?.matchAnalysis || { matchedSkills: [], partialMatches: [], missingSkills: [] };
    const updatedMatchAnalysis = { ...matchAnalysis };
    // Add skills to matched and remove from missing/partial
    addedSkills.forEach((skillName) => {
        const lowerSkill = skillName.toLowerCase();
        if (!updatedMatchAnalysis.matchedSkills.find((m) => m.skill.toLowerCase() === lowerSkill)) {
            updatedMatchAnalysis.matchedSkills.push({
                skill: skillName,
                importance: "high",
                confidence: 100,
                userHas: true
            });
        }
        updatedMatchAnalysis.partialMatches = updatedMatchAnalysis.partialMatches.filter((p) => p.skill.toLowerCase() !== lowerSkill);
        updatedMatchAnalysis.missingSkills = updatedMatchAnalysis.missingSkills.filter((m) => m.skill.toLowerCase() !== lowerSkill);
    });
    // DYNAMIC SCORE CALCULATION BASED ON BASELINE
    // Get baseline data from initial optimization
    // Use draftAtsScore as baseline if baselineAtsScore not set (for backwards compatibility)
    const baselineAtsScore = currentAnalysis?.baselineAtsScore || currentAnalysis?.draftAtsScore || currentAnalysis?.atsScore || 0;
    // Calculate fallback for totalSkills from current matchAnalysis if not stored
    const baseMatchAnalysis = currentAnalysis?.matchAnalysis || {};
    const fallbackTotalSkills = (baseMatchAnalysis.partialMatches?.length || 0) + (baseMatchAnalysis.missingSkills?.length || 0);
    const baselineTotalSkills = currentAnalysis?.baselineTotalSkills || fallbackTotalSkills || 6; // Default to 6 if all else fails
    // Calculate score gap
    const scoreGap = 100 - baselineAtsScore;
    // Count how many skills were added in this change
    const skillsAddedCount = addedSkills.length || 1;
    // Calculate new score: floor(currentScore + (scoreGap / totalSkills) × skillsAdded)
    // Floor AFTER multiplication to preserve decimal precision
    const currentScore = currentAnalysis?.draftAtsScore || baselineAtsScore;
    const scoreIncrease = (scoreGap / baselineTotalSkills) * skillsAddedCount;
    let newScore = Math.floor(currentScore + scoreIncrease);
    newScore = Math.min(100, newScore); // Cap at 100
    // Safeguard: ensure at least +1 increase if score gap exists
    if (newScore <= currentScore && scoreGap > 0) {
        newScore = Math.min(100, currentScore + 1);
    }
    const perSkillIncrease = scoreGap / baselineTotalSkills;
    console.log(`[processAddSkill] Baseline: ${baselineAtsScore}%, Total Skills: ${baselineTotalSkills}, Per-Skill: ${perSkillIncrease.toFixed(2)}%, Skills Added: ${skillsAddedCount}`);
    console.log(`[processAddSkill] Formula: floor(${currentScore} + ${scoreIncrease.toFixed(2)}) = ${newScore}%`);
    // CHECK: Was the task cancelled during AI processing?
    if (!(await checkTaskExists(analysisTaskId, db))) {
        console.warn(`[processAddSkill] Task ${analysisTaskId} was cancelled during processing. Skipping save.`);
        return;
    }
    // Save directly to user_analyses collection
    const historyDocId = historyId || currentAnalysis?.id;
    if (historyDocId) {
        const historyRef = db.collection("user_analyses").doc(historyDocId);
        // Get existing changes
        const historyDoc = await historyRef.get();
        const existingData = historyDoc.data() || {};
        const existingChanges = existingData.draftChangesData || existingData.changesData || [];
        const mergedChanges = [...existingChanges, ...(result.changes || [])];
        await historyRef.update({
            draftOptimizedResumeData: result.optimizedResume,
            draftChangesData: mergedChanges,
            draftAtsScore: newScore,
            draftMatchAnalysis: updatedMatchAnalysis,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[processAddSkill] Saved draft to history ${historyDocId}`);
    }
    // Store result in the task document
    await taskRef.update({
        result: {
            optimizedResume: result.optimizedResume,
            changes: result.changes || [],
            newScore,
            updatedMatchAnalysis,
        },
        progress: 90,
    });
    // Mark analysis task as completed
    await analysisTaskRef.update({
        status: "completed",
        progress: 100,
        currentStep: "Skill addition complete",
        resultId: historyDocId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }).catch(e => console.warn(`[processAddSkill] Final update failed: ${e.message}`));
    console.log(`[processAddSkill] Complete. Score: ${currentScore}% -> ${newScore}%`);
}
// Helper function: Process prep_guide task
async function processPrepGuide(task, taskRef, openai, db) {
    const { applicationId, companyName, jobTitle, jobDescription, optimizedResume, matchedSkills, partialMatches, missingSkills, newSkillsAcquired } = task.payload;
    const appRef = db.collection("user_applications").doc(applicationId);
    // Helper to check if user has cancelled the task
    const checkIfCancelled = async () => {
        const appSnap = await appRef.get();
        const status = appSnap.data()?.prepGuide?.status;
        if (status === 'cancelled' || status === 'failed') {
            console.log(`[processPrepGuide] Task cancelled by user. Status: ${status}`);
            return true;
        }
        return false;
    };
    // Note: Token deduction now handled at task start in applications.tsx
    await appRef.update({
        "prepGuide.status": "generating",
        "prepGuide.startedAt": admin.firestore.FieldValue.serverTimestamp(),
        "prepGuide.progress": 0,
        "prepGuide.currentStep": "Starting generation (server-side)...",
    });
    const sections = {};
    const callGpt = async (prompt, taskName) => {
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "You are an expert technical interview coach." },
                    { role: "user", content: prompt }
                ],
                max_tokens: 5000,
                temperature: 0.5,
            });
            const content = response.choices[0]?.message?.content;
            if (!content)
                throw new Error(`No content for ${taskName}`);
            return content.trim();
        }
        catch (error) {
            console.warn(`[processPrepGuide] GPT failed for ${taskName}, trying Perplexity...`);
            return await callPerplexity(perplexityApiKey.value(), "You are an expert technical interview coach.", prompt);
        }
    };
    // Step 1: Company Research (use markdown format, not JSON)
    await appRef.update({ "prepGuide.progress": 5, "prepGuide.currentStep": "Researching company..." });
    sections.companyIntelligence = await callPerplexity(perplexityApiKey.value(), "You are a company research analyst preparing interview prep materials.", `Research ${companyName} for interview preparation for a ${jobTitle} role. Include company history, culture, recent news, products/services, and key leadership. Focus on information that would help a candidate in an interview.`, false // Return human-readable markdown, not JSON
    );
    await appRef.update({ "prepGuide.progress": 15, "prepGuide.sections.companyIntelligence": sections.companyIntelligence });
    // Check for cancellation after Step 1
    if (await checkIfCancelled()) {
        throw new Error("Task cancelled by user after Step 1");
    }
    // Step 2: Role Analysis
    await appRef.update({ "prepGuide.currentStep": "Analyzing role requirements..." });
    sections.roleAnalysis = await callGpt(`Analyze ${jobTitle} at ${companyName}. JD: ${jobDescription || "N/A"}`, "Role Analysis");
    await appRef.update({ "prepGuide.progress": 30, "prepGuide.sections.roleAnalysis": sections.roleAnalysis });
    // Check for cancellation after Step 2
    if (await checkIfCancelled()) {
        throw new Error("Task cancelled by user after Step 2");
    }
    // Step 3: Technical Prep
    await appRef.update({ "prepGuide.currentStep": "Creating technical prep plan..." });
    sections.technicalPrep = await callGpt(`Technical prep for ${jobTitle} at ${companyName}. Skills: ${matchedSkills?.join(', ')}`, "Technical Prep");
    await appRef.update({ "prepGuide.progress": 50, "prepGuide.sections.technicalPrep": sections.technicalPrep });
    // Check for cancellation after Step 3
    if (await checkIfCancelled()) {
        throw new Error("Task cancelled by user after Step 3");
    }
    // Step 4: Behavioral Framework
    await appRef.update({ "prepGuide.currentStep": "Generating behavioral framework..." });
    sections.behavioralFramework = await callGpt(`Behavioral interview guide for ${jobTitle} at ${companyName}`, "Behavioral");
    await appRef.update({ "prepGuide.progress": 70, "prepGuide.sections.behavioralFramework": sections.behavioralFramework });
    // Check for cancellation after Step 4
    if (await checkIfCancelled()) {
        throw new Error("Task cancelled by user after Step 4");
    }
    // Step 5: Story Mapping
    await appRef.update({ "prepGuide.currentStep": "Mapping your experience..." });
    sections.storyMapping = await callGpt(`Map experiences to interview questions for ${jobTitle}`, "Story Mapping");
    await appRef.update({ "prepGuide.progress": 85, "prepGuide.sections.storyMapping": sections.storyMapping });
    // Check for cancellation after Step 5
    if (await checkIfCancelled()) {
        throw new Error("Task cancelled by user after Step 5");
    }
    // Step 6: Questions & Strategy
    await appRef.update({ "prepGuide.currentStep": "Finalizing questions & strategy..." });
    const [questionsToAsk, interviewStrategy] = await Promise.all([
        callGpt(`Questions to ask at ${companyName} for ${jobTitle}`, "Questions"),
        callGpt(`Interview day strategy for ${jobTitle} at ${companyName}`, "Strategy")
    ]);
    sections.questionsToAsk = questionsToAsk;
    sections.interviewStrategy = interviewStrategy;
    // Final cancellation check before marking complete
    if (await checkIfCancelled()) {
        throw new Error("Task cancelled by user before completion");
    }
    // Read current history to update the latest entry
    const appSnapForHistory = await appRef.get();
    const appDataForHistory = appSnapForHistory.data();
    let prepGuideHistory = appDataForHistory?.prepGuideHistory || [];
    // Update the latest history entry to 'completed'
    if (prepGuideHistory.length > 0) {
        prepGuideHistory[prepGuideHistory.length - 1].status = 'completed';
        // Note: serverTimestamp() doesn't work inside arrays, use Timestamp.now() instead
        prepGuideHistory[prepGuideHistory.length - 1].generatedAt = admin.firestore.Timestamp.now();
    }
    // Final update - includes prepGuideHistory
    await appRef.update({
        "prepGuide.status": "completed",
        "prepGuide.progress": 100,
        "prepGuide.currentStep": "Complete",
        "prepGuide.completedAt": admin.firestore.FieldValue.serverTimestamp(),
        "prepGuide.generatedAt": admin.firestore.FieldValue.serverTimestamp(),
        "prepGuide.sections.questionsToAsk": questionsToAsk,
        "prepGuide.sections.interviewStrategy": interviewStrategy,
        "prepGuideHistory": prepGuideHistory,
    });
    await taskRef.update({ result: { sections } });
}
// Helper function: Process cover_letter task
async function processCoverLetter(task, taskRef, db) {
    const { applicationId, resume, jobTitle, company, jobDescription } = task.payload;
    const appRef = db.collection("user_applications").doc(applicationId);
    // Check if application document exists
    const appDoc = await appRef.get();
    if (!appDoc.exists) {
        console.warn(`[processCoverLetter] Application ${applicationId} not found. Creating minimal document.`);
        // Create a minimal application document if it doesn't exist
        await appRef.set({
            userId: task.userId,
            job: { title: jobTitle, company: company },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            coverLetter: {
                status: "generating",
                startedAt: admin.firestore.FieldValue.serverTimestamp(),
            }
        });
    }
    else {
        await appRef.update({
            "coverLetter.status": "generating",
            "coverLetter.startedAt": admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    // TRANSACTION: Deduct tokens (15 tokens)
    await deductTokens(task.userId, 15, "cover_letter_generation", `Generated Cover Letter for ${company}`, applicationId, db);
    const prompt = `
Write a professional cover letter for "${jobTitle}" at "${company}".
RESUME: ${JSON.stringify(resume, null, 2)}
JOB: ${jobDescription || "N/A"}
Output ONLY the cover letter text.
    `;
    let coverLetterText;
    try {
        coverLetterText = await callPerplexity(perplexityApiKey.value(), "You are a professional career assistant. Output ONLY plain text, no JSON, no markdown, no code blocks.", prompt);
    }
    catch (perplexityError) {
        // Fallback to OpenAI
        const openai = new openai_1.default({ apiKey: openaiApiKey.value() });
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_tokens: 2000,
        });
        coverLetterText = response.choices[0]?.message?.content?.trim() || "";
    }
    // Clean up the cover letter text - remove any JSON/markdown formatting
    coverLetterText = coverLetterText
        .replace(/```json\s*/gi, '')
        .replace(/```markdown\s*/gi, '')
        .replace(/```\s*/g, '')
        .replace(/^\s*{\s*"coverLetter"\s*:\s*"/i, '')
        .replace(/"\s*}\s*$/i, '')
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .trim();
    // If it looks like JSON, try to extract the content
    if (coverLetterText.startsWith('{') && coverLetterText.includes('"')) {
        try {
            const parsed = JSON.parse(coverLetterText);
            if (parsed.coverLetter) {
                coverLetterText = parsed.coverLetter;
            }
            else if (parsed.content) {
                coverLetterText = parsed.content;
            }
            else if (typeof parsed === 'string') {
                coverLetterText = parsed;
            }
        }
        catch (e) {
            // Not valid JSON, keep as-is
        }
    }
    await appRef.update({
        "coverLetter.status": "completed",
        "coverLetter.content": coverLetterText,
        "coverLetter.completedAt": admin.firestore.FieldValue.serverTimestamp(),
    });
    await taskRef.update({ result: { coverLetter: coverLetterText } });
}
/**
 * Cloud Function: Generate Training Slideshow
 * Moving this from client to server for secure token deduction
 */
exports.generateTrainingSlideshow = (0, https_1.onCall)({
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: [openaiApiKey],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in.");
    }
    const { entryId, skill, position, company } = request.data;
    if (!entryId || !skill || !position || !company) {
        throw new https_1.HttpsError("invalid-argument", "Missing required fields.");
    }
    const db = admin.firestore();
    try {
        // SAFEGUARD: If slides already exist, don't deduct tokens or re-generate
        const entryRef = db.collection("user_learning").doc(entryId);
        const entrySnap = await entryRef.get();
        if (entrySnap.exists) {
            const data = entrySnap.data();
            if (data?.slides && data.slides.length > 0) {
                console.log(`[generateTrainingSlideshow] Slides already exist for entry ${entryId}. Returning existing slides.`);
                return { success: true, slides: data.slides };
            }
        }
        // TRANSACTION: Deduct tokens and log activity (30 tokens)
        await deductTokens(request.auth.uid, 30, "training_slideshow_generation", `Generated AI Training Slideshow for ${skill}`, entryId, db);
        const openai = new openai_1.default({ apiKey: openaiApiKey.value() });
        const prompt = `You are an expert technical trainer. Create a comprehensive training slideshow for a candidate learning a specific skill for a specific job at a specific company.

SKILL: ${skill}
POSITION: ${position}
COMPANY: ${company}

Requirements:
- Generate 10-15 slides.
- Content must be curated specifically for the skill in the context of this job and company.
- Format the output as a JSON object with a "slides" array.
- Each slide object must have:
  - "title": A short header for the slide.
  - "points": An array of objects, where each object has:
    - "title": A concise name of the sub-point/concept.
    - "description": A rudimentary level explanation of this point (1-3 sentences).
- Avoid overly generic text. Provide practical, job-relevant explanations.

Respond ONLY with the JSON object.`;
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: "You are an expert technical trainer." },
                { role: "user", content: prompt }
            ],
            max_tokens: 4000,
            temperature: 0.7,
            response_format: { type: "json_object" }
        });
        const content = response.choices[0]?.message?.content;
        if (!content)
            throw new Error("No content from AI");
        const parsed = JSON.parse(content);
        const slides = parsed.slides || [];
        // Update the learning entry in Firestore
        await db.collection("user_learning").doc(entryId).update({
            slides,
            totalSlides: slides.length,
            currentSlide: 0,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, slides };
    }
    catch (error) {
        console.error("[generateTrainingSlideshow] Failed:", error);
        throw new https_1.HttpsError("internal", error.message || "Failed to generate training content.");
    }
});
//# sourceMappingURL=aiAnalysis.js.map