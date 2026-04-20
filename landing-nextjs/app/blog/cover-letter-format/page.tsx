import Link from 'next/link';
import { APP_URLS } from '@/data/LandingData';
import styles from '../page.module.css';

export const metadata = {
  title: 'Cover Letter Structure: The Perfect Format | RiResume Blog',
  description: 'Master the ideal cover letter format with proven structure, spacing, and visual hierarchy that impresses recruiters and passes ATS screening.',
};

export default function CoverLetterFormat() {
  return (
    <main className={styles.article}>
      <Link href="/blog" className={styles.articleBackLink}>← Back to Blog</Link>
      <div className={styles.articleMeta}>
        <span className={styles.category}>Cover Letter</span>
        <span className={styles.readTime}>8 min read</span>
        <span className={styles.cardDate}>Updated Mar 20, 2026</span>
        <span className={styles.readTime}>By RiResume Team</span>
      </div>
      <h1 className={styles.articleTitle}>Cover Letter Structure: The Perfect Format</h1>
      <div className={styles.articleBody}>
        <p>The difference between a cover letter that gets read and one that gets skipped often comes down to format. Recruiters spend an average of 30 seconds scanning a cover letter, according to <a href="https://www.shrm.org/topics-tools/news/talent-acquisition" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>SHRM research</a>. A well-structured letter makes the most of those seconds by guiding the reader&apos;s eye to your strongest qualifications.</p>

        <h2>The Anatomy of a High-Impact Cover Letter</h2>
        <h3>Header: Matching Your Resume for Brand Consistency</h3>
        <p>Use the same header as your resume — name, contact information, and styling. This creates a cohesive application package that looks professional and intentional. Include your LinkedIn URL if it&apos;s well-optimized (see our guide on <Link href="/blog/building-personal-brand-linkedin" style={{ color: 'var(--primary)', fontWeight: 500 }}>building your LinkedIn brand</Link>).</p>
        <h3>Salutation: Find the Right Name</h3>
        <p>Always address a specific person whenever possible. Search LinkedIn, the company website, or even call the front desk. &quot;Dear [Name]&quot; is always better than &quot;Dear Hiring Manager&quot; — it shows initiative and research. If you truly can&apos;t find a name, &quot;Dear Hiring Team&quot; is more personal than &quot;To Whom It May Concern.&quot;</p>
        <h3>Opening Paragraph: The 2-Sentence Hook</h3>
        <p>Your opening must immediately establish relevance. Lead with a specific accomplishment that connects to the role, or reference something noteworthy about the company that genuinely excites you. Avoid generic phrases like &quot;I am writing to express my interest.&quot; For proven opening strategies, see our guide on <Link href="/blog/cover-letter-opening-lines" style={{ color: 'var(--primary)', fontWeight: 500 }}>opening lines that hook hiring managers</Link>.</p>
        <h3>Body Paragraphs: Evidence-Based Value Propositions</h3>
        <p>Write 2-3 short paragraphs, each focused on a single, specific way your experience addresses the employer&apos;s needs. Use the job description as your roadmap — if they prioritize &quot;data-driven decision making,&quot; dedicate a paragraph to your analytics experience with quantified results. Reference the same keywords the ATS is scanning for.</p>
        <h3>Closing: Confidence Without Arrogance</h3>
        <p>Express genuine enthusiasm, restate your unique value, and include a clear call to action. &quot;I&apos;m eager to discuss how my experience in scaling B2B sales teams can contribute to [Company]&apos;s growth targets. I&apos;m happy to connect at your convenience.&quot;</p>

        <h2>Formatting Rules for Maximum Readability</h2>
        <p>Keep your letter to one page, ideally 300-400 words. Use 10-12pt professional fonts (matching your resume). Set 1-inch margins on all sides. Single-space within paragraphs, double-space between them. Left-align all text — never center or justify body text in a cover letter.</p>
        <p>According to <a href="https://hbr.org/topic/subject/hiring-and-recruitment" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Harvard Business Review</a>, concise, well-structured communications are associated with higher perceived competence. The same principle applies to your cover letter — every sentence should earn its place.</p>

        <h2>File Format and Submission Best Practices</h2>
        <p>Submit your cover letter as a PDF unless the application specifically requests .docx. PDFs preserve formatting across all devices. Name the file &quot;FirstName_LastName_Cover_Letter.pdf&quot; for easy identification. If the ATS has a separate cover letter upload field, use it rather than combining your resume and letter into one document.</p>
        <p>Note that some ATS platforms also parse cover letters for keywords, just like resumes. This means your cover letter should naturally include key terms from the job description. Learn more about this in our <Link href="/optimize" style={{ color: 'var(--primary)', fontWeight: 500 }}>AI optimization guide</Link>.</p>

        <h2>Common Cover Letter Formatting Mistakes to Avoid</h2>
        <p>The most damaging formatting mistakes include: exceeding one page (signals inability to communicate concisely), using a different font or style than your resume (breaks brand consistency), center-aligning text (makes body text harder to read), including a photo (unprofessional in most Western markets and can trigger bias), and forgetting to proofread for formatting inconsistencies like misaligned dates or mixed bullet styles.</p>
        <p>Another subtle mistake is using overly complex formatting. While a beautifully designed cover letter might impress in creative industries, most recruiters prefer clean, readable letters that respect their time. Let your content do the impressing — not your layout.</p>

        <h2>Adapting Your Cover Letter Format for Different Industries</h2>
        <p>Creative industries (design, marketing, ad agencies) may welcome more visual formatting — colored headers, custom typography, or even a portfolio link. Corporate and regulated industries (finance, healthcare, legal) expect strictly traditional formatting. Tech companies generally fall in between, valuing clarity and substance over formality.</p>

        <h2>Ready to Optimize Your Resume?</h2>
        <p>The best cover letter starts with a perfectly optimized resume. RiResume generates tailored cover letters that match the job description, echo the company&apos;s tone, and complement your resume — all in under 60 seconds.</p>
        <div className={styles.articleCta}>
          <h3 className={styles.articleCtaTitle}>Try RiResume Free</h3>
          <p className={styles.articleCtaText}>110 tokens included on signup. Generate AI-powered cover letters tailored to each job.</p>
          <a href={APP_URLS.getStarted} className={styles.articleCtaBtn}>Try RiResume Free →</a>
        </div>
      </div>
    </main>
  );
}
