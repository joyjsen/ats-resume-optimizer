import { Alert } from 'react-native';
import { loadStripe } from '@stripe/stripe-js';
import { httpsCallable } from 'firebase/functions';
import { ENV } from '../../config/env';
import { userService } from '../firebase/userService';
import { activityService } from '../firebase/activityService';
import { functions } from '../firebase/config';

export class StripeService {
    private isInitialized = false;

    async initialize() {
        this.isInitialized = true;
        return Promise.resolve();
    }

    async initializePaymentSheet(uid: string, amount: number, isDark: boolean = false) {
        // Stripe Checkout on web handles this during the redirect
        return { success: true };
    }

    async openPaymentSheet(uid: string, tokens: number, packageId: string, amount: number) {
        try {
            console.log(`[Stripe Web] Starting checkout for ${tokens} tokens ($${amount})...`);

            // If in simulation mode, show the simulation alert
            if (ENV.STRIPE_PUBLISHABLE_KEY === 'pk_test_sample') {
                return this.simulatePurchase(uid, tokens, packageId, amount);
            }

            console.log("[Stripe Web] Initializing Stripe JS...");
            const stripe = await loadStripe(ENV.STRIPE_PUBLISHABLE_KEY!);
            if (!stripe) throw new Error("Stripe.js failed to load. Check your publishable key.");

            console.log("[Stripe Web] Creating Checkout Session...");
            const createSession = httpsCallable(functions, 'createStripeCheckoutSession');
            const response = await createSession({
                amount,
                packageId,
                tokens,
                successUrl: window.location.origin + '/purchase?status=success',
                cancelUrl: window.location.origin + '/purchase?status=cancel',
            });

            console.log("[Stripe Web] Backend response:", response.data);
            const { url } = response.data as { sessionId: string, url: string };

            if (!url) {
                throw new Error("Failed to receive checkout URL from backend.");
            }

            console.log("[Stripe Web] Redirecting to Stripe Checkout...");
            window.location.href = url;

            return { success: true };
        } catch (error: any) {
            console.error("[Stripe Web] Error:", error);

            // Extract more specific error message from Firebase Functions error
            let msg = error.message || "Could not initiate payment.";
            if (error.details) {
                msg += ` (${error.details})`;
            } else if (error.code) {
                msg += ` [Code: ${error.code}]`;
            }

            // Web-specific alert fallback
            if (typeof window !== 'undefined') window.alert(`Payment Error: ${msg}`);
            else Alert.alert("Payment Error", msg);

            return { success: false };
        }
    }

    private simulatePurchase(uid: string, tokens: number, packageId: string, amount: number) {
        return new Promise((resolve, reject) => {
            Alert.alert(
                "Stripe Checkout (Simulation - Web)",
                `This is a simulation of the Stripe checkout for a $${amount} purchase.\n\nSimulating purchase of ${tokens} tokens...`,
                [
                    { text: "Cancel", style: 'cancel', onPress: () => resolve({ success: false }) },
                    {
                        text: "Simulate Success",
                        onPress: async () => {
                            try {
                                await this.completePurchase(uid, tokens, packageId, amount);
                                resolve({ success: true });
                            } catch (e) {
                                reject(e);
                            }
                        }
                    }
                ]
            );
        });
    }

    private async completePurchase(uid: string, tokens: number, packageId: string, amount: number) {
        await userService.creditTokens(uid, tokens);
        await activityService.logActivity({
            type: 'token_purchase',
            description: `Purchased ${tokens} tokens (Web)`,
            contextData: { packageId, amount, tokens },
            platform: 'web'
        });
    }
}

export const stripeService = new StripeService();


