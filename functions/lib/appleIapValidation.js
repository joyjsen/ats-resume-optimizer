"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateAppleReceipt = void 0;
const functionsV1 = require("firebase-functions/v1");
const admin = require("firebase-admin");
const params_1 = require("firebase-functions/params");
// Apple Shared Secret for receipt validation
// Set via: firebase functions:secrets:set APPLE_SHARED_SECRET
const appleSharedSecret = (0, params_1.defineSecret)("APPLE_SHARED_SECRET");
/**
 * Product ID → Token count mapping.
 * Must match exactly what's in App Store Connect and iapService.ts on the client.
 */
const PRODUCT_TOKEN_MAP = {
    "com.jsn22.atsresumeoptimizer.tokens.starter": { tokens: 100, packageId: "starter", price: 4.99 },
    "com.jsn22.atsresumeoptimizer.tokens.pro": { tokens: 250, packageId: "pro", price: 9.99 },
    "com.jsn22.atsresumeoptimizer.tokens.premium": { tokens: 500, packageId: "premium", price: 14.99 },
};
/**
 * Validates an Apple IAP receipt and grants tokens to the user.
 *
 * Flow:
 * 1. Receive receipt data (base64) from the iOS app
 * 2. Validate with Apple's production endpoint
 * 3. If Apple returns 21007 (sandbox receipt), retry with sandbox endpoint
 * 4. Check the in_app array for matching product purchase
 * 5. Check for duplicate transaction IDs (idempotency)
 * 6. Credit tokens to user's Firestore document
 * 7. Return success + token count
 */
