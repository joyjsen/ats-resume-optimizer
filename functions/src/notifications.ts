import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";

const smtpEmail = defineSecret("SMTP_EMAIL");
const smtpPassword = defineSecret("SMTP_PASSWORD");
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Initialize Nodemailer Transporter
const getTransporter = () => {
    return nodemailer.createTransport({
        service: "gmail", // Make this configurable if needed
        auth: {
            user: smtpEmail.value(),
            pass: smtpPassword.value(),
        },
    });
};

// Initialize OpenAI
const getOpenAI = (key: string) => {
    return new OpenAI({
        apiKey: key,
    });
};

// --- Helper: Send Email ---
async function sendEmail(to: string, subject: string, html: string) {
    try {
        const transporter = getTransporter();
        await transporter.sendMail({
            from: `"RiResume" <${smtpEmail.value()}>`,
            to,
            subject,
            html,
        });
        console.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
        console.error("Error sending email:", error);
    }
}

// --- Helper: Send Push Notification ---
async function sendPush(uid: string, title: string, body: string, data?: any) {
    console.log(`[sendPush] Attempting to send push to user ${uid}: "${title}"`);
    try {
        const userDoc = await admin.firestore().collection("users").doc(uid).get();
        if (!userDoc.exists) {
            console.warn(`[sendPush] User ${uid} not found in Firestore. Cannot send push.`);
            return;
        }

        const userData = userDoc.data();
        let rawTokens = userData?.pushTokens || [];

        // Ensure we have an array of strings
        if (typeof rawTokens === 'object' && !Array.isArray(rawTokens)) {
            console.warn(`[sendPush] pushTokens for ${uid} is an object, converting to array...`);
            rawTokens = Object.values(rawTokens).flat();
        }

        const tokens = (Array.isArray(rawTokens) ? rawTokens : [rawTokens])
            .filter(t => typeof t === 'string' && t.startsWith('ExponentPushToken'));

        if (!tokens.length) {
            console.warn(`[sendPush] User ${uid} has no valid Expo push tokens. Data:`, JSON.stringify(rawTokens));
            return;
        }

        console.log(`[sendPush] Found ${tokens.length} valid push token(s) for user ${uid}`);

        // IMPORTANT FIX: Send tokens individually to avoid "PUSH_TOO_MANY_EXPERIENCE_IDS" error
        // Expo rejects batches that mix different slug/experience IDs.
        for (const token of tokens) {
            try {
                const message = {
                    to: token,
                    sound: "default",
                    title,
                    body,
                    data,
                    priority: 'high',
                    channelId: 'default', // Android
                    mutableContent: true, // iOS
                    interruptionLevel: 'active', // iOS 15+
                    badge: 1,
                    projectId: "3584d443-a654-4a9b-98bb-8344ba4c3110",
                };

                const response = await fetch("https://exp.host/--/api/v2/push/send", {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Accept-encoding": "gzip, deflate",
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(message),
                });

                const responseData = await response.json() as any;

                if (responseData.data && responseData.data.status === 'error') {
                    console.error(`[sendPush] Error for token ${token}: ${responseData.data.message}`);

                    // AUTO-CLEANUP: If token is invalid or not registered, remove it from Firestore
                    const isPermanentFailure =
                        responseData.data.details?.error === 'DeviceNotRegistered' ||
                        responseData.data.message?.includes('not a valid');

                    if (isPermanentFailure) {
                        console.log(`[sendPush] Removing invalid token from user ${uid}: ${token}`);
                        await admin.firestore().collection("users").doc(uid).update({
                            pushTokens: admin.firestore.FieldValue.arrayRemove(token)
                        }).catch(e => console.error(`[sendPush] Failed to remove token ${token}:`, e));
                    }
                } else {
                    console.log(`[sendPush] Successfully sent to token: ${token.substring(0, 25)}...`);
                }
            } catch (tokenError) {
                console.error(`[sendPush] Failed to send to token ${token}:`, tokenError);
            }
        }

    } catch (error) {
        console.error("[sendPush] Error in sendPush loop:", error);
    }
}

