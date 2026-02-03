import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { httpsCallable } from 'firebase/functions';
import { ENV } from '../../config/env';
import { activityService } from '../firebase/activityService';
import { userService } from '../firebase/userService';
import { functions } from '../firebase/config';

export class StripeService {
    private isInitialized = false;

    async initialize() {
        // Initialization is handled by StripeProvider in _layout.tsx
        this.isInitialized = true;
        return Promise.resolve();
    }

    /**
     * Initialize the Payment Sheet
     * Calls the Firebase Cloud Function to create a PaymentIntent and get the clientSecret.
     */
    async initializePaymentSheet(uid: string, amount: number, isDark: boolean = false) {
        try {
            console.log(`[Stripe] Requesting PaymentIntent for $${amount}...`);

            // 1. Call the Firebase Cloud Function
            const createIntent = httpsCallable(functions, 'createStripePaymentIntent');
            const response = await createIntent({ amount });
            const { clientSecret } = response.data as { clientSecret: string };

            if (!clientSecret) {
                throw new Error("Failed to receive client secret from backend.");
            }

            // 2. Initialize the native payment sheet
            const { error } = await initPaymentSheet({
                merchantDisplayName: 'RiResume',
                paymentIntentClientSecret: clientSecret,
                defaultBillingDetails: {
                    name: 'User Name',
                },
                allowsDelayedPaymentMethods: true,
                returnURL: 'atsresumeoptimizer://stripe-redirect',
                style: isDark ? 'alwaysDark' : 'alwaysLight',
                appearance: {
                    colors: {
                        primary: '#6200ee',
                        background: isDark ? '#121212' : '#ffffff',
                        componentBackground: isDark ? '#1e1e1e' : '#ffffff',
                        componentBorder: isDark ? '#333333' : '#e0e0e0',
                        componentDivider: isDark ? '#333333' : '#e0e0e0',
                        primaryText: isDark ? '#ffffff' : '#000000',
                        secondaryText: isDark ? '#cccccc' : '#737373',
                        placeholderText: isDark ? '#888888' : '#a3acb9',
                        icon: isDark ? '#ffffff' : '#000000',
                    }
                }
            });

            if (error) {
                console.error("Error initializing payment sheet:", error);
                throw error;
            }

            return { success: true };
        } catch (error: any) {
            console.error("Payment initialization failed:", error);
            throw error;
        }
    }

    /**
     * Open the Payment Sheet and process the transaction
     */
    async openPaymentSheet(uid: string, tokens: number, packageId: string, amount: number) {
        // SIMULATION: Only use simulation if we specifically want to skip Stripe (handled by backend or env)
        // For now, we always try to present the sheet unless we are in a dev environment without a key.

        if (ENV.STRIPE_PUBLISHABLE_KEY === 'pk_test_sample') {
            const { Alert } = require('react-native');
            return new Promise((resolve, reject) => {
                Alert.alert(
                    "Stripe Checkout (Simulation)",
                    `This is a simulation of the Stripe Payment Sheet for a $${amount} purchase.\n\nNote: A real Stripe sheet requires a secure backend to generate a Client Secret.`,
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

        const { error } = await presentPaymentSheet();

        if (error) {
            if (error.code === 'Canceled') {
                return { success: false, message: 'canceled' };
            }
            throw error;
        } else {
            // STEP 3: Handle successful payment
            await this.completePurchase(uid, tokens, packageId, amount);
            return { success: true };
        }
    }

    /**
     * Internal method to credit tokens and log activity after payment
     */
    private async completePurchase(uid: string, tokens: number, packageId: string, amount: number) {
        // 1. Credit user tokens
        await userService.creditTokens(uid, tokens);

        // 2. Log activity
        await activityService.logActivity({
            type: 'token_purchase',
            description: `Purchased ${tokens} tokens`,
            contextData: { packageId, amount, tokens },
            platform: 'ios'
        });
    }
}

export const stripeService = new StripeService();
