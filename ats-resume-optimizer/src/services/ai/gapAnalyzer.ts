import { AnalysisResult, MatchAnalysis, GapAnalysis, Recommendation } from '../../types/analysis.types';
import { ParsedResume } from '../../types/resume.types';
import { JobPosting } from '../../types/job.types';
import { historyService } from '../firebase/historyService';
import { openai, safeOpenAICall } from '../../config/ai';

// Removed local OpenAI instantiation

export class GapAnalyzerService {
  /**
   * Main analysis function - determines if user should optimize or upskill
   */
  async analyzeJobFit(resume: ParsedResume, job: JobPosting): Promise<AnalysisResult> {
    try {
      // Step 1: Get AI analysis
      const aiAnalysis = await this.getAIAnalysis(resume, job);

      // Step 2: Calculate ATS score
      const atsScore = this.calculateATSScore(aiAnalysis.matchAnalysis);

      // Step 3: Determine readiness
      const readyToApply = this.determineReadiness(atsScore, aiAnalysis.gaps);

      // Step 4: Generate recommendation
      const recommendation = await this.generateRecommendation(
        aiAnalysis,
        atsScore,
        readyToApply,
        resume,
        job
      );

      const result: AnalysisResult = {
        id: this.generateId(),
        resumeId: '', // Will be set by caller
        jobId: job.id,
        atsScore,
        readyToApply,
        matchAnalysis: aiAnalysis.matchAnalysis,
        gaps: aiAnalysis.gaps,
        recommendation,
        analyzedAt: new Date(),
      };

      // Save to History (Fire-and-forget to avoid slowing response)
      // We pass the composite object so HistoryService can extract what it needs, 
      // but GapAnalyzer only returns AnalysisResult. 
      // Actually, ResumeOptimizer/Main Flow holds the Resume. 
      // GapAnalyzer doesn't have the optimized resume yet.
      // We should move saving to the UI layer or a higher level orchestration?
      // For now, let's keep it here but we only have `resume` (original) and `job`.
      // The `optimizedResume` is generated LATER.

      // FIX: GapAnalyzer shouldn't save immediately if we want to include Optimization results.
      // Or we save a "Draft" here and update it later?
      // Simplest for now: User wants to see "Analysis". 
      // Let's pass 'resume' into saveAnalysis as a 3rd arg.

      // historyService.saveAnalysis(result, job, resume).catch(err => console.error("Background save failed", err));

      return result;
    } catch (error) {
      console.error('Error analyzing job fit:', error);
      throw error;
    }
  }

