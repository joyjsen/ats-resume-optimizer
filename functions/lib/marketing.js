"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishToBlotato = exports.generateBlogPost = exports.generateMediaPrompts = exports.modifyTone = exports.generateMarketingIdeas = void 0;
const functionsV1 = require("firebase-functions/v1");
const admin = require("firebase-admin");
const axios_1 = require("axios");
const secrets_1 = require("./secrets");
/**
 * Helper to standardise CORS across internal backend endpoints
 */
function applyCors(req, res) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return req.method === 'OPTIONS';
}
/**
 * Generates marketing ideas by hitting the OpenRouter (Perplexity) API.
 */
exports.generateMarketingIdeas = functionsV1
    .region("us-central1")
    .runWith({ secrets: [secrets_1.openRouterApiKey], timeoutSeconds: 90 })
    .https.onRequest(async (req, res) => {
    if (applyCors(req, res)) {
        res.status(204).send('');
        return;
    }
    const { customTopic } = req.body;
    const topicQuery = customTopic ? customTopic : "Resume optimization, job hunt trends, and tech layoffs in 2026";
    try {
        const prompt = `Search Google Trends and LinkedIn right now for the biggest trending topics around: ${topicQuery}. Then, find the exact trending hashtags being used today. 
            Using that live data, generate exactly 10 unique marketing post ideas incorporating RiResume's features (1. Frictionless Job Matching, 2. ATS Diagnostics, 3. Ethical Upskilling Engine, 4. One-Click Optimization, 5. Tailored Cover Letters). 
            
            Format the response strictly as a JSON array of objects without markdown formatting or code blocks. The JSON array should just contain objects with these exact keys: "topic" (a brief 1-line title), "caption" (a compelling 2-3 sentence marketing copy), "hashtags" (a single string containing 4-5 relevant hashtags like '#JobHunt #RiResume'), "platform" (Randomly vary this to create a mix across: Facebook, X, Threads, Instagram, YouTube Shorts, YouTube, LinkedIn, TikTok, BlueSky, Pinterest), "status" (always "pending"), "date" (e.g., 'Tomorrow, 10:00 AM').`;
        const response = await axios_1.default.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "perplexity/sonar",
            messages: [{ role: "user", content: prompt }]
        }, {
            headers: {
                "Authorization": `Bearer ${secrets_1.openRouterApiKey.value().trim()}`,
                "Content-Type": "application/json"
            }
        });
        const contentStr = response.data.choices[0].message.content;
        let cleanedJson = contentStr;
        if (contentStr.startsWith('```')) {
            cleanedJson = contentStr.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        res.status(200).json({
            success: true,
            ideas: JSON.parse(cleanedJson)
        });
    }
    catch (error) {
        console.error("OpenRouter Error:", error.response?.data || error.message);
        res.status(500).json({ error: error.message || "Failed to generate ideas." });
    }
});
/**
 * AI Endpoint: Modifies Content Tone
 */
exports.modifyTone = functionsV1
    .region("us-central1")
    .runWith({ secrets: [secrets_1.openRouterApiKey], timeoutSeconds: 30 })
    .https.onRequest(async (req, res) => {
    if (applyCors(req, res)) {
        res.status(204).send('');
        return;
    }
    const { text, tone } = req.body;
    try {
        const prompt = `Rewrite the following marketing caption to sound strictly '${tone}'. Maintain the core message and the fact it promotes RiResume, but completely restructure the vocabulary and tone to match the request. Output strictly the rewritten text ONLY, with absolutely no conversational filler or quotes.\n\nTEXT:\n${text}`;
        const response = await axios_1.default.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "openai/gpt-4o-mini",
            messages: [{ role: "user", content: prompt }]
        }, {
            headers: { "Authorization": `Bearer ${secrets_1.openRouterApiKey.value().trim()}`, "Content-Type": "application/json" }
        });
        res.status(200).json({ success: true, text: response.data.choices[0].message.content.trim() });
    }
    catch (error) {
        console.error(error.message);
        res.status(500).json({ error: "Failed to rewrite tone." });
    }
});
/**
 * AI Endpoint: Generates specific media prompts (Image/Video)
 */
