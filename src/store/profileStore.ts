import { create } from 'zustand';
import { UserProfile, UserActivity } from '../types/profile.types';
import { getFirebaseAuth } from '../services/firebase/config';



interface UserStats {
    resumesAnalyzed: number;
    resumesOptimized: number;
    resumesReoptimized: number;
    prepGuides: number;
    skillsLearned: number;
    coverLetters: number;
}

interface ProfileState {
    userProfile: UserProfile | null;
    activities: UserActivity[];
    userStats: UserStats | null;
    loading: boolean;
    isInitialized: boolean;
    error: string | null;

    setUserProfile: (profile: UserProfile | null) => void;
    setInitialized: (initialized: boolean) => void;
    fetchActivities: () => Promise<void>;
    fetchUserStats: () => Promise<void>;
    refreshProfile: () => Promise<void>;
    addActivity: (activity: UserActivity) => void;
    subscribeToProfile: (uid: string) => () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
    userProfile: null,
    activities: [],
    userStats: null,
    loading: false,
    isInitialized: false,
    error: null,

    setUserProfile: (profile) => set({ userProfile: profile }),
    setInitialized: (initialized) => set({ isInitialized: initialized }),

    fetchActivities: async () => {
        const auth = await getFirebaseAuth();
        const user = auth.currentUser;
        if (!user) return;


        set({ loading: true });
        try {
            const { activityService } = await import('../services/firebase/activityService');
            const activities = await activityService.getRecentActivity(500);
            set({ activities, loading: false });
        } catch (error: any) {
            set({ error: error.message, loading: false });
        }
    },


    fetchUserStats: async () => {
        const auth = await getFirebaseAuth();
        const user = auth.currentUser;
        if (!user) return;


        try {
            const { userService } = await import('../services/firebase/userService');
            const stats = await userService.getUserStats(user.uid);
            set({ userStats: stats });
        } catch (error) {
            console.error("Failed to fetch user stats:", error);
        }
    },


    refreshProfile: async () => {
        const auth = await getFirebaseAuth();
        const user = auth.currentUser;
        if (!user) return;


        try {
            const { userService } = await import('../services/firebase/userService');
            const { activityService } = await import('../services/firebase/activityService');

            const [profile, stats] = await Promise.all([
                userService.getUserProfile(user.uid),
                userService.getUserStats(user.uid)
            ]);
            set({ userProfile: profile, userStats: stats });
            const activities = await activityService.getRecentActivity(500);
            set({ activities });
        } catch (error) {
            console.error("Failed to refresh profile:", error);
        }
    },


    addActivity: (activity) => {
        set((state) => ({
            activities: [activity, ...state.activities.slice(0, 499)],
            userProfile: state.userProfile ? {
                ...state.userProfile,
                tokenBalance: activity.tokenBalance,
                totalTokensUsed: state.userProfile.totalTokensUsed + activity.tokensUsed
            } : null
        }));
    },

    subscribeToProfile: (uid: string) => {
        console.log("Setting up profile subscription for:", uid);
        let currentUnsubscribe: (() => void) | null = null;
        let isCancelled = false;

        // Asynchronous setup for the subscription
        import('../services/firebase/userService').then(async ({ userService }) => {
            const unsub = await userService.subscribeToUserProfile(uid, (profile) => {
                console.log("Profile update received. Balance:", profile?.tokenBalance);
                set({ userProfile: profile });
            });
            
            if (isCancelled) {
                unsub();
            } else {
                currentUnsubscribe = unsub;
            }
        });

        return () => {
            isCancelled = true;
            if (currentUnsubscribe) {
                currentUnsubscribe();
            }
        };
    }

}));
