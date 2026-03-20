import { onCall, HttpsError } from "firebase-functions/v2/https";
import OpenAI from "openai";
import { callAiWithFallback, callPerplexity } from "../utils/aiUtils";

export const aiProxy = (openaiApiKey: any, perplexityApiKey: any) => onCall(
    {
        region: "us-central1",
        timeoutSeconds: 300,
        memory: "1GiB",
        secrets: [openaiApiKey, perplexityApiKey],
    },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "You must be logged in.");

        const { systemPrompt, userPrompt, messages, provider, options } = request.data;

        try {
            if (provider === 'perplexity') {
                 const result = await callPerplexity(
                     perplexityApiKey.value().trim(), 
                     systemPrompt || "You are a helpful assistant.", 
                     userPrompt || "", 
                     options?.jsonMode || false
                 );
                 return { success: true, result };
            } else {
                 const openai = new OpenAI({ apiKey: openaiApiKey.value().trim() });
                 
                 // If raw messages are provided, call OpenAI directly
                 if (messages) {
                     const payload: any = {
                         model: options?.model || 'gpt-5.4-mini',
                         messages: messages,
                     };
                     
                     if (options?.response_format) payload.response_format = options.response_format;
                     if (options?.max_tokens != null) payload.max_completion_tokens = options.max_tokens;
                     if (options?.temperature != null) payload.temperature = options.temperature;

                     const response = await openai.chat.completions.create(payload);
                     return { success: true, result: response.choices[0].message.content };
                 } else {
                     const result = await callAiWithFallback(
                         openai, 
                         perplexityApiKey.value().trim(), 
                         systemPrompt, 
                         userPrompt, 
                         options || {}
                     );
                     return { success: true, result };
                 }
            }
        } catch (error: any) {
            console.error("[aiProxy] Failed:", error);
            throw new HttpsError("internal", error.message);
        }
    }
);
