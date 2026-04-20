import axios from 'axios';
import { JobPosting } from '../../types/job.types';
import { createSafeAPICall } from '../../config/ai';

export class JobParserService {
    /**
     * Parse job posting from URL
     */
    async parseJobFromURL(url: string): Promise<JobPosting> {
        try {
            let textContent: string;
            let title = '';
            let company = '';

            const htmlContent = await this.scrapeJobPage(url);
            textContent = this.extractTextFromHTML(htmlContent);

            if (url.toLowerCase().includes('linkedin.com')) {
                const titleMatch = htmlContent.match(/class="top-card-layout__title[^"]*"[^>]*>([\s\S]*?)<\/h2>/i)
                    || htmlContent.match(/<title>([\s\S]*?) \| LinkedIn/i);
                title = titleMatch ? this.decodeSimpleEntities(titleMatch[1].trim().split(' | ')[0]) : '';

                const companyMatch = htmlContent.match(/class="topcard__org-name-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
                    || htmlContent.match(/class="topcard__flavor"[^>]*>([\s\S]*?)<\/span>/i)
                    || htmlContent.match(/data-tracking-control-name="public_jobs_topcard-org-name"[^>]*>([\s\S]*?)<\/a>/i)
                    || htmlContent.match(/class="jobs-unified-top-card__company-name"[^>]*>([\s\S]*?)<\/a>/i);
                company = companyMatch ? this.decodeSimpleEntities(companyMatch[1].trim()) : '';
            } else if (url.toLowerCase().includes('indeed.com')) {
                const companyMatch = htmlContent.match(/class="jobsearch-CompanyReview--heading"[^>]*>([\s\S]*?)<\/div>/i)
                    || htmlContent.match(/class="jobsearch-InlineCompanyRating"[^>]*>([\s\S]*?)<\/div>/i)
                    || htmlContent.match(/<meta property="og:description" content="[^"]*at ([^"]*)"/i);
                company = companyMatch ? this.decodeSimpleEntities(companyMatch[1].trim()) : '';
            }

            if (!company) {
                const ogCompany = htmlContent.match(/<meta property="og:site_name" content="([^"]*)"/i);
                if (ogCompany) company = this.decodeSimpleEntities(ogCompany[1].trim());
            }

            const parsedData = await this.parseWithAI(textContent, url, title, company);
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

            const options = {
                model: 'gpt-5.4-mini',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            ...imageContent as any
                        ],
                    },
                ],
                max_tokens: 4000,
            };

            const response = await createSafeAPICall(options as any, 'Job from Image');

            const message = response.choices[0].message;
            const contentResponse = message.content;
            if (!contentResponse || response.choices[0].finish_reason === 'length') {
                const reason = response.choices[0].finish_reason;
                const refusal = (message as any).refusal || 'None';
                console.error(`System returned empty/truncated content. Finish Reason: ${reason}. Refusal: ${refusal}`);
                
                let userReason: string = reason;
                if (reason === 'content_filter') userReason = "Content policy violation (safety)";
                if (reason === 'length') userReason = "The job description is too large. Please paste a shorter version.";
                
                throw new Error(`System rejected the document because: ${userReason}`);
            }

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
     * Quickly fetch job details from a URL (skips structured AI parsing)
     */
    async fetchJobDescription(url: string): Promise<{ title: string; company: string; description: string }> {
        try {
            console.log(`[JobParser] Fetching Job via direct scrape: ${url}`);

            let fetchUrl = url;
            if (url.toLowerCase().includes('indeed.com')) {
                const indeedJobId = this.extractIndeedJobId(url);
                if (indeedJobId) {
                    fetchUrl = `https://www.indeed.com/viewjob?jk=${indeedJobId}`;
                }
            }

            const htmlContent = await this.scrapeJobPage(fetchUrl);
            let rawText = this.extractTextFromHTML(htmlContent);

            const prompt = `
                You are a job posting parser. From the raw text below, extract:
                1. Job Title
                2. Company Name
                3. Full Job Description (EVERY SINGLE WORD from the technical requirements, responsibilities, and about sections).

                CRITICAL INSTRUCTION FOR DESCRIPTION:
                - DO NOT summarize.
                - DO NOT rephrase.
                - DO NOT use bullet points if the original didn't.
                - COPY the text ABSOLUTELY BY THE WORD with no modifications.
                - Include all requirements, qualifications, and duties verbatim.
                - Exclude only unrelated site noise like "Sign In", "Open in App", or "Career Guide articles" if they are outside the job content block.

                Raw Text:
                ${rawText.substring(0, 15000)}

                Return ONLY JSON with structure: { "title": "...", "company": "...", "description": "..." }
            `.trim();

            try {
                const options = {
                    model: 'gpt-5.4-mini',
                    messages: [{ role: 'user', content: prompt }],
                    response_format: { type: 'json_object' },
                };

                const response = await createSafeAPICall(options as any, 'Structure Job Scrape');

                const content = response.choices[0].message.content;
                const parsed = JSON.parse(content || '{}');

                return {
                    title: parsed.title || '',
                    company: parsed.company || '',
                    description: parsed.description || rawText
                };
            } catch (aiError) {
                console.warn('[JobParser] AI structuring failed, returning raw text:', aiError);
                return { title: '', company: '', description: rawText };
            }
        } catch (error) {
            console.error('Error fetching job description:', error);
            throw new Error('Failed to fetch job text.');
        }
    }

