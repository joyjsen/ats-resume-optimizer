import { AnalysisResult, MatchAnalysis, GapAnalysis, Recommendation } from '../../types/analysis.types';
import { ParsedResume } from '../../types/resume.types';
import { JobPosting } from '../../types/job.types';
import { getFirebaseFunctions } from '../firebase/config';
import { httpsCallable } from 'firebase/functions';

export class GapAnalyzerService {
  /**
   * Main analysis function - determines if user should optimize or upskill
   */
  async analyzeJobFit(resume: ParsedResume, job: JobPosting): Promise<AnalysisResult> {
    try {
      const functions = await getFirebaseFunctions();
      const performGapAnalysis = httpsCallable(functions, 'performGapAnalysis');
      
      const taskId = this.generateId();
      
      const response = await performGapAnalysis({
        taskId,
        resume,
        job
      });
      
      const data = response.data as any;
      if (!data.success) throw new Error(data.error || "Analysis failed");

      const recommendation = await this.generateRecommendation(
        data.atsScore,
        data.readyToApply,
        data.gaps,
        resume,
        job
      );

      const result: AnalysisResult = {
        id: taskId,
        resumeId: '', // Will be set by caller
        jobId: job.id,
        atsScore: data.atsScore,
        readyToApply: data.readyToApply,
        matchAnalysis: data.matchAnalysis,
        gaps: data.gaps,
        recommendation,
        analyzedAt: new Date(),
      };

      return result;
    } catch (error) {
      console.error('Error analyzing job fit:', error);
      throw error;
    }
  }

  /**
   * Determine if user is ready to apply (THE CRITICAL LOGIC)
   */
  private determineReadiness(atsScore: number, gaps: GapAnalysis): boolean {
    const criticalGaps = gaps.criticalGaps || [];
    const hasFewCriticalGaps = criticalGaps.length <= 5;
    const meetsMinimumScore = atsScore > 40;
    return meetsMinimumScore || hasFewCriticalGaps;
  }

  /**
   * Generate detailed recommendation via Backend
   */
  private async generateRecommendation(
    atsScore: number,
    readyToApply: boolean,
    gaps: GapAnalysis,
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

    // Call Backend Recommendation Service
    const functions = await getFirebaseFunctions();
    const generateRecsFunc = httpsCallable(functions, 'generateRecommendation');

    const response = await generateRecsFunc({
        resume, 
        job, 
        gaps
    });
    
    const data = response.data as any;
    if (!data.success) throw new Error(data.error || "Recommendation generation failed");

    const upskillPath = data.upskillPath;
    const alternativeJobs = data.alternativeJobs || [];

    const processedUpskill = {
      ...upskillPath,
      id: this.generateId(),
      estimatedCost: this.calculateTotalCost(upskillPath.skills || []),
    };

    const totalGapScore = gaps.totalGapScore;
    let action: 'upskill' | 'apply_junior' | 'not_suitable';
    let reasoning: string;

    if (totalGapScore <= 40) {
      action = 'upskill';
      reasoning = `You're close! With an ATS score of ${atsScore}%, you have ${gaps.criticalGaps?.length || 0} critical skill gap(s). Estimated upskilling time: ${processedUpskill.totalDuration}. This role is within reach with focused learning.`;
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
      upskillPath: processedUpskill,
      alternativeJobs,
    };
  }

  private calculateTotalCost(skills: any[]): number {
    return skills.reduce((total, skill) => {
      const courseCosts = (skill.courses || [])
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