// 1. Welcome Email (onUserCreated)
export const onUserCreated = functionsV1
    .runWith({ secrets: [smtpEmail, smtpPassword] })
    .auth.user().onCreate(async (user: any) => {
        if (!user.email) return;
        const subject = "Welcome to RiResume!";
        const html = `
        <h1>Welcome, ${user.displayName || 'User'}!</h1>
        <p>Thank you for signing up. We are excited to help you land your dream job.</p>
        <p>Get started by uploading your resume today!</p>
    `;
        await sendEmail(user.email, subject, html);
    });

// 2. Monitoring Activities (Invoice, Learning, Admin Adjustment)
export const onActivityCreated = functionsV1
    .runWith({ secrets: [smtpEmail, smtpPassword] })
    .firestore
    .document("activities/{activityId}")
    .onCreate(async (snap: any, context: any) => {
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

            const tokens = activity.contextData?.tokens || 'tokens';
            const cost = activity.contextData?.amount || '0.00';
            const transactionId = snap.id;

            const subject = "Your RiResume Tokens Are Ready! 🚀";
            const html = `
                <p>Hi ${firstName},</p>
                <p>Your token purchase is confirmed!</p>
                <p><strong>${tokens} tokens added to your account</strong></p>
                <p>Amount: $${cost}</p>
                <p>Order ID: ${transactionId}</p>
                <p>Your tokens are ready to use. Open RiResume to start optimizing your applications.</p>
                <p>Need help? Reply to this email.</p>
                <p>Thanks,<br/>RiResume</p>
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
                await sendEmail(
                    email,
                    "Course Completed!",
                    `Congratulations! You have completed the module: ${activity.resourceName}`
                );
            }
            // Push
            await sendPush(uid, "Module Completed!", `You finished ${activity.resourceName}. Great job!`, {
                type: "learning_completion",
                resourceId: activity.resourceId,
                route: "/(tabs)/learning"
            });
        }
    });


// 3. Monitoring Analysis Tasks (Analyze Resume) -> Completion
export const onTaskUpdated = functionsV1
    .runWith({ secrets: [smtpEmail, smtpPassword] })
    .firestore
    .document("analysis_tasks/{taskId}")
    .onUpdate(async (change: any, context: any) => {
        const before = change.before.data();
        const after = change.after.data();

        // Only trigger on completion
        if (before.status !== "completed" && after.status === "completed") {
            const uid = after.userId;
            const userRec = await admin.auth().getUser(uid);
            const email = userRec.email;
            const type = after.type;

            // ONLY handle resume_analysis/analyze_resume here. 
            // Others (optimize, skill, prep, cover) are handled by background_tasks trigger.
            if (type !== "resume_analysis" && type !== "analyze_resume") {
                return;
            }

            let title = "Analysis Complete";
            let body = "Your resume analysis is ready. Tap to view.";
            let emailSubject = "Resume Analysis Complete";
            let emailBody = `<p>Your resume has been analyzed.</p><a href="https://riresume.web.app/analysis-result?id=${after.resultId || ''}">View Results in App</a>`;

            // Push
            await sendPush(uid, title, body, {
                taskId: context.params.taskId,
                type,
                resultId: after.resultId,
                route: '/analysis-result',
                params: { id: after.resultId }
            });

            // Email
            if (email) {
                await sendEmail(email, emailSubject, emailBody);
            }
        }
    });

// 4. Monitoring Background Tasks (Optimize, Skill Add, Prep Guide, Cover Letter) -> Completion
export const onBackgroundTaskUpdated = functionsV1
    .runWith({ secrets: [smtpEmail, smtpPassword] })
    .firestore
    .document("background_tasks/{taskId}")
    .onUpdate(async (change: any, context: any) => {
        const before = change.before.data();
        const after = change.after.data();
        const taskId = context.params.taskId;

        console.log(`[onBackgroundTaskUpdated] Triggered for task ${taskId}. Status: ${before.status} -> ${after.status}`);

        // Only trigger on completion
        if (before.status !== "completed" && after.status === "completed") {
            const uid = after.userId;
            const type = after.type;
            const payload = after.payload || {};

            console.log(`[onBackgroundTaskUpdated] Task ${taskId} completed. Type: ${type}, User: ${uid}`);

            if (!uid) {
                console.error(`[onBackgroundTaskUpdated] No userId found for task ${taskId}`);
                return;
            }

            let email = "";
            try {
                const userRec = await admin.auth().getUser(uid);
                email = userRec.email || "";
            } catch (err) {
                console.error(`[onBackgroundTaskUpdated] Error fetching user ${uid}:`, err);
            }

            let title = "";
            let body = "";
            let emailSubject = "";
            let emailBody = "";
            let data: any = { taskId, type };

            if (type === "optimize_resume") {
                title = "Resume Optimized ✨";
                body = "Your resume has been rewritten and optimized for the job. Tap to review.";
                emailSubject = "Resume Optimization Complete";
                emailBody = `<p>Your resume rewrite and optimization is complete.</p><a href="https://riresume.web.app/analysis-result?id=${payload.analysisTaskId || ''}">Review Optimized Resume</a>`;
                data.resultId = payload.analysisTaskId || payload.historyId;
                data.route = '/analysis-result';
                data.params = { id: data.resultId };
            } else if (type === "add_skill" || type === "skill_addition") {
                title = "Skill Added to Resume";
                body = "The new skill has been incorporated into your optimized resume.";
                emailSubject = "Skill Addition Complete";
                emailBody = `<p>We've successfully added the new skill to your resume and updated your ATS score.</p>`;
                data.resultId = payload.analysisTaskId || payload.historyId;
                data.route = '/analysis-result';
                data.params = { id: data.resultId };
            } else if (type === "prep_guide" || type === "prep_guide_refresh") {
                title = "Interview Prep Guide Ready";
                body = `Your interview prep guide for ${payload.jobTitle || 'the position'} at ${payload.companyName || 'the company'} is ready`;
                emailSubject = "Interview Prep Guide Ready";
                emailBody = `<p>Your interview prep guide is ready. We've included company research and tailored questions.</p>`;
                data.applicationId = payload.applicationId;
                data.route = "/(tabs)/applications";
                data.action = "viewPrep";
            } else if (type === "cover_letter") {
                title = "Cover Letter Generated";
                body = `Your tailored cover letter for ${payload.company || 'the position'} is ready.`;
                emailSubject = "Cover Letter Generated";
                emailBody = `<p>Your cover letter for ${payload.company || 'the position'} is ready.</p>`;
                data.applicationId = payload.applicationId;
                data.route = "/(tabs)/applications";
                data.action = "viewCoverLetter";
            }

            if (title) {
                console.log(`[onBackgroundTaskUpdated] Sending push for ${type} to ${uid}`);
                await sendPush(uid, title, body, data);
            }

            // Email for specific types
            const validEmailTypes = ["optimize_resume", "add_skill", "skill_addition", "prep_guide", "prep_guide_refresh", "cover_letter"];
            if (email && validEmailTypes.includes(type)) {
                console.log(`[onBackgroundTaskUpdated] Sending email for ${type} to ${email}`);
                await sendEmail(email, emailSubject, emailBody);
            }
        }
    });

