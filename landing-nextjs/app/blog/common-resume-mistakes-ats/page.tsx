import Link from 'next/link';
import { APP_URLS } from '@/data/LandingData';
import styles from '../page.module.css';

export const metadata = {
  title: 'Common Resume Mistakes That Kill Your ATS Score | RiResume Blog',
  description: 'Avoid these critical resume mistakes that cause ATS rejection. Learn the formatting errors, keyword gaps, and content issues that prevent your resume from getting noticed.',
};

export default function CommonMistakes() {
  return (
    <main className={styles.article}>
      <Link href="/blog" className={styles.articleBackLink}>← Back to Blog</Link>
      <div className={styles.articleMeta}>
        <span className={styles.category}>Resume Resources</span>
        <span className={styles.readTime}>9 min read</span>
        <span className={styles.cardDate}>Updated Mar 20, 2026</span>
        <span className={styles.readTime}>By RiResume Team</span>
      </div>
      <h1 className={styles.articleTitle}>Common Resume Mistakes That Kill Your ATS Score</h1>
      <div className={styles.articleBody}>
        <p>Up to 75% of resumes are rejected by ATS systems before a human recruiter ever sees them. In many cases, the rejections aren&apos;t because of lack of qualifications — they&apos;re caused by avoidable mistakes that confuse ATS parsers or fail to demonstrate keyword alignment. The <a href="https://www.shrm.org/topics-tools/news/talent-acquisition" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Society for Human Resource Management</a> reports that the average recruiter reviews over 40 resumes per open position, making ATS screening the critical first gate.</p>

        <h2>Formatting Mistakes That Break ATS Parsers</h2>
        <h3>Using Tables, Text Boxes, and Multi-Column Layouts</h3>
        <p>This is the #1 ATS-killing mistake. Tables — even invisible ones used for alignment — cause most ATS platforms to scramble your content or ignore entire sections. Text boxes create floating content that parsers can&apos;t sequence. Multi-column layouts confuse the reading order, mixing unrelated content together. Always use a simple, single-column format.</p>
        <h3>Placing Critical Information in Headers and Footers</h3>
        <p>Many candidates place their name, contact information, or links in the document header or footer. Unfortunately, most ATS platforms cannot read header/footer content. Your name and contact details should be in the main body of the document, typically at the very top.</p>
        <h3>Using Images, Graphics, and Infographics</h3>
        <p>Skill bar charts, headshot photos, icons, and infographics look great in PDFs but are invisible to ATS parsers. If your skills are communicated only through a visual bar chart, the ATS sees nothing. Always use text-based representations for all information. For complete formatting guidance, see our <Link href="/blog/resume-formatting-best-practices" style={{ color: 'var(--primary)', fontWeight: 500 }}>resume formatting best practices</Link>.</p>

        <h2>Keyword Mistakes That Lower Your ATS Match Score</h2>
        <h3>Sending the Same Generic Resume to Every Job</h3>
        <p>This is the most expensive mistake job seekers make. A generic resume might match 30-40% of any given job description&apos;s keywords, while a tailored version can hit 80-90%. Every job has unique requirements and terminology — learn how to customize efficiently in our guide on <Link href="/blog/how-to-tailor-resume-for-every-job" style={{ color: 'var(--primary)', fontWeight: 500 }}>tailoring your resume for every application</Link>.</p>
        <h3>Keyword Stuffing and Invisible Text</h3>
        <p>Some candidates add white text filled with keywords, thinking it will boost their ATS score without affecting readability. Modern ATS platforms detect and penalize this practice. Similarly, repeating the same keyword 10+ times raises spam flags. Natural integration is always more effective — see our deep dive on <Link href="/blog/resume-ats-keywords" style={{ color: 'var(--primary)', fontWeight: 500 }}>ATS keywords strategy</Link>.</p>
        <h3>Using Only Acronyms or Only Full Terms</h3>
        <p>If you write &quot;SEO&quot; but the ATS searches for &quot;Search Engine Optimization,&quot; you&apos;ll miss the match. Always include both forms at first mention: &quot;Search Engine Optimization (SEO).&quot; This simple practice can boost keyword match rates by 15-25%.</p>

        <h2>Content Mistakes That Hurt Both ATS and Human Review</h2>
        <h3>Vague, Unquantified Achievement Descriptions</h3>
        <p>&quot;Managed a team&quot; tells a recruiter almost nothing. &quot;Led a cross-functional team of 12, delivering a $3.2M product launch 2 weeks ahead of schedule&quot; tells them everything. According to <a href="https://hbr.org/topic/subject/hiring-and-recruitment" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Harvard Business Review</a>, quantified bullets are 40% more likely to result in callbacks. Learn how in our guide to <Link href="/blog/resume-quantify-achievements" style={{ color: 'var(--primary)', fontWeight: 500 }}>quantifying achievements</Link>.</p>
        <h3>Missing or Weak Professional Summary</h3>
        <p>Your professional summary is prime real estate — the first text both ATS and recruiters read. A missing or generic summary wastes this opportunity. Write 3-4 sentences that include your most relevant keywords, years of experience, and biggest achievements.</p>
        <h3>Irrelevant Information and Excessive Length</h3>
        <p>Including every job since high school, listing hobbies unrelated to the role, or writing five pages when two would suffice all hurt your ATS score by diluting keyword density. Focus on the last 10-15 years of relevant experience.</p>

        <h2>How to Catch These Mistakes Before Applying</h2>
        <p>The best defense against these mistakes is proactive testing. Run your resume through an AI analyzer like RiResume before every submission. It identifies formatting issues, keyword gaps, and content weaknesses in under 60 seconds. Visit our <Link href="/optimize" style={{ color: 'var(--primary)', fontWeight: 500 }}>complete optimization guide</Link> for the full process.</p>

        <h2>Ready to Optimize Your Resume?</h2>
        <p>Stop making mistakes that silently kill your job applications. RiResume&apos;s AI catches formatting errors, keyword gaps, and content issues — then fixes them automatically with one click.</p>
        <div className={styles.articleCta}>
          <h3 className={styles.articleCtaTitle}>Try RiResume Free</h3>
          <p className={styles.articleCtaText}>110 tokens included on signup. Get a complete audit of your resume&apos;s ATS compatibility.</p>
          <a href={APP_URLS.getStarted} className={styles.articleCtaBtn}>Try RiResume Free →</a>
        </div>
      </div>
    </main>
  );
}
