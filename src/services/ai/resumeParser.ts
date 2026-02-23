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
      // OPTIMIZATION: Check if we can use Vision-First multimodal parsing (faster for images)
      const imageUris = fileUris.filter(uri => uri.match(/\.(jpg|jpeg|png)$/i) || uri.startsWith('data:image'));
      const otherUris = fileUris.filter(uri => !uri.match(/\.(jpg|jpeg|png)$/i) && !uri.startsWith('data:image'));

      if (imageUris.length > 0 && otherUris.length === 0) {
        console.log(`[ResumeParser] Using Vision-First multimodal parsing for ${imageUris.length} images.`);
        const base64Images = await Promise.all(
          imageUris.map(uri => FileSystem.readAsStringAsync(uri, { encoding: 'base64' }))
        );
        return await this.parseWithMultimodalAI(base64Images);
      }

      // Fallback/Mixed content: Extract text first
      const mixedContent = await this.extractContentFromFiles(fileUris);
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
        if (!uri || typeof uri !== 'string') continue; // Skip invalid URIs
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

      const combined = allContents.join('\n\n');
      console.log(`[ResumeParser] Extraction complete. Length: ${combined.length}`);
      return combined;
    } catch (error) {
      console.error("File reading error:", error);
      throw error;
    }
  }

  /**
   * Use OpenAI to parse resume into structured data
   */
  /**
   * Use OpenAI to parse structured data from the resume text.
   * IMPROVED: proper system/user role separation to avoid token limits and hallucination.
   */
  private async parseWithAI(content: string): Promise<ParsedResume> {
    const systemPrompt = `Expert Resume Parser. Extract data from the text into EXACT JSON.
Structure:
{
  "contactInfo": {"name":"", "email":"", "phone":"", "location":"", "linkedin":"", "portfolio":"", "github":""},
  "summary": "",
  "experience": [{"company":"", "title":"", "location":"", "startDate":"MM/YYYY", "endDate":"MM/YYYY", "current":false, "bullets":[]}],
  "education": [{"institution":"", "degree":"", "field":"", "startDate":"YYYY", "endDate":"YYYY", "gpa":""}],
  "skills": [{"name":"", "category":"technical|soft|domain|methodology", "proficiency":"beginner|intermediate|advanced|expert"}],
  "certifications": [{"name":"", "issuer":"", "date":"MM/YYYY"}],
  "projects": [{"name":"", "description":"", "technologies":[], "url":""}]
}
Rules:
- Exhaustive extraction. Do not truncate bullets.
- MM/YYYY dates.
- Clean bullets (no symbols).
- Categorize skills accurately.
- Return EXACT JSON, no other text.`.trim();

    // Clean visualization markers if present
    const cleanContent = content.replace(/\[IMAGE_CONTENT:.*?\]/g, '(Image Data Included)');

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Resume Content:\n${cleanContent}` }
    ];

    // Validation
    const lines = content.split('\n');
    const warnings = lines.filter(l => l.startsWith('[WARNING:'));
    const actualContent = lines.filter(l => !l.startsWith('[WARNING:') && l.trim().length > 0);

    const isOnlyWarnings = content.trim().length === 0 || (warnings.length > 0 && actualContent.length === 0);

    if (isOnlyWarnings) {
      let errorMessage = "No valid content found. Please upload a Screenshot (Image), Text file (.txt), or DOCX.";
      if (warnings.length > 0) {
        errorMessage = `Could not extract text from files: ${warnings.map(w => w.replace('[WARNING:', '').replace(']', '').trim()).join('; ')}`;
      }
      throw new Error(errorMessage);
    }

    const options = {
      model: 'gpt-4o-mini',
      messages: messages,
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      temperature: 0, // Deterministic and faster
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
      text: content
    };
  }

  /**
   * Multimodal Vision Parsing - Combined OCR and Structure extraction
   * This is the FASTEST way to parse images.
   */
  private async parseWithMultimodalAI(base64Images: string[]): Promise<ParsedResume> {
    const systemPrompt = `Expert Resume Parser. Extract all details from these images into EXACT JSON.
Structure:
{
  "contactInfo": {"name":"", "email":"", "phone":"", "location":"", "linkedin":"", "portfolio":"", "github":""},
  "summary": "",
  "experience": [{"company":"", "title":"", "location":"", "startDate":"MM/YYYY", "endDate":"MM/YYYY", "current":false, "bullets":[]}],
  "education": [{"institution":"", "degree":"", "field":"", "startDate":"YYYY", "endDate":"YYYY", "gpa":""}],
  "skills": [{"name":"", "category":"technical|soft|domain|methodology", "proficiency":"beginner|intermediate|advanced|expert"}],
  "certifications": [{"name":"", "issuer":"", "date":"MM/YYYY"}],
  "projects": [{"name":"", "description":"", "technologies":[], "url":""}]
}
Rules:
- EXHAUSTIVE text extraction. Do not skip content.
- Combined all images into one profile.
- Return EXACT JSON, no explanations.`.trim();

    const imageContent = base64Images.map(base64 => ({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${base64}` }
    }));

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: "Extract and structure this resume from the attached images." },
          ...imageContent as any
        ]
      }
    ];

    const response = await safeOpenAICall(() => openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      response_format: { type: 'json_object' },
      max_tokens: 4000,
      temperature: 0,
    }), 'Resume Vision-First Parse');

    const contentResponse = response.choices[0].message.content;
    if (!contentResponse) throw new Error("No response from AI");

    const parsed = JSON.parse(contentResponse);

    return {
      ...parsed,
      experience: (parsed.experience || []).map((exp: any) => ({ ...exp, id: this.generateId() })),
      education: (parsed.education || []).map((edu: any) => ({ ...edu, id: this.generateId() })),
      skills: parsed.skills || [],
      text: "[Parsed from images]"
    };
  }

  /**
   * Batched OCR - processes multiple images in a single API call
   * This is kept as a fallback for pure text extraction needs.
   */
  private async performBatchedOCR(base64Images: string[]): Promise<string> {
    try {
      const imageContent = base64Images.map(base64 => ({
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${base64}` }
      }));

      const prompt = base64Images.length > 1
        ? `Extract ALL text from these ${base64Images.length} resume images verbatim. Combine in logical order. Do not summarize.`
        : "Extract the text from this resume image verbatim. Do not summarize.";

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
        max_tokens: 4000,
        temperature: 0,
      }), 'Resume OCR (Batched)');

      let text = response.choices[0].message.content || "";
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
