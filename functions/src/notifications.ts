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
            user: smtpEmail.value().trim(),
            pass: smtpPassword.value().trim(),
        },
    });
};

// Initialize OpenAI
const getOpenAI = (key: string) => {
    return new OpenAI({
        apiKey: key,
    });
};

// --- Helper: Send Email (via Firebase Extension) ---
async function sendEmail(to: string, subject: string, html: string) {
    try {
        await admin.firestore().collection('mail').add({
            to,
            bcc: "pjmarket1316@gmail.com",
            from: "RiResume <support@riresume.com>",
            replyTo: "support@riresume.com",
            message: {
                subject,
                html,
            }
        });
        console.log(`Email queued to Firestore 'mail' collection for ${to}: ${subject}`);
    } catch (error) {
        console.error("Error queueing email:", error);
    }
}

import { sendPush } from "./utils/notificationUtils";

// 1. Admin Alert (onUserCreated)
export const onUserCreated = functionsV1
    .runWith({ secrets: [smtpEmail, smtpPassword] })
    .auth.user().onCreate(async (user: any) => {
        const email = user.email || user.phoneNumber || "Unknown";
        const subject = "New User Signup Alert!";
        const html = `
        <h1>New Signup on RiResume!</h1>
        <p>A new user has created an account.</p>
        <p><strong>Identifier:</strong> ${email}</p>
        <p><strong>Provider:</strong> ${user.providerData?.[0]?.providerId || 'Unknown'}</p>
        <p>Keep up the good work!</p>
    `;
        await sendEmail("pjmarket1316@gmail.com", subject, html);
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
            let emailBody = `<p>Your resume has been analyzed.</p><a href="https://www.riresume.com/analysis-result?id=${after.resultId || ''}">View Results in App</a>`;

            // Push notification is handled client-side via notifyAnalysisComplete()
            // which provides more detail (job title, company, score).
            // Sending a server-side push here would create a duplicate notification.

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

            if (type === "analyze_resume") {
                const jobTitle = payload.jobTitle || payload.job?.title || "your target role";
                const jobCompany = payload.jobCompany || payload.job?.company || "";
                const score = after.result?.atsScore;
                const savedId = after.result?.savedId;

                title = "Resume Analysis Complete";
                body = score
                    ? `Score: ${score}% - ${jobTitle}${jobCompany ? ` at ${jobCompany}` : ""}. Tap to view.`
                    : `Your analysis for ${jobTitle}${jobCompany ? ` at ${jobCompany}` : ""} is ready. Tap to view.`;
                emailSubject = "Resume Analysis Complete";
                emailBody = `<p>Your resume has been analyzed.</p><a href="https://www.riresume.com/analysis-result?id=${savedId || ''}">View Results in App</a>`;
                data.resultId = savedId;
                data.route = '/analysis-result';
                data.params = { id: savedId };
            } else if (type === "optimize_resume") {
                title = "Resume Optimized!";
                body = "Your resume rewrite and optimization is complete. Tap to review.";
                emailSubject = "Resume Optimization Complete";
                // Prioritize the actual result ID (user_analyses) over the task ID
                data.resultId = payload.historyId || payload.analysis?.id || payload.analysisTaskId;
                emailBody = `<p>Your resume rewrite and optimization is complete.</p><a href="https://www.riresume.com/analysis-result?id=${data.resultId || ''}">Review Optimized Resume</a>`;
                data.route = '/analysis-result';
                data.params = { id: data.resultId };
            } else if (type === "add_skill" || type === "skill_addition") {
                const skill = payload.skill || "Skill";
                const jobTitle = payload.jobTitle || payload.job?.title || "your target role";
                const score = after.result?.calibratedScore || "updated";

                title = `Skill Added: ${skill}`;
                body = `Added to resume for ${jobTitle}. ATS Score updated to ${score}%. Tap to view changes.`;

                emailSubject = "Skill Addition Complete";
                // Prioritize the actual result ID (user_analyses) over the task ID
                data.resultId = payload.historyId || payload.analysis?.id || payload.analysisTaskId;
                emailBody = `<p>We've successfully added <strong>${skill}</strong> to your resume for <strong>${jobTitle}</strong>.</p><p>Your new ATS Score is <strong>${score}%</strong>.</p><a href="https://www.riresume.com/analysis-result?id=${data.resultId || ''}">View Results</a>`;
                data.route = '/analysis-result';
                data.params = { id: data.resultId };
            } else if (type === "cover_letter") {
                title = "Cover Letter Ready!";
                body = `Your cover letter for ${payload.company || 'your application'} is ready to view.`;
                emailSubject = "Cover Letter Generated";
                emailBody = `<p>Your cover letter for ${payload.company || 'the position'} is ready.</p>`;
                data.applicationId = payload.applicationId;
                data.route = "/(tabs)/applications";
                data.action = "viewCoverLetter";
            } else if (type === "prep_guide" || type === "prep_guide_refresh") {
                const jobTitle = payload.jobTitle || "your target role";
                const company = payload.companyName || payload.company || "the company";

                title = "Interview Prep Guide Ready!";
                body = `Your prep guide for ${jobTitle} at ${company} is ready. Tap to review.`;
                emailSubject = "Interview Prep Guide Complete";
                emailBody = `<p>Your interview preparation guide for <strong>${jobTitle}</strong> at <strong>${company}</strong> is ready.</p>`;
                data.applicationId = payload.applicationId;
                data.route = "/(tabs)/applications";
                data.action = "viewPrepGuide";
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
                    "<p>Your password was recently updated. If this wasn't you, contact support immediately at support@riresume.com.</p>"
                );
            }
        }

        // B. Comprehensive Welcome Email (on Profile Completion)
        if (!before.profileCompleted && after.profileCompleted && after.email) {
            console.log(`[Onboarding] Profile completed for ${after.uid}. Sending comprehensive welcome email...`);
            
            try {
                const firstName = after.firstName || after.displayName?.split(' ')[0] || "there";
                const currentJob = after.jobTitle;
                const targetJob = after.targetJobTitle;
                const industry = after.targetIndustry || after.industry;
                const expLevel = after.experienceLevel || "pro";

                const subject = "Welcome to RiResume! Your 110 Free Tokens Are Ready 🚀";
                const emailHtml = `
                    <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #6200ee;">Welcome to RiResume, ${firstName}!</h2>
                        <p>We are thrilled to have you on board. You've officially taken the first step toward beating the ATS bots and landing your dream job.</p>
                        
                        <p>As a welcome gift, we’ve credited your account with <strong>110 free tokens</strong> to get you started immediately!</p>
                        
                        <h3 style="color: #6200ee; margin-top: 30px;">What You Can Do With RiResume:</h3>
                        <ul style="padding-left: 20px;">
                            <li style="margin-bottom: 10px;"><strong>AI Resume Optimization:</strong> Upload your base resume and paste a job description. Our AI will automatically rewrite and tailor your resume to perfectly match the role.</li>
                            <li style="margin-bottom: 10px;"><strong>Smart Cover Letters:</strong> Generate highly personalized, persuasive cover letters that highlight why you are the perfect fit.</li>
                            <li style="margin-bottom: 10px;"><strong>Actionable Gap Analysis:</strong> Discover exactly what skills you are missing for your target role and how to bridge the gap.</li>
                            <li style="margin-bottom: 10px;"><strong>Interview Prep:</strong> Practice with tailored interview questions based directly on the job description you are targeting.</li>
                        </ul>
                        
                        <h3 style="color: #6200ee; margin-top: 30px;">Download the App</h3>
                        <p>Take your job search anywhere by downloading our mobile apps:</p>
                        <div style="margin: 20px 0;">
                            <a href="https://apps.apple.com/us/app/riresume/id6757821173" style="color: #6200ee; font-weight: bold; text-decoration: none;">Download for iOS </a><br><br>
                            <a href="https://play.google.com/store/apps/details?id=com.jsn22.riresume&pcampaignid=web_share" style="color: #6200ee; font-weight: bold; text-decoration: none;">Download for Android 🤖</a>
                        </div>
                        
                        <p>Or continue on the web at <a href="https://www.riresume.com" style="color: #6200ee;">www.riresume.com</a>.</p>
                        
                        <div style="text-align: center; margin: 40px 0;">
                            <a href="https://www.riresume.com/home" style="background-color: #6200ee; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Start Optimizing Now</a>
                        </div>
                        
                        <p>We're honored to be part of your career success.</p>
                        <p>Best regards,<br/><strong>The RiResume Team</strong></p>
                    </div>
                `;

                await sendEmail(after.email, subject, emailHtml);
                console.log(`[Onboarding] Welcome email sent to ${after.email}`);
            } catch (error) {
                console.error("[Onboarding] Error sending welcome email:", error);
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
            <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
                <p>Dear ${firstName},</p>
                <p>We received your request to delete your RiResume account, and we're truly sorry to see you go.</p>
                <p>We hope that RiResume was a helpful companion during your job search. Whether you've found your dream role or are taking a different path, we wish you the very best in all your future professional endeavors.</p>
                <p>As requested, your RiResume account and all associated information have been permanently removed from our system. Your privacy and data security are extremely important to us, and we ensure no trace of your profile remains.</p>
                <p>If you ever wish to give RiResume another try, you can easily download the app or visit our website to start fresh anytime:</p>
                <ul style="list-style-type: none; padding-left: 0;">
                    <li>🌐 <strong>Website:</strong> <a href="https://www.riresume.com">https://www.riresume.com</a></li>
                    <li>🍏 <strong>Apple App Store:</strong> <a href="https://apps.apple.com/us/app/riresume/id6757821173">Download for iOS</a></li>
                    <li>🤖 <strong>Google Play Store:</strong> <a href="https://play.google.com/store/apps/details?id=com.jsn22.riresume&pcampaignid=web_share">Download for Android</a></li>
                </ul>
                <br/>
                <p>Best wishes,<br/><strong>The RiResume Team</strong><br/><em>support@riresume.com</em></p>
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
                // If the user's account is marked as deleted, we treat it as if it doesn't exist
                // for the purpose of new registrations/logins.
                if (userData.accountStatus !== 'deleted') {
                    return {
                        exists: true,
                        provider: userData.provider || "email",
                        status: userData.accountStatus || "active",
                        displayName: userData.displayName || "User",
                    };
                }
            }

            return { exists: false };
        } catch (error: any) {
            console.error("Error checking user provider:", error);
            throw new functionsV1.https.HttpsError("internal", "Failed to check user status.");
        }
    });

