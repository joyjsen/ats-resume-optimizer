import { create } from 'zustand';
import { UpskillPath } from '../types/analysis.types';

interface LearningPath extends UpskillPath {
    jobTitle: string;
    company: string;
    startedAt: Date;
    targetDate: Date;
    progress: number;
    status: 'not_started' | 'in_progress' | 'completed';
}

interface LearningState {
    learningPaths: LearningPath[];
    addLearningPath: (path: any) => void; // Using any temporarily to match screen usage which spreads props
    updateProgress: (id: string, progress: number) => void;
}

export const useLearningStore = create<LearningState>((set) => ({
    learningPaths: [],
    addLearningPath: (path) => set((state) => ({
        learningPaths: [...state.learningPaths, path]
    })),
    updateProgress: (id, progress) => set((state) => ({
        learningPaths: state.learningPaths.map(p =>
            p.id === id ? { ...p, progress } : p
        )
    })),
}));
