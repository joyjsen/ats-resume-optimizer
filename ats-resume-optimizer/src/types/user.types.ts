export interface User {
    id: string;
    email: string;
    name: string;
    photoURL?: string;
    subscription: SubscriptionTier;
    subscriptionExpiry?: Date;
    settings: UserSettings;
    stats: UserStats;
    createdAt: Date;
    lastLoginAt: Date;
}

export type SubscriptionTier = 'free' | 'premium' | 'enterprise';

export interface UserSettings {
    notifications: {
        email: boolean;
        push: boolean;
        followUpReminders: boolean;
        learningReminders: boolean;
    };
    privacy: {
        shareAnonymousData: boolean;
    };
    preferences: {
        defaultResumeTemplate: string;
        autoSaveInterval: number;
    };
}

export interface UserStats {
    resumesCreated: number;
    applicationsTracked: number;
    interviewsReceived: number;
    offersReceived: number;
    averageResponseTime: number;
    averageATSScore: number;
}
