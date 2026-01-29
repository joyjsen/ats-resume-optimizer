import OpenAI from 'openai';
import axios from 'axios';
import { ENV } from './env';

// Centralized OpenAI configuration
export const openai = new OpenAI({
    apiKey: ENV.OPENAI_API_KEY,
    dangerouslyAllowBrowser: true, // Needed for React Native environment
    maxRetries: 2, // Keep SDK retries low
    timeout: 60000, // 60s timeout - increased for background resilience
});

// Perplexity API configuration for fallback
const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
const PERPLEXITY_API_KEY = ENV.PERPLEXITY_API_KEY;

interface AICallOptions {
    model?: string;
    messages: { role: string; content: any }[];
    response_format?: { type: string };
    max_tokens?: number;
    temperature?: number;
}

/**
 * Call Perplexity API as fallback
 */
async function callPerplexity(options: AICallOptions, taskName: string): Promise<string> {
    console.log(`[AI Fallback] Calling Perplexity for: ${taskName}`);

    // Convert messages - Perplexity doesn't support vision, so we need to handle image content
    const convertedMessages = options.messages.map(msg => {
        if (Array.isArray(msg.content)) {
            // Extract text from multi-part content (vision messages)
            const textParts = msg.content
                .filter((part: any) => part.type === 'text')
                .map((part: any) => part.text)
                .join('\n');
            return { role: msg.role, content: textParts || '[Image content - not supported in fallback]' };
        }
        return msg;
    });

    // If JSON mode was requested, add instruction to return JSON
    if (options.response_format?.type === 'json_object') {
        const lastMessage = convertedMessages[convertedMessages.length - 1];
        if (lastMessage && !lastMessage.content.includes('Return ONLY valid JSON')) {
            lastMessage.content += '\n\nIMPORTANT: Return ONLY valid JSON. No markdown, no explanations, just the JSON object.';
        }
    }

    const response = await axios.post(
        PERPLEXITY_API_URL,
        {
            model: 'sonar-pro',
            messages: convertedMessages,
            temperature: options.temperature ?? 0.3,
            max_tokens: options.max_tokens ?? 4000,
        },
        {
            headers: {
                'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 90000, // 90s timeout for Perplexity
        }
    );

    const content = response.data.choices[0]?.message?.content;
    if (!content) throw new Error("No content returned from Perplexity");

    return content.trim();
}

/**
 * Check if an error is a timeout error
 */
function isTimeoutError(error: any): boolean {
    if (!error) return false;

    // OpenAI timeout
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') return true;
    if (error.message?.toLowerCase().includes('timeout')) return true;
    if (error.name === 'APIConnectionTimeoutError') return true;

    // Axios timeout
    if (error.code === 'ECONNABORTED') return true;

    // Generic timeout patterns
    if (error.status === 408) return true;
    if (error.response?.status === 408) return true;

    return false;
}

/**
 * Check if error is a vision-related call (can't fallback to Perplexity)
 */
function hasVisionContent(messages: any[]): boolean {
    return messages.some(msg =>
        Array.isArray(msg.content) &&
        msg.content.some((part: any) => part.type === 'image_url')
    );
}

/**
 * Safe OpenAI call with Perplexity fallback on timeout
 *
 * @param apiCall - The OpenAI API call function
 * @param taskName - Name of the task for logging
 * @param options - Optional: the original options for fallback (needed for Perplexity fallback)
 */
export const safeOpenAICall = async <T>(
    apiCall: () => Promise<T>,
    taskName: string,
    options?: AICallOptions
): Promise<T> => {
    let lastError: any = null;

    // Try OpenAI first
    try {
        return await apiCall();
    } catch (error: any) {
        lastError = error;
        console.warn(`[AI] OpenAI call failed for ${taskName}:`, error.message || error);

        // Check if we can fallback to Perplexity
        const canFallback = PERPLEXITY_API_KEY &&
            options &&
            (isTimeoutError(error) || error.status === 429 || error.status >= 500);

        // Don't fallback for vision calls - Perplexity doesn't support them
        if (canFallback && options && hasVisionContent(options.messages)) {
            console.warn(`[AI] Cannot fallback to Perplexity for vision tasks`);
            throw error;
        }

        if (canFallback && options) {
            console.log(`[AI] Attempting Perplexity fallback for: ${taskName}`);
            try {
                const perplexityResult = await callPerplexity(options, taskName);

                // If JSON mode was requested, parse and return as expected structure
                if (options.response_format?.type === 'json_object') {
                    // Clean up markdown code blocks if present
                    let cleanContent = perplexityResult
                        .replace(/```json\s*/gi, '')
                        .replace(/```\s*/g, '')
                        .trim();

                    // Validate it's valid JSON
                    JSON.parse(cleanContent); // This will throw if invalid

                    // Return in OpenAI-like structure
                    return {
                        choices: [{
                            message: {
                                content: cleanContent
                            },
                            finish_reason: 'stop'
                        }]
                    } as T;
                }

                // Return in OpenAI-like structure for non-JSON responses
                return {
                    choices: [{
                        message: {
                            content: perplexityResult
                        },
                        finish_reason: 'stop'
                    }]
                } as T;

            } catch (fallbackError: any) {
                console.error(`[AI] Perplexity fallback also failed:`, fallbackError.message);
                // Throw the original OpenAI error as it's more informative
                throw lastError;
            }
        }

        // No fallback possible, throw original error
        if (error.status === 429) {
            throw new Error(`Rate limit exceeded. Please wait a moment and try again. (${taskName})`);
        }

        throw error;
    }
};

/**
 * Create a safe API call with automatic fallback support
 * This is a convenience wrapper that captures options for fallback
 */
export const createSafeAPICall = async (
    options: AICallOptions,
    taskName: string
): Promise<any> => {
    return safeOpenAICall(
        () => openai.chat.completions.create({
            model: options.model || 'gpt-4o-mini',
            messages: options.messages as any,
            response_format: options.response_format as any,
            max_tokens: options.max_tokens,
            temperature: options.temperature,
        }),
        taskName,
        options
    );
};
