"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = void 0;
const functionsV1 = require("firebase-functions/v1");
const admin = require("firebase-admin");
const stripe_1 = require("stripe");
const secrets_1 = require("./secrets");
/**
 * Stripe Webhook Handler
 * Listen for successful payments and credit tokens server-side.
 */
exports.stripeWebhook = functionsV1
    .region("us-central1")
    .runWith({ secrets: [secrets_1.stripeSecretKey, secrets_1.stripeWebhookSecret] })
    .https.onRequest(async (req, res) => {
    const sig = req.headers["stripe-signature"];
    const stripe = new stripe_1.default(secrets_1.stripeSecretKey.value(), { apiVersion: "2022-11-15" });
    let event;
    try {
        // Stripe expects the raw body for signature verification
        event = stripe.webhooks.constructEvent(req.rawBody, sig, secrets_1.stripeWebhookSecret.value());
    }
    catch (err) {
        console.error(`Webhook Error: ${err.message}`);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    // Handle the event
    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
        const session = event.data.object;
        const metadata = session.metadata || {};
        const { uid, tokens, packageId, amount } = metadata;
        if (uid && tokens) {
            const tokenCount = parseInt(tokens);
            const cost = parseFloat(amount || "0");
            console.log(`Processing successful payment for UID: ${uid}, Tokens: ${tokenCount}`);
            // 1. Idempotency Check: Check if this payment was already processed
            const activityId = session.id;
            const activityRef = admin.firestore().collection("activities").doc(activityId);
            const activityDoc = await activityRef.get();
            if (activityDoc.exists) {
                console.log(`Payment ${activityId} already processed. Skipping.`);
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
            // Log activity
            batch.set(activityRef, {
                uid,
                type: "token_purchase",
                description: `Purchased ${tokenCount} tokens`,
                contextData: {
                    packageId: packageId || "unknown",
                    tokens: tokenCount,
                    amount: cost,
                    stripeId: activityId
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