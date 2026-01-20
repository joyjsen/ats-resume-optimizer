import OpenAI from 'openai';
import { ENV } from './env';

// Centralized OpenAI configuration
// This ensures consistent retry logic and API key usage across the app
export const openai = new OpenAI({
    apiKey: ENV.OPENAI_API_KEY,
    dangerouslyAllowBrowser: true, // Needed for React Native environment
    maxRetries: 5, // Increased from default 2 to handle 429 Rate Limits better
    timeout: 60000, // 60s timeout for long analysis tasks
});

// Helper to handle specific 429 edge cases if the default retry isn't enough
// Helper to handle specific 429 edge cases with explicit backoff
export const safeOpenAICall = async <T>(apiCall: () => Promise<T>, fallbackMessage: string): Promise<T> => {
    let retries = 0;
    const MAX_RETRIES = 3;
    const INITIAL_DELAY = 2000; // 2 seconds

    while (true) {
        try {
            return await apiCall();
        } catch (error: any) {
            if (error.status === 429 && retries < MAX_RETRIES) {
                retries++;
                const delay = INITIAL_DELAY * Math.pow(2, retries - 1); // 2s, 4s, 8s
                console.warn(`Rate limit hit. Retrying in ${delay}ms... (Attempt ${retries}/${MAX_RETRIES})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }

            console.error("OpenAI API Error:", error);

            if (error.status === 429) {
                throw new Error(`Rate limit exceeded despite retries. Please wait a moment and try again. (${fallbackMessage})`);
            }

            throw error;
        }
    }
};
