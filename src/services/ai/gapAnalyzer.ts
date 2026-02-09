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
You are an expert career advisor, ATS (Applicant Tracking System) specialist, and hiring consultant with deep knowledge of resume screening algorithms and recruitment practices across industries.

## YOUR TASK
Analyze the candidate's resume against the provided job posting to determine application readiness. Perform a rigorous, evidence-based skill matching analysis and return a structured JSON assessment.

## ANALYSIS METHODOLOGY

### Skill Classification Rules
1. **Matched Skill**: The candidate explicitly demonstrates this skill through listed experience, projects, certifications, or their skills section. Evidence must be clear and direct — not assumed.
2. **Partial Match**: The candidate possesses a related, transferable, or adjacent skill that could reasonably bridge to the required skill with minimal ramp-up. Example: "PostgreSQL experience" partially matches a "MySQL" requirement.
3. **Missing Skill**: No evidence whatsoever in the resume — neither direct nor transferable.

### Importance Classification
- **critical**: Explicitly stated as "required," "must-have," or listed in minimum qualifications. The candidate will likely be auto-rejected without this.
- **high**: Strongly emphasized in the posting (mentioned multiple times, listed early, or central to the role's core function).
- **medium**: Listed as "preferred," "nice-to-have," or mentioned once without emphasis.
- **low**: Implied by the role context or industry norms but not explicitly stated in the posting.

### Confidence Scoring (0-100)
Rate how confident you are in each classification:
- **90-100**: Explicit, unambiguous evidence (e.g., skill listed verbatim, years of experience stated)
- **70-89**: Strong evidence through context (e.g., job titles, project descriptions that clearly involve the skill)
- **50-69**: Moderate/indirect evidence (e.g., related tools or frameworks used)
- **30-49**: Weak evidence, largely inferred
- **0-29**: Near-zero evidence, speculative at best

### Scoring Formulas
- **keywordDensity** (0-100): Percentage of important keywords/phrases from the job posting that appear (exactly or semantically) in the resume. Weight critical keywords 3x, high keywords 2x, medium 1x, low 0.5x.
- **experienceMatch** (0-100): How well the candidate's years of experience, seniority level, industry background, and scope of responsibilities align with the job's requirements.
- **totalGapScore** (0-100): Overall gap severity. 0 = no gaps (perfect match), 100 = completely unqualified. Weight critical gaps at 40% each (capped at 100), high gaps at 15% each, medium at 5% each, low at 2% each. Reduce gap weight by 30% if hasTransferable is true.

## OUTPUT FORMAT
Return ONLY valid JSON — no markdown fencing, no commentary, no text before or after the JSON object.

{
  "matchAnalysis": {
    "matchedSkills": [
      {
        "skill": "string — the skill name as referenced in the job posting",
        "importance": "critical | high | medium | low",
        "confidence": "number 0-100",
        "evidence": "string — brief quote or reference from the resume proving this match",
        "recommendation": "string — brief actionable tip to optimize how this skill is presented"
      }
    ],
    "partialMatches": [
      {
        "skill": "string — the required skill from the job posting",
        "importance": "critical | high | medium | low",
        "confidence": "number 0-100",
        "candidateSkill": "string — the related skill the candidate actually has",
        "transferability": "string — brief explanation of how the existing skill transfers",
        "recommendation": "string — brief actionable tip to bridge this partial gap"
      }
    ],
    "missingSkills": [
      {
        "skill": "string — the skill name as referenced in the job posting",
        "importance": "critical | high | medium | low",
        "confidence": "number 0-100",
        "recommendation": "string — brief actionable tip to acquire/demonstrate this missing skill"
      }
    ],
    "keywordDensity": "number 0-100",
    "experienceMatch": {
      "match": "number 0-100",
      "requiredYears": "string — what the job asks for",
      "candidateYears": "string — what the resume shows",
      "seniorityAlignment": "string — e.g., 'Candidate is mid-level, role requires senior'"
    }
  },
  "gaps": {
    "criticalGaps": [
      {
        "skill": "string",
        "importance": "critical",
        "hasTransferable": "boolean",
        "recommendation": "string — actionable suggestion to close this gap (e.g., certification, project, course)"
      }
    ],
    "minorGaps": [
      {
        "skill": "string",
        "importance": "medium | low",
        "hasTransferable": "boolean",
        "recommendation": "string — actionable suggestion to close this gap"
      }
    ],
    "totalGapScore": "number 0-100",
    "readinessVerdict": "strong_match | competitive | stretch | underqualified",
    "verdictSummary": "string — 1-2 sentence plain-English assessment of application readiness"
  }
}

## IMPORTANT RULES
- Be honest and precise. Do not inflate matches to be encouraging — candidates rely on this to make real decisions.
- Every skill in the job posting must appear in exactly ONE category: matchedSkills, partialMatches, or missingSkills. No skill should be omitted or duplicated.
- If the job posting is vague or lacks explicit requirements, infer reasonable requirements from the job title, industry, and seniority level, and note inferred requirements with lower confidence scores.
- Return ONLY the JSON object. No preamble, no explanation, no markdown code blocks.
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
      max_tokens: 2500,
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
        readinessVerdict: parsed.gaps?.readinessVerdict,
        verdictSummary: parsed.gaps?.verdictSummary
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
