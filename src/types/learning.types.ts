export type LearningPath = 'self' | 'ai';
export type LearningStatus = 'todo' | 'completed';

export interface LearningEntry {
    id: string;
    userId: string;
    skillName: string;
    jobTitle: string;
    companyName: string;
    path: LearningPath;
    status: LearningStatus;
    completionDate?: Date;
    archived?: boolean;
    slides?: {
        title: string;
        points: { title: string; description: string }[];
    }[];
    currentSlide?: number;
    totalSlides?: number;
    createdAt: Date;
    updatedAt: Date;
    generationStatus?: 'generating' | 'completed' | 'failed' | null;
}
