export interface Application {
    id: string;
    userId: string;
    resumeVersionId: string;
    jobTitle: string;
    company: string;
    jobUrl: string;
    appliedDate: Date;
    status: ApplicationStatus;
    timeline: TimelineEvent[];
    notes: string;
    followUpDate?: Date;
    salary?: {
        min?: number;
        max?: number;
        currency: string;
    };
    location: string;
    remote: boolean;
    interviewDates?: Date[];
    offerDetails?: {
        salary: number;
        bonus?: number;
        equity?: string;
        startDate?: Date;
    };
    rejectionReason?: string;
    createdAt: Date;
    updatedAt: Date;
}

export type ApplicationStatus =
    | 'saved'
    | 'applied'
    | 'screening'
    | 'phone_screen'
    | 'technical_interview'
    | 'onsite_interview'
    | 'final_round'
    | 'offer_received'
    | 'offer_accepted'
    | 'offer_declined'
    | 'rejected'
    | 'withdrawn';

export interface TimelineEvent {
    date: Date;
    event: ApplicationStatus;
    notes?: string;
}