// 4. User Documentation Updates (Password Change & Profile Completion)
export const onUserDocUpdated = functionsV1
    .runWith({ secrets: [smtpEmail, smtpPassword, openaiApiKey] })
    .firestore
    .document("users/{uid}")
    .onUpdate(async (change: any, context: any) => {
        const before = change.before.data();
        const after = change.after.data();

        // A. Password Update Notification
        if (before.passwordUpdatedAt !== after.passwordUpdatedAt && after.passwordUpdatedAt) {
            const userRec = await admin.auth().getUser(context.params.uid);
            if (userRec.email && userRec.providerData.some(p => p.providerId === 'password')) {
                await sendEmail(
                    userRec.email,
                    "Security Alert: Password Changed",
                    "<p>Your password was recently updated. If this wasn't you, contact support immediately at pjmarket1316@gmail.com.</p>"
                );
            }
        }

        // B. Onboarding Roadmap Email (on Profile Completion)
        if (!before.profileCompleted && after.profileCompleted && after.email) {
            console.log(`[Onboarding] Profile completed for ${after.uid}. Generating roadmap...`);

            try {
                const openai = getOpenAI(openaiApiKey.value());
                const firstName = after.firstName || after.displayName?.split(' ')[0] || "there";
                const currentJob = after.jobTitle || "Professional";
                const targetJob = after.targetJobTitle || "Next Role";
                const industry = after.targetIndustry || after.industry || "your industry";
                const expLevel = after.experienceLevel || "pro";

                const prompt = `
                    You are a Career Architect. Generate a professional and highly actionable 3-phase career roadmap for ${firstName} transitioning from ${currentJob} to ${targetJob} in the ${industry} sector. The user is at an ${expLevel} level.
                    
                    Each phase must explicitly mention how RiResume's specific features (Gap Analysis, AI Optimization, Interview Prep, Cover Letters) act as the catalyst for success.
                    - Tone: Executive, empowering, and persuasive.
                    - Goal: Showcase value and encourage token purchase. Mention that their first optimization journey is free.
                    - Format: Clean HTML for mobile-friendly emails. Use <h3> for phase titles, <ul> for steps.
                `.trim();

                const response = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: [
                        { role: "system", content: "You are a professional career advisor specializing in AI-driven job searching." },
                        { role: "user", content: prompt }
                    ],
                    max_tokens: 1500,
                    temperature: 0.7,
                });

                const roadmapHtml = response.choices[0].message.content || "<p>Explore RiResume to start your journey.</p>";

                const subject = `🚀 Your Personalized Career Roadmap to ${targetJob}`;
                const emailHtml = `
                    <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #6200ee;">Welcome to RiResume, ${firstName}!</h2>
                        <p>We’ve reviewed your background as a <strong>${currentJob}</strong> and your goal to transition into a <strong>${targetJob}</strong> within the <strong>${industry}</strong> sector.</p>
                        
                        <p>Navigating a career move can be challenging, especially at the ${expLevel} level. To jumpstart your journey, our AI has designed a bespoke career roadmap tailored specifically to your goals:</p>
                        
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                        
                        <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px;">
                            ${roadmapHtml}
                        </div>
                        
                        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
                        
                        <h3 style="color: #6200ee;">Get Moving with RiResume</h3>
                        <p>We believe so strongly in our platform that <strong>your first optimization journey is completely free.</strong></p>
                        
                        <p>Once you've seen the power of having an AI-optimized professional presence, you can purchase <strong>RiResume Tokens</strong> to:</p>
                        <ul>
                            <li>Optimize for multiple specific job postings.</li>
                            <li>Generate tailored cover letters for every application.</li>
                            <li>Access advanced learning modules in our Learning Hub.</li>
                        </ul>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="https://riresume.web.app/home" style="background-color: #6200ee; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Open RiResume & Start Your Journey</a>
                        </div>
                        
                        <p>We're honored to be part of your career success.</p>
                        <p>Best regards,<br/><strong>The RiResume Team</strong></p>
                    </div>
                `;

                await sendEmail(after.email, subject, emailHtml);
                console.log(`[Onboarding] Roadmap email sent to ${after.email}`);
            } catch (error) {
                console.error("[Onboarding] Error generating roadmap email:", error);
            }
        }
    });

