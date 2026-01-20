import axios from 'axios';
import { JobPosting } from '../../types/job.types';
import { openai, safeOpenAICall } from '../../config/ai';

// Removed local OpenAI instantiation

export class JobParserService {
    /**
     * Parse job posting from URL
     */
    async parseJobFromURL(url: string): Promise<JobPosting> {
        try {
            // Step 1: Scrape the job page
            const htmlContent = await this.scrapeJobPage(url);

            // Step 2: Extract text content
            const textContent = this.extractTextFromHTML(htmlContent);

            // Step 3: Use OpenAI to parse structured data
            const parsedData = await this.parseWithAI(textContent, url);

            return parsedData;
        } catch (error) {
            console.error('Error parsing job URL:', error);
            throw new Error('Failed to parse job posting. Please paste the job description manually.');
        }
    }

    /**
     * Parse job posting from manual text input
     */
    async parseJobFromText(text: string, jobTitle?: string, company?: string): Promise<JobPosting> {
        const parsedData = await this.parseWithAI(text, '', jobTitle, company);
        return parsedData;
    }

    /**
     * Parse job posting from images (screenshots)
     */
    async parseJobFromImage(base64Images: string[]): Promise<JobPosting> {
        try {
            const prompt = `
                Extract structured job posting information from these images.
                Identify the job title, company, location, and all required skills/qualifications.
                If the content spans multiple images, combine the information intelligently.
                Return the result in the standard JSON format used for job analysis.
            `.trim();

            const imageContent = base64Images.map(base64 => ({
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${base64}` }
            }));

            const response = await safeOpenAICall(() => openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            ...imageContent as any
                        ],
                    },
                ],
                max_tokens: 1500,
            }), 'Job from Image');

            const contentResponse = response.choices[0].message.content;
            if (!contentResponse) throw new Error('No response from OpenAI Vision');

            // Clean up markdown code blocks if present
            const cleanContent = contentResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanContent);

            return {
                id: this.generateId(),
                url: '',
                title: parsed.title || 'Unknown Job',
                company: parsed.company || 'Unknown Company',
                location: parsed.location,
                salary: parsed.salary,
                type: parsed.type,
                remote: parsed.remote,
                description: parsed.description || '',
                requirements: parsed.requirements || { mustHaveSkills: [], niceToHaveSkills: [], keywords: [] },
                parsedAt: new Date(),
            };
        } catch (error) {
            console.error('Error parsing job from image:', error);
            throw new Error('Failed to process screenshot. Please try pasting the text instead.');
        }
    }

    /**
     * Scrape job page HTML
     */
    private async scrapeJobPage(url: string): Promise<string> {
        // Note: Direct scraping from client often fails due to CORS or bot protection.
        // In production, use a proxy or cloud function.
        console.warn('Scraping from client - might fail due to CORS');
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            },
            timeout: 10000,
        });
        return response.data;
    }

    /**
     * Extract clean text from HTML
     */
    /**
     * Extract clean text from HTML
     */
    private extractTextFromHTML(html: string): string {
        // 1. Remove script and style tags and their content
        let text = html.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, ' ');
        text = text.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, ' ');

        // 2. Remove nav, header, footer and their content
        text = text.replace(/<(nav|header|footer)\b[^>]*>([\s\S]*?)<\/\1>/gim, ' ');

        // 3. Remove all other HTML tags
        text = text.replace(/<[^>]+>/g, ' ');

        // 4. Decode common HTML entities (basic)
        text = text.replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"');

        // 5. Clean up whitespace
        return text.replace(/\s+/g, ' ').trim();
    }

    /**
     * Use OpenAI to parse job posting into structured data
     */
    private async parseWithAI(
        content: string,
        url: string,
        jobTitle?: string,
        company?: string
    ): Promise<JobPosting> {
        const prompt = `
You are an expert job posting analyzer. Extract structured information from this job posting.

Job Posting Content:
${content.substring(0, 15000)} // Limit content length

Extract and return JSON with the following structure:
{
  "title": "exact job title",
  "company": "company name",
  "location": "city, state/country or 'Remote'",
  "salary": "salary range if mentioned, otherwise null",
  "type": "full-time|part-time|contract|internship",
  "remote": true|false,
  "description": "clean job description without requirements",
  "requirements": {
    "mustHaveSkills": [
      {
        "name": "skill name",
        "importance": "critical|high|medium|low",
        "category": "technical|soft|tool|framework|language"
      }
    ],
    "niceToHaveSkills": [...same structure],
    "experienceLevel": "entry|mid|senior|lead|executive",
    "yearsExperience": "X-Y years" or "X+ years" or null,
    "education": ["degree requirements"],
    "certifications": ["certification names"],
    "keywords": ["important keywords for ATS"]
  }
}

Guidelines:
- Mark skills as "critical" if described as "required", "must have"
- Mark as "high" if "strongly preferred" or emphasized
- Mark as "medium" or "low" if "nice to have" or "plus"
- Extract ALL technical skills, tools, frameworks mentioned
- Include soft skills like "leadership", "communication"
- Keywords should include: skills, technologies, methodologies, domain knowledge
- If information is missing, use null or empty array

${jobTitle ? `Known job title: ${jobTitle}` : ''}
${company ? `Known company: ${company}` : ''}
    `.trim();

        const response = await safeOpenAICall(() => openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
        }), 'Job from Text');

        const contentResponse = response.choices[0].message.content;
        if (!contentResponse) throw new Error('No response from OpenAI');

        const parsed = JSON.parse(contentResponse);

        return {
            id: this.generateId(),
            url: url,
            title: parsed.title || 'Unknown Job',
            company: parsed.company || 'Unknown Company',
            location: parsed.location,
            salary: parsed.salary,
            type: parsed.type,
            remote: parsed.remote,
            description: parsed.description || '',
            requirements: parsed.requirements || { mustHaveSkills: [], niceToHaveSkills: [], keywords: [] },
            parsedAt: new Date(),
        };
    }

    private generateId(): string {
        return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

export const jobParserService = new JobParserService();
