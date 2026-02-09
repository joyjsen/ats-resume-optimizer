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
    pendingSharedUrl: string | null;
    pendingSharedText: string | null; // New field for pre-fetched text
    jobUrl: string; // Persistent shared URL
    jobText: string; // Persistent shared text
    jobTitle: string; // New: Persistent job title
    jobCompany: string; // New: Persistent job company
    setCurrentAnalysis: (analysis: ResumeState['currentAnalysis']) => void;
    addOptimizedVersion: (version: OptimizedVersion) => void;
    setResumes: (resumes: ParsedResume[]) => void;
    setPendingSharedUrl: (url: string | null) => void;
    setPendingSharedText: (text: string | null) => void;
    setJobUrl: (url: string) => void;
    setJobText: (text: string) => void;
    setJobTitle: (title: string) => void;
    setJobCompany: (company: string) => void;
}

export const useResumeStore = create<ResumeState>((set) => ({
    currentAnalysis: null,
    resumes: [],
    pendingSharedUrl: null,
    pendingSharedText: null,
    jobUrl: '',
    jobText: '',
    jobTitle: '',
    jobCompany: '',
    setCurrentAnalysis: (analysis) => set({ currentAnalysis: analysis }),
    addOptimizedVersion: (version) => set((state) => {
        // In a real app, you'd likely update a specific resume in the list
        // or add to a separate 'optimizedVersions' collection
        console.log('Adding optimized version:', version.id);
        return state;
    }),
    setResumes: (resumes) => set({ resumes }),
    setPendingSharedUrl: (url) => set({ pendingSharedUrl: url }),
    setPendingSharedText: (text) => set({ pendingSharedText: text }),
    setJobUrl: (url) => set({ jobUrl: url }),
    setJobText: (text) => set({ jobText: text }),
    setJobTitle: (title) => set({ jobTitle: title }),
    setJobCompany: (company) => set({ jobCompany: company }),
}));
