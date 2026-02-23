export interface AnalysisResult {
    id: string;
    resumeId: string;
    jobId: string;
    atsScore: number;
    readyToApply: boolean;
    matchAnalysis: MatchAnalysis;
    gaps: GapAnalysis;
    recommendation: Recommendation;
    analyzedAt: Date;
    // Optional Draft Data (Loaded when re-visiting an analysis that has pending optimizations)
    draftOptimizedResumeData?: any;
    draftChangesData?: any[];
    draftAtsScore?: number;
    draftMatchAnalysis?: MatchAnalysis;
    optimizedMatchAnalysis?: MatchAnalysis;
    isLocked?: boolean;
    applicationStatus?: string;

    // Baseline Data for Dynamic Skill Score Calculation
    baselineAtsScore?: number;  // ATS score after initial optimization (baseline for skill additions)
    baselineTotalSkills?: number;  // Total skills (partial + missing) at baseline
}

export interface MatchAnalysis {
    matchedSkills: SkillMatch[];
    partialMatches: SkillMatch[];
    missingSkills: SkillMatch[];

    // NEW DETAILED FIELDS
    strongMatches?: any[];
    weakMatches?: any[];
    noMatches?: any[];
    atsKeywordAnalysis?: any;
    executiveSummary?: string;

    keywordDensity: number;
    experienceMatch: {
        match: number;
        requiredYears?: string;
        candidateYears?: string;
        seniorityAlignment?: string;
    };
    readinessVerdict?: 'strong_match' | 'competitive' | 'stretch' | 'underqualified';
    verdictSummary?: string;
}

export interface SkillMatch {
    skill: string;
    importance: 'critical' | 'high' | 'medium' | 'low';
    confidence: number;
    evidence?: string | string[]; // For matched skills, can now be multiple bullets
    candidateSkill?: string; // For partial matches
    transferability?: string; // For partial matches
    recommendation?: string; // Actionable suggestion
    requirementId?: string; // New
}

export interface GapAnalysis {
    criticalGaps: Gap[];
    minorGaps: Gap[];
    totalGapScore: number;
    prioritizedActions?: any[]; // New
}

export interface Gap {
    skill: string;
    importance: 'critical' | 'high' | 'medium' | 'low';
    hasTransferable: boolean;
    recommendation?: string;
    impactOnApplication?: string; // New
}

export interface Recommendation {
    action: 'optimize' | 'upskill' | 'apply_junior' | 'not_suitable';
    confidence: number;
    reasoning: string;
    upskillPath?: UpskillPath;
    alternativeJobs?: AlternativeJob[];
}

export interface UpskillPath {
    id: string;
    totalDuration: string;
    priority: number;
    skills: SkillToLearn[];
    estimatedCost: number;
}

export interface SkillToLearn {
    skill: string;
    priority: 1 | 2 | 3 | 4 | 5;
    estimatedTime: string;
    courses: CourseRecommendation[];
    projectIdeas: string[];
    resources: LearningResource[];
}

export interface CourseRecommendation {
    platform: 'Coursera' | 'Udemy' | 'LinkedIn Learning' | 'Pluralsight' | 'edX';
    name: string;
    url: string;
    duration: string;
    cost: 'free' | number;
    rating?: number;
    enrolled?: number;
}

export interface LearningResource {
    type: 'documentation' | 'tutorial' | 'blog' | 'video' | 'book';
    title: string;
    url: string;
    free: boolean;
}

export interface AlternativeJob {
    title: string;
    company?: string;
    estimatedScore: number;
    reason: string;
    url?: string;
}
