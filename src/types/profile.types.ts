export type UserRole = 'user' | 'admin';
export type AccountStatus = 'active' | 'suspended' | 'deleted' | 'inactive';
export type AuthProvider = 'google' | 'facebook' | 'apple' | 'email' | 'microsoft' | 'phone';
export type AppTheme = 'light' | 'dark' | 'auto';

export interface LocationData {
    latitude: number;
    longitude: number;
    city: string;
    state: string;
    country: string;
    formattedAddress: string;
    lastUpdated: Date;
}

export interface UserPreferences {
    notificationsEnabled: boolean;
    emailNotifications: boolean;
    smsNotifications: boolean;
    locationTrackingEnabled: boolean;
    theme: AppTheme;
    profileVisibility: 'public' | 'private';
    shareLocationWithEmployers: boolean;
}

export interface UserProfile {
    // Core Identity
    uid: string;
    email: string;
    displayName: string;
    firstName?: string;
    lastName?: string;
    photoURL?: string;
    phoneNumber?: string;

    // Authentication Details
    provider: AuthProvider;
    emailVerified: boolean;
    phoneVerified: boolean;

    // Provider-Specific IDs
    microsoftId?: string;
    facebookId?: string;
    googleId?: string;
    appleId?: string;

    // Microsoft-Specific
    microsoftAccountType?: 'personal' | 'work' | 'school';
    microsoftTenantId?: string;
    officeLocation?: string;

    // Professional Information
    currentOrganization?: string;
    jobTitle?: string; // Current Job Title
    targetJobTitle?: string; // Target Job Title
    industry?: string;
    targetIndustry?: string;
    experienceLevel?: 'entry' | 'mid' | 'senior' | 'executive';
    yearsOfExperience?: string; // Stored as string range or number
    department?: string;
    linkedInUrl?: string;
    primaryGoal?: string;

    // Location Information
    location?: LocationData;

    // Account Management
    role: UserRole;
    accountStatus: AccountStatus;

    // Token System
    tokenBalance: number;
    totalTokensPurchased: number;
    totalTokensUsed: number;

    // Payment Integration
    stripeCustomerId?: string;
    defaultPaymentMethodId?: string;

    // User Preferences (Flattened or nested, here nested is cleaner but sticking to flat for back-compat if needed, let's allow both or migrate. 
    // The prompt requested flat structure in Firestore, but Typescript interfaces can be structured. 
    // Let's stick to the prompt's suggested structure which had preferences nested in the Firestore schema example, but earlier it listed them flat.
    // I will use a flat structure on the main profile for compatibility, but group them conceptually.)

    notificationsEnabled: boolean;
    emailNotifications: boolean;
    smsNotifications: boolean;
    locationTrackingEnabled: boolean;
    theme: AppTheme;
    profileVisibility: 'public' | 'private';
    shareLocationWithEmployers: boolean;

    // Profile Completion
    profileCompleted: boolean;
    profileCompletedAt?: Date;

    // Timestamps
    createdAt: Date;
    lastLoginAt: Date;
    updatedAt: Date;
}

export type ActivityType =
    | 'resume_parsing'
    | 'job_extraction'
    | 'gap_analysis'
    | 'ats_score_calculation'
    | 'bullet_enhancement'
    | 'skill_incorporation'
    | 'resume_optimized'
    | 'resume_reoptimization'
    | 'draft_score_prediction'
    | 'cover_letter_generation'
    | 'company_research'
    | 'interview_prep_generation'
    | 'training_slideshow_generation'
    | 'concept_explanation'
    | 'skill_marked_learned'
    | 'token_purchase'
    | 'pdf_export'
    | 'application_status_update'
    | 'analysis_deleted'
    | 'learning_completion';

export type ActivityStatus = 'completed' | 'failed' | 'cancelled' | 'in_progress';
export type AIProvider = 'openai-gpt4o-mini' | 'perplexity-sonar-pro' | 'none';

export interface UserActivity {
    activityId: string;
    uid: string;
    type: ActivityType;
    description: string;
    resourceId?: string;
    resourceName?: string;
    tokensUsed: number;
    tokenBalance: number;
    aiProvider: AIProvider;
    aiTokensConsumed?: number;
    estimatedCostUSD?: number;
    contextData?: {
        previousATSScore?: number;
        newATSScore?: number;
        scoreImprovement?: number;
        skillsAdded?: string[];
        trainingSlides?: number;
        researchSources?: number;
        prepGuideCategories?: string[];
        [key: string]: any;
    };
    status: ActivityStatus;
    errorMessage?: string;
    platform: 'ios' | 'android' | 'web';
    timestamp: Date;
    duration?: number;
}

export interface TokenPackage {
    id: string;
    name: string;
    tokens: number;
    price: number;
    description: string;
    bonusPercent?: number;
}

export const TOKEN_PACKAGES: TokenPackage[] = [
    { id: 'starter', name: 'Starter Pack', tokens: 100, price: 4.99, description: 'Perfect for a single job application.' },
    { id: 'pro', name: 'Pro Pack', tokens: 250, price: 9.99, description: '20% bonus tokens for multiple applications.', bonusPercent: 20 },
    { id: 'premium', name: 'Premium Pack', tokens: 500, price: 14.99, description: '40% bonus tokens for the complete job search.', bonusPercent: 40 },
];

export const ACTIVITY_COSTS: Record<ActivityType, number> = {
    resume_parsing: 5,
    job_extraction: 3,
    gap_analysis: 10,
    ats_score_calculation: 8,
    bullet_enhancement: 15,
    skill_incorporation: 15,
    resume_optimized: 15,
    resume_reoptimization: 15,
    draft_score_prediction: 5,
    cover_letter_generation: 15,
    company_research: 15,
    interview_prep_generation: 40,
    training_slideshow_generation: 30,
    concept_explanation: 8,
    skill_marked_learned: 0,
    token_purchase: 0,
    pdf_export: 0,
    application_status_update: 0,
    analysis_deleted: 0,
    learning_completion: 0,
};
