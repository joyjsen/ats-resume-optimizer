"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateATSScore = exports.extractJson = exports.callAiWithFallback = exports.callPerplexity = void 0;
const axios_1 = require("axios");
const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
/**
 * Call Perplexity API as fallback or for research
 */
async function callPerplexity(perplexityKey, systemContent, userContent, returnJson = true, maxTokens = 4000) {
    console.log(`[AI Fallback/Research] Calling Perplexity (maxTokens: ${maxTokens})...`);
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
        max_tokens: maxTokens,
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
exports.callPerplexity = callPerplexity;
/**
 * Common GPT calling wrapper with Perplexity fallback
 */
async function callAiWithFallback(openai, perplexityKey, systemInstruction, userContent, options = {}) {
    const { model = "gpt-4o-mini", maxTokens = 2000, jsonMode = true, temperature = 0.5, perplexitySystemInstruction } = options;
    try {
        const response = await openai.chat.completions.create({
            model,
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: userContent }
            ],
            response_format: jsonMode ? { type: "json_object" } : undefined,
            max_tokens: maxTokens,
            temperature,
        });
        const content = response.choices[0].message.content;
        if (!content)
            throw new Error("No content from OpenAI");
        return content;
    }
    catch (openaiError) {
        console.warn(`[AI Utils] OpenAI failed: ${openaiError.message}, trying Perplexity...`);
        const result = await callPerplexity(perplexityKey, perplexitySystemInstruction || systemInstruction, userContent, jsonMode, maxTokens);
        if (jsonMode) {
            return extractJson(result);
        }
        return result;
    }
}
exports.callAiWithFallback = callAiWithFallback;
/**
 * Robustly extract JSON from AI string results.
 * Handles markdown fences, trailing text, and partial results.
 */
function extractJson(content) {
    if (!content)
        return "";
    // Step 1: Remove markdown fences
    let cleaned = content
        .replace(/```json\s*/gi, "")
        .replace(/```\s*/g, "")
        .trim();
    // Step 2: Extract the first balanced JSON object { ... }
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        return cleaned.substring(firstBrace, lastBrace + 1);
    }
    // Step 3: Minimal fallback (return cleaned if no braces found, though likely invalid)
    return cleaned;
}
exports.extractJson = extractJson;
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
exports.calculateATSScore = calculateATSScore;
//# sourceMappingURL=aiUtils.js.map