  /**
   * Use OpenAI to analyze the match between resume and job
   */
  private async getAIAnalysis(resume: ParsedResume, job: JobPosting): Promise<{
    matchAnalysis: MatchAnalysis;
    gaps: GapAnalysis;
  }> {
    const systemInstruction = `
You are an expert career advisor and ATS specialist. Analyze if this candidate is ready to apply for this job.
Perform a comprehensive analysis and return a JSON object with matchAnalysis and gaps.
Review the following analysis guidelines:
1. A "matched skill" means they clearly have it in their experience or skills section
2. A "partial match" means they have a related/transferable skill
3. A "missing skill" has no evidence in their resume
4. Mark skills as "critical gap" if required/must-have
5. totalGapScore should weigh critical gaps heavily

Return JSON with this EXACT structure:
{
  "matchAnalysis": {
    "matchedSkills": [{ "skill": "name", "importance": "critical|high|medium|low", "confidence": 0-100 }],
    "partialMatches": [{ "skill": "name", "importance": "critical|high", "confidence": 0-100 }],
    "missingSkills": [{ "skill": "name", "importance": "critical|high|medium|low", "confidence": 0-100 }],
    "keywordDensity": 0-100,
    "experienceMatch": { "match": 0-100 }
  },
  "gaps": {
    "criticalGaps": [{ "skill": "name", "importance": "critical", "hasTransferable": boolean }],
    "minorGaps": [{ "skill": "name", "importance": "medium", "hasTransferable": boolean }],
    "totalGapScore": 0-100
  }
}
    `.trim();

    const userContent = `
CANDIDATE RESUME:
${JSON.stringify(resume, null, 2)}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Requirements: ${JSON.stringify(job.requirements, null, 2)}

Provide the analysis JSON.
    `.trim();

    const options = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: userContent }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    };

    const response = await safeOpenAICall(
      () => openai.chat.completions.create(options as any),
      'Gap Analysis',
      options
    );

    const content = response.choices[0].message.content;
    if (!content) {
      console.error("OpenAI Response Error Dump:", JSON.stringify(response, null, 2));
      throw new Error(`No content from OpenAI. Finish reason: ${response.choices[0].finish_reason}`);
    }

    // Robust Parsing & Defensive Coding
    const parsed = JSON.parse(content);

    // Ensure nested objects and arrays exist to prevent crashes
    return {
      matchAnalysis: {
        matchedSkills: Array.isArray(parsed.matchAnalysis?.matchedSkills) ? parsed.matchAnalysis.matchedSkills : [],
        partialMatches: Array.isArray(parsed.matchAnalysis?.partialMatches) ? parsed.matchAnalysis.partialMatches : [],
        missingSkills: Array.isArray(parsed.matchAnalysis?.missingSkills) ? parsed.matchAnalysis.missingSkills : [],
        keywordDensity: parsed.matchAnalysis?.keywordDensity || 0,
        experienceMatch: parsed.matchAnalysis?.experienceMatch || { match: 0 },
      },
      gaps: {
        criticalGaps: Array.isArray(parsed.gaps?.criticalGaps) ? parsed.gaps.criticalGaps : [],
        minorGaps: Array.isArray(parsed.gaps?.minorGaps) ? parsed.gaps.minorGaps : [],
        totalGapScore: parsed.gaps?.totalGapScore || 0
      }
    };
  }

  /**
   * Calculate ATS score based on match analysis
   */
  /**
   * Calculate ATS score based on match analysis
   */
  public calculateATSScore(matchAnalysis: MatchAnalysis): number {
    const weights = {
      matchedSkills: 0.5,     // 50% of total score comes from skills
      keywordDensity: 0.2,    // 20%
      experienceMatch: 0.2,   // 20% (increased from 0.1)
      formatting: 0.1         // 10% (buffer)
    };

    const matchedSkills = matchAnalysis.matchedSkills || [];
    const partialMatches = matchAnalysis.partialMatches || [];
    const missingSkills = matchAnalysis.missingSkills || [];

    // Calculate weighted skill score
    // Matched = 1.0
    // Partial = 0.5
    const importantMatched = matchedSkills.filter(s => s.importance === 'critical' || s.importance === 'high').length;
    const importantPartial = partialMatches.filter(s => s.importance === 'critical' || s.importance === 'high').length;
    const importantMissing = missingSkills.filter(s => s.importance === 'critical' || s.importance === 'high').length;

    const totalImportant = importantMatched + importantPartial + importantMissing;
    
    // Formula: (Matched + 0.5 * Partial) / Total
    const skillMatchScore = totalImportant > 0
      ? ((importantMatched * 1.0 + importantPartial * 0.5) / totalImportant) * 100
      : 0;

    const score =
      (skillMatchScore * weights.matchedSkills) +
      ((matchAnalysis.keywordDensity || 0) * weights.keywordDensity) +
      ((matchAnalysis.experienceMatch?.match || 0) * weights.experienceMatch);

    // Normalize to 0-100 and round
    return Math.round(Math.min(100, Math.max(0, score)));
  }

  /**
   * Determine if user is ready to apply (THE CRITICAL LOGIC)
   */
  private determineReadiness(atsScore: number, gaps: GapAnalysis): boolean {
    const criticalGaps = gaps.criticalGaps || [];

    // User Request: If score > 40% OR missing critical skills <= 5, offer to rewrite
    const hasFewCriticalGaps = criticalGaps.length <= 5;
    const meetsMinimumScore = atsScore > 40;

    // We can be much more lenient now as per user request
    return meetsMinimumScore || hasFewCriticalGaps;
  }

  /**
   * Generate detailed recommendation
   * OPTIMIZED: Runs upskill path and alternative jobs in parallel when needed
   */
  private async generateRecommendation(
    aiAnalysis: { matchAnalysis: MatchAnalysis; gaps: GapAnalysis },
    atsScore: number,
    readyToApply: boolean,
    resume: ParsedResume,
    job: JobPosting
  ): Promise<Recommendation> {
    if (readyToApply) {
      // Fast path - no additional API calls needed
      return {
        action: 'optimize',
        confidence: atsScore,
        reasoning: atsScore >= 70
          ? `Your profile is a strong match! With an ATS score of ${atsScore}%, you're qualified for this role. We'll optimize your resume to highlight the right skills and keywords.`
          : `You're a potential match (ATS: ${atsScore}%) but there are some missing keywords. We can rewrite your resume to better align with the job requirements.`,
      };
    }

    // User needs to upskill - generate learning path and alternatives IN PARALLEL
    const [upskillPath, alternativeJobs] = await Promise.all([
      this.generateUpskillPath(aiAnalysis.gaps, resume, job),
      this.findAlternativeJobs(resume, job)
    ]);

    const totalGapScore = aiAnalysis.gaps.totalGapScore;
    let action: 'upskill' | 'apply_junior' | 'not_suitable';
    let reasoning: string;

    if (totalGapScore <= 40) {
      action = 'upskill';
      reasoning = `You're close! With an ATS score of ${atsScore}%, you have ${aiAnalysis.gaps.criticalGaps.length} critical skill gap(s). Estimated upskilling time: ${upskillPath.totalDuration}. This role is within reach with focused learning.`;
    } else if (totalGapScore <= 70) {
      action = 'apply_junior';
      reasoning = `This role requires skills you haven't developed yet (ATS: ${atsScore}%). Consider applying to mid-level or junior positions where you'd be a stronger fit. We've found ${alternativeJobs.length} alternative roles for you.`;
    } else {
      action = 'not_suitable';
      reasoning = `This role requires significantly more experience and skills (ATS: ${atsScore}%). We recommend gaining 1-2 years of experience in a related junior role first, or consider a career transition plan. Check our alternative suggestions.`;
    }

    return {
      action,
      confidence: 100 - totalGapScore,
      reasoning,
      upskillPath,
      alternativeJobs,
    };
  }

  /**
   * Generate personalized upskilling path
   */
  private async generateUpskillPath(
    gaps: GapAnalysis,
    resume: ParsedResume,
    job: JobPosting
  ): Promise<any> {
    const criticalGaps = gaps.criticalGaps || [];
    const minorGaps = gaps.minorGaps || [];
    const allGaps = [...criticalGaps, ...minorGaps];

    const prompt = `
You are a career development advisor. Create a personalized learning path for this candidate.

Candidate's Current Skills: ${resume.skills.map(s => s.name).join(', ')}
Skill Gaps: ${JSON.stringify(allGaps, null, 2)}
Target Job: ${job.title} at ${job.company}

Create a detailed learning path with:
{
  "totalDuration": "total estimated time (e.g., '2-3 months')",
  "priority": 1-5,
  "skills": [
    {
      "skill": "skill name",
      "priority": 1-5 (1 = most critical),
      "estimatedTime": "learning duration",
      "courses": [
        {
          "platform": "Coursera|Udemy|LinkedIn Learning|Pluralsight|edX|YouTube",
          "name": "course name",
          "url": "actual course URL if known, else generic search URL",
          "duration": "course duration",
          "cost": "free" or number,
          "rating": 4.5,
          "enrolled": 50000
        }
      ],
      "projectIdeas": [
        "Build a X using Y",
        "Contribute to Z open source project"
      ],
      "resources": [
        {
          "type": "documentation|tutorial|blog|video|book",
          "title": "resource name",
          "url": "URL",
          "free": true|false
        }
      ]
    }
  ]
}

IMPORTANT:
- Prioritize critical gaps first
- Suggest FREE resources where possible
- Include hands-on projects (crucial for learning)
- Be realistic about time estimates
- Provide multiple learning options (visual, reading, doing)
- Include quick wins (1-2 week skills) and long-term goals

Return ONLY valid JSON.
    `.trim();

    const options = {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 2500,
    };

    const response = await safeOpenAICall(
      () => openai.chat.completions.create(options as any),
      'Upskilling Path',
      options
    );

    const content = response.choices[0].message.content;
    if (!content) throw new Error('No content from OpenAI');
    const upskillPath = JSON.parse(content);

    return {
      ...upskillPath,
      id: this.generateId(),
      estimatedCost: this.calculateTotalCost(upskillPath.skills),
    };
  }

  /**
   * Find alternative jobs user might be qualified for
   */
  private async findAlternativeJobs(resume: ParsedResume, originalJob: JobPosting): Promise<any[]> {
    const prompt = `
Based on this resume, suggest 3-5 alternative job titles that would be a better fit than "${originalJob.title}".

Resume Skills: ${resume.skills.map(s => s.name).join(', ')}
Experience Level: ${resume.experience.length} positions, latest: ${resume.experience[0]?.title}
Original Job: ${originalJob.title} (${originalJob.requirements.experienceLevel} level)

Return JSON array of:
{
  "alternatives": [
    {
      "title": "alternative job title",
      "estimatedScore": 75-95 (predicted ATS score),
      "reason": "why this is a better fit (one sentence)"
    }
  ]
}

Focus on:
- More junior/mid-level versions of the same role
- Related roles that use their existing skills
- Realistic alternatives (not completely different fields)

Return ONLY valid JSON object with "alternatives" key.
    `.trim();

    const options = {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 500,
    };

    const response = await safeOpenAICall(
      () => openai.chat.completions.create(options as any),
      'Alternative Jobs',
      options
    );

    const content = response.choices[0].message.content;
    if (!content) return [];
    const result = JSON.parse(content);
    return result.alternatives || [];
  }

  private calculateTotalCost(skills: any[]): number {
    return skills.reduce((total, skill) => {
      const courseCosts = skill.courses
        .filter((c: any) => c.cost !== 'free')
        .map((c: any) => typeof c.cost === 'number' ? c.cost : 0);
      return total + (courseCosts.length > 0 ? Math.min(...courseCosts) : 0);
    }, 0);
  }

  private generateId(): string {
    return `analysis_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const gapAnalyzerService = new GapAnalyzerService();
