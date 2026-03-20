"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiProxy = void 0;
const https_1 = require("firebase-functions/v2/https");
const openai_1 = require("openai");
const aiUtils_1 = require("../utils/aiUtils");
const aiProxy = (openaiApiKey, perplexityApiKey) => (0, https_1.onCall)({
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "1GiB",
    secrets: [openaiApiKey, perplexityApiKey],
}, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "You must be logged in.");
    const { systemPrompt, userPrompt, messages, provider, options } = request.data;
    try {
        if (provider === 'perplexity') {
            const result = await (0, aiUtils_1.callPerplexity)(perplexityApiKey.value().trim(), systemPrompt || "You are a helpful assistant.", userPrompt || "", options?.jsonMode || false);
            return { success: true, result };
        }
        else {
            const openai = new openai_1.default({ apiKey: openaiApiKey.value().trim() });
            // If raw messages are provided, call OpenAI directly
            if (messages) {
                const payload = {
                    model: options?.model || 'gpt-5.4-mini',
                    messages: messages,
                };
                if (options?.response_format)
                    payload.response_format = options.response_format;
                if (options?.max_tokens != null)
                    payload.max_completion_tokens = options.max_tokens;
                if (options?.temperature != null)
                    payload.temperature = options.temperature;
                const response = await openai.chat.completions.create(payload);
                return { success: true, result: response.choices[0].message.content };
            }
            else {
                const result = await (0, aiUtils_1.callAiWithFallback)(openai, perplexityApiKey.value().trim(), systemPrompt, userPrompt, options || {});
                return { success: true, result };
            }
        }
    }
    catch (error) {
        console.error("[aiProxy] Failed:", error);
        throw new https_1.HttpsError("internal", error.message);
    }
});
exports.aiProxy = aiProxy;
//# sourceMappingURL=aiProxy.js.map