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
}
