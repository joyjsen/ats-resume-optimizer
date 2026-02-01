"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserDocUpdated = exports.onTaskUpdated = exports.onActivityCreated = exports.onUserCreated = void 0;
const functionsV1 = require("firebase-functions/v1");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const params_1 = require("firebase-functions/params");
const smtpEmail = (0, params_1.defineSecret)("SMTP_EMAIL");
const smtpPassword = (0, params_1.defineSecret)("SMTP_PASSWORD");
// Initialize Nodemailer Transporter
const getTransporter = () => {
    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: smtpEmail.value(),
            pass: smtpPassword.value(),
        },
    });
};
// --- Helper: Send Email ---
async function sendEmail(to, subject, html) {
    try {
        const transporter = getTransporter();
        await transporter.sendMail({
            from: `"ATS Resume Optimizer" <${smtpEmail.value()}>`,
            to,
            subject,
            html,
        });
        console.log(`Email sent to ${to}: ${subject}`);
    }
    catch (error) {
        console.error("Error sending email:", error);
    }
}
// --- Helper: Send Push Notification ---
async function sendPush(uid, title, body, data) {
    try {
        const userDoc = await admin.firestore().collection("users").doc(uid).get();
        if (!userDoc.exists)
            return;
        const userData = userDoc.data();
        const tokens = userData?.pushTokens || [];
        if (!tokens.length)
            return;
        // Using Expo Push API (or Firebase Cloud Messaging if tokens are FCM)
        // Since we used expo-notifications, getting an Expo Push Token means we should use Expo's API
        // BUT expo-notifications can also get FCM tokens. The standard way with Firebase Admin SDK 
        // implies FCM tokens.
        // IF the token starts with "ExponentPushToken", we need to hit Expo API, NOT Firebase Admin.
        // For simplicity and robust backend, let's assume we use Expo's API via fetch or a library.
        // However, adding another dependency might be annoying.
        // Let's implement a simple fetch to Expo.
        const messages = tokens.map((token) => ({
            to: token,
            sound: "default",
            title,
            body,
            data,
        }));
        // Send to Expo
        // We use fetch here. Node 18+ has global fetch.
        await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
                Accept: "application/json",
                "Accept-encoding": "gzip, deflate",
                "Content-Type": "application/json",
            },
            body: JSON.stringify(messages),
        });
        console.log(`Push sent to ${uid}: ${title}`);
    }
    catch (error) {
        console.error("Error sending push:", error);
    }
}
// 1. Welcome Email (onUserCreated)
exports.onUserCreated = functionsV1
    .runWith({ secrets: [smtpEmail, smtpPassword] })
    .auth.user().onCreate(async (user) => {
    if (!user.email)
        return;
    const subject = "Welcome to ATS Resume Optimizer!";
    const html = `
        <h1>Welcome, ${user.displayName || 'User'}!</h1>
        <p>Thank you for signing up. We are excited to help you land your dream job.</p>
        <p>Get started by uploading your resume today!</p>
    `;
    await sendEmail(user.email, subject, html);
});
// 2. Monitoring Activities (Invoice, Learning, Admin Adjustment)
exports.onActivityCreated = functionsV1
    .runWith({ secrets: [smtpEmail, smtpPassword] })
    .firestore
    .document("activities/{activityId}")
    .onCreate(async (snap, context) => {
    const activity = snap.data();
    const uid = activity.uid;
    const userRec = await admin.auth().getUser(uid);
    const email = userRec.email;
    // A. Token Purchase -> Invoice
    if (activity.type === "token_purchase" && email) {
        // Fetch user profile for personalization
        const userDoc = await admin.firestore().collection("users").doc(uid).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        const firstName = userData?.firstName || userData?.displayName?.split(' ')[0] || 'there';
        const tokens = activity.contextData?.amount || 'tokens';
        const cost = activity.contextData?.cost || '0.00';
        const transactionId = snap.id;
        const subject = "Your ResuMate Tokens Are Ready! 🚀";
        const html = `
                <p>Hi ${firstName},</p>
                <p>Your token purchase is confirmed!</p>
                <p><strong>${tokens} tokens added to your account</strong></p>
                <p>Amount: $${cost}</p>
                <p>Order ID: ${transactionId}</p>
                <p>Your tokens are ready to use. Open ResuMate to start optimizing your applications.</p>
                <p>Need help? Reply to this email.</p>
                <p>Thanks,<br/>ResuMate</p>
            `;
        await sendEmail(email, subject, html);
    }
    // B. Admin Adjustment -> Email
    // Assuming admin logs activity type 'admin_adjustment' (we might need to ensure this type exists)
    if (activity.type === "admin_adjustment" && email) {
        const subject = "Your Token Balance Has Been Updated";
        const html = `
                <h1>Admin Adjustment</h1>
                <p>An admin has updated your token balance.</p>
                <p>Description: ${activity.description}</p>
             `;
        await sendEmail(email, subject, html);
    }
    // C. Learning Completion -> Email + Push
    if (activity.type === "learning_completion") {
        // Email
        if (email) {
            await sendEmail(email, "Course Completed!", `Congratulations! You have completed the module: ${activity.resourceName}`);
        }
        // Push - REMOVED (Local notification handled by app)
        // await sendPush(uid, "Module Completed!", `You finished ${activity.resourceName}. Great job!`);
    }
});
// 3. Monitoring Tasks (Analyze, Prep Guide, Cover Letter) -> Completion
exports.onTaskUpdated = functionsV1
    .runWith({ secrets: [smtpEmail, smtpPassword] })
    .firestore
    .document("analysis_tasks/{taskId}")
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    // Only trigger on completion
    if (before.status !== "completed" && after.status === "completed") {
        const uid = after.userId;
        const userRec = await admin.auth().getUser(uid);
        const email = userRec.email;
        const type = after.type; // 'resume_analysis', 'prep_guide', 'cover_letter'
        let title = "";
        let body = "";
        let emailSubject = "";
        let emailBody = "";
        if (type === "resume_analysis" || type === "analyze_resume") {
            title = "Analysis Complete";
            body = "Your resume analysis is ready. Tap to view.";
            emailSubject = "Resume Analysis Complete";
            emailBody = `<p>Your resume has been analyzed.</p><a href="#">View Results in App</a>`;
        }
        else if (type === "prep_guide" || type === "prep_guide_refresh") {
            // "Prep Guide" and "Re-Generate"
            // Push handled by App (Local)
            emailSubject = "Interview Prep Guide Ready";
            emailBody = `<p>Your interview prep guide is ready.</p>`;
        }
        else if (type === "cover_letter") {
            // Push handled by App (Local)
            emailSubject = "Cover Letter Generated";
            emailBody = `<p>Your cover letter is ready for review.</p>`;
        }
        else if (type === "course_completion") {
            // Push handled by App (Local)
            emailSubject = "AI Training Course Completed";
            emailBody = `<p>Congratulations! You have successfully completed your training course.</p>`;
        }
        else if (type === "resume_validation") {
            title = "Resume Validated & Saved";
            body = "Your optimized resume has been saved to your dashboard.";
        }
        const isAnalysisTask = type === "resume_analysis" || type === "analyze_resume";
        if (title && !isAnalysisTask) {
            // Push
            await sendPush(uid, title, body, { taskId: context.params.taskId, type });
        }
        // Email (Except optimization usually, unless requested. User asked for: Prep Guide, Re-Generate, Cover Letter)
        // User requested: "Prep Guide", "Re-Generate", "Cover Letter". 
        // User requested Push for: "Analyze", "Rewrite", "Validate"(Save), "Prep", "Re-prep", "Cover Letter"
        // Filter Emails based on request
        const validEmailTypes = ["prep_guide", "prep_guide_refresh", "cover_letter", "course_completion"];
        if (email && validEmailTypes.includes(type)) {
            await sendEmail(email, emailSubject, emailBody);
        }
    }
});
// 4. Password Update (Email only)
exports.onUserDocUpdated = functionsV1
    .runWith({ secrets: [smtpEmail, smtpPassword] })
    .firestore
    .document("users/{uid}")
    .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    // Check if passwordUpdatedAt changed
    if (before.passwordUpdatedAt !== after.passwordUpdatedAt && after.passwordUpdatedAt) {
        const userRec = await admin.auth().getUser(context.params.uid);
        if (userRec.email && userRec.providerData.some(p => p.providerId === 'password')) {
            await sendEmail(userRec.email, "Security Alert: Password Changed", "<p>Your password was recently updated. If this wasn't you, contact support immediately at pjmarket1316@gmail.com.</p>");
        }
    }
});
//# sourceMappingURL=notifications.js.map