exports.generateMediaPrompts = functionsV1
    .region("us-central1")
    .runWith({ secrets: [secrets_1.openRouterApiKey], timeoutSeconds: 30 })
    .https.onRequest(async (req, res) => {
    if (applyCors(req, res)) {
        res.status(204).send('');
        return;
    }
    const { topic, caption } = req.body;
    try {
        const prompt = `Read the following marketing post intended for social media:
            Topic: ${topic}
            Caption: ${caption}
            
            Generate exactly 2 things in valid JSON array format, no markdown wrappers:
            [
              { "type": "Midjourney Image Prompt", "prompt": "a highly cinematic midjourney prompt that visualizes this concept..." },
              { "type": "Runway Video Prompt", "prompt": "a detailed txt2video prompt for a 5 second cinematic b-roll shot..." }
            ]
            `;
        const response = await axios_1.default.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "openai/gpt-4o-mini",
            messages: [{ role: "user", content: prompt }]
        }, {
            headers: { "Authorization": `Bearer ${secrets_1.openRouterApiKey.value().trim()}`, "Content-Type": "application/json" }
        });
        let cleanedJson = response.data.choices[0].message.content.trim();
        if (cleanedJson.startsWith('```')) {
            cleanedJson = cleanedJson.replace(/```json/g, '').replace(/```/g, '').trim();
        }
        res.status(200).json({ success: true, prompts: JSON.parse(cleanedJson) });
    }
    catch (error) {
        console.error(error.message);
        res.status(500).json({ error: "Failed to generate media prompts." });
    }
});
/**
 * AI Endpoint: Generates a 1,000 word SEO blog post
 */
exports.generateBlogPost = functionsV1
    .region("us-central1")
    .runWith({ secrets: [secrets_1.openRouterApiKey], timeoutSeconds: 300 })
    .https.onRequest(async (req, res) => {
    if (applyCors(req, res)) {
        res.status(204).send('');
        return;
    }
    const { topic, caption } = req.body;
    try {
        const prompt = `You are a highly skilled technical content marketer. Expand the following social media seed idea into a massive, highly detailed 800-1000 word thought leadership blog post. Structure it perfectly with markdown headers (H1, H2, H3), bullet points, and an intro/conclusion.
            
            Seed Topic: ${topic}
            Seed Caption: ${caption}
            
            Ensure it natively pitch drops RiResume (ATS scanner, targeted cover letters, ethical upskilling) contextually without sounding like a cheap ad. Output purely the markdown blog content.`;
        const response = await axios_1.default.post("https://openrouter.ai/api/v1/chat/completions", {
            model: "openai/gpt-4o",
            messages: [{ role: "user", content: prompt }]
        }, {
            headers: { "Authorization": `Bearer ${secrets_1.openRouterApiKey.value().trim()}`, "Content-Type": "application/json" }
        });
        res.status(200).json({ success: true, blog: response.data.choices[0].message.content });
    }
    catch (error) {
        console.error(error.message);
        res.status(500).json({ error: "Failed to generate blog post." });
    }
});
/**
 * Maps the frontend platform id to Blotato's required Account ID BigInt & targetType
 */
function getBlotatoTarget(platform) {
    const map = {
        "bluesky": { accountId: 31285, targetType: "bluesky" },
        "facebook": { accountId: 25244, targetType: "facebook", pageId: "1093971307121951" },
        "instagram": { accountId: 38707, targetType: "instagram" },
        "threads": { accountId: 5618, targetType: "threads" },
        "tiktok": { accountId: 36402, targetType: "tiktok" },
        "x": { accountId: 15439, targetType: "twitter" }
    };
    return map[platform] || null;
}
/**
 * Publishes an approved post direct to the Blotato API.
 */
