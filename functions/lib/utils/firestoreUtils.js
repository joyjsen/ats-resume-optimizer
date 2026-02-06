"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deductTokens = exports.checkDocExists = void 0;
const admin = require("firebase-admin");
/**
 * Check if a document exists in a collection
 */
async function checkDocExists(collectionName, docId, db) {
    const doc = await db.collection(collectionName).doc(docId).get();
    return doc.exists;
}
exports.checkDocExists = checkDocExists;
/**
 * Transactional token deduction and activity logging
 */
async function deductTokens(userId, cost, type, description, resourceId, db, aiProvider = 'none') {
    const requestId = Math.random().toString(36).substring(7);
    console.log(`[deductTokens][${requestId}] START: ${userId} requesting -${cost} for ${type} (${resourceId})`);
    try {
        await db.runTransaction(async (transaction) => {
            const userRef = db.collection("users").doc(userId);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists) {
                console.error(`[deductTokens] FAILED: User profile not found for ${userId}`);
                throw new Error("User profile not found for token deduction");
            }
            const userData = userSnap.data();
            const currentBalance = userData?.tokenBalance || 0;
            if (currentBalance < cost) {
                console.error(`[deductTokens] FAILED: Insufficient tokens for ${userId}. Balance: ${currentBalance}, Cost: ${cost}`);
                throw new Error(`Insufficient tokens. Balance: ${currentBalance}, Required: ${cost}`);
            }
            const newBalance = currentBalance - cost;
            // 1. Update Balance
            transaction.update(userRef, {
                tokenBalance: newBalance,
                totalTokensUsed: (userData?.totalTokensUsed || 0) + cost,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            // 2. Log Activity
            const activityRef = db.collection("activities").doc();
            transaction.set(activityRef, {
                userId,
                uid: userId,
                type,
                description,
                resourceId,
                tokensUsed: cost,
                tokenBalance: newBalance,
                status: "completed",
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                aiProvider
            });
            console.log(`[deductTokens][${requestId}] SUCCESS: ${userId} new balance: ${newBalance}`);
        });
    }
    catch (error) {
        console.error(`[deductTokens][${requestId}] TRANSACTION ERROR for ${userId}:`, error.message);
        throw error;
    }
}
exports.deductTokens = deductTokens;
//# sourceMappingURL=firestoreUtils.js.map