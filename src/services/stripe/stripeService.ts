import { Platform, Appearance } from 'react-native';
import { initPaymentSheet, presentPaymentSheet } from '@stripe/stripe-react-native';
import { httpsCallable } from 'firebase/functions';
import { ENV } from '../../config/env';
import { activityService } from '../firebase/activityService';
import { userService } from '../firebase/userService';
import { functions } from '../firebase/config';
import { useProfileStore } from '../../store/profileStore';

export class StripeService {
    private isInitialized = false;

    async initialize() {
        // Initialization is handled by StripeProvider in _layout.tsx
        this.isInitialized = true;
        return Promise.resolve();
    }

    async initializePaymentSheet(uid: string, amount: number, isDark: boolean = false) {
        try {
            // Detect system color scheme
            const systemColorScheme = Appearance.getColorScheme();
            const isSystemDark = systemColorScheme === 'dark';

            console.log(`[Stripe] Initializing PaymentSheet. systemColorScheme: ${systemColorScheme}, isSystemDark: ${isSystemDark}`);

            const { userProfile } = useProfileStore.getState();

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
                    name: userProfile?.displayName || 'User',
                },
                allowsDelayedPaymentMethods: true,
                returnURL: 'riresume://stripe-redirect',
                // Use 'automatic' to let the native Stripe SDK detect the OS theme directly.
                // This bypasses the app's 'userInterfaceStyle: light' setting which was confusing the logic.
                style: 'automatic',
                appearance: {
                    colors: {
                        primary: '#6200ee',
                        error: '#ff1744',
                    },
                    shapes: {
                        borderRadius: 10,
                        borderWidth: 1,
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
