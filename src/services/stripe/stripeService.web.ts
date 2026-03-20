import { Alert } from 'react-native';
import { loadStripe } from '@stripe/stripe-js';
import { ENV } from '../../config/env';
import { getFirebaseFunctions } from '../firebase/config';

export class StripeService {
    async initialize() { return Promise.resolve(); }
    async initializePaymentSheet() { return { success: true }; }

    async openPaymentSheet(uid: string, tokens: number, packageId: string, amount: number) {
        try {
            if (ENV.STRIPE_PUBLISHABLE_KEY === 'pk_test_sample') return this.simulatePurchase(uid, tokens, packageId, amount);

            const stripe = await loadStripe(ENV.STRIPE_PUBLISHABLE_KEY!);
            if (!stripe) throw new Error("Stripe.js failed to load");

            const { httpsCallable } = await import('firebase/functions');
            const functions = await getFirebaseFunctions();
            const result = await httpsCallable(functions, 'createStripeCheckoutSession')({
                amount, packageId, tokens,
                successUrl: window.location.origin + '/purchase?status=success',
                cancelUrl: window.location.origin + '/purchase?status=cancel',
            });

            const { url } = result.data as { url: string };
            if (url) window.location.href = url;
            return { success: true };
        } catch (error: any) {
            console.error("[Stripe Web] Error:", error);
            if (typeof window !== 'undefined') window.alert(`Payment Error: ${error.message}`);
            return { success: false };
        }
    }

    private async simulatePurchase(uid: string, tokens: number, packageId: string, amount: number) {
        return new Promise((resolve, reject) => {
            Alert.alert("Stripe (Simulation)", `Simulating $${amount}`, [
                { text: "Cancel", style: 'cancel', onPress: () => resolve({ success: false }) },
                {
                    text: "Success", onPress: async () => {
                        try { await this.completePurchase(uid, tokens, packageId, amount); resolve({ success: true }); }
                        catch (e) { reject(e); }
                    }
                }
            ]);
        });
    }

    private async completePurchase(uid: string, tokens: number, packageId: string, amount: number) {
        const { userService } = await import('../firebase/userService');
        await userService.creditTokens(uid, tokens);
        const { activityService } = await import('../firebase/activityService');
        await activityService.logActivity({
            type: 'token_purchase',
            description: `Purchased ${tokens} tokens (Web)`,
            contextData: { packageId, amount, tokens },
            platform: 'web'
        });
    }
}

export const stripeService = new StripeService();
