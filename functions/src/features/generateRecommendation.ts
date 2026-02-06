import { onCall, HttpsError } from "firebase-functions/v2/https";
import OpenAI from "openai";
import { callAiWithFallback } from "../utils/aiUtils";

export const generateRecommendation = (openaiApiKey: any, perplexityApiKey: any) => onCall(
    {
        region: "us-central1",
        timeoutSeconds: 120,
        memory: "512MiB",
        secrets: [openaiApiKey, perplexityApiKey],
    },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");

        const { resume, job, gaps } = request.data;
        if (!resume || !job || !gaps) throw new HttpsError("invalid-argument", "Missing required fields.");

        const openai = new OpenAI({ apiKey: openaiApiKey.value() });

        try {
            const upskillPrompt = `Create a learning path for ${JSON.stringify(gaps)}.`;
            const jobsPrompt = `Suggest alternative jobs for ${job.title}.`;

            const [upskillPath, alternativeJobs] = await Promise.all([
                callAiWithFallback(openai, perplexityApiKey.value(), "You are a career advisor.", upskillPrompt),
                callAiWithFallback(openai, perplexityApiKey.value(), "You are a career advisor.", jobsPrompt)
            ]);

            return {
                success: true,
                upskillPath: JSON.parse(upskillPath),
                alternativeJobs: JSON.parse(alternativeJobs).alternatives || [],
            };
        } catch (error: any) {
            console.error("[generateRecommendation] Failed:", error);
            throw new HttpsError("internal", error.message);
        }
    }
);
