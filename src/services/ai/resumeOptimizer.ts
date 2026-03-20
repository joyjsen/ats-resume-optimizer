import { ParsedResume, OptimizationChange } from '../../types/resume.types';
import { JobPosting } from '../../types/job.types';
import { AnalysisResult } from '../../types/analysis.types';
import { getFirebaseFunctions } from '../firebase/config';
import { httpsCallable } from 'firebase/functions';

export class ResumeOptimizerService {
    /**
     * Optimize resume for job
     */
    async optimizeResume(
        resume: ParsedResume,
        job: JobPosting,
        analysis: AnalysisResult
    ): Promise<{ optimizedResume: ParsedResume; changes: OptimizationChange[] }> {
        try {
            const functions = await getFirebaseFunctions();
            const optimizeFunc = httpsCallable(functions, 'optimizeResume');
            
            const response = await optimizeFunc({
                taskId: `opt_${Date.now()}`,
                resume,
                job,
                analysis
            });
            
            const data = response.data as any;
            if (!data.success) throw new Error(data.error || "Optimization failed");

            return {
                optimizedResume: data.optimizedResume,
                changes: data.changes || [],
            };
        } catch (error: any) {
            console.error('Error optimizing resume:', error);
            throw new Error(`Optimization failed: ${error.message}`);
        }
    }

    async addSkillToResume(
        resume: ParsedResume,
        skill: string,
        targetSections: string[]
    ): Promise<{ optimizedResume: ParsedResume; changes: OptimizationChange[] }> {
        try {
            const functions = await getFirebaseFunctions();
            const addSkillFunc = httpsCallable(functions, 'addSkillToResume');
            
            const response = await addSkillFunc({
                taskId: `skill_${Date.now()}`,
                resume,
                skill,
                targetSections
            });
            
            const data = response.data as any;
            if (!data.success) throw new Error(data.error || "Skill addition failed");

            return {
                optimizedResume: data.optimizedResume,
                changes: data.changes || []
            };

        } catch (error) {
            console.error('Error adding skill:', error);
            throw error;
        }
    }

    async enhanceText(
        text: string,
        job: { title: string; company: string; requirements: any },
        section: string
    ): Promise<string> {
        try {
            const functions = await getFirebaseFunctions();
            const aiProxyFunc = httpsCallable(functions, 'aiProxy');

            const systemInstruction = `
You are an expert Executive Resume Writer and ATS specialist. Your task is to polish and enhance a specific piece of resume text to make it more impactful, professional, and optimized for a target job.

STRICT RULES:
1. Contextual Excellence: Use the target job information to highlight relevant keywords and achievements.
2. Impactful Language: Use strong action verbs and quantify achievements where possible.
3. Tone: Maintain a sophisticated, executive tone.
4. Output: Return ONLY the enhanced text. No commentary.

TARGET JOB:
${JSON.stringify(job, null, 2)}

SECTION: ${section}
`.trim();

            const response = await aiProxyFunc({
                systemPrompt: systemInstruction,
                userPrompt: `Original Text: "${text}"\\n\\nProvide the enhanced version:`,
                options: { maxTokens: 1000 }
            });
            
            const data = response.data as any;
            if (!data.success) throw new Error(data.error || "AI Fallback failed");

            let result = data.result.trim().replace(/^"|"$/g, '');

            // AI sometimes returns JSON like {"enhanced_text": "..."} — extract the clean text
            if (result.startsWith('{') || result.startsWith('```')) {
                // Strip markdown code fences if present
                result = result.replace(/^```(?:json)?\n?/g, '').replace(/\n?```$/g, '').trim();
                try {
                    const parsed = JSON.parse(result);
                    // Extract the first string value from the parsed object
                    if (typeof parsed === 'object' && parsed !== null) {
                        const firstStringValue = Object.values(parsed).find(v => typeof v === 'string');
                        if (firstStringValue) {
                            result = firstStringValue as string;
                        }
                    }
                } catch {
                    // Not valid JSON, use as-is
                }
            }

            return result;

        } catch (error) {
            console.error('Error enhancing text:', error);
            throw error;
        }
    }
}

export const resumeOptimizerService = new ResumeOptimizerService();