/**
 * 5. Goodbye Email (onAccountDeleted)
 * Triggered when a document is created in 'deleted_accounts' collection.
 */
export const onAccountDeleted = functionsV1
    .runWith({ secrets: [smtpEmail, smtpPassword] })
    .firestore
    .document("deleted_accounts/{uid}")
    .onCreate(async (snap: any, context: any) => {
        const data = snap.data();
        const email = data.email;
        const displayName = data.displayName || data.fullProfile?.displayName || "there";
        const firstName = data.fullProfile?.firstName || displayName.split(' ')[0];

        if (!email) return;

        const subject = "We're sorry to see you go – A final note from RiResume";
        const html = `
            <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                <p>Dear ${firstName},</p>
                <p>We received your request to delete your RiResume account, and we're truly sorry to see you go.</p>
                <p>We hope that RiResume was a helpful companion during your job search. Whether you’ve found your dream role or are taking a different path, we wish you the very best in all your future professional endeavors.</p>
                <p>If you ever need assistance with resume optimization or interview preparation again, please know that you are always welcome back.</p>
                <p>Thank you for choosing RiResume.</p>
                <br/>
                <p>Best regards,<br/><strong>The RiResume Team</strong></p>
            </div>
        `;

        await sendEmail(email, subject, html);
    });

/**
 * 6. Account Status Email (Callable)
 * Callable function to send emails for account suspend, reactivate, or permanent delete.
 */
