/**
 * REFERENCE ONLY: This code is intended to be deployed to Firebase Cloud Functions.
 * You must run 'firebase init functions' and install dependencies (firebase-admin, firebase-functions)
 * before using this code.
 */

/*
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();
const db = admin.firestore();

// 1. On User Create: Grant Bonus & Welcome
export const onUserCreate = functions.auth.user().onCreate(async (user) => {
    const uid = user.uid;
    const email = user.email;
    const provider = user.providerData && user.providerData.length > 0 ? user.providerData[0].providerId : 'email';

    console.log(`New user created: ${uid}, Provider: ${provider}`);

    try {
        // Standard User Profile Init is handled by client-side 'syncUserProfile' usually, 
        // but doing it here guarantees it even if client fails.
        // However, our client-side logic is robust. 
        // We will focus on the "Bonus" aspect here if not done.
        
        // Let's create the welcome activity log
        const activityRef = db.collection('activities').doc();
        await activityRef.set({
            uid: uid,
            type: 'token_purchase', // or 'bonus'
            description: 'Welcome Bonus: 50 Tokens',
            tokensUsed: 0,
            tokenBalance: 50, // This is just a log, balance is updated in user doc
            aiProvider: 'none',
            status: 'completed',
            platform: 'web', // default
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // We assume tokenBalance is initialized to 50 in client-side syncUserProfile. 
        // If we want to enforce it server-side:
        await db.collection('users').doc(uid).set({
            tokenBalance: 50,
            accountStatus: 'active',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

    } catch (error) {
        console.error("Error in onUserCreate:", error);
    }
});

// 2. Microsoft Custom Token Generator (Conceptual)
// Requires OAuth Setup in Azure
export const createMicrosoftCustomToken = functions.https.onCall(async (data, context) => {
    const { accessToken } = data;
    // Logic: Validate accessToken with Microsoft Graph -> Get User ID -> Create Firebase Custom Token
    // const uid = `microsoft:${graphUser.id}`;
    // const token = await admin.auth().createCustomToken(uid);
    // return { token };
});
*/
