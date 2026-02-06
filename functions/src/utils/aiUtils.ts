import OpenAI from "openai";
import axios from "axios";

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

export interface MatchAnalysis {
    matchedSkills: Array<{ skill: string; importance: string; confidence: number; userHas?: boolean }>;
    partialMatches: Array<{ skill: string; importance: string; confidence: number }>;
    missingSkills: Array<{ skill: string; importance: string; confidence: number }>;
    keywordDensity: number;
    experienceMatch: { match: number };
}

/**
 * Call Perplexity API as fallback or for research
 */
export async function callPerplexity(
    perplexityKey: string,
    systemContent: string,
    userContent: string,
    returnJson: boolean = true
): Promise<string> {
    console.log("[AI Fallback/Research] Calling Perplexity...");

    const finalUserContent = returnJson
        ? userContent + "\n\nIMPORTANT: Return ONLY valid JSON."
        : userContent + "\n\nFormat your response as clear, well-structured markdown with headings and bullet points.";

    const response = await axios.post(
        PERPLEXITY_API_URL,
        {
            model: "sonar-pro",
            messages: [
                { role: "system", content: systemContent },
                { role: "user", content: finalUserContent }
            ],
            temperature: 0.3,
            max_tokens: 4000,
        },
        {
            headers: {
                "Authorization": `Bearer ${perplexityKey}`,
                "Content-Type": "application/json"
            },
            timeout: 60000,
        }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) throw new Error("No content from Perplexity");

    return content.trim();
}

/**
 * Common GPT calling wrapper with Perplexity fallback
 */
export async function callAiWithFallback(
    openai: OpenAI,
    perplexityKey: string,
    systemInstruction: string,
    userContent: string,
    options: {
        model?: string;
        maxTokens?: number;
        jsonMode?: boolean;
        temperature?: number;
        perplexitySystemInstruction?: string;
    } = {}
): Promise<string> {
    const {
        model = "gpt-4o-mini",
        maxTokens = 2000,
        jsonMode = true,
        temperature = 0.5,
        perplexitySystemInstruction
    } = options;

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
        if (!content) throw new Error("No content from OpenAI");
        return content;
    } catch (openaiError: any) {
        console.warn(`[AI Utils] OpenAI failed: ${openaiError.message}, trying Perplexity...`);

        const result = await callPerplexity(
            perplexityKey,
            perplexitySystemInstruction || systemInstruction,
            userContent,
            jsonMode
        );

        if (jsonMode) {
            return result
                .replace(/```json\s*/gi, "")
                .replace(/```\s*/g, "")
                .trim();
        }
        return result;
    }
}

/**
 * Calculate ATS score from match analysis
 */
export function calculateATSScore(matchAnalysis: MatchAnalysis): number {
    const weights = {
        matchedSkills: 0.5,
        keywordDensity: 0.2,
        experienceMatch: 0.2,
    };

    const matchedSkills = matchAnalysis.matchedSkills || [];
    const partialMatches = matchAnalysis.partialMatches || [];
    const missingSkills = matchAnalysis.missingSkills || [];

    const importantMatched = matchedSkills.filter(
        s => s.importance === "critical" || s.importance === "high"
    ).length;
    const importantPartial = partialMatches.filter(
        s => s.importance === "critical" || s.importance === "high"
    ).length;
    const importantMissing = missingSkills.filter(
        s => s.importance === "critical" || s.importance === "high"
    ).length;

    const totalImportant = importantMatched + importantPartial + importantMissing;

    const skillMatchScore = totalImportant > 0
        ? ((importantMatched * 1.0 + importantPartial * 0.5) / totalImportant) * 100
        : 0;

    const score =
        (skillMatchScore * weights.matchedSkills) +
        ((matchAnalysis.keywordDensity || 0) * weights.keywordDensity) +
        ((matchAnalysis.experienceMatch?.match || 0) * weights.experienceMatch);

    return Math.round(Math.min(100, Math.max(0, score)));
}
