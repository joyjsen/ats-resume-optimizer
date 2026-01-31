import { AccountStatus, AuthProvider, UserRole } from "./profile.types";

export interface TokenPurchase {
    purchaseId: string;
    uid: string;
    packageId: string;
    tokensReceived: number;
    amountPaid: number;
    currency: string;
    stripePaymentIntentId: string;
    stripeCustomerId: string;
    paymentStatus: 'succeeded' | 'pending' | 'failed' | 'refunded';
    timestamp: Date;
    platform: 'ios' | 'android' | 'web';
}
