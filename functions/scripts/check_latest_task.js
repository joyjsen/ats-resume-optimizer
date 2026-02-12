
const admin = require('firebase-admin');
const serviceAccount = require('../service-account.json'); // I'll need to check where this key is or if I can use default logic

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: "ats-resume-optimizer-8652d"
    });
}

const db = admin.firestore();

async function checkLatestTask() {
    console.log("Checking latest prep_guide task...");
    const snapshot = await db.collection('background_tasks')
        .where('type', '==', 'prep_guide')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

    if (snapshot.empty) {
        console.log("No prep_guide tasks found.");
        return;
    }

    const doc = snapshot.docs[0];
    const data = doc.data();
    console.log(`Task ID: ${doc.id}`);
    console.log(`Status: ${data.status}`);
    console.log(`Progress: ${data.progress}`);
    console.log(`Created At: ${data.createdAt?.toDate()}`);
    console.log(`Completed At: ${data.completedAt?.toDate()}`);
    console.log(`Error: ${data.error}`);
    console.log(`UserId: ${data.userId}`);
}

checkLatestTask().catch(console.error);