exports.validateAppleReceipt = functionsV1
    .region("us-central1")
    .runWith({ secrets: [appleSharedSecret] })
    .https.onCall(async (data, context) => {
    // 1. Authenticate user
    if (!context.auth) {
        throw new functionsV1.https.HttpsError("unauthenticated", "You must be logged in to validate a purchase.");
    }
    const { receiptData, productId } = data;
    const uid = context.auth.uid;
    if (!receiptData || typeof receiptData !== "string") {
        throw new functionsV1.https.HttpsError("invalid-argument", "A valid receipt is required.");
    }
    if (!productId || !PRODUCT_TOKEN_MAP[productId]) {
        throw new functionsV1.https.HttpsError("invalid-argument", `Unknown product ID: ${productId}`);
    }
    try {
        // 2. Validate receipt with Apple
        const validationResult = await validateWithApple(receiptData, appleSharedSecret.value().trim());
        if (!validationResult.valid) {
            console.error(`[Apple IAP] Invalid receipt for UID ${uid}:`, validationResult.status);
            return { success: false, error: `Receipt validation failed (status: ${validationResult.status})` };
        }
        // 3. Find the matching purchase in the receipt's in_app array or latest_receipt_info
        const inAppPurchases = validationResult.receipt?.in_app || [];
        const latestPurchases = validationResult.latest_receipt_info || [];
        const allPurchases = [...inAppPurchases, ...latestPurchases];
        const transactionIdFromClient = data.transactionId;
        console.log(`[Apple IAP] Validating product: ${productId} for UID: ${uid}. Client provided Transaction ID: ${transactionIdFromClient || 'none'}`);
        console.log(`[Apple IAP] Found ${allPurchases.length} total items in receipt (in_app: ${inAppPurchases.length}, latest: ${latestPurchases.length}).`);
        // Detailed logging (condensed)
        allPurchases.forEach((p, idx) => {
            console.log(`[Apple IAP] Item #${idx}: Prod=${p.product_id}, TX=${p.transaction_id}, OriginalTX=${p.original_transaction_id}`);
        });
        const matchingPurchase = allPurchases.find((item) => {
            if (transactionIdFromClient) {
                // Try to match by transaction_id or original_transaction_id
                return item.product_id === productId && (item.transaction_id === transactionIdFromClient || item.original_transaction_id === transactionIdFromClient);
            }
            return item.product_id === productId;
        });
        if (!matchingPurchase) {
            console.error(`[Apple IAP] Product ${productId}${transactionIdFromClient ? ` (TX: ${transactionIdFromClient})` : ""} not found in receipt.`);
            // Log the first item's structure for debugging if available
            if (allPurchases.length > 0) {
                console.log("[Apple IAP] First available item keys:", Object.keys(allPurchases[0]));
            }
            return { success: false, error: "Product not found in receipt." };
        }
        const transactionId = matchingPurchase.transaction_id;
        console.log(`[Apple IAP] Valid receipt. Transaction: ${transactionId}, Product: ${productId}, UID: ${uid}`);
        // 4. Idempotency check — prevent duplicate token grants
        const txRef = admin.firestore().collection("processed_apple_transactions").doc(transactionId);
        const txDoc = await txRef.get();
        if (txDoc.exists) {
            console.log(`[Apple IAP] Transaction ${transactionId} already processed. Skipping.`);
            return {
                success: true,
                tokensGranted: 0,
                message: "This purchase was already processed.",
                alreadyProcessed: true,
            };
        }
        // 5. Credit tokens atomically
        const tokenInfo = PRODUCT_TOKEN_MAP[productId];
        const batch = admin.firestore().batch();
        const userRef = admin.firestore().collection("users").doc(uid);
        // Update user token balance
        batch.update(userRef, {
            tokenBalance: admin.firestore.FieldValue.increment(tokenInfo.tokens),
            totalTokensPurchased: admin.firestore.FieldValue.increment(tokenInfo.tokens),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Record the processed transaction (for idempotency)
        batch.set(txRef, {
            uid,
            productId,
            tokens: tokenInfo.tokens,
            packageId: tokenInfo.packageId,
            transactionId,
            processedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        // Log activity (same pattern as stripeWebhook.ts)
        const activityRef = admin.firestore().collection("activities").doc(`apple_${transactionId}`);
        batch.set(activityRef, {
            uid,
            type: "token_purchase",
            description: `Purchased ${tokenInfo.packageId} tokens (Apple)`,
            tokensUsed: tokenInfo.tokens,
            contextData: {
                packageId: tokenInfo.packageId,
                tokens: tokenInfo.tokens,
                amount: tokenInfo.price,
                transactionId,
                source: "apple_iap",
            },
            platform: "ios",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });
        await batch.commit();
        console.log(`[Apple IAP] Successfully credited ${tokenInfo.tokens} tokens to user ${uid}`);
        return {
            success: true,
            tokensGranted: tokenInfo.tokens,
        };
    }
    catch (error) {
        console.error("[Apple IAP] Validation error:", error);
        throw new functionsV1.https.HttpsError("internal", error.message || "Failed to validate Apple receipt.");
    }
});
/**
 * Validates a receipt with Apple's verifyReceipt endpoint.
 *
 * Strategy:
 * 1. Try production endpoint first
 * 2. If Apple returns status 21007 (sandbox receipt sent to production), retry with sandbox
 * This is Apple's recommended approach for handling both environments.
 */
async function validateWithApple(receiptData, sharedSecret) {
    const PRODUCTION_URL = "https://buy.itunes.apple.com/verifyReceipt";
    const SANDBOX_URL = "https://sandbox.itunes.apple.com/verifyReceipt";
    const requestBody = JSON.stringify({
        "receipt-data": receiptData,
        "password": sharedSecret,
        // Removed exclude-old-transactions as it can cause issues with consumables in some sandbox cases
    });
    // Try production first
    let response = await fetch(PRODUCTION_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: requestBody,
    });
    let result = await response.json();
    // 21007 means the receipt is from the sandbox environment
    // Retry with sandbox URL (Apple's recommended approach)
    if (result.status === 21007) {
        console.log("[Apple IAP] Sandbox receipt detected, retrying with sandbox URL...");
        response = await fetch(SANDBOX_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
        });
        result = await response.json();
    }
    // Status 0 means valid
    if (result.status === 0) {
        return {
            valid: true,
            status: 0,
            receipt: result.receipt,
            latest_receipt_info: result.latest_receipt_info, // Path to newer transactions
        };
    }
    return {
        valid: false,
        status: result.status,
    };
}
//# sourceMappingURL=appleIapValidation.js.map