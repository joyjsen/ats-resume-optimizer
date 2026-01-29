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
     * Quickly fetch just the text description from a URL (skips AI parsing)
     */
    async fetchJobDescription(url: string): Promise<string> {
        try {
            const htmlContent = await this.scrapeJobPage(url);
            return this.extractTextFromHTML(htmlContent);
        } catch (error) {
            console.error('Error fetching job description:', error);
            throw new Error('Failed to fetch job text.');
        }
    }



    /**
     * Scrape job page HTML
     */
    /**
     * Scrape job page HTML
     */
    private async scrapeJobPage(url: string): Promise<string> {
        // LinkedIn extraction strategy: Use jobs-guest API
        if (url.includes('linkedin.com')) {
            const jobId = this.extractLinkedInJobId(url);
            if (jobId) {
                console.log(`Detected LinkedIn URL. Extracted Job ID: ${jobId}`);
                // Use the guest API which returns the job posting HTML fragment
                const guestApiUrl = `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
                console.log(`Fetching from Guest API: ${guestApiUrl}`);
                url = guestApiUrl;
            } else {
                console.warn('Could not extract LinkedIn Job ID from URL');
            }
        }

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
     * Extract LinkedIn Job ID from various URL formats
     */
    private extractLinkedInJobId(url: string): string | null {
        // Pattern 1: /jobs/view/123456
        const viewMatch = url.match(/\/jobs\/view\/(\d+)/);
        if (viewMatch) return viewMatch[1];

        // Pattern 2: currentJobId=123456
        const queryMatch = url.match(/currentJobId=(\d+)/);
        if (queryMatch) return queryMatch[1];

        // Pattern 3: /jobs/search/?currentJobId=123456
        // Pattern 4: /comm/jobs/view/123456 (mobile app links sometimes)

        return null;
    }

    /**
     * Extract clean text from HTML
     */
    /**
     * Extract clean text from HTML
     */
    private extractTextFromHTML(html: string): string {
        try {
            // 0. Attempt to extract specific container first (LinkedIn specific)
            // LinkedIn 'jobs-guest' API often puts the description in a 'description__text' class
            const descriptionMatch = html.match(/class="[^"]*description__text[^"]*">([\s\S]*?)<\/section>/i)
                || html.match(/class="[^"]*show-more-less-html__markup[^"]*">([\s\S]*?)<\/(div|section)>/i);

            let text = descriptionMatch ? descriptionMatch[1] : html;

            // 1. Remove script and style tags and their content
            text = text.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '');
            text = text.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '');

            // 2. Convert block elements to newlines to preserve structure
            text = text.replace(/<(br|p|div|li|h[1-6])\b[^>]*>/gim, '\n');
            text = text.replace(/<\/li>/gim, '\n'); // End of list item matches new line
            text = text.replace(/<\/ul>|<\/ol>/gim, '\n'); // End of list matches new line

            // 3. Remove all other HTML tags
            text = text.replace(/<[^>]+>/g, ' ');

            // 4. Decode common HTML entities
            text = text.replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&#x27;/g, "'");

            // 5. Clean up "LinkedIn Noise" and excessive whitespace
            text = text.replace(/Show more|Show less/gi, '');
            text = text.replace(/Posted \d+ days? ago/gi, '');

            // Collapse multiple spaces
            text = text.replace(/[ \t]+/g, ' ');
            // Collapse multiple newlines (max 2)
            text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');

            return text.trim();
        } catch (e) {
            console.error("Error cleaning HTML, falling back to basic strip", e);
            return html.replace(/<[^>]+>/g, ' ').trim();
        }
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

        const options = {
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
        };

        const response = await safeOpenAICall(
            () => openai.chat.completions.create(options as any),
            'Job from Text',
            options
        );

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
