import { ParsedResume, OptimizationChange } from '../../types/resume.types';
import { JobPosting } from '../../types/job.types';
import { AnalysisResult } from '../../types/analysis.types';
import { openai, safeOpenAICall } from '../../config/ai';

// Removed local OpenAI instantiation

export class ResumeOptimizerService {
    /**
     * Optimize resume for job (only called when readyToApply = true)
     */
    async optimizeResume(
        resume: ParsedResume,
        job: JobPosting,
        analysis: AnalysisResult
    ): Promise<{ optimizedResume: ParsedResume; changes: OptimizationChange[] }> {
        try {
            const systemInstruction = `
You are an expert ATS resume optimizer. Optimize the provided resume for the target job while maintaining truthfulness.
Return a JSON object with properties 'optimizedResume' (structure matching original) and 'changes' (array of change objects).
Aim for an ATS score of 85-95%.
            `.trim();

            const userContent = this.buildOptimizationPrompt(resume, job, analysis);

            const options = {
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: userContent }
                ],
                response_format: { type: 'json_object' },
                max_tokens: 10000,
            };

            const response = await safeOpenAICall(
                () => openai.chat.completions.create(options as any),
                'Resume Optimization',
                options
            );

            const choice = response.choices[0];
            const content = choice.message.content;

            if (choice.finish_reason === 'length') {
                console.warn("Optimization response truncated due to length limits.");
                // We might try to parse what we have, but for JSON it will fail.
                // Thowing a specific error helps debugging.
                throw new Error("Resume too long: Optimization response was truncated.");
            }

            if (!content) throw new Error('No content from OpenAI');

            try {
                const result = JSON.parse(content);
                return {
                    optimizedResume: result.optimizedResume,
                    changes: result.changes,
                };
            } catch (e) {
                console.error("JSON Parse Error. Content snippet:", content.substring(content.length - 200));
                throw new Error("AI Assistant failed to structure the response correctly. Please try again.");
            }
        } catch (error: any) {
            console.error('Error optimizing resume:', error);
            // Pass through specific errors, wrap unknown ones
            if (error.message.includes("Resume too long") || error.message.includes("AI Assistant failed")) {
                throw error;
            }
            throw new Error(`Optimization failed: ${error.message}`);
        }
    }

    private buildOptimizationPrompt(
        resume: ParsedResume,
        job: JobPosting,
        analysis: AnalysisResult
    ): string {
        return `
You are an expert Executive Resume Writer. Optimize this resume for the target job while maintaining truthfulness.
Your mandate is to REWRITE the content to be more professional, impactful, and ATS-optimized. 

CRITICAL: DO NOT BE CONCISE. The user wants a detailed, comprehensive resume. 
- Expand on bullet points to explain HOW and WHY, not just WHAT.
- Use full sentences with strong impact.
- Aim for 2-3 lines per bullet point if necessary to convey depth.

ORIGINAL RESUME:
${JSON.stringify(resume, null, 2)}

TARGET JOB:
${JSON.stringify({ title: job.title, company: job.company, requirements: job.requirements }, null, 2)}

ANALYSIS INSIGHTS:
Missing Keywords: ${analysis.matchAnalysis.missingSkills.map(s => s.skill).join(', ')}
Current ATS Score: ${analysis.atsScore}%

OPTIMIZATION INSTRUCTIONS:
1. **Professional Summary**: WRITE A COMPLETELY NEW summary. It must be 3-4 lines, punchy, include key achievements, and naturally integrate the top 5 keywords.
2. **Experience Section (CRITICAL)**: 
   - For EACH and EVERY role, rewrite the bullet points.
   - **EXPAND** on them. Do not simplify.
   - Transform passive responsibilities into active achievements (e.g., "Responsible for sales" -> "Spearheaded sales strategy delivering 20% growth by leveraging X and Y...").
   - INTEGRATE the missing keywords naturally into these bullets.
   - Use strong power verbs.
   - Provide context (team size, budget, technologies used).
3. **Skills**: Reorder and categorize them to match the job description priorities.
4. **General**: Correction of grammar, tone, and clarity is required.

STRICT RULES:
- ❌ DO NOT add skills or experiences the user clearly doesn't have.
- ❌ DO NOT be brief or concise. Detail is preferred.
- ✅ DO rephrase existing experience to sound more impressive and relevant.
- ✅ DO generate a "changes" list that explains EXACTLY what you did.

Return JSON:
{
  "optimizedResume": { ... },
  "changes": [
    {
      "type": "summary_rewrite",
      "reason": "Rewrote summary to position candidate as a [Job Title] expert."
    },
    {
      "type": "experience_improvement",
      "reason": "Enhanced [Company] bullets to highlight [Skill] and [Metric]."
    }
  ]
}
    `.trim();
    }

    /**
     * Contextually add a specific skill to selected sections
     */
    async addSkillToResume(
        resume: ParsedResume,
        skill: string,
        targetSections: string[]
    ): Promise<{ optimizedResume: ParsedResume; changes: OptimizationChange[] }> {
        try {
            const systemInstruction = `
You are an expert Resume Editor. Your task is to surgically add a specific skill to a resume in the requested sections.
Return a JSON object with 'optimizedResume' and 'changes'.
            `.trim();

            const prompt = `
TASK: Add the skill "${skill}" to the following sections: ${targetSections.join(', ')}.

RESUME:
${JSON.stringify(resume, null, 2)}

INSTRUCTIONS:
1. **Contextual Integration**: Do not just append keywords. Write natural, impactful sentences or bullet points.
2. **Professional Summary**: If selected, rewrite the summary to naturally include "${skill}".
3. **Experience**: If a specific role ID is selected (e.g. "experience_[ID]"), find that role and ADD a new bullet point that demonstrates usage of "${skill}".
    - Make up a plausible achievement based on the role title and the skill.
    - E.g. If adding "Python" to "Data Analyst", add: "Leveraged Python scripts to automate data cleaning..."
4. **Skills Section**: If selected, ensure "${skill}" is present in the skills list.
5. **Preserve Integrity**: Do NOT remove existing content unless necessary for flow in the summary. For experience, append the new bullet.

OUTPUT JSON:
{
  "optimizedResume": { ... },
  "changes": [
    { 
      "type": "skill_addition", 
      "skill": "${skill}",
      "reason": "Added '${skill}' to [Section Name]..." 
    }
  ]
}
            `.trim();

            const options = {
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemInstruction },
                    { role: 'user', content: prompt }
                ],
                response_format: { type: 'json_object' },
            };

            const response = await safeOpenAICall(
                () => openai.chat.completions.create(options as any),
                'Add Skill',
                options
            );

            const content = response.choices[0].message.content;
            if (!content) throw new Error('No content from OpenAI');

            const result = JSON.parse(content);
            return {
                optimizedResume: result.optimizedResume,
                changes: result.changes || []
            };

        } catch (error) {
            console.error('Error adding skill:', error);
            throw error;
        }
    }
}

export const resumeOptimizerService = new ResumeOptimizerService();
