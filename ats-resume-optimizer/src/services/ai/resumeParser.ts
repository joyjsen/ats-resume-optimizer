import * as FileSystem from 'expo-file-system/legacy';
import { ParsedResume } from '../../types/resume.types';
import { openai, safeOpenAICall } from '../../config/ai';
import { Buffer } from 'buffer';

// Use the browser build of mammoth to avoid Node.js dependency issues in React Native
const mammoth = require('mammoth/mammoth.browser');

// pdf-parse is removed as it breaks the React Native bundler.
// const pdf = require('pdf-parse');

export class ResumeParserService {
  /**
   * Parse resume files (Multiple Images, Text, PDF, DOCX)
   */
  async parseResume(fileUris: string[]): Promise<ParsedResume> {
    try {
      // Step 1: Extract text/images from files
      const mixedContent = await this.extractContentFromFiles(fileUris);

      // Step 2: Use OpenAI to parse structured data
      return await this.parseWithAI(mixedContent);
    } catch (error: any) {
      console.error('Error parsing resume:', error);
      throw new Error('Failed to parse resume. ' + (error.message || ''));
    }
  }

  /**
   * Parse resume directly from extracted text content
   */
  async parseResumeFromContent(content: string): Promise<ParsedResume> {
    try {
      return await this.parseWithAI(content);
    } catch (error: any) {
      console.error('Error parsing resume content:', error);
      throw new Error('Failed to parse resume content. ' + (error.message || ''));
    }
  }

  /**
   * Extract content from multiple files (Images, Text, PDF, DOCX)
   * OPTIMIZED: Batches multiple images into a single OCR call
   */
  async extractContentFromFiles(fileUris: string[]): Promise<string> {
    try {
      // Separate images from other file types for batch processing
      const imageUris: string[] = [];
      const otherUris: string[] = [];

      for (const uri of fileUris) {
        if (uri.match(/\.(jpg|jpeg|png)$/i) || uri.startsWith('data:image')) {
          imageUris.push(uri);
        } else {
          otherUris.push(uri);
        }
      }

      // Process non-image files
      const otherContents = await Promise.all(otherUris.map(async (uri) => {
        // Case 2: Text/Markdown/JSON
        if (uri.match(/\.(txt|md|json)$/i)) {
          return await FileSystem.readAsStringAsync(uri);
        }

        // Case 3: DOCX
        if (uri.match(/\.docx$/i) || uri.match(/\.doc$/i)) {
          try {
            const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
            const buffer = Buffer.from(base64, 'base64');
            const result = await mammoth.extractRawText({ arrayBuffer: buffer });
            return result.value || "";
          } catch (docxError: any) {
            console.error("DOCX Parse Error", docxError);
            return `[WARNING: DOCX Parsing failed (${docxError.message}).]`;
          }
        }

        // Case 4: PDF (Not supported)
        if (uri.match(/\.pdf$/i)) {
          return `[WARNING: PDF files are not supported. Please use DOCX or Text.]`;
        }

        return `[WARNING: Unsupported file type ${uri.split('/').pop()}]`;
      }));

      // Process images - batch into single OCR call if multiple
      let imageContent = "";
      if (imageUris.length > 0) {
        try {
          const base64Images = await Promise.all(
            imageUris.map(uri => FileSystem.readAsStringAsync(uri, { encoding: 'base64' }))
          );
          // Use batched OCR for multiple images (single API call)
          imageContent = await this.performBatchedOCR(base64Images);
        } catch (e) {
          console.error("OCR Error", e);
          imageContent = "[Error extracting text from images]";
        }
      }

      // Combine all content
      const allContents = [...otherContents];
      if (imageContent) {
        allContents.push(imageContent);
      }

      return allContents.join('\n\n');
    } catch (error) {
      console.error("File reading error:", error);
      throw error;
    }
  }

