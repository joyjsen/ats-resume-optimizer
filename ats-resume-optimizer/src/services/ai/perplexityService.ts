import axios from 'axios';
import { ParsedResume } from '../../types/resume.types';
import { ENV } from '../../config/env';

const PERPLEXITY_API_KEY = ENV.PERPLEXITY_API_KEY;
const API_URL = 'https://api.perplexity.ai/chat/completions';

export class PerplexityService {

    /**
     * Generate a tailored cover letter using Perplexity AI
     */
    async generateCoverLetter(resume: ParsedResume, jobTitle: string, company: string, jobDescription?: string): Promise<string> {
        try {
            if (!jobDescription || jobDescription.length < 50) {
                // If JD is weak, rely on Title/Company context
                console.warn("Weak Job Description for Cover Letter, using generic prompt.");
            }

            const prompt = `
You are an expert career coach and professional copywriter.
Write a compelling, professional cover letter for the following candidate applying for the position of "${jobTitle}" at "${company}".

THE GOAL:
- The cover letter must be tailored specifically to the job opportunities and requirements implied by the role.
- Highlight the candidate's most relevant skills and experiences from their resume.
- Maintain a professional, enthusiastic, and confident tone.
- Use standard business letter formatting (Header, Salutation, Body, Closing).
- Do not include placeholders like "[Your Name]" or "[Phone Number]" in the body if the data is available in the resume. Use the actual data.
- If specific contact data is missing, omit that line rather than using a placeholder.

CANDIDATE RESUME:
${JSON.stringify(resume, null, 2)}

JOB DETAILS:
Title: ${jobTitle}
Company: ${company}
Description: ${jobDescription || "N/A"}

Please output ONLY the text of the cover letter, starting with the header. Do not include markdown naming blocks or introductory conversational text.
            `;

            const response = await axios.post(
                API_URL,
                {
                    model: 'sonar-pro',
                    messages: [
                        { role: 'system', content: 'You are a helpful, professional career assistant.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000, // Cover letters shouldn't be too long
                    top_p: 0.9,
                    stream: false
                },
                {
                    headers: {
                        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const content = response.data.choices[0]?.message?.content;
            if (!content) throw new Error("No content returned from AI");

            return content.trim();

        } catch (error: any) {
            console.error("Perplexity API Error:", error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || "Failed to generate cover letter.");
        }
    }

    /**
     * Generate Company Intelligence Research for Prep Guide
     */
    async generateCompanyResearch(companyName: string, jobTitle: string): Promise<string> {
        try {
            const prompt = `Research ${companyName} for interview preparation. You are helping a candidate prepare for a ${jobTitle} interview.

Provide detailed, CURRENT information in the following structure:

## 1. COMPANY OVERVIEW
- Mission, values, and culture
- Company size (employees, revenue if public)
- Headquarters and global presence
- Industry position and market share

## 2. RECENT NEWS & DEVELOPMENTS (Last 30-90 days)
Search for and include:
- Major product launches or announcements
- Leadership changes
- Strategic partnerships or acquisitions
- Financial performance (if public)
- Industry awards or recognition
- Any news relevant to ${jobTitle} role
- Use CURRENT sources (2024-2026)

## 3. COMPANY CULTURE & WORK ENVIRONMENT
Based on RECENT employee reviews (Glassdoor, Blind, LinkedIn):
- Company values in practice
- Work-life balance reputation
- Remote/hybrid policies (current as of 2025-2026)
- What employees say they love vs. challenges
- Interview process insights

## 4. KEY PRODUCTS & BUSINESS UNITS
- Main product lines or services (current portfolio)
- Revenue drivers
- Recent innovations
- Technologies used (especially relevant to ${jobTitle})
- Team/division structure

## 5. COMPETITIVE LANDSCAPE
- Main competitors (current market position)
- Company's competitive advantages
- Current challenges or threats (2025-2026)
- Market opportunities
- Industry trends affecting ${companyName}

## 6. INTERVIEW CULTURE & PROCESS
Search for current information about:
- What is ${companyName} known for in their interview process?
- Interview format and number of rounds
- What competencies do they value most?
- Specific interview prep advice for ${companyName}
- Recent changes to interview process (if any)

Use RECENT, credible sources from 2024-2026. Include specific dates when mentioning news or events. Be specific and actionable for interview preparation.`;

            const response = await axios.post(
                API_URL,
                {
                    model: 'sonar-pro', // WEB-CONNECTED MODEL
                    messages: [
                        { role: 'system', content: 'You are a company research analyst providing detailed, CURRENT information for interview preparation. Always use recent sources from 2024-2026 and include specific dates when relevant.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.3,
                    max_tokens: 4000,
                    return_citations: true
                },
                {
                    headers: {
                        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const content = response.data.choices[0]?.message?.content;
            if (!content) throw new Error("No content returned from AI");

            return content.trim();

        } catch (error: any) {
            console.error("Perplexity API Error (Research):", error.response?.data || error.message);
            throw new Error(error.response?.data?.error?.message || "Failed to generate company research.");
        }
    }
}

export const perplexityService = new PerplexityService();
