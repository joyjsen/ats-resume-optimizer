import Link from 'next/link';
import { APP_URLS } from '@/data/LandingData';
import styles from '../page.module.css';

export const metadata = {
  title: 'How to Write a Cover Letter That Gets Read | RiResume Blog',
  description: 'Learn how to write compelling cover letters that capture recruiter attention from the first line. Proven structure, tone, and content strategies for 2026.',
};

export default function WriteCoverLetter() {
  return (
    <main className={styles.article}>
      <Link href="/blog" className={styles.articleBackLink}>← Back to Blog</Link>
      <div className={styles.articleMeta}>
        <span className={styles.category}>Cover Letter</span>
        <span className={styles.readTime}>9 min read</span>
        <span className={styles.cardDate}>Updated Mar 20, 2026</span>
        <span className={styles.readTime}>By RiResume Team</span>
      </div>
      <h1 className={styles.articleTitle}>How to Write a Cover Letter That Gets Read</h1>
      <div className={styles.articleBody}>
        <p>In a competitive job market, your cover letter is often the difference between landing an interview and being overlooked. According to a <a href="https://www.shrm.org/topics-tools/news/talent-acquisition" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>SHRM survey</a>, 83% of HR professionals say cover letters are important when evaluating candidates, yet most job seekers either skip them or submit generic templates that fail to make an impact.</p>

        <h2>Why Cover Letters Still Matter in 2026</h2>
        <p>Despite debates about their relevance, cover letters serve a critical purpose: they give you space to tell the story your resume can&apos;t. While your resume lists what you&apos;ve done, your cover letter explains why you&apos;re the right person for <em>this specific role</em>. It&apos;s your opportunity to demonstrate cultural fit, explain career transitions, and highlight the most relevant achievements in context.</p>
        <p>Many ATS systems also parse cover letters for keywords, adding another layer of matching to your application. This means your cover letter should contain the same targeted keywords as your resume — naturally integrated into compelling prose. Learn more about keyword optimization in our <Link href="/blog/resume-ats-keywords" style={{ color: 'var(--primary)', fontWeight: 500 }}>ATS keywords guide</Link>.</p>

        <h2>The Proven Cover Letter Structure That Works</h2>
        <h3>Opening: Hook the Reader in 2 Sentences</h3>
        <p>Skip generic openings like &quot;I am writing to apply for...&quot; Instead, lead with a specific achievement or insight that relates directly to the role. For example: &quot;After leading a 34% increase in customer retention at [Company], I&apos;m excited to bring that same data-driven approach to the Customer Success Manager role at [Target Company].&quot; See our guide on <Link href="/blog/cover-letter-opening-lines" style={{ color: 'var(--primary)', fontWeight: 500 }}>opening lines that hook hiring managers</Link> for more examples.</p>
        <h3>Body: Connect Your Experience to Their Needs</h3>
        <p>The body should be 2-3 short paragraphs, each making a specific case for why you&apos;re qualified. Reference the job description directly — if they ask for &quot;cross-functional leadership,&quot; describe a time you led a cross-functional initiative. Quantify results wherever possible, just as you would on your resume.</p>
        <h3>Closing: Clear Call to Action</h3>
        <p>End with confidence and a specific next step: &quot;I&apos;d welcome the opportunity to discuss how my experience in [relevant area] can contribute to [Company]&apos;s goals. I&apos;m available for a conversation at your convenience.&quot; Avoid desperate or presumptuous closings.</p>

        <h2>Matching Your Cover Letter Tone to the Company Culture</h2>
        <p>Research the company&apos;s voice on their website, social media, and job postings. A startup using casual language on their careers page expects a different tone than a Fortune 500 company with formal communications. According to <a href="https://hbr.org/topic/subject/hiring-and-recruitment" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Harvard Business Review</a>, cultural fit is one of the top three factors in hiring decisions — and your cover letter is where you demonstrate it.</p>

        <h2>How to Customize Your Cover Letter Without Starting from Scratch</h2>
        <p>You don&apos;t need to write every cover letter from zero. Create a strong template with your core narrative, then customize three elements for each application: the opening hook (company-specific), the body paragraphs (role-specific achievements), and the closing (referencing specific company goals). See our full guide on <Link href="/blog/customizing-cover-letter" style={{ color: 'var(--primary)', fontWeight: 500 }}>customizing your cover letter for every application</Link>.</p>
        <p>AI tools can accelerate this process dramatically. RiResume&apos;s cover letter generator analyzes both your resume and the job description to create a tailored letter that highlights the right qualifications and matches the company&apos;s tone. Visit our <Link href="/optimize" style={{ color: 'var(--primary)', fontWeight: 500 }}>optimization guide</Link> for the complete workflow.</p>

        <h2>Cover Letter Length and Formatting Rules</h2>
        <p>Keep your cover letter to one page — ideally 300-400 words. Use the same font and header as your resume for a cohesive application package. Include proper salutation (research the hiring manager&apos;s name if possible), clear paragraph breaks, and a professional sign-off. See our breakdown of the <Link href="/blog/cover-letter-format" style={{ color: 'var(--primary)', fontWeight: 500 }}>perfect cover letter format</Link>.</p>

        <h2>Ready to Optimize Your Resume?</h2>
        <p>A great cover letter starts with a great resume. RiResume generates tailored cover letters based on your optimized resume and the job description — matching tone, highlighting relevant achievements, and integrating the right keywords automatically.</p>
        <div className={styles.articleCta}>
          <h3 className={styles.articleCtaTitle}>Try RiResume Free</h3>
          <p className={styles.articleCtaText}>Generate a tailored cover letter in under 60 seconds. 110 tokens included, no subscription required.</p>
          <a href={APP_URLS.getStarted} className={styles.articleCtaBtn}>Try RiResume Free →</a>
        </div>
      </div>
    </main>
  );
}
