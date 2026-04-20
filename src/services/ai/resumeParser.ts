import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
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
// pdf-parse is removed as it breaks the React Native bundler.
// const pdf = require('pdf-parse');

export interface FileItem {
  uri: string;
  name?: string;
  mimeType?: string;
}

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
  async parseResume(files: (string | FileItem)[]): Promise<ParsedResume> {
    try {
      const { httpsCallable } = await import('firebase/functions');
      const { getFirebaseFunctions } = await import('../firebase/config');
      const functions = await getFirebaseFunctions();
      const parseResumeFn = httpsCallable(functions, 'parseResume');

      const normalizedFiles: FileItem[] = files.map(f => typeof f === 'string' ? { uri: f, name: f } : f);

      const isImage = (f: FileItem) => {
        if (f.mimeType && f.mimeType.startsWith('image/')) return true;
        const name = f.name || f.uri;
        return !!name.match(/\.(jpg|jpeg|png)$/i) || f.uri.startsWith('data:image');
      };

      // OPTIMIZATION: Check if we can use Vision-First multimodal parsing (faster for images)
      const imageFiles = normalizedFiles.filter(isImage);
      const otherFiles = normalizedFiles.filter(f => !isImage(f));

      if (imageFiles.length > 0 && otherFiles.length === 0) {
        console.log(`[ResumeParser] Using Vision-First multimodal parsing for ${imageFiles.length} images.`);
        const base64Images = await Promise.all(
          imageFiles.map(async f => {
            if (Platform.OS === 'web') {
              const res = await fetch(f.uri);
              const blob = await res.blob();
              return new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                  resolve((reader.result as string).split(',')[1]);
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
            } else {
              return FileSystem.readAsStringAsync(f.uri, { encoding: 'base64' });
            }
          })
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
      const mixedContent = await this.extractContentFromFiles(normalizedFiles);

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
  async extractContentFromFiles(files: (string | FileItem)[]): Promise<string> {
    try {
      const normalizedFiles: FileItem[] = files.map(f => typeof f === 'string' ? { uri: f, name: f } : f);

      const isImage = (f: FileItem) => {
        if (f.mimeType && f.mimeType.startsWith('image/')) return true;
        const name = f.name || f.uri;
        return !!name.match(/\.(jpg|jpeg|png)$/i) || f.uri.startsWith('data:image');
      };

      // Separate images from other file types for batch processing
      const imageFiles = normalizedFiles.filter(isImage);
      const otherFiles = normalizedFiles.filter(f => !isImage(f) && f.uri && f.uri.trim() !== '');

      // Process non-image files
      const otherContents = await Promise.all(otherFiles.map(async (f) => {
        const name = f.name || f.uri;
        const mimeType = f.mimeType || '';

        if (mimeType === 'text/plain' || mimeType === 'text/markdown' || mimeType === 'application/json' || name.match(/\.(txt|md|json)$/i)) {
          if (Platform.OS === 'web') {
            const res = await fetch(f.uri);
            return await res.text();
          } else {
            return await FileSystem.readAsStringAsync(f.uri);
          }
        }

        if (mimeType.includes('wordprocessingml') || mimeType === 'application/msword' || name.match(/\.docx?$/i)) {
          try {
            let data: ArrayBuffer | any;
            if (Platform.OS === 'web') {
              const res = await fetch(f.uri);
              data = await res.arrayBuffer();
            } else {
              const base64 = await FileSystem.readAsStringAsync(f.uri, { encoding: 'base64' });
              const bufModule = require('buffer');
              data = bufModule.Buffer.from(base64, 'base64');
            }
            const mammoth = await getMammoth();
            const result = await mammoth.extractRawText({ arrayBuffer: data });
            return result.value || "";

          } catch (docxError: any) {
            console.error("DOCX Parse Error", docxError);
            return `[WARNING: DOCX Parsing failed (${docxError.message}).]`;
          }
        }

        // Case 4: PDF (Not supported)
        if (mimeType === 'application/pdf' || name.match(/\.pdf$/i)) {
          return `[WARNING: PDF files are not supported. Please use DOCX or Text.]`;
        }

        return `[WARNING: Unsupported file type ${name.split('/').pop()}]`;
      }));

      // Process images - skip in mixed mode (handled by vision-first if images only)
      let imageContent = "";
      if (imageFiles.length > 0) {
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