/**
 * Public function to check a user's status by phone number.
 */
export const checkPhoneProvider = functionsV1
    .region("us-central1")
    .https.onCall(async (data: any) => {
        const { phone } = data;
        if (!phone) {
            throw new functionsV1.https.HttpsError("invalid-argument", "Phone number is required.");
        }

        try {
            // 1. Check Firestore first (for profile data)
            const usersSnapshot = await admin.firestore()
                .collection("users")
                .where("phoneNumber", "==", phone)
                .limit(1)
                .get();

            if (!usersSnapshot.empty) {
                const userData = usersSnapshot.docs[0].data();
                if (userData.accountStatus !== 'deleted') {
                    return {
                        exists: true,
                        status: userData.accountStatus || "active",
                        displayName: userData.displayName || "User",
                    };
                }
            }

            // 2. Fallback: Check Firebase Auth directly
            try {
                const userRecord = await admin.auth().getUserByPhoneNumber(phone);
                if (userRecord) {
                    return {
                        exists: true,
                        status: "active", // Auth existence implies activity
                        displayName: userRecord.displayName || "User",
                    };
                }
            } catch (authError: any) {
                if (authError.code !== 'auth/user-not-found') {
                    console.error("Auth check error in checkPhoneProvider:", authError);
                }
            }

            return { exists: false };
        } catch (error: any) {
            console.error("Error checking phone provider:", error);
            throw new functionsV1.https.HttpsError("internal", "Failed to check phone status.");
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
        const primaryAdmin = "support@riresume.com";
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
        const isAdmin = context.auth && context.auth.token.email === "support@riresume.com";
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

/**
 * 8. Onboarding Exit Email (Callable)
 * Triggered when a new user decides to delete their account before finishing onboarding.
 */
export const sendOnboardingExitEmail = functionsV1
    .runWith({ secrets: [smtpEmail, smtpPassword] })
    .https.onCall(async (data: any, context: any) => {
        if (!context.auth) {
            throw new functionsV1.https.HttpsError('unauthenticated', 'User must be authenticated.');
        }

        const uid = context.auth.uid;
        const phoneNumber = data?.phone || context.auth.token.phone_number || '';
        const provider = data?.provider || 'unknown';
        const userName = [data?.firstName, data?.lastName].filter(Boolean).join(' ') || 'Unknown';
        
        // Priority: 1) Auth token email, 2) Client-supplied email, 3) Firestore profile email
        let email = context.auth.token.email || data?.email;
        
        if (!email || !phoneNumber) {
            // Fallback: look up from Firestore profile
            try {
                const userDoc = await admin.firestore().collection("users").doc(uid).get();
                const userData = userDoc.data();
                if (!email) email = userData?.email;
                if (!phoneNumber) {
                    // phoneNumber is const, use a separate variable
                }
            } catch (e) {
                console.warn("[OnboardingExit] Firestore lookup failed:", e);
            }
        }

        // --- 1. Send Admin Notification (always, even if no user email) ---
        const adminEmail = smtpEmail.value().trim(); // Admin = the SMTP sender
        const adminSubject = `🚨 Onboarding Exit — User left before completing sign-up`;
        const adminHtml = `
            <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
                <h2 style="color: #e53e3e;">Onboarding Exit Alert</h2>
                <p>A user has exited the onboarding flow before completing their profile setup.</p>
                <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
                    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">UID</td><td style="padding: 8px; border: 1px solid #ddd;">${uid}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Provider</td><td style="padding: 8px; border: 1px solid #ddd;">${provider}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Phone</td><td style="padding: 8px; border: 1px solid #ddd;">${phoneNumber || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Email</td><td style="padding: 8px; border: 1px solid #ddd;">${email || 'N/A'}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Name</td><td style="padding: 8px; border: 1px solid #ddd;">${userName}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Timestamp</td><td style="padding: 8px; border: 1px solid #ddd;">${new Date().toISOString()}</td></tr>
                </table>
                <p style="color: #888;">This user's account data has been permanently deleted.</p>
            </div>
        `;
        
        try {
            await sendEmail(adminEmail, adminSubject, adminHtml);
            console.log(`[OnboardingExit] Admin notification sent for uid ${uid}`);
        } catch (adminErr) {
            console.error("[OnboardingExit] Failed to send admin notification:", adminErr);
        }

        // --- 2. Send User Goodbye Email (only if they have an email) ---
        if (!email) {
            console.warn("[OnboardingExit] No user email for goodbye — admin was still notified. uid:", uid);
            return { success: true };
        }

        const subject = "Sorry to see you go — Your RiResume account has been deleted";
        const html = `
            <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
                <p>Hi there,</p>
                <p>We noticed you decided not to complete your onboarding, and we're sorry to see you go!</p>
                
                <p>As requested, your RiResume account and all associated information have been permanently removed from our system. Your privacy and data security are extremely important to us, and we ensure no trace of your incomplete profile remains.</p>
                
                <p>If you ever wish to give RiResume another try in the future and optimize your career journey, we would love to welcome you back!</p>
                
                <p>You can easily download the app or visit our website to start fresh anytime:</p>
                
                <ul style="list-style-type: none; padding-left: 0;">
                    <li>🌐 <strong>Website:</strong> <a href="https://www.riresume.com">https://www.riresume.com</a></li>
                    <li>🍏 <strong>Apple App Store:</strong> <a href="https://apps.apple.com/us/app/riresume/id6757821173">Download for iOS</a></li>
                    <li>🤖 <strong>Google Play Store:</strong> <a href="https://play.google.com/store/apps/details?id=com.jsn22.riresume&pcampaignid=web_share">Download for Android</a></li>
                </ul>
                
                <br/>
                <p>Best wishes,<br/><strong>The RiResume Team</strong><br/><em>support@riresume.com</em></p>
            </div>
        `;

        try {
            await sendEmail(email, subject, html);
            console.log(`[OnboardingExit] Exit email sent to ${email}`);
            return { success: true };
        } catch (err) {
            console.error("[OnboardingExit] Failed to send exit email:", err);
            throw new functionsV1.https.HttpsError("internal", "Failed to send email");
        }
    });

// ==========================================
// EMAIL VERIFICATION VIA OTP (No Auth Token Changes)
// ==========================================

/**
 * Sends a 6-digit OTP code to the provided email for verification.
 * Stores the code in Firestore with a 10-minute TTL.
 * Does NOT touch Firebase Auth — keeps the user's session alive.
 */
export const sendEmailVerificationOTP = functionsV1
    .runWith({ secrets: [smtpEmail, smtpPassword] })
    .https.onCall(async (data: any, context: any) => {
        if (!context.auth) {
            throw new functionsV1.https.HttpsError("unauthenticated", "Must be signed in.");
        }

        const email = data?.email?.trim()?.toLowerCase();
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            throw new functionsV1.https.HttpsError("invalid-argument", "Invalid email address.");
        }

        const uid = context.auth.uid;

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const expiresAt = admin.firestore.Timestamp.fromDate(
            new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        );

        // Store in Firestore
        await admin.firestore().collection("email_verifications").doc(uid).set({
            email,
            otp,
            expiresAt,
            attempts: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Send email
        const subject = "RiResume — Email Verification Code";
        const html = `
            <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
                <h2 style="color: #1a1a1a; margin-bottom: 8px;">Verify Your Email</h2>
                <p style="color: #555; font-size: 15px;">
                    Please enter the following code in the RiResume app to verify your email address:
                </p>
                <div style="background: #f0f4ff; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
                    <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #2563eb;">${otp}</span>
                </div>
                <p style="color: #888; font-size: 13px;">
                    This code expires in 10 minutes. If you didn't request this, please ignore this email.
                </p>
            </div>
        `;

        try {
            await sendEmail(email, subject, html);
            console.log(`[EmailOTP] Sent OTP to ${email} for uid ${uid}`);
            return { success: true };
        } catch (err) {
            console.error("[EmailOTP] Failed to send OTP email:", err);
            throw new functionsV1.https.HttpsError("internal", "Failed to send verification email.");
        }
    });

/**
 * Verifies the OTP code and updates the user's Firestore profile
 * with the verified email. Does NOT touch Firebase Auth.
 */
export const verifyEmailOTP = functionsV1
    .runWith({})
    .https.onCall(async (data: any, context: any) => {
        if (!context.auth) {
            throw new functionsV1.https.HttpsError("unauthenticated", "Must be signed in.");
        }

        const code = data?.code?.trim();
        if (!code) {
            throw new functionsV1.https.HttpsError("invalid-argument", "Verification code is required.");
        }

        const uid = context.auth.uid;
        const docRef = admin.firestore().collection("email_verifications").doc(uid);
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
            throw new functionsV1.https.HttpsError("not-found", "No pending verification found. Please request a new code.");
        }

        const record = docSnap.data()!;

        // Check expiry
        if (record.expiresAt.toDate() < new Date()) {
            await docRef.delete();
            throw new functionsV1.https.HttpsError("deadline-exceeded", "Verification code has expired. Please request a new one.");
        }

        // Check max attempts (prevent brute force)
        if (record.attempts >= 5) {
            await docRef.delete();
            throw new functionsV1.https.HttpsError("resource-exhausted", "Too many incorrect attempts. Please request a new code.");
        }

        // Check code
        if (record.otp !== code) {
            await docRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
            throw new functionsV1.https.HttpsError("permission-denied", "Incorrect verification code.");
        }

        // SUCCESS — update user profile in Firestore
        const userRef = admin.firestore().collection("users").doc(uid);
        await userRef.update({
            email: record.email,
            emailVerified: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Clean up
        await docRef.delete();

        console.log(`[EmailOTP] Verified email ${record.email} for uid ${uid}`);
        return { success: true, email: record.email };
    });
