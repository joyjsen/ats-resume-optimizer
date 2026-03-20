import { getFirebaseFunctions } from '../services/firebase/config';
import { httpsCallable } from 'firebase/functions';

// Lazy initialized axios instance (if still needed anywhere)
let axiosInstance: any = null;

export async function getAxios() {
    if (axiosInstance) return axiosInstance;
    axiosInstance = (await import('axios')).default;
    return axiosInstance;
}

interface AICallOptions {
    model?: string;
    messages: { role: string; content: any }[];
    response_format?: { type: string };
    max_tokens?: number;
    temperature?: number;
}

/**
 * Proxy call to the backend Firebase function instead of local OpenAI
 */
export const safeOpenAICall = async <T>(apiCall: any, taskName: string, options?: AICallOptions): Promise<any> => {
    try {
        const functions = await getFirebaseFunctions();
        const aiProxyFunc = httpsCallable(functions, 'aiProxy');

        const response = await aiProxyFunc({
            provider: 'openai',
            messages: options?.messages,
            options: {
                model: options?.model,
                response_format: options?.response_format,
                max_tokens: options?.max_tokens,
                temperature: options?.temperature
            }
        });

        const data = response.data as any;
        if (!data.success) throw new Error(data.error || "AI Proxy call failed");

        return {
            choices: [{
                message: { content: data.result }
            }]
        };

    } catch (error) {
        console.error(`Error in safeOpenAICall (\${taskName}):`, error);
        throw error;
    }
};

export const createSafeAPICall = async (options: AICallOptions, taskName: string): Promise<any> => {
    return safeOpenAICall(null, taskName, options);
};

// We don't export openai itself because we shouldn't use it directly on the frontend anymore
export const openai = null;
