import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import Stripe from "stripe";
import { defineSecret } from "firebase-functions/params";

admin.initializeApp();

import { stripeSecretKey } from "./secrets";

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

/**
 * Creates a Stripe Checkout Session for web-based token purchases.
 */
export const createStripeCheckoutSession = functionsV1
    .region("us-central1")
    .runWith({ secrets: [stripeSecretKey] })
    .https.onCall(async (data: any, context: any) => {
        if (!context.auth) {
            throw new functionsV1.https.HttpsError("unauthenticated", "You must be logged in.");
        }

        const { amount, packageId, tokens, successUrl, cancelUrl } = data;

        try {
            const stripe = new Stripe(stripeSecretKey.value(), {
                apiVersion: "2022-11-15",
            });

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ["card"],
                line_items: [
                    {
                        price_data: {
                            currency: "usd",
                            product_data: {
                                name: `${tokens} Tokens Package`,
                                description: `Purchase ${tokens} tokens for ATS Resume Optimizer`,
                            },
                            unit_amount: Math.round(amount * 100),
                        },
                        quantity: 1,
                    },
                ],
                mode: "payment",
                success_url: successUrl,
                cancel_url: cancelUrl,
                metadata: {
                    uid: context.auth.uid,
                    packageId,
                    tokens: tokens.toString(),
                },
                customer_email: context.auth.token.email,
            });

            return { sessionId: session.id, url: session.url };
        } catch (error: any) {
            console.error("Checkout Session Error:", error);
            throw new functionsV1.https.HttpsError("internal", error.message);
        }
    });


export * from "./notifications";
export * from "./aiAnalysis";
export * from "./stripeWebhook";
