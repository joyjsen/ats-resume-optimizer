import * as functionsV2 from "firebase-functions/v2";
import OpenAI from "openai";
import { SecretParam } from "firebase-functions/lib/params/types";

export const parseResume = (openaiApiKey: SecretParam) => functionsV2.https.onCall(
    {
        secrets: [openaiApiKey],
        timeoutSeconds: 300,
        memory: "1GiB",
        maxInstances: 10,
    },
    async (request) => {
        const { text, images } = request.data;
        const uid = request.auth?.uid;

        if (!uid) {
            throw new functionsV2.https.HttpsError("unauthenticated", "User must be authenticated");
        }

        if (!text && (!images || images.length === 0)) {
            throw new functionsV2.https.HttpsError("invalid-argument", "Either text or images must be provided");
        }

        const openai = new OpenAI({ apiKey: openaiApiKey.value().trim() });

        try {
            if (images && images.length > 0) {
                // Multimodal Vision Parsing
                const systemPrompt = `Expert Resume Parser. Extract all details from these images into EXACT JSON.
Structure:
{
  "contactInfo": {"name":"", "email":"", "phone":"", "location":"", "linkedin":"", "portfolio":"", "github":""},
  "summary": "",
  "experience": [{"company":"", "title":"", "location":"", "startDate":"MM/YYYY", "endDate":"MM/YYYY", "current":false, "bullets":[]}],
  "education": [{"institution":"", "degree":"", "field":"", "startDate":"YYYY", "endDate":"YYYY", "gpa":"", "relevantCoursework":[], "honors":[]}],
  "skills": [{"name":"", "category":"technical|soft|domain|methodology", "proficiency":"beginner|intermediate|advanced|expert"}],
  "certifications": [{"name":"", "issuer":"", "date":"MM/YYYY", "expiryDate":"MM/YYYY", "credentialId":""}],
  "projects": [{"name":"", "description":"", "technologies":[], "url":""}]
}
Rules:
- EXHAUSTIVE text extraction. Do not skip content.
- **Education Standardization**: Try to standardize degree names during extraction (e.g., extract "Bachelor of Arts" or "BA" as "Bachelor's Degree" in the JSON if the meaning is clear).
- Education & Certifications: Capture every degree, certification, and specific technical keywords mentioned.
- Combined all images into one profile.
- Return EXACT JSON, no explanations.`.trim();

                const imageContent = images.map((base64: string) => ({
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${base64}` }
                }));

                const messages: any[] = [
                    { role: 'system', content: systemPrompt },
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: "Extract and structure this resume from the attached images." },
                            ...imageContent
                        ]
                    }
                ];

                const response = await openai.chat.completions.create({
                    model: 'gpt-5.4-mini',
                    messages: messages,
                    response_format: { type: 'json_object' },
                    max_completion_tokens: 16384,
                    temperature: 0,
                });

                const message = response.choices[0].message;
                const contentResponse = message?.content;
                if (!contentResponse || response.choices[0].finish_reason === 'length') {
                    const reason = response.choices[0].finish_reason;
                    const refusal = (message as any)?.refusal || 'None';
                    console.error(`System returned empty/truncated content. Finish Reason: ${reason}. Refusal: ${refusal}`);
                    
                    let userReason: string = reason;
                    if (reason === 'content_filter') userReason = "Content policy violation (safety)";
                    if (reason === 'length') userReason = "The document is too long to parse. Please shorten your resume.";
                    
                    throw new Error(`System rejected the document because: ${userReason}`);
                }

                const parsed = JSON.parse(contentResponse);
                return _addIdsToParsedData(parsed, "[Parsed from images]");
            } else {
                // Text Parsing
                const systemPrompt = `Expert Resume Parser. Extract data from the text into EXACT JSON.
Structure:
{
  "contactInfo": {"name":"", "email":"", "phone":"", "location":"", "linkedin":"", "portfolio":"", "github":""},
  "summary": "",
  "experience": [{"company":"", "title":"", "location":"", "startDate":"MM/YYYY", "endDate":"MM/YYYY", "current":false, "bullets":[]}],
  "education": [{"institution":"", "degree":"", "field":"", "startDate":"YYYY", "endDate":"YYYY", "gpa":"", "relevantCoursework":[], "honors":[]}],
  "skills": [{"name":"", "category":"technical|soft|domain|methodology", "proficiency":"beginner|intermediate|advanced|expert"}],
  "certifications": [{"name":"", "issuer":"", "date":"MM/YYYY", "expiryDate":"MM/YYYY", "credentialId":""}],
  "projects": [{"name":"", "description":"", "technologies":[], "url":""}]
}
Rules:
- EXHAUSTIVE extraction. Do not truncate bullets or lists.
- MM/YYYY dates.
- Clean bullets (no symbols).
- Categorize skills accurately.
- **Education Standardization**: Try to standardize degree names during extraction (e.g., extract "Bachelor of Arts" or "BA" as "Bachelor's Degree" in the JSON if the meaning is clear).
- Education & Certifications: Extract ALL mentioned technologies, tools, and professional standards mentioned in these sections.
- Return EXACT JSON, no other text.`.trim();

                const cleanContent = text.replace(/\[IMAGE_CONTENT:.*?\]/g, '(Image Data Included)');

                const messages: any[] = [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `Resume Content:\n${cleanContent}` }
                ];

                const lines = text.split('\n');
                const warnings = lines.filter((l: string) => l.startsWith('[WARNING:'));
                const actualContent = lines.filter((l: string) => !l.startsWith('[WARNING:') && l.trim().length > 0);

                const isOnlyWarnings = text.trim().length === 0 || (warnings.length > 0 && actualContent.length === 0);

                if (isOnlyWarnings) {
                    let errorMessage = "No valid content found. Please upload a Screenshot (Image), Text file (.txt), or DOCX.";
                    if (warnings.length > 0) {
                        errorMessage = `Could not extract text from files: ${warnings.map((w: string) => w.replace('[WARNING:', '').replace(']', '').trim()).join('; ')}`;
                    }
                    throw new functionsV2.https.HttpsError("invalid-argument", errorMessage);
                }

                const response = await openai.chat.completions.create({
                    model: 'gpt-5.4-mini',
                    messages: messages,
                    response_format: { type: 'json_object' },
                    max_completion_tokens: 16384,
                    temperature: 0,
                });

                const message = response.choices[0].message;
                const contentResponse = message?.content;
                if (!contentResponse || response.choices[0].finish_reason === 'length') {
                    const reason = response.choices[0].finish_reason;
                    const refusal = (message as any)?.refusal || 'None';
                    console.error(`System returned empty/truncated content. Finish Reason: ${reason}. Refusal: ${refusal}`);
                    
                    let userReason: string = reason;
                    if (reason === 'content_filter') userReason = "Content policy violation (safety)";
                    if (reason === 'length') userReason = "The document is too long to parse. Please shorten your resume.";
                    
                    throw new Error(`System rejected the document because: ${userReason}`);
                }

                const parsed = JSON.parse(contentResponse);
                return _addIdsToParsedData(parsed, text);
            }

        } catch (error: any) {
            console.error("Parse Error:", error);
            throw new functionsV2.https.HttpsError("internal", error.message || "Failed to parse resume");
        }
    }
);

function _addIdsToParsedData(parsed: any, originalText: string) {
    const generateId = () => `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
        ...parsed,
        experience: (parsed.experience || []).map((exp: any) => ({ ...exp, id: generateId() })),
        education: (parsed.education || []).map((edu: any) => ({ ...edu, id: generateId() })),
        certifications: (parsed.certifications || []).map((cert: any) => ({ ...cert, id: generateId() })),
        projects: (parsed.projects || []).map((proj: any) => ({ ...proj, id: generateId() })),
        skills: parsed.skills || [],
        text: originalText
    };
}
