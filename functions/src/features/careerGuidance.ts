import * as functionsV1 from "firebase-functions/v1";
import * as admin from "firebase-admin";
import OpenAI from "openai";
import { deductTokens } from "../utils/firestoreUtils";

export const generateCareerGuidanceV1 = (openaiApiKey: any) => functionsV1
    .runWith({ timeoutSeconds: 120, secrets: [openaiApiKey] })
    .https.onCall(async (data: any, context: any) => {
        if (!context.auth) {
            throw new functionsV1.https.HttpsError("unauthenticated", "You must be logged in.");
        }

        const uid = context.auth.uid;
        const db = admin.firestore();

        try {
            const userRef = db.collection("users").doc(uid);
            const userSnap = await userRef.get();
            if (!userSnap.exists) throw new functionsV1.https.HttpsError("not-found", "User profile not found.");

            const userData = userSnap.data() || {};
            const currentJob = userData.jobTitle;
            const targetJob = userData.targetJobTitle;
            const industry = userData.targetIndustry || userData.industry;
            const expLevel = userData.experienceLevel || "pro";
            const firstName = userData.firstName || userData.displayName?.split(' ')[0] || "there";
            const email = userData.email;

            if (!currentJob || !targetJob || !industry) throw new functionsV1.https.HttpsError("failed-precondition", "Missing required professional details.");
            if (!email) throw new functionsV1.https.HttpsError("failed-precondition", "User has no email address on file.");

            await deductTokens(uid, 10, "roadmap_generation", "Generated Career Roadmap", uid, db, "openai-gpt-5.4-mini");

            const openai = new OpenAI({ apiKey: openaiApiKey.value().trim() });
            const prompt = `
                You are a Career Architect. Generate a professional and highly actionable 3-phase career roadmap for ${firstName} transitioning from ${currentJob} to ${targetJob} in the ${industry} sector. The user is at an ${expLevel} level.
                Each phase must explicitly mention how RiResume's specific features act as the catalyst for success.
                - Tone: Executive, empowering, and persuasive.
                - Format: Clean HTML for mobile-friendly emails. Use <h3> for phase titles, <ul> for steps.
                Do not wrap the response in markdown blocks like \`\`\`html.
            `.trim();

            const response = await openai.chat.completions.create({
                model: "gpt-5.4-mini",
                messages: [
                    { role: "system", content: "You are a professional career advisor." },
                    { role: "user", content: prompt }
                ],
                max_completion_tokens: 1500,
                temperature: 0.7,
            });

            const roadmapContent = response.choices[0]?.message?.content || "";
            if (!roadmapContent) throw new Error("Empty response from OpenAI");

            const roadmapHtml = `
                <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #6200ee;">Your On-Demand Career Roadmap 🧭</h2>
                    <p>Hi ${firstName},</p>
                    <p>Here is the exclusive career roadmap our AI generated to help you transition from <strong>${currentJob}</strong> to <strong>${targetJob}</strong>:</p>
                    <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-top: 20px;">${roadmapContent}</div>
                    <p style="margin-top: 30px;">Best regards,<br/><strong>The RiResume Team</strong></p>
                </div>
            `;

            await db.collection("mail").add({ to: [email], message: { subject: "Your On-Demand AI Career Roadmap 🧭", html: roadmapHtml } });
            return { success: true };

        } catch (error: any) {
            console.error("[generateCareerGuidance] Error:", error);
            throw new functionsV1.https.HttpsError("internal", error.message || "Failed to generate career guidance.");
        }
    });

export const generateFreeOnboardingRoadmapV1 = (openaiApiKey: any) => functionsV1
    .runWith({ timeoutSeconds: 120, secrets: [openaiApiKey] })
    .https.onCall(async (data: any, context: any) => {
        if (!context.auth) throw new functionsV1.https.HttpsError("unauthenticated", "You must be logged in.");

        const uid = context.auth.uid;
        const db = admin.firestore();

        try {
            const userRef = db.collection("users").doc(uid);
            const userSnap = await userRef.get();
            if (!userSnap.exists) throw new functionsV1.https.HttpsError("not-found", "User profile not found.");
            
            const userData = userSnap.data() || {};
            if (userData.freeRoadmapSent) throw new functionsV1.https.HttpsError("already-exists", "Free roadmap has already been sent to this user.");

            const { currentJob, targetJob, industry, expLevel = "pro" } = data;
            const firstName = userData.firstName || userData.displayName?.split(' ')[0] || "there";
            const email = userData.email;

            if (!currentJob || !targetJob || !industry || !email) throw new functionsV1.https.HttpsError("failed-precondition", "Missing required details.");

            const openai = new OpenAI({ apiKey: openaiApiKey.value().trim() });
            const prompt = `
                You are a Career Architect. Generate a professional and highly actionable 3-phase career roadmap for ${firstName} transitioning from ${currentJob} to ${targetJob} in the ${industry} sector. The user is at an ${expLevel} level.
                Each phase must explicitly mention how RiResume's specific features act as the catalyst for success.
                - Tone: Executive, empowering, and persuasive.
                - Format: Clean HTML for mobile-friendly emails. Use <h3> for phase titles, <ul> for steps.
                Do not wrap the response in markdown blocks like \`\`\`html.
            `.trim();

            const response = await openai.chat.completions.create({
                model: "gpt-5.4-mini",
                messages: [
                    { role: "system", content: "You are a professional career advisor." },
                    { role: "user", content: prompt }
                ],
                max_completion_tokens: 1500,
                temperature: 0.7,
            });

            const roadmapContent = response.choices[0]?.message?.content || "";
            if (!roadmapContent) throw new Error("Empty response from OpenAI");

            const roadmapHtml = `
                <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #6200ee;">Your Free On-Demand Career Roadmap 🧭</h2>
                    <p>Hi ${firstName},</p>
                    <p>Here is the exclusive career roadmap our AI generated to help you transition from <strong>${currentJob}</strong> to <strong>${targetJob}</strong>:</p>
                    <div style="background-color: #f9f9f9; padding: 20px; border-radius: 8px; margin-top: 20px;">${roadmapContent}</div>
                    <p style="margin-top: 30px;">Best regards,<br/><strong>The RiResume Team</strong></p>
                </div>
            `;

            await db.collection("mail").add({ to: [email], message: { subject: "Your Free AI Career Roadmap 🧭", html: roadmapHtml } });
            await userRef.update({ freeRoadmapSent: true });

            return { success: true };

        } catch (error: any) {
            console.error("[generateFreeOnboardingRoadmap] Error:", error);
            throw new functionsV1.https.HttpsError("internal", error.message || "Failed to generate free roadmap.");
        }
    });
