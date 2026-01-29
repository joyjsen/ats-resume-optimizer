import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { defineSecret } from "firebase-functions/params";

admin.initializeApp();

// Define the secret so it can be used in the function
// This corresponds to 'firebase functions:secrets:set STRIPE_SECRET_KEY'
const stripeSecretKey = defineSecret("STRIPE_SECRET_KEY");

/**
 * Creates a Stripe Payment Intent for a token purchase.
 *
 * @param data.amount - The amount in USD (e.g., 9.99)
 * @param context - Authenticated user context
 * @returns { clientSecret: string }
 */
export const createStripePaymentIntent = functionsV1
    .region("us-central1")
    .runWith({ secrets: [stripeSecretKey] })
    .https.onCall(async (data: any, context: any) => {
        // 1. Authenticate user
        if (!context.auth) {
            throw new functionsV1.https.HttpsError(
                "unauthenticated",
                "You must be logged in to make a purchase."
            );
        }

        const { amount } = data;
        if (!amount || typeof amount !== "number" || amount <= 0) {
            throw new functionsV1.https.HttpsError(
                "invalid-argument",
                "A valid numeric amount is required."
            );
        }

        try {
            const stripe = new Stripe(stripeSecretKey.value(), {
                apiVersion: "2022-11-15", // Use a stable version
            });

            // 2. Create Payment Intent
            // Stripe expects amounts in cents
            const amountInCents = Math.round(amount * 100);

            console.log(`Creating PaymentIntent for UID: ${context.auth.uid}, Amount: ${amountInCents} cents`);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amountInCents,
                currency: "usd",
                automatic_payment_methods: {
                    enabled: true,
                },
                metadata: {
                    uid: context.auth.uid,
                    // You can add more metadata here for tracking
                },
            });

            // 3. Return the client secret
            return {
                clientSecret: paymentIntent.client_secret,
            };
        } catch (error: any) {
            console.error("Stripe Error:", error);
            throw new functionsV1.https.HttpsError(
                "internal",
                error.message || "Failed to create payment intent."
            );
        }
    });

export * from "./notifications";
export * from "./aiAnalysis";