  /**
   * Use OpenAI to parse resume into structured data
   */
  private async parseWithAI(content: string): Promise<ParsedResume> {
    const prompt = `
You are an expert resume parser. Extract structured information from this resume.
If multiple pages (images) are provided, combine the information intelligently.

Resume Content:
${content.replace(/\[IMAGE_CONTENT:.*?\]/g, '(Image Data Included)')}

Extract and return JSON with the following structure:
{
  "contactInfo": {
    "name": "full name",
    "email": "email",
    "phone": "phone number",
    "location": "city, state",
    "linkedin": "linkedin URL",
    "portfolio": "portfolio URL",
    "github": "github URL"
  },
  "summary": "professional summary if present",
  "experience": [
    {
      "company": "company name",
      "title": "job title",
      "location": "city, state",
      "startDate": "MM/YYYY",
      "endDate": "MM/YYYY or null if current",
      "current": true|false,
      "bullets": ["bullet point 1", "bullet point 2"]
    }
  ],
  "education": [
    {
      "institution": "school name",
      "degree": "degree type",
      "field": "field of study",
      "startDate": "YYYY",
      "endDate": "YYYY",
      "gpa": "GPA if mentioned"
    }
  ],
  "skills": [
    {
      "name": "skill name",
      "category": "technical|soft|language|tool|framework",
      "proficiency": "beginner|intermediate|advanced|expert (infer from context)"
    }
  ],
  "certifications": [
    {
      "name": "certification name",
      "issuer": "issuing organization",
      "date": "MM/YYYY"
    }
  ],
  "projects": [
    {
      "name": "project name",
      "description": "brief description",
      "technologies": ["tech1", "tech2"],
      "url": "project URL if available"
    }
  ]
}

Guidelines:
- Extract ALL information present
- Infer skill proficiency from experience context
- Standardize date formats
- Clean up bullet points (remove extra symbols)
- Categorize skills accurately
- If section is missing, return empty array
    `.trim();

    // Simplified prompt now that we always have text (OCR performed upstream)
    const messages: any[] = [{ role: 'user', content: prompt + `\n\nResume Content:\n${content}` }];

    // Validation
    const isOnlyWarnings = !content.includes('[IMAGE_CONTENT:') &&
      (content.trim().length === 0 ||
        (content.includes('[WARNING:') && !content.split('\n').some(line => !line.startsWith('[WARNING:') && line.trim().length > 0)));

    if (isOnlyWarnings) {
      throw new Error("No valid content found. Please upload a Screenshot (Image), Text file (.txt), PDF, or DOCX.");
    }

    const options = {
      model: 'gpt-4o-mini',
      messages: messages,
      response_format: { type: 'json_object' },
    };

    const response = await safeOpenAICall(
      () => openai.chat.completions.create(options as any),
      'Resume Parse',
      options
    );

    const contentResponse = response.choices[0].message.content;
    if (!contentResponse) throw new Error("No response from AI");

    const parsed = JSON.parse(contentResponse);

    // Add IDs to nested arrays
    return {
      ...parsed,
      experience: (parsed.experience || []).map((exp: any) => ({ ...exp, id: this.generateId() })),
      education: (parsed.education || []).map((edu: any) => ({ ...edu, id: this.generateId() })),
      skills: parsed.skills || [],
    };
  }

  /**
   * Batched OCR - processes multiple images in a single API call
   * This is significantly faster than individual OCR calls
   */
  private async performBatchedOCR(base64Images: string[]): Promise<string> {
    try {
      const imageContent = base64Images.map(base64 => ({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${base64}` }
      }));

      const prompt = base64Images.length > 1
        ? `Extract ALL text from these ${base64Images.length} resume images verbatim. If the content spans multiple pages/images, combine them in logical order. Do not summarize. Return only the extracted text.`
        : "Extract the text from this resume image verbatim. Do not summarize. Return only the text.";

      const messages: any[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            ...imageContent as any
          ]
        }
      ];

      const response = await safeOpenAICall(() => openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages,
        max_tokens: 4000, // Higher limit for multiple pages
      }), 'Resume OCR (Batched)');

      let text = response.choices[0].message.content || "";

      // Text Cleaning: Remove AI refusal/apology messages
      const refusalPattern = /(?:^|\s)(?:I'?m\s+sorry|I\s+am\s+sorry|Sorry)[^.!?]*[.!?]/gi;
      text = text.replace(refusalPattern, '');

      // Clean up excessive whitespace
      text = text.replace(/\s+/g, ' ').trim();

      return text;
    } catch (e) {
      console.error("Batched OCR Failed", e);
      throw new Error("Failed to extract text from images");
    }
  }

  /**
   * Helper to extract text from single image (kept for backwards compatibility)
   */
  private async performOCR(base64Image: string): Promise<string> {
    return this.performBatchedOCR([base64Image]);
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const resumeParserService = new ResumeParserService();
