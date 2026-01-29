import { AnalysisResult } from './analysis.types';
import { JobPosting } from './job.types';
import { ParsedResume } from './resume.types';

export interface SavedAnalysis {
    id: string; // Firestore ID
    userId: string;
    jobTitle: string;
    company: string;
    atsScore: number;
    action: 'optimize' | 'upskill' | 'apply_junior' | 'not_suitable';
    createdAt: Date;
    updatedAt?: Date;

    // Stored references or full objects (simplified for this MVP)
    analysisData: AnalysisResult;
    jobData: JobPosting;
    resumeData?: ParsedResume;
    optimizedResumeData?: ParsedResume;
    changesData?: any[];

    // Deduplication
    jobHash?: string;
    resumeHash?: string;

    // Draft/Pending Data
    draftOptimizedResumeData?: any;
    draftChangesData?: any[];
    draftAtsScore?: number;
    draftMatchAnalysis?: any;

    // Baseline Data for Dynamic Skill Score Calculation
    baselineAtsScore?: number;  // ATS score after initial optimization (baseline for skill additions)
    baselineTotalSkills?: number;  // Total skills (partial + missing) at baseline

    // Application Tracking Integration
    applicationId?: string; // Link to the created application
    applicationStatus?: string; // Denormalized status for Dashboard badges
    isLocked?: boolean; // If true, resume editing is disabled (e.g. submitted)
    analysisStatus?: string; // e.g. 'optimized', 'pending_resume_update', 'draft_ready'
}
