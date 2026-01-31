import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FS from 'expo-file-system/legacy';
const FileSystem = FS as any;

interface PrepGuideSections {
  companyIntelligence: string;
  roleAnalysis: string;
  technicalPrep: string;
  behavioralFramework: string;
  storyMapping: string;
  questionsToAsk: string;
  interviewStrategy: string;
}

interface PrepGuideMetadata {
  companyName: string;
  jobTitle: string;
}

class PrepGuidePdfGenerator {

  async generateAndShare(sections: PrepGuideSections, metadata: PrepGuideMetadata): Promise<string> {
    try {
      const htmlContent = this.createHtmlContent(sections, metadata);

      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false
      });

      // Move to a more permanent location with readable name
      const fileName = `${metadata.companyName.replace(/\s+/g, '_')}_${metadata.jobTitle.replace(/\s+/g, '_')}_PrepGuide.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;

      // Ensure documentDirectory exists (it should, but just in case)
      const dirInfo = await FileSystem.getInfoAsync(FileSystem.documentDirectory || '');
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(FileSystem.documentDirectory || '', { intermediates: true });
      }

      // Use copyAsync which is more reliable on iOS, then delete original
      try {
        await FileSystem.copyAsync({
          from: uri,
          to: fileUri
        });
        // Delete the original temp file
        await FileSystem.deleteAsync(uri, { idempotent: true });
      } catch (moveError) {
        console.warn('Copy failed, using original URI:', moveError);
        // If copy fails, just use the original URI
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri);
        }
        return uri;
      }

      // Share immediately
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri);
      }

      return fileUri;

    } catch (error) {
      console.error('Error generating PDF:', error);
      throw error;
    }
  }

  private createHtmlContent(sections: PrepGuideSections, metadata: PrepGuideMetadata): string {
    return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          @page {
            margin: 40px;
          }
          body {
            font-family: 'Helvetica', 'Arial', sans-serif;
            font-size: 11pt;
            color: #374151;
            line-height: 1.6;
          }
          h1 {
            font-size: 24pt;
            color: #1a1a1a;
            margin-bottom: 10px;
          }
          h2 {
            font-size: 18pt;
            color: #2563eb;
            margin-top: 24px;
            margin-bottom: 12px;
            border-bottom: 2px solid #2563eb;
            padding-bottom: 4px;
            page-break-after: avoid;
          }
          h3 {
            font-size: 14pt;
            color: #4b5563;
            margin-top: 16px;
            margin-bottom: 8px;
            page-break-after: avoid;
          }
          p {
            margin-bottom: 12px;
          }
          ul, ol {
            margin-bottom: 12px;
            padding-left: 20px;
          }
          li {
            margin-bottom: 6px;
          }
          .cover-page {
            text-align: center;
            padding-top: 100px;
            page-break-after: always;
          }
          .subtitle {
            font-size: 14pt;
            color: #64748b;
            margin-top: 10px;
          }
          .date {
            font-size: 10pt;
            color: #6b7280;
            margin-top: 20px;
          }
          .section {
            page-break-before: always;
          }
          .highlight-box {
            background-color: #f0f9ff;
            border-left: 4px solid #2563eb;
            padding: 12px;
            margin: 12px 0;
            page-break-inside: avoid;
          }
          .star-framework {
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            padding: 16px;
            margin: 12px 0;
            border-radius: 4px;
            page-break-inside: avoid;
          }
          .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 9pt;
            color: #9ca3af;
            padding: 10px;
          }
          .toc-item {
            margin-bottom: 8px;
          }
        </style>
      </head>
      <body>
        <!-- Cover Page -->
        <div class="cover-page">
          <h1>Interview Preparation Guide</h1>
          <div class="subtitle">${metadata.companyName} - ${metadata.jobTitle}</div>
          <div class="date">Generated: ${new Date().toLocaleDateString()}</div>
        </div>

        <!-- Table of Contents -->
        <div class="section">
          <h1>Table of Contents</h1>
          <ol>
            <li class="toc-item">Company Intelligence</li>
            <li class="toc-item">Role Deep Dive</li>
            <li class="toc-item">Technical Preparation</li>
            <li class="toc-item">Behavioral Framework</li>
            <li class="toc-item">Your Story Mapping</li>
            <li class="toc-item">Questions to Ask</li>
            <li class="toc-item">Interview Day Strategy</li>
          </ol>
          <p style="margin-top: 24px; font-style: italic;">
            Total: 12-18 pages, professional format
          </p>
        </div>

        <!-- Section 1: Company Intelligence -->
        <div class="section">
          <h2>Section 1: Company Intelligence 🏢</h2>
          <p style="font-style: italic; color: #6b7280;">
            Generated using Perplexity AI with current web research
          </p>
          ${this.formatAIContent(sections.companyIntelligence)}
        </div>

        <!-- Section 2: Role Deep Dive -->
        <div class="section">
          <h2>Section 2: Role Deep Dive 🎯</h2>
          ${this.formatAIContent(sections.roleAnalysis)}
        </div>

        <!-- Section 3: Technical Preparation -->
        <div class="section">
          <h2>Section 3: Technical Preparation 💻</h2>
          ${this.formatAIContent(sections.technicalPrep)}
        </div>

        <!-- Section 4: Behavioral Framework -->
        <div class="section">
          <h2>Section 4: Behavioral Framework 🗣️</h2>
          ${this.formatAIContent(sections.behavioralFramework)}
        </div>

        <!-- Section 5: Your Story Mapping -->
        <div class="section">
          <h2>Section 5: Your Story Mapping 🎯</h2>
          <div class="highlight-box">
            <strong>This is the most valuable section</strong> - your actual resume experiences mapped to likely interview questions with STAR framework outlines.
          </div>
          ${this.formatAIContent(sections.storyMapping)}
        </div>

        <!-- Section 6: Questions to Ask -->
        <div class="section">
          <h2>Section 6: Questions to Ask ❓</h2>
          ${this.formatAIContent(sections.questionsToAsk)}
        </div>

        <!-- Section 7: Interview Day Strategy -->
        <div class="section">
          <h2>Section 7: Interview Day Strategy 📅</h2>
          ${this.formatAIContent(sections.interviewStrategy)}
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>This guide was AI-generated using Perplexity AI (company research) and GPT-4o-mini (content generation).</p>
          <p>Use as a preparation aid based on your resume and job description.</p>
        </div>
      </body>
    </html>
        `;
  }

  private formatAIContent(content: string): string {
    if (!content) return '';

    let formatted = content
      // Fix header hierarchy - map down one level to fit section structure
      .replace(/^# (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')

      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')

      // List items - simple regex replacement
      .replace(/^[-•] (.+)$/gm, '<li>$1</li>')

      // Wrap loose list items in ul (simplified approach, better to use proper parser but regex works for generated content structure)
      .replace(/(<li>.*?<\/li>\n?)+/gs, '<ul>$&</ul>')

      // Paragraphs - double newlines become new paragraphs
      .replace(/\n\n/g, '</p><p>')

      // Wrap anything that looks like a plain text line in p tags if not already tagged
      .replace(/^(?!<[h|ul|ol|li|div|p])(.+)$/gm, '<p>$1</p>');

    return formatted;
  }
}

export const prepGuidePdfGenerator = new PrepGuidePdfGenerator();
