"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = void 0;
const functionsV1 = require("firebase-functions/v1");
const admin = require("firebase-admin");
const stripe_1 = require("stripe");
const params_1 = require("firebase-functions/params");
const stripeSecretKey = (0, params_1.defineSecret)("STRIPE_SECRET_KEY");
const stripeWebhookSecret = (0, params_1.defineSecret)("STRIPE_WEBHOOK_SECRET");
/**
 * Stripe Webhook Handler
 * Listen for successful payments and credit tokens server-side.
 */
exports.stripeWebhook = functionsV1
    .region("us-central1")
    .runWith({ secrets: [stripeSecretKey, stripeWebhookSecret] })
    .https.onRequest(async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const stripe = new stripe_1.default(stripeSecretKey.value(), { apiVersion: "2022-11-15" });
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, stripeWebhookSecret.value());
    }
    catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    // Handle the event
    if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        const { uid, tokens, packageId, amount } = paymentIntent.metadata;
        if (uid && tokens) {
            const tokenCount = parseInt(tokens);
            const cost = parseFloat(amount || "0");
            console.log(`Processing successful payment for UID: ${uid}, Tokens: ${tokenCount}`);
            // 1. Idempotency Check: Check if this payment was already processed
            const activityRef = admin.firestore().collection("activities").doc(paymentIntent.id);
            const activityDoc = await activityRef.get();
            if (activityDoc.exists) {
                console.log(`Payment ${paymentIntent.id} already processed. Skipping.`);
                res.json({ received: true, status: "already_processed" });
                return;
            }
            // 2. Perform updates in a batch for atomicity
            const batch = admin.firestore().batch();
            const userRef = admin.firestore().collection("users").doc(uid);
            // Update user tokens
            batch.update(userRef, {
                tokenBalance: admin.firestore.FieldValue.increment(tokenCount),
                totalTokensPurchased: admin.firestore.FieldValue.increment(tokenCount),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Log activity (using PaymentIntent ID as doc ID for idempotency)
            batch.set(activityRef, {
                uid,
                type: "token_purchase",
                description: `Purchased ${tokenCount} tokens`,
                contextData: {
                    packageId: packageId || "unknown",
                    tokens: tokenCount,
                    amount: cost,
                    stripePaymentIntentId: paymentIntent.id
                },
                platform: "stripe_webhook",
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });
            await batch.commit();
            console.log(`Successfully credited ${tokenCount} tokens to user ${uid}`);
        }
    }
    res.json({ received: true });
});
//# sourceMappingURL=stripeWebhook.js.map