"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStripePaymentIntent = void 0;
const functionsV1 = require("firebase-functions/v1");
const admin = require("firebase-admin");
const stripe_1 = require("stripe");
const params_1 = require("firebase-functions/params");
admin.initializeApp();
// Define the secret so it can be used in the function
// This corresponds to 'firebase functions:secrets:set STRIPE_SECRET_KEY'
const stripeSecretKey = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
/**
 * Creates a Stripe Payment Intent for a token purchase.
 *
 * @param data.amount - The amount in USD (e.g., 9.99)
 * @param context - Authenticated user context
 * @returns { clientSecret: string }
 */
exports.createStripePaymentIntent = functionsV1
    .region("us-central1")
    .runWith({ secrets: [stripeSecretKey] })
    .https.onCall(async (data, context) => {
    // 1. Authenticate user
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "You must be logged in to make a purchase.");
    }
    const { amount } = data;
    if (!amount || typeof amount !== "number" || amount <= 0) {
        throw new functionsV1.https.HttpsError("invalid-argument", "A valid numeric amount is required.");
    }
    try {
        const stripe = new stripe_1.default(stripeSecretKey.value(), {
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
    }
    catch (error) {
        console.error("Stripe Error:", error);
        throw new functionsV1.https.HttpsError("internal", error.message || "Failed to create payment intent.");
    }
});
__exportStar(require("./notifications"), exports);
__exportStar(require("./aiAnalysis"), exports);
//# sourceMappingURL=index.js.map