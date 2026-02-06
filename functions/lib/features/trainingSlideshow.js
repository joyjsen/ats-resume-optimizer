"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTrainingSlideshow = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const openai_1 = require("openai");
const firestoreUtils_1 = require("../utils/firestoreUtils");
/**
 * Cloud Function: Generate Training Slideshow
 */
const generateTrainingSlideshow = (openaiApiKey) => (0, https_1.onCall)({
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: [openaiApiKey],
}, async (request) => {
    if (!request.auth)
        throw new https_1.HttpsError("unauthenticated", "You must be logged in.");
    const { entryId, skill, position, company } = request.data;
    if (!entryId || !skill || !position || !company)
        throw new https_1.HttpsError("invalid-argument", "Missing required fields.");
    const db = admin.firestore();
    try {
        const entryRef = db.collection("user_learning").doc(entryId);
        // ATOMIC CHECK & LOCK
        const shouldProceed = await db.runTransaction(async (transaction) => {
            const entrySnap = await transaction.get(entryRef);
            if (!entrySnap.exists)
                throw new Error("Learning entry not found");
            const data = entrySnap.data();
            if (data && data.slides?.length > 0)
                return { action: "return_existing", slides: data.slides };
            if (data && data.generationStatus === "generating")
                throw new Error("Generation in progress.");
            transaction.update(entryRef, { generationStatus: "generating", updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            return { action: "proceed" };
        });
        if (shouldProceed.action === "return_existing")
            return { success: true, slides: shouldProceed.slides };
        // Deduct tokens
        await (0, firestoreUtils_1.deductTokens)(request.auth.uid, 30, "training_slideshow_generation", `Generated AI Training for "${skill}"`, entryId, db, 'openai');
        const openai = new openai_1.default({ apiKey: openaiApiKey.value() });
        const prompt = `Create a 10-15 slide technical training JSON for ${skill} at ${company}.`;
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "system", content: "You are an expert technical trainer." }, { role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });
        const content = response.choices[0]?.message?.content;
        if (!content)
            throw new Error("No content from AI");
        const slides = JSON.parse(content).slides || [];
        await entryRef.update({
            slides,
            totalSlides: slides.length,
            generationStatus: "completed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true, slides };
    }
    catch (error) {
        console.error("[generateTrainingSlideshow] Failed:", error);
        await admin.firestore().collection("user_learning").doc(entryId).update({ generationStatus: "failed" }).catch(() => { });
        throw new https_1.HttpsError("internal", error.message);
    }
});
exports.generateTrainingSlideshow = generateTrainingSlideshow;
//# sourceMappingURL=trainingSlideshow.js.map