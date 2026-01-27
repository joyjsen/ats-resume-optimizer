export type TaskType = 'analyze_resume' | 'optimize_resume' | 'add_skill';

export type TaskStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface AnalysisTask {
    id: string;
    userId: string;
    type: TaskType;
    status: TaskStatus;
    progress: number; // 0-100
    stage: string; // e.g. "Parsing PDF", "Analyzing Keywords"
    createdAt: Date;
    updatedAt: Date;

    // Inputs needed to re-run or continue
    payload: {
        jobUrl?: string;
        jobText?: string;
        resumeText?: string;
        resumeFiles?: string[];
        // For Optimization
        analysisId?: string; // If optimizing an existing analysis
        currentAnalysis?: any; // For optimizing based on draft or current state

        // For Skill Addition
        skill?: string;
        targetSections?: string[];
        resume?: any; // Passing current resume state

        // Deduplication
        jobHash?: string;
        resumeHash?: string;
    };

    // Output
    resultId?: string; // ID of the resulting SavedAnalysis
    error?: string;
}
