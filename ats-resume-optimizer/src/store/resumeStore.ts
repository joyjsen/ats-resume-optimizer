import { create } from 'zustand';
import { AnalysisResult } from '../types/analysis.types';
import { ParsedResume, OptimizedVersion } from '../types/resume.types';
import { JobPosting } from '../types/job.types';

interface ResumeState {
    currentAnalysis: (AnalysisResult & {
        id?: string;
        job: JobPosting;
        resume: ParsedResume;
        optimizedResume?: ParsedResume;
        changes?: any[];
    }) | null;
    resumes: ParsedResume[];
    setCurrentAnalysis: (analysis: ResumeState['currentAnalysis']) => void;
    addOptimizedVersion: (version: OptimizedVersion) => void;
    setResumes: (resumes: ParsedResume[]) => void;
}

export const useResumeStore = create<ResumeState>((set) => ({
    currentAnalysis: null,
    resumes: [],
    setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }),
    addOptimizedVersion: (version) => set((state) => {
        // In a real app, you'd likely update a specific resume in the list
        // or add to a separate 'optimizedVersions' collection
        console.log('Adding optimized version:', version.id);
        return state;
    }),
    setResumes: (resumes) => set({ resumes }),
}));
