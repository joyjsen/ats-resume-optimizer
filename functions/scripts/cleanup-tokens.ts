import * as admin from 'firebase-admin';

/**
 * PUSH TOKEN CLEANUP SCRIPT (Inside Functions)
 * 
 * This script will clear the 'pushTokens' array for ALL users in Firestore.
 * 
 * Usage:
 * cd functions
 * npx ts-node scripts/cleanup-tokens.ts
 */

// Initialize Firebase Admin
if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: 'ats-resume-optimizer-8652d'
    });
}

const db = admin.firestore();

async function cleanupPushTokens() {
    console.log('--- STARTING PUSH TOKEN CLEANUP ---');

    try {
        const usersSnapshot = await db.collection('users').get();
        console.log(`Found ${usersSnapshot.size} users to process.`);

        const batch = db.batch();
        let count = 0;
        let batchCount = 0;

        for (const userDoc of usersSnapshot.docs) {
            const userData = userDoc.data();

            if (userData.pushTokens && Array.isArray(userData.pushTokens) && userData.pushTokens.length > 0) {
                batch.update(userDoc.ref, {
                    pushTokens: []
                });
                count++;
                batchCount++;

                if (batchCount === 450) {
                    await batch.commit();
                    console.log(`Committed batch of ${batchCount} users...`);
                    batchCount = 0;
                }
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        console.log(`--- SUCCESS ---`);
        console.log(`Cleared push tokens for ${count} users.`);

    } catch (error) {
        console.error('--- FAILURE ---');
        console.error('Error during cleanup:', error);
    }
}

cleanupPushTokens();