    private decodeSimpleEntities(text: string): string {
        return text
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&#x27;/g, "'")
            .replace(/<[^>]+>/g, '')
            .trim();
    }

    private async scrapeJobPage(url: string): Promise<string> {
        // LinkedIn: use their guest API for reliable structured HTML
        if (url.includes('linkedin.com')) {
            const jobId = this.extractLinkedInJobId(url);
            const fetchUrl = jobId
                ? `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`
                : url;
            const response = await axios.get(fetchUrl, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                timeout: 10000,
            });
            return response.data;
        }

        // Indeed: use mobile UA for cleaner HTML
        if (url.includes('indeed.com')) {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                },
                timeout: 10000,
            });
            return response.data;
        }

        // All other sites (Greenhouse, Lever, Workday, etc.):
        // Use Jina Reader to render JS-heavy pages and return clean markdown text
        try {
            console.log(`[JobParser] Using Jina Reader for JS-rendered page: ${url}`);
            const jinaUrl = `https://r.jina.ai/${url}`;
            const response = await axios.get(jinaUrl, {
                headers: {
                    'Accept': 'text/plain',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                timeout: 15000,
            });
            return response.data;
        } catch (jinaError) {
            // Fallback: if Jina fails, try direct fetch as last resort
            console.warn('[JobParser] Jina Reader failed, falling back to direct fetch:', jinaError);
            const response = await axios.get(url, {
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                timeout: 10000,
            });
            return response.data;
        }
    }

    private extractLinkedInJobId(url: string): string | null {
        const viewMatch = url.match(/\/jobs\/view\/(?:.*-)?(\d+)(?:\/|\?|$)/);
        if (viewMatch) return viewMatch[1];

        const queryMatch = url.match(/currentJobId=(\d+)/);
        if (queryMatch) return queryMatch[1];

        return null;
    }

    private extractIndeedJobId(url: string): string | null {
        try {
            const jkMatch = url.match(/[?&]jk=([^&]+)/);
            if (jkMatch) return jkMatch[1];

            const viewJobMatch = url.match(/viewjob\?jk=([^&]+)/);
            if (viewJobMatch) return viewJobMatch[1];

            return null;
        } catch (e) {
            return null;
        }
    }

    private extractTextFromHTML(html: string): string {
        try {
            const descriptionMatch = html.match(/class="[^"]*description__text[^"]*">([\s\S]*?)<\/section>/i)
                || html.match(/class="[^"]*show-more-less-html__markup[^"]*">([\s\S]*?)<\/(div|section)>/i);

            let text = descriptionMatch ? descriptionMatch[1] : html;

            text = text.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '');
            text = text.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '');
            text = text.replace(/<(br|p|div|li|h[1-6])\b[^>]*>/gim, '\n');
            text = text.replace(/<\/li>/gim, '\n');
            text = text.replace(/<\/ul>|<\/ol>/gim, '\n');
            text = text.replace(/<[^>]+>/g, ' ');

            text = text.replace(/&nbsp;/g, ' ')
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .replace(/&#x27;/g, "'");

            text = text.replace(/Show more|Show less/gi, '');
            text = text.replace(/Posted \d+ days? ago/gi, '');

            text = text.replace(/[ \t]+/g, ' ');
            text = text.replace(/\n\s*\n\s*\n+/g, '\n\n');

            return text.trim();
        } catch (e) {
            return html.replace(/<[^>]+>/g, ' ').trim();
        }
    }

    private async parseWithAI(
        content: string,
        url: string,
        jobTitle?: string,
        company?: string
    ): Promise<JobPosting> {
        const prompt = `
You are an expert job posting analyzer. Extract structured information from this job posting.

Job Posting Content:
${content.substring(0, 15000)}

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
- DESCRIPTION: This must be the ABSOLUTE VERBATIM job description. DO NOT summarize. DO NOT rephrase.
- PRIORITIZE: If "Known job title" or "Known company" are provided below, USE THEM EXACTLY as the "title" and "company" in your JSON.
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
            model: 'gpt-5.4-mini',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
        };

        const response = await createSafeAPICall(options as any, 'Job from Text');

        const message = response.choices[0].message;
        const contentResponse = message.content;
        if (!contentResponse || response.choices[0].finish_reason === 'length') {
            const reason = response.choices[0].finish_reason;
            const refusal = (message as any).refusal || 'None';
            console.error(`System returned empty/truncated content. Finish Reason: ${reason}. Refusal: ${refusal}`);
            
            let userReason: string = reason;
            if (reason === 'content_filter') userReason = "Content policy violation (safety)";
            if (reason === 'length') userReason = "The job description is too large. Please paste a shorter version.";
            
            throw new Error(`System rejected the document because: ${userReason}`);
        }

        const parsed = JSON.parse(contentResponse);

        const cleanValue = (val: any, fallback: string) => {
            if (val === null || val === undefined) return fallback;
            const s = String(val).trim();
            const lower = s.toLowerCase();
            if (lower === 'null' || lower === 'undefined' || lower === 'unknown' || lower === 'n/a' || lower === '') {
                return fallback;
            }
            return s;
        };

        return {
            id: this.generateId(),
            url: url,
            title: jobTitle || cleanValue(parsed.title, 'Unknown Job'),
            company: company || cleanValue(parsed.company, 'Unknown Company'),
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