export const sendAccountStatusEmail = functionsV1
    .runWith({ secrets: [smtpEmail, smtpPassword] })
    .https.onCall(async (data: any, context: any) => {
        // Verify caller is admin
        if (!context.auth) {
            throw new functionsV1.https.HttpsError('unauthenticated', 'User must be authenticated.');
        }

        const callerUid = context.auth.uid;
        const callerDoc = await admin.firestore().collection('users').doc(callerUid).get();
        if (!callerDoc.exists || callerDoc.data()?.role !== 'admin') {
            throw new functionsV1.https.HttpsError('permission-denied', 'Only admins can send status emails.');
        }

        const { email, displayName, action } = data;
        if (!email || !action) {
            throw new functionsV1.https.HttpsError('invalid-argument', 'Email and action are required.');
        }

        const firstName = displayName?.split(' ')[0] || 'there';
        let subject = '';
        let html = '';

        if (action === 'suspended') {
            subject = 'Your RiResume Account Has Been Temporarily Deactivated';
            html = `
                <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                    <p>Dear ${firstName},</p>
                    <p>Your RiResume account has been temporarily deactivated by our team.</p>
                    <p>If you believe this was done in error or would like more information, please contact our support team at <a href="mailto:support@riresume.com">support@riresume.com</a>.</p>
                    <p>We apologize for any inconvenience this may cause.</p>
                    <br/>
                    <p>Best regards,<br/><strong>The RiResume Team</strong></p>
                </div>
            `;
        } else if (action === 'reactivated') {
            subject = 'Your RiResume Account Has Been Reactivated!';
            html = `
                <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                    <p>Dear ${firstName},</p>
                    <p>Great news! Your RiResume account has been successfully reactivated.</p>
                    <p>You can now log in and continue using all the features you had before. Your token balance and history have been preserved.</p>
                    <p>If you have any questions, please don't hesitate to reach out to our support team.</p>
                    <br/>
                    <p>Welcome back!<br/><strong>The RiResume Team</strong></p>
                </div>
            `;
        } else if (action === 'permanent_delete') {
            subject = 'Your RiResume Account Has Been Permanently Removed';
            html = `
                <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
                    <p>Dear ${firstName},</p>
                    <p>As per your previous request, your RiResume account has now been permanently removed from our system.</p>
                    <p>If you change your mind within the next <strong>30 days</strong>, you may still be able to recover your account by contacting us at <a href="mailto:support@riresume.com">support@riresume.com</a>.</p>
                    <p>After 30 days, all your data will be irreversibly deleted.</p>
                    <p>We wish you all the best in your career journey.</p>
                    <br/>
                    <p>Best regards,<br/><strong>The RiResume Team</strong></p>
                </div>
            `;
        } else {
            throw new functionsV1.https.HttpsError('invalid-argument', 'Invalid action type.');
        }

        await sendEmail(email, subject, html);
        console.log(`[AccountStatus] ${action} email sent to ${email}`);
        return { success: true };
    });

/**
 * Public function to check a user's registration provider and account status by email.
 * Used for better UX in Forgot Password and Sign Up flows without exposing full profiles.
 */
export const checkUserProvider = functionsV1
    .region("us-central1")
    .https.onCall(async (data: any) => {
        const { email } = data;
        if (!email) {
            throw new functionsV1.https.HttpsError("invalid-argument", "Email is required.");
        }

        try {
            const emailLower = email.toLowerCase().trim();
            const usersSnapshot = await admin.firestore()
                .collection("users")
                .where("email", "==", emailLower)
                .limit(1)
                .get();

            if (!usersSnapshot.empty) {
                const userData = usersSnapshot.docs[0].data();
                return {
                    exists: true,
                    provider: userData.provider || "email",
                    status: userData.accountStatus || "active",
                    displayName: userData.displayName || "User",
                };
            }

            // Check deleted_accounts too
            const deletedSnapshot = await admin.firestore()
                .collection("deleted_accounts")
                .where("email", "==", emailLower)
                .limit(1)
                .get();

            if (!deletedSnapshot.empty) {
                const deletedData = deletedSnapshot.docs[0].data();
                return {
                    exists: true,
                    provider: deletedData.provider || "unknown",
                    status: "deleted",
                    displayName: deletedData.displayName || "User",
                };
            }

            return { exists: false };
        } catch (error: any) {
            console.error("Error checking user provider:", error);
            throw new functionsV1.https.HttpsError("internal", "Failed to check user status.");
        }
    });

/**
 * Admin function to ensure a Firebase Auth account exists for a restored user.
 * If the account was deleted from Auth but exists in Firestore, this recreates it.
 */
