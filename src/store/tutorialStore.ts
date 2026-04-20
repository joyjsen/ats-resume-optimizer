import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface TutorialState {
    isSkipped: boolean;
    hasSeenAnalyzeStart: boolean;
    hasSeenOptimizePending: boolean;
    hasSeenOptimizeDraft: boolean;
    hasSeenOptimizeOptimized: boolean;
    hasSeenAnalysisDraftSequence: boolean;
    hasSeenAnalysisOptimizedSequence: boolean;
    hasSeenApplicationsSequence: boolean;
    hasSeenResumeUploadTutorial: boolean;
    hasSeenJobUrlTutorial: boolean;

    // Actions
    skipAllTutorials: () => Promise<void>;
    resetTutorials: () => Promise<void>;
    markSeen: (key: keyof Omit<TutorialState, 'isSkipped' | 'skipAllTutorials' | 'resetTutorials' | 'markSeen'>) => Promise<void>;
    loadState: () => Promise<void>;
}

export const useTutorialStore = create<TutorialState>((set) => ({
    isSkipped: false,
    hasSeenAnalyzeStart: false,
    hasSeenOptimizePending: false,
    hasSeenOptimizeDraft: false,
    hasSeenOptimizeOptimized: false,
    hasSeenAnalysisDraftSequence: false,
    hasSeenAnalysisOptimizedSequence: false,
    hasSeenApplicationsSequence: false,
    hasSeenResumeUploadTutorial: false,
    hasSeenJobUrlTutorial: false,

    skipAllTutorials: async () => {
        try {
            set({ isSkipped: true });
            await AsyncStorage.setItem('tutorial_isSkipped', 'true');
        } catch (e) {
            console.error("Failed to skip tutorials", e);
        }
    },

    resetTutorials: async () => {
        try {
            const keysToRemove = [
                'tutorial_isSkipped',
                'tutorial_hasSeenAnalyzeStart',
                'tutorial_hasSeenOptimizePending',
                'tutorial_hasSeenOptimizeDraft',
                'tutorial_hasSeenOptimizeOptimized',
                'tutorial_hasSeenAnalysisDraftSequence',
                'tutorial_hasSeenAnalysisOptimizedSequence',
                'tutorial_hasSeenApplicationsSequence',
                'tutorial_hasSeenResumeUploadTutorial',
                'tutorial_hasSeenJobUrlTutorial'
            ];
            await AsyncStorage.multiRemove(keysToRemove);
            
            // For backward compatibility with the old keys used in `optimize.tsx`:
            await AsyncStorage.multiRemove(['hasSeenOptimizePending', 'hasSeenOptimizeDraft', 'hasSeenOptimizeOptimized', 'hasSeenAnalyzeTutorial']);

            set({
                isSkipped: false,
                hasSeenAnalyzeStart: false,
                hasSeenOptimizePending: false,
                hasSeenOptimizeDraft: false,
                hasSeenOptimizeOptimized: false,
                hasSeenAnalysisDraftSequence: false,
                hasSeenAnalysisOptimizedSequence: false,
                hasSeenApplicationsSequence: false,
                hasSeenResumeUploadTutorial: false,
                hasSeenJobUrlTutorial: false,
            });
        } catch (e) {
            console.error("Failed to reset tutorials", e);
        }
    },

    markSeen: async (key) => {
        try {
            set({ [key]: true });
            await AsyncStorage.setItem(`tutorial_${key}`, 'true');
        } catch (e) {
            console.error(`Failed to mark tutorial ${key} as seen`, e);
        }
    },

    loadState: async () => {
        try {
            const isSkipped = await AsyncStorage.getItem('tutorial_isSkipped');
            const hasSeenAnalyzeStart = await AsyncStorage.getItem('tutorial_hasSeenAnalyzeStart');
            const hasSeenOptimizePending = await AsyncStorage.getItem('tutorial_hasSeenOptimizePending') || await AsyncStorage.getItem('hasSeenOptimizePending');
            const hasSeenOptimizeDraft = await AsyncStorage.getItem('tutorial_hasSeenOptimizeDraft') || await AsyncStorage.getItem('hasSeenOptimizeDraft');
            const hasSeenOptimizeOptimized = await AsyncStorage.getItem('tutorial_hasSeenOptimizeOptimized') || await AsyncStorage.getItem('hasSeenOptimizeOptimized');
            const hasSeenAnalysisDraftSequence = await AsyncStorage.getItem('tutorial_hasSeenAnalysisDraftSequence');
            const hasSeenAnalysisOptimizedSequence = await AsyncStorage.getItem('tutorial_hasSeenAnalysisOptimizedSequence');
            const hasSeenApplicationsSequence = await AsyncStorage.getItem('tutorial_hasSeenApplicationsSequence');
            const hasSeenResumeUploadTutorial = await AsyncStorage.getItem('tutorial_hasSeenResumeUploadTutorial');
            const hasSeenJobUrlTutorial = await AsyncStorage.getItem('tutorial_hasSeenJobUrlTutorial');

            set({
                isSkipped: isSkipped === 'true',
                hasSeenAnalyzeStart: hasSeenAnalyzeStart === 'true' || await AsyncStorage.getItem('hasSeenAnalyzeTutorial') === 'true',
                hasSeenOptimizePending: hasSeenOptimizePending === 'true',
                hasSeenOptimizeDraft: hasSeenOptimizeDraft === 'true',
                hasSeenOptimizeOptimized: hasSeenOptimizeOptimized === 'true',
                hasSeenAnalysisDraftSequence: hasSeenAnalysisDraftSequence === 'true',
                hasSeenAnalysisOptimizedSequence: hasSeenAnalysisOptimizedSequence === 'true',
                hasSeenApplicationsSequence: hasSeenApplicationsSequence === 'true',
                hasSeenResumeUploadTutorial: hasSeenResumeUploadTutorial === 'true',
                hasSeenJobUrlTutorial: hasSeenJobUrlTutorial === 'true',
            });
        } catch (e) {
            console.error("Failed to load tutorial state", e);
        }
    }
}));
