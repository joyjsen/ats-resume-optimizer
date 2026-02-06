"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRecommendation = void 0;
const https_1 = require("firebase-functions/v2/https");
const openai_1 = require("openai");
const aiUtils_1 = require("../utils/aiUtils");
const generateRecommendation = (openaiApiKey, perplexityApiKey) => (0, https_1.onCall)({
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [openaiApiKey, perplexityApiKey],
}, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "You must be logged in.");
    const { resume, job, gaps } = request.data;
    if (!resume || !job || !gaps)
        throw new https_1.HttpsError("invalid-argument", "Missing required fields.");
    const openai = new openai_1.default({ apiKey: openaiApiKey.value() });
    try {
        const upskillPrompt = `Create a learning path for ${JSON.stringify(gaps)}.`;
        const jobsPrompt = `Suggest alternative jobs for ${job.title}.`;
        const [upskillPath, alternativeJobs] = await Promise.all([
            (0, aiUtils_1.callAiWithFallback)(openai, perplexityApiKey.value(), "You are a career advisor.", upskillPrompt),
            (0, aiUtils_1.callAiWithFallback)(openai, perplexityApiKey.value(), "You are a career advisor.", jobsPrompt)
        ]);
        return {
            success: true,
            upskillPath: JSON.parse(upskillPath),
            alternativeJobs: JSON.parse(alternativeJobs).alternatives || [],
        };
    }
    catch (error) {
        console.error("[generateRecommendation] Failed:", error);
        throw new https_1.HttpsError("internal", error.message);
    }
});
exports.generateRecommendation = generateRecommendation;
//# sourceMappingURL=generateRecommendation.js.map