exports.publishToBlotato = functionsV1
    .region("us-central1")
    .runWith({ secrets: [secrets_1.blotatoApiKey] })
    .https.onRequest(async (req, res) => {
    if (applyCors(req, res)) {
        res.status(204).send('');
        return;
    }
    const { caption, hashtags, urls, platforms, scheduleDate } = req.body;
    try {
        const validDate = new Date(scheduleDate).toISOString();
        const mediaUrlArray = urls.map((u) => u.value).filter((val) => val.trim() !== "");
        // Blotato requires a 1-to-1 payload per target account. 
        // We loop and fan-out multiple independent requests if multiple platforms are selected.
        const publishPromises = platforms.map(async (plat) => {
            const targetDetails = getBlotatoTarget(plat);
            if (!targetDetails)
                return { platform: plat, success: false, error: "No account mapping found for this platform." };
            const promotionalFooter = `

📲 Get RiResume:
iOS: https://bit.ly/4c4g1yR
Android: https://bit.ly/4c3z9Nx
Web: https://www.riresume.com`;
            const payload = {
                post: {
                    accountId: targetDetails.accountId,
                    content: {
                        text: `${caption}\n\n${hashtags}${promotionalFooter}`,
                        mediaUrls: mediaUrlArray,
                        platform: targetDetails.targetType
                    },
                    target: {
                        targetType: targetDetails.targetType,
                        publishAt: validDate
                    }
                }
            };
            // Inject Facebook Page ID structurally if configured
            if (targetDetails.pageId) {
                payload.post.target.pageId = targetDetails.pageId;
            }
            // Inject mandatory TikTok configuration fields
            if (targetDetails.targetType === 'tiktok') {
                payload.post.target.privacyLevel = "PUBLIC_TO_EVERYONE";
                payload.post.target.disabledComments = false;
                payload.post.target.disabledDuet = false;
                payload.post.target.disabledStitch = false;
                payload.post.target.isBrandedContent = false;
                payload.post.target.isYourBrand = false;
                payload.post.target.isAiGenerated = false;
            }
            try {
                const response = await axios_1.default.post("https://backend.blotato.com/v2/posts", payload, {
                    headers: {
                        "Authorization": `Bearer ${secrets_1.blotatoApiKey.value().trim()}`,
                        "Content-Type": "application/json"
                    }
                });
                return { platform: plat, success: true, payload: response.data };
            }
            catch (err) {
                return { platform: plat, success: false, error: err.response?.data || err.message };
            }
        });
        const results = await Promise.all(publishPromises);
        const isAllFailed = results.every(r => !r.success);
        const failedResults = results.filter(r => !r.success);
        const statusLabel = isAllFailed ? 'failed' : (failedResults.length > 0 ? 'partial_failure' : 'scheduled');
        // Save to Firestore so Calendar can render it
        const firestoreData = {
            caption,
            hashtags,
            mediaUrls: mediaUrlArray,
            platforms,
            postId: req.body.postId || 'manual',
            scheduleDate: validDate,
            status: statusLabel,
            results,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };
        const docRef = await admin.firestore().collection('marketing_posts').add(firestoreData);
        // Trigger Email to Admin if there's any failure
        if (failedResults.length > 0) {
            const errorDetails = failedResults.map(r => `${r.platform}: ${JSON.stringify(r.error)}`).join('<br/><br/>');
            await admin.firestore().collection('mail').add({
                to: ["pjmarket1316@gmail.com"],
                message: {
                    subject: `[RiResume Marketing] Blotato Scheduling Failure`,
                    html: `<p>One or more social platforms failed to schedule via Blotato.</p>
                                <p><strong>Database ID:</strong> ${docRef.id}</p>
                                <p><strong>Scheduled Time:</strong> ${validDate}</p>
                                <p><strong>Errors:</strong><br/>${errorDetails}</p>`
                }
            });
        }
        if (isAllFailed) {
            console.error("All Blotato pushes failed:", results);
            res.status(500).json({ error: "Failed to publish to Blotato networks.", details: results });
            return;
        }
        res.status(200).json({ success: true, results });
    }
    catch (error) {
        console.error("Blotato Root Error:", error.message);
        res.status(500).json({ error: error.message || "Failed to parse publication array." });
    }
});
//# sourceMappingURL=marketing.js.map