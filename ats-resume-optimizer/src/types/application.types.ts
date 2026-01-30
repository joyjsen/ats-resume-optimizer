export type ApplicationStage =
    | 'not_applied'
    | 'submitted'
    | 'phone_screen'
    | 'technical'
    | 'final_round'
    | 'offer'
    | 'rejected'
    | 'withdrawn'
    | 'other';

export interface TimelineEvent {
    stage: ApplicationStage;
    date: Date;
    note?: string;
    customStageName?: string; // If stage is 'other'
}

export interface Application {
    id: string;
    userId: string;
    analysisId: string; // Link to original analysis

    // Snapshot data for display (reduce reads)
    jobTitle: string;
    company: string;
    jobDescription: string;
    atsScore: number;

    // Status tracking
    currentStage: ApplicationStage;
    customStageName?: string;
    lastStatusUpdate: Date;
    timeline: TimelineEvent[];
    isArchived: boolean;

    // Resume Versioning
    // If 'submitted', this tracks the specific version used
    submittedResumeData?: any;
    lastResumeUpdateAt?: Date; // To track if regeneration is needed

    // AI Content
    coverLetter?: {
        status?: 'generating' | 'completed' | 'failed';
        content: string;
        generatedAt: Date;
        lastEditedAt?: Date;
        startedAt?: Date;
        completedAt?: Date;
    };
    prepGuide?: {
        status: 'generating' | 'completed' | 'failed' | 'cancelled';
        startedAt: Date;
        progress: number;
        currentStep?: string;
        sections?: {
            companyIntelligence?: string;
            roleAnalysis?: string;
            technicalPrep?: string;
            behavioralFramework?: string;
            storyMapping?: string;
            questionsToAsk?: string;
            interviewStrategy?: string;
        };
        downloadUrl?: string; // from storage
        storagePath?: string;
        generatedAt?: Date; // Completion time (for update logic)
    };
    prepGuideHistory?: {
        id: string; // unique run ID
        status: 'generating' | 'completed' | 'failed' | 'cancelled';
        startedAt: Date;
        generatedAt?: Date; // or failedAt
    }[];
    practiceQuestionsUrl?: string; // Placeholder

    interviewNotes?: string;
    finalResult?: string; // Notes on offer/rejection

    createdAt: Date;
    updatedAt: Date;
    prepGuideGeneratedAt?: Date;

    // Read-only mode for pending/draft analyses
    isReadOnly?: boolean;
    analysisStatus?: 'pending_resume_update' | 'draft_ready' | 'optimized' | 'pending_skill_update';
}
