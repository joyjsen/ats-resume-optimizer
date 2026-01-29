export class LinkedInService {
    /**
     * Extracts the Job ID from a standard LinkedIn Job URL
     */
    extractJobId(url: string): string | null {
        // Handle various formats:
        // /jobs/view/12345/
        // /jobs/view/12345
        // currentJobId=12345 (search params)

        try {
            // Priority 1: Direct /view/ ID
            const viewMatch = url.match(/\/jobs\/view\/(\d+)/);
            if (viewMatch && viewMatch[1]) {
                return viewMatch[1];
            }

            // Priority 2: Query Param (common in direct links or search results)
            const urlObj = new URL(url);
            const currentJobId = urlObj.searchParams.get('currentJobId');
            if (currentJobId) return currentJobId;

        } catch (e) {
            console.log("Error parsing URL params:", e);
        }

        // Priority 3: Collections regex (sometimes links look different)
        const digits = url.match(/(\d+)/g);
        // This is risky as it might pick up other numbers, but usually the job ID is the longest or last significant one.
        // Let's stick to strict patterns for reliability first.
        return null;
    }

    /**
     * Reconstructs the Guest API URL
     */
    getGuestUrl(jobId: string): string {
        return `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`;
    }

    /**
     * Fetches and extracts description text
     */
    async fetchJobDescription(url: string): Promise<string | null> {
        const jobId = this.extractJobId(url);
        if (!jobId) {
            console.log("Could not extract Job ID from URL");
            return null;
        }

        const guestUrl = this.getGuestUrl(jobId);
        console.log(`Fetching guest URL: ${guestUrl}`);

        try {
            const response = await fetch(guestUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            if (!response.ok) {
                console.warn(`Failed to fetch guest URL: ${response.status}`);
                return null;
            }

            const html = await response.text();

            // The response is an HTML snippet of the job posting.
            // We need to parse this or regex strip it.
            // Since we don't have a DOM parser in React Native JS engine easily without polyfills,
            // we will use regex to strip tags and decode entities.

            // Try to extract just the description container first
            // Common class for LinkedIn guest view descriptions: "show-more-less-html__markup"
            const descriptionMatch = html.match(/<div class="[^"]*show-more-less-html__markup[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

            let contentToClean = html;
            if (descriptionMatch && descriptionMatch[1]) {
                contentToClean = descriptionMatch[1];
            } else {
                // If specific container not found, try to remove known header/footer junk from the full HTML
                // Remove "About the job" header if present
                contentToClean = contentToClean.replace(/About the job/i, '');
            }

            return this.cleanHtml(contentToClean);
        } catch (error) {
            console.error("Error fetching LinkedIn job:", error);
            return null;
        }
    }

    private cleanHtml(html: string): string {
        // 1. Remove script and style tags
        let text = html.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "");
        text = text.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "");

        // 2. Replace <br> and <p> with newlines
        text = text.replace(/<br\s*\/?>/gi, "\n");
        text = text.replace(/<\/p>/gi, "\n\n");
        text = text.replace(/<li>/gi, "\n• "); // Format list items nicely
        text = text.replace(/<\/li>/gi, "");

        // 3. Strip all other tags
        text = text.replace(/<[^>]+>/g, "");

        // 4. Decode HTML entities (extended)
        text = text
            .replace(/&nbsp;/g, " ")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&ndash;/g, "-")
            .replace(/&mdash;/g, "--");

        // 5. Remove known operational noise (post-stripping)
        // LinkedIn sometimes includes these text snippets invisibly or in aria-labels that get stripped to text
        const noisePatterns = [
            /Show more/gi,
            /Show less/gi,
            /Seniority level/gi, // Actually these might be useful context, but if user wants pure description...
            // "Employment type", "Job function", "Industries" are often in the sidebar, not description.
            // If we captured the specific div, these shouldn't be there.
        ];

        // If we failed to capture the specific div, we might have noise.
        // But if we did capture it, we're likely good.

        // 6. Clean up excessive whitespace
        text = text.replace(/\n\s*\n/g, "\n\n").trim();

        return text;
    }
}

export const linkedInService = new LinkedInService();
