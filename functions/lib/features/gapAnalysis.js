"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.performGapAnalysis = void 0;
const https_1 = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const openai_1 = require("openai");
const aiUtils_1 = require("../utils/aiUtils");
/**
 * Determine if user is ready to apply
 */
function determineReadiness(atsScore, gaps) {
    const criticalGaps = gaps.criticalGaps || [];
    const hasFewCriticalGaps = criticalGaps.length <= 5;
    const meetsMinimumScore = atsScore > 40;
    return meetsMinimumScore || hasFewCriticalGaps;
}
const performGapAnalysis = (openaiApiKey, perplexityApiKey) => (0, https_1.onCall)({
    region: "us-central1",
    timeoutSeconds: 120,
    memory: "512MiB",
    secrets: [openaiApiKey, perplexityApiKey],
}, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "You must be logged in to perform analysis.");
    }
    const { taskId, resume, job } = request.data;
    if (!taskId || !resume || !job) {
        throw new https_1.HttpsError("invalid-argument", "taskId, resume, and job are required.");
    }
    const db = admin.firestore();
    const taskRef = db.collection("analysis_tasks").doc(taskId);
    try {
        await taskRef.update({
            status: "processing",
            progress: 50,
            currentStep: "Analyzing fit (server-side)...",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        const openai = new openai_1.default({
            apiKey: openaiApiKey.value().trim(),
            maxRetries: 2,
            timeout: 30000,
        });
        const systemInstruction = `

Importance Classification:
- critical: Explicitly "required" or "must-have" or in minimum qualifications
- high: Strongly emphasized, mentioned multiple times
- medium: "preferred", "nice-to-have", mentioned once
- low: Implied by role context

Return JSON with this EXACT structure:
{
  "matchAnalysis": {
    "matchedSkills": [{ "skill": "name", "importance": "critical|high|medium|low", "confidence": 0-100 }],
    "partialMatches": [{ "skill": "name", "importance": "critical|high|medium|low", "confidence": 0-100, "candidateSkill": "what they have", "transferability": "how it transfers" }],
    "missingSkills": [{ "skill": "name", "importance": "critical|high|medium|low", "confidence": 0-100 }],
    "keywordDensity": 0-100,
    "experienceMatch": { "match": 0-100 }
  },
  "gaps": {
    "criticalGaps": [{ "skill": "name", "importance": "critical", "hasTransferable": boolean }],
    "minorGaps": [{ "skill": "name", "importance": "medium", "hasTransferable": boolean }],
    "totalGapScore": 0-100
  }
}`.trim();
        const userContent = `
Perform a COMPREHENSIVE, LINE-BY-LINE comparison of this candidate's resume against this job description. Every requirement must be accounted for. Every relevant experience must be considered.

PARSED RESUME:
"""
${JSON.stringify(resume, null, 2)}
"""

PARSED JOB DESCRIPTION:
"""
${JSON.stringify(job, null, 2)}
"""

DEFENSIVE HANDLING RULES — READ FIRST:
- If the resume JSON has empty arrays (e.g., "experience": [], "skills": {}), treat as "no data available" — classify all requirements as "no_match" and set overallScore to 0.
- If the job JSON has empty requirement arrays, return overallScore: 100 with a note that no requirements were specified.
- If any field is missing or empty in either input, skip that comparison gracefully and note it in analysisMetadata.warnings.
- NEVER throw an error. NEVER return malformed JSON. ALWAYS return the complete structure below with safe defaults.
- If you cannot determine a value, use: "" for strings, [] for arrays, {} for objects, 0 for numbers, false for booleans.

ANALYSIS METHODOLOGY — Follow these steps in order:

STEP 1: REQUIREMENT INVENTORY
- List EVERY requirement from the job description (must-have, nice-to-have, and implied).
- Assign each a unique ID (REQ-001, REQ-002, etc.).
- If mustHaveSkills, niceToHaveSkills, or impliedSkills arrays are empty, note "no requirements found in this category" and continue.
- Confirm total count. This is your checklist — every REQ must appear in your final output.

STEP 2: RESUME EVIDENCE MAPPING
- For EACH requirement, scan ALL sections of the resume: experience bullet points, skills, summary, EDUCATION, and CERTIFICATIONS.
- EDUCATION MATCHING: Degree requirements (e.g., "Bachelor's in Computer Science") MUST be checked against the candidate's education entries. A matching or closely related degree is direct evidence.
- CERTIFICATION MATCHING: Certification requirements (e.g., "AWS Solutions Architect", "Azure Certified") MUST be checked against the candidate's certifications. An exact or equivalent cert is direct evidence.
- Look for: exact matches, synonym matches (e.g., "CI/CD" = "continuous integration"), adjacent/transferable skills (e.g., "Ansible" is adjacent to "Puppet" for config management), related degrees (e.g., "Electronics Engineering" is related to "Computer Science"), and same-vendor certifications (e.g., "AWS DevOps" is related to "AWS Cloud Practitioner").
- Record the SPECIFIC bullet point(s), skill entries, education entries, or certification entries that serve as evidence.
- EVIDENCE PRIORITY: When a skill appears in multiple resume sections, prioritize: (1) Certifications (most authoritative), (2) Education (formal knowledge), (3) Experience bullet points (practical application), (4) Skills list.
- If the resume has no relevant section (e.g., empty skills object), note "no resume data for this category" in the evidence field.

STEP 3: MATCH CLASSIFICATION
For each requirement, classify as:
- "strong_match": Direct, clear evidence in resume using the same or synonymous terms with demonstrated experience. Also applies when: a required degree matches the candidate's degree exactly or in the same field; a required certification matches the candidate's certification exactly.
- "partial_match": Related or transferable skill found; candidate could likely perform but doesn't have the exact skill/tool. Also applies when: a required degree is in a related field (e.g., job needs CS degree but candidate has Electronics Engineering); a required certification is from the same vendor/platform but different specialty (e.g., job needs "AWS Solutions Architect" but candidate has "AWS DevOps").
- "weak_match": Tangential connection only — the candidate has worked in the domain but hasn't specifically demonstrated this skill.
- "no_match": No evidence found anywhere in the resume (experience, skills, education, OR certifications) for this requirement.

STEP 4: SCORE CALCULATION
- strong_match: 100% of the requirement's weight
- partial_match: 50% of the requirement's weight
- weak_match: 20% of the requirement's weight
- no_match: 0%

Weights by importance:
- critical: 4 points
- high: 3 points
- medium: 2 points
- low: 1 point

overallScore = (earned points / total possible points) × 100
- If total possible points = 0 (no requirements found), set overallScore to 0 and note in warnings.

STEP 5: GAP PRIORITIZATION
- Rank all gaps (partial, weak, no_match) by impact: a missing "critical" skill matters far more than a missing "low" skill.
- For each gap, provide actionable recommendations: what to add to the resume, how to frame existing experience, or what to learn.

STEP 6: ATS KEYWORD ANALYSIS
- Compare exact keywords from the JD against exact words in the resume.
- Identify missing keywords that should be added.
- Identify keywords present but in different phrasing (needs alignment).
- Calculate keyword match percentage.
- If JD keywords array is empty, set keywordMatchRate to 0 and note in warnings.

STEP 7: RESUME CONTENT PRESERVATION CHECK
- Confirm that ALL original resume bullet points are accounted for in the analysis.
- Identify resume strengths that are NOT required by this job but should still be preserved (they add value and differentiation).
- Flag any resume content that should NOT be removed during optimization.
- If resume has no bullet points, set totalOriginalBullets to 0 and return empty arrays.

Return this EXACT JSON structure (ALL keys mandatory — never omit any key):
{
  "overallScore": 0,
  "atsKeywordScore": 0,
  "readinessLevel": "strong_match",
  "executiveSummary": "",
  "requirementInventory": {
    "totalRequirements": 0,
    "strongMatches": 0,
    "partialMatches": 0,
    "weakMatches": 0,
    "noMatches": 0
  },
  "matchAnalysis": {
    "strongMatches": [
      {
        "requirementId": "REQ-001",
        "requirement": "",
        "importance": "critical",
        "category": "",
        "resumeEvidence": [],
        "matchType": "exact_term",
        "confidenceScore": 0
      }
    ],
    "partialMatches": [
      {
        "requirementId": "",
        "requirement": "",
        "importance": "",
        "category": "",
        "resumeEvidence": [],
        "candidateHas": "",
        "gapDescription": "",
        "transferabilityScore": 0,
        "recommendation": ""
      }
    ],
    "weakMatches": [
      {
        "requirementId": "",
        "requirement": "",
        "importance": "",
        "resumeEvidence": [],
        "connection": "",
        "recommendation": ""
      }
    ],
    "noMatches": [
      {
        "requirementId": "",
        "requirement": "",
        "importance": "",
        "category": "",
        "impactOnApplication": "",
        "recommendation": "",
        "canBeAddressedInResume": false,
        "suggestedResumeAddition": ""
      }
    ]
  },
  "atsKeywordAnalysis": {
    "matchedKeywords": [
      {
        "keyword": "",
        "foundIn": ""
      }
    ],
    "missingKeywords": [
      {
        "keyword": "",
        "importance": "",
        "suggestedPlacement": ""
      }
    ],
    "phrasingMismatches": [
      {
        "jdPhrase": "",
        "resumePhrase": "",
        "recommendation": ""
      }
    ],
    "keywordMatchRate": 0
  },
  "resumePreservation": {
    "totalOriginalBullets": 0,
    "bulletsMatchedToRequirements": 0,
    "bulletsNotMatchedButValuable": [
      {
        "bullet": "",
        "value": ""
      }
    ],
    "bulletsToConsiderRemoving": [
      {
        "bullet": "",
        "reason": ""
      }
    ]
  },
  "prioritizedActions": [
    {
      "priority": 1,
      "action": "",
      "impact": "high",
      "targetRequirement": "",
      "effort": "easy"
    }
  ],
  "analysisMetadata": {
    "totalRequirementsAnalyzed": 0,
    "totalResumeBulletsAnalyzed": 0,
    "requirementsAccountedFor": 0,
    "unaccountedRequirements": [],
    "analysisComplete": false,
    "warnings": []
  }
}

READINESS LEVEL THRESHOLDS:
- overallScore >= 80 → "strong_match"
- overallScore >= 60 → "competitive"
- overallScore >= 40 → "needs_work"
- overallScore < 40 → "significant_gaps"

EMPTY ARRAY RULES:
- If no strong matches found → "strongMatches": []
- If no partial matches found → "partialMatches": []
- If no weak matches found → "weakMatches": []
- If no gaps found → "noMatches": []
- If no keyword mismatches → "phrasingMismatches": []
- If no actions needed → "prioritizedActions": []
- If no warnings → "warnings": []
- NEVER omit the key. Always include it with an empty array.

WARNINGS — Add to analysisMetadata.warnings for any of these conditions:
- "Resume summary section was empty"
- "Resume skills section was empty"
- "Resume had no experience entries"
- "Job description had no must-have requirements"
- "Job description had no keywords extracted"
- "Could not calculate keyword match rate — no keywords in JD"
- "Education comparison skipped — no education data in resume/JD"
- Any other data quality issue encountered

FINAL VALIDATION: Before returning your response, verify:
1. Every REQ-ID from Step 1 appears in exactly one of: strongMatches, partialMatches, weakMatches, or noMatches.
2. totalRequirementsAnalyzed == strongMatches count + partialMatches count + weakMatches count + noMatches count.
3. No resume bullet points were ignored — every bullet is either cited as evidence or listed in resumePreservation.
4. The overallScore math is correct based on the weights defined above.
5. ALL keys in the JSON schema above are present in your output — no missing keys.
6. No field has the value undefined or null (use the defaults specified above).
7. All arrays that should be empty are [] not missing.
8. analysisMetadata.analysisComplete is true only if all validations pass.`.trim();
        const aiResult = await (0, aiUtils_1.callAiWithFallback)(openai, perplexityApiKey.value().trim(), systemInstruction, userContent, { maxTokens: 4096 });
        const analysisResult = JSON.parse(aiResult);
        // Mapping helper for the new complex Match objects to our simplified SkillMatch interface
        const mapMatchToSkill = (m) => ({
            skill: m.requirement || m.skill || "",
            importance: (m.importance || 'medium').toLowerCase(),
            confidence: m.confidenceScore || m.confidence || 0,
            evidence: Array.isArray(m.resumeEvidence) ? m.resumeEvidence.join(", ") : (m.resumeEvidence || m.evidence || ""),
            candidateSkill: m.candidateHas || m.candidateSkill || "",
            transferability: m.gapDescription || m.transferability || "",
            recommendation: m.recommendation || "",
            requirementId: m.requirementId
        });
        // Normalize results into backwards-compatible fields
        // First, map all categories
        const rawMatchedSkills = (analysisResult.matchAnalysis?.strongMatches || []).map(mapMatchToSkill);
        const rawPartialMatches = (analysisResult.matchAnalysis?.partialMatches || []).map(mapMatchToSkill);
        const rawMissingSkills = [
            ...(analysisResult.matchAnalysis?.weakMatches || []),
            ...(analysisResult.matchAnalysis?.noMatches || [])
        ].map(mapMatchToSkill);
        // Helper: case-insensitive fuzzy match check
        const skillsOverlap = (a, b) => {
            const la = a.toLowerCase().trim();
            const lb = b.toLowerCase().trim();
            return la === lb || la.includes(lb) || lb.includes(la);
        };
        // Deduplicate: matched skills take priority over partial, partial takes priority over missing
        const dedupedPartialMatches = rawPartialMatches.filter((p) => !rawMatchedSkills.some((m) => skillsOverlap(m.skill, p.skill)));
        const dedupedMissingSkills = rawMissingSkills.filter((m) => !rawMatchedSkills.some((s) => skillsOverlap(s.skill, m.skill)) &&
            !dedupedPartialMatches.some((p) => skillsOverlap(p.skill, m.skill)));
        // Final self-deduplication within each list (in case AI returns dupes within the same list)
        const deduplicateList = (list) => {
            const seen = new Set();
            return list.filter(item => {
                const key = item.skill.toLowerCase().trim();
                if (seen.has(key))
                    return false;
                seen.add(key);
                return true;
            });
        };
        const matchAnalysis = {
            matchedSkills: deduplicateList(rawMatchedSkills),
            partialMatches: deduplicateList(dedupedPartialMatches),
            missingSkills: deduplicateList(dedupedMissingSkills),
            // Keep raw new fields for detailed UI injection
            strongMatches: analysisResult.matchAnalysis?.strongMatches || [],
            weakMatches: analysisResult.matchAnalysis?.weakMatches || [],
            noMatches: analysisResult.matchAnalysis?.noMatches || [],
            atsKeywordAnalysis: analysisResult.atsKeywordAnalysis,
            executiveSummary: analysisResult.executiveSummary,
            keywordDensity: analysisResult.atsKeywordAnalysis?.keywordMatchRate || 0,
            experienceMatch: { match: analysisResult.overallScore || 0 },
            readinessVerdict: (analysisResult.readinessLevel || 'stretch').toLowerCase(),
            verdictSummary: analysisResult.executiveSummary || ""
        };
        const gaps = {
            criticalGaps: (analysisResult.matchAnalysis?.noMatches || [])
                .filter((m) => m.importance === 'critical' || m.importance === 'high')
                .map((m) => ({
                skill: m.requirement || m.skill,
                importance: m.importance?.toLowerCase() || 'high',
                hasTransferable: false,
                recommendation: m.recommendation,
                impactOnApplication: m.impactOnApplication
            })),
            minorGaps: (analysisResult.matchAnalysis?.weakMatches || [])
                .map((m) => ({
                skill: m.requirement || m.skill,
                importance: m.importance?.toLowerCase() || 'medium',
                hasTransferable: true,
                recommendation: m.recommendation
            })),
            totalGapScore: 100 - (analysisResult.overallScore || 0),
            prioritizedActions: analysisResult.prioritizedActions || []
        };
        const atsScore = analysisResult.overallScore || 0;
        const readyToApply = atsScore >= 60;
        await taskRef.update({
            progress: 80,
            currentStep: "Analysis complete",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return {
            success: true,
            matchAnalysis,
            gaps,
            atsScore,
            readyToApply,
        };
    }
    catch (error) {
        console.error(`[GapAnalysis] Failed for task ${taskId}:`, error);
        await taskRef.update({
            status: "failed",
            error: error.message || "Analysis failed",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }).catch(console.error);
        throw new https_1.HttpsError("internal", error.message || "Failed to perform gap analysis.");
    }
});
exports.performGapAnalysis = performGapAnalysis;
//# sourceMappingURL=gapAnalysis.js.map