export const restoreUserAuth = functionsV1
    .region("us-central1")
    .https.onCall(async (data: any, context: any) => {
        // 1. Security Check
        const primaryAdmin = "pjmarket1316@gmail.com";
        const currentUserEmail = context.auth?.token?.email;
        const isAdmin = context.auth && (currentUserEmail === primaryAdmin || context.auth.token.admin === true);

        if (!isAdmin) {
            console.error(`[RestoreAuth] Unauthorized attempt. User: ${currentUserEmail}`);
            throw new functionsV1.https.HttpsError("permission-denied", "Only administrators can restore accounts.");
        }

        const { uid, email, displayName } = data;
        if (!uid || !email) {
            throw new functionsV1.https.HttpsError("invalid-argument", "UID and Email are required.");
        }

        try {
            console.log(`[RestoreAuth] Request to restore UID: ${uid}, Email: ${email}`);

            // 2. Check if UID already exists in Auth
            try {
                const userById = await admin.auth().getUser(uid);
                console.log(`[RestoreAuth] UID ${uid} already exists in Auth. Email: ${userById.email}`);
                if (userById.email !== email) {
                    console.warn(`[RestoreAuth] UID ${uid} exists but email mismatch! Auth: ${userById.email}, Request: ${email}`);
                }
                return {
                    success: true,
                    recreated: false,
                    message: "User already exists in Auth.",
                    details: { uid: userById.uid, email: userById.email }
                };
            } catch (authError: any) {
                if (authError.code !== 'auth/user-not-found') {
                    throw authError;
                }
            }

            // 3. Check if EMAIL already exists in Auth (under a different UID)
            try {
                const userByEmail = await admin.auth().getUserByEmail(email);
                console.warn(`[RestoreAuth] Email ${email} already belongs to a DIFFERENT UID: ${userByEmail.uid}`);
                return {
                    success: false,
                    error: "EMAIL_EXISTS_DIFFERENT_UID",
                    message: `Email already exists in Auth with a different UID (${userByEmail.uid}). Please resolve the conflict manually in Firebase Console.`,
                    existingUid: userByEmail.uid
                };
            } catch (authError: any) {
                if (authError.code !== 'auth/user-not-found') {
                    throw authError;
                }
            }

            // 4. Recreate the user if they are completely missing
            console.log(`[RestoreAuth] User completely missing from Auth. Recreating with UID: ${uid}`);

            const createData: any = {
                uid: uid,
                email: email,
                displayName: displayName || "Restored User",
                emailVerified: true,
            };

            await admin.auth().createUser(createData);
            console.log(`[RestoreAuth] Successfully recreated Auth account for ${uid}`);

            return {
                success: true,
                recreated: true,
                message: "Auth account recreated successfully."
            };

        } catch (error: any) {
            console.error("Error restoring user auth:", error);
            throw new functionsV1.https.HttpsError("internal", error.message || "Failed to restore user auth.");
        }
    });

/**
 * Admin function to permanently delete a user from Firebase Auth.
 * This should be used during the "Permanent Delete" phase in the admin dashboard.
 */
export const deleteUserAuth = functionsV1
    .region("us-central1")
    .https.onCall(async (data: any, context: any) => {
        // 1. Security Check
        const isAdmin = context.auth && context.auth.token.email === "pjmarket1316@gmail.com";
        if (!isAdmin) {
            throw new functionsV1.https.HttpsError("permission-denied", "Only administrators can delete accounts.");
        }

        const { uid } = data;
        if (!uid) {
            throw new functionsV1.https.HttpsError("invalid-argument", "UID is required.");
        }

        try {
            // 2. Check if user exists before trying to delete
            try {
                await admin.auth().getUser(uid);
            } catch (authError: any) {
                if (authError.code === 'auth/user-not-found') {
                    console.log(`[DeleteAuth] User ${uid} not found in Auth, skipping deletion.`);
                    return { success: true, message: "User not found, nothing to delete." };
                }
                throw authError;
            }

            // 3. Delete from Auth
            await admin.auth().deleteUser(uid);
            console.log(`[DeleteAuth] Successfully deleted Auth account for ${uid}`);

            return { success: true, message: "Auth account successfully deleted." };

        } catch (error: any) {
            console.error("Error deleting user auth:", error);
            throw new functionsV1.https.HttpsError("internal", error.message || "Failed to delete user auth.");
        }
    });
