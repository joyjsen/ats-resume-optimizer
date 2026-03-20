import * as FileSystem from 'expo-file-system/legacy';
import { ParsedResume } from '../../types/resume.types';

// Use the browser build of mammoth to avoid Node.js dependency issues in React Native
let mammothCache: any = null;
const getMammoth = async () => {
  if (!mammothCache) {
    mammothCache = require('mammoth/mammoth.browser');
  }
  return mammothCache;
};

// pdf-parse is removed as it breaks the React Native bundler.
// const pdf = require('pdf-parse');


export class ResumeParserService {
  // In-memory cache: hash of content -> parsed result
  private _cache = new Map<string, ParsedResume>();

  /**
   * Simple hash function for content-based cache keys.
   * Uses a fast string hash (djb2) — sufficient for dedup purposes.
   */
  private _hashContent(content: string): string {
    let hash = 5381;
    for (let i = 0; i < content.length; i++) {
      hash = ((hash << 5) + hash) + content.charCodeAt(i); // hash * 33 + c
      hash = hash & hash; // Convert to 32-bit integer
    }
    return `resume_${hash >>> 0}`; // unsigned
  }

  /**
   * Parse resume files (Multiple Images, Text, PDF, DOCX)
   */
  async parseResume(fileUris: string[]): Promise<ParsedResume> {
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { getFirebaseFunctions } = await import('../firebase/config');
      const functions = await getFirebaseFunctions();
      const parseResumeFn = httpsCallable(functions, 'parseResume');

      // OPTIMIZATION: Check if we can use Vision-First multimodal parsing (faster for images)
      const imageUris = fileUris.filter(uri => uri.match(/\.(jpg|jpeg|png)$/i) || uri.startsWith('data:image'));
      const otherUris = fileUris.filter(uri => !uri.match(/\.(jpg|jpeg|png)$/i) && !uri.startsWith('data:image'));

      if (imageUris.length > 0 && otherUris.length === 0) {
        console.log(`[ResumeParser] Using Vision-First multimodal parsing for ${imageUris.length} images.`);
        const base64Images = await Promise.all(
          imageUris.map(uri => FileSystem.readAsStringAsync(uri, { encoding: 'base64' }))
        );

        // Cache check: hash the concatenated base64 images
        const cacheKey = this._hashContent(base64Images.join('|'));
        if (this._cache.has(cacheKey)) {
          console.log(`[ResumeParser] ✅ Cache HIT for images (key: ${cacheKey}). Returning cached result.`);
          return this._cache.get(cacheKey)!;
        }

        const response = await parseResumeFn({ text: '', images: base64Images });
        const result = response.data as ParsedResume;
        this._cache.set(cacheKey, result);
        console.log(`[ResumeParser] Cached parsed result (key: ${cacheKey}).`);
        return result;
      }

      // Fallback/Mixed content: Extract text first using client-side extractors
      const mixedContent = await this.extractContentFromFiles(fileUris);

      // Cache check: hash the extracted text content
      const cacheKey = this._hashContent(mixedContent);
      if (this._cache.has(cacheKey)) {
        console.log(`[ResumeParser] ✅ Cache HIT for text content (key: ${cacheKey}). Returning cached result.`);
        return this._cache.get(cacheKey)!;
      }

      const response = await parseResumeFn({ text: mixedContent, images: [] });
      const result = response.data as ParsedResume;
      this._cache.set(cacheKey, result);
      console.log(`[ResumeParser] Cached parsed result (key: ${cacheKey}).`);
      return result;
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
      // Cache check
      const cacheKey = this._hashContent(content);
      if (this._cache.has(cacheKey)) {
        console.log(`[ResumeParser] ✅ Cache HIT for content (key: ${cacheKey}). Returning cached result.`);
        return this._cache.get(cacheKey)!;
      }

      const { httpsCallable } = await import('firebase/functions');
      const { getFirebaseFunctions } = await import('../firebase/config');
      const functions = await getFirebaseFunctions();

      const parseResumeFn = httpsCallable(functions, 'parseResume');
      const response = await parseResumeFn({ text: content, images: [] });
      const result = response.data as ParsedResume;
      this._cache.set(cacheKey, result);
      console.log(`[ResumeParser] Cached parsed result (key: ${cacheKey}).`);
      return result;
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
            const mammoth = await getMammoth();
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

      // Process images - skip in mixed mode (handled by vision-first if images only)
      let imageContent = "";
      if (imageUris.length > 0) {
        console.warn("[ResumeParser] Mixed image and text content detected. Images are ignored in mixed mode. For best results with images, upload them without documents.");
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
   * Clear the parsing cache (e.g., if user wants to force re-parse)
   */
  clearCache() {
    this._cache.clear();
    console.log('[ResumeParser] Cache cleared.');
  }
}

export const resumeParserService = new ResumeParserService();
