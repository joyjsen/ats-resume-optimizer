import { Appearance } from 'react-native';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { ENV } from '../../config/env';
import { getFirebaseFunctions } from '../firebase/config';
import { useProfileStore } from '../../store/profileStore';

export class StripeService {
    private isInitialized = false;

    async initialize() {
        this.isInitialized = true;
        return Promise.resolve();
    }

    async initializePaymentSheet(uid: string, amount: number, currency: string = 'usd') {
        try {
            const { userProfile } = useProfileStore.getState();

            const { httpsCallable } = await import('firebase/functions');
            const functions = await getFirebaseFunctions();
            const createIntent = httpsCallable(functions, 'createStripePaymentIntent');
            const response = (await createIntent({ amount, currency: currency.toLowerCase() })) as any;
            const { clientSecret } = response.data as { clientSecret: string };

            if (!clientSecret) throw new Error("No client secret");

            const { error } = await initPaymentSheet({
                merchantDisplayName: 'RiResume',
                paymentIntentClientSecret: clientSecret,
                defaultBillingDetails: { name: userProfile?.displayName || 'User' },
                allowsDelayedPaymentMethods: true,
                returnURL: 'riresume://stripe-redirect',
                style: 'automatic',
                appearance: { colors: { primary: '#6200ee', error: '#ff1744' }, shapes: { borderRadius: 10, borderWidth: 1 } }
            });

            if (error) throw error;
            return { success: true };
        } catch (error) {
            console.error("Payment initialization failed:", error);
            throw error;
        }
    }

    async openPaymentSheet(uid: string, tokens: number, packageId: string, amount: number) {
        if (ENV.STRIPE_PUBLISHABLE_KEY === 'pk_test_sample') {
            const { Alert } = await import('react-native');
            return new Promise((resolve, reject) => {
                Alert.Alert.alert(
                    "Stripe Checkout (Simulation)",
                    `Simulation for $${amount}`,
                    [
                        { text: "Cancel", style: 'cancel', onPress: () => resolve({ success: false }) },
                        {
                            text: "Simulate Success", onPress: async () => {
                                try { await this.completePurchase(uid, tokens, packageId, amount); resolve({ success: true }); }
                                catch (e) { reject(e); }
                            }
                        }
                    ]
                );
            });
        }

        const { error } = await presentPaymentSheet();
        if (error) {
            return error.code === 'Canceled' ? { success: false, message: 'canceled' } : { success: false, error };
        }
        await this.completePurchase(uid, tokens, packageId, amount);
        return { success: true };
    }

    private async completePurchase(uid: string, tokens: number, packageId: string, amount: number) {
        const { userService } = await import('../firebase/userService');
        await userService.creditTokens(uid, tokens);
        const { activityService } = await import('../firebase/activityService');
        await activityService.logActivity({
            type: 'token_purchase',
            description: `Purchased ${tokens} tokens`,
            contextData: { packageId, amount, tokens },
            platform: 'web'
        });
    }
}

export const stripeService = new StripeService();
