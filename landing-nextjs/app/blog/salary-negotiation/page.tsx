import Link from 'next/link';
import { APP_URLS } from '@/data/LandingData';
import styles from '../page.module.css';

export const metadata = {
  title: "Salary Negotiation: How to Get What You're Worth | RiResume Blog",
  description: "Master salary negotiation with data-driven strategies. Learn when to negotiate, how to counter, and what to say to maximize your compensation package.",
};

export default function SalaryNegotiation() {
  return (
    <main className={styles.article}>
      <Link href="/blog" className={styles.articleBackLink}>← Back to Blog</Link>
      <div className={styles.articleMeta}>
        <span className={styles.category}>Interview</span>
        <span className={styles.readTime}>9 min read</span>
        <span className={styles.cardDate}>Updated Mar 20, 2026</span>
        <span className={styles.readTime}>By RiResume Team</span>
      </div>
      <h1 className={styles.articleTitle}>Salary Negotiation: How to Get What You&apos;re Worth</h1>
      <div className={styles.articleBody}>
        <p>Failing to negotiate your salary can cost you over $1 million in lifetime earnings, according to a widely cited study. Yet <a href="https://www.shrm.org/topics-tools/news/talent-acquisition" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>SHRM</a> reports that only 37% of workers always negotiate their salary when starting a new job. The good news: negotiation is a learnable skill, and employers expect it.</p>

        <h2>Why Employers Expect You to Negotiate</h2>
        <p>Most job offers include a built-in negotiation buffer of 10-20%. Companies budget for negotiation because they know that candidates who negotiate demonstrate confidence, market awareness, and self-advocacy — all desirable professional qualities. Not negotiating can actually leave a negative impression, as some hiring managers view it as a lack of market awareness.</p>

        <h2>Research: The Foundation of Every Successful Negotiation</h2>
        <h3>Know Your Market Value with Data</h3>
        <p>Before any negotiation, research the market rate for your role, location, and experience level. Use the <a href="https://www.bls.gov/oes/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)' }}>Bureau of Labor Statistics Occupational Employment Statistics</a>, Glassdoor salary data, Levels.fyi for tech roles, and LinkedIn Salary Insights. Compile data from at least three sources to establish a reliable range.</p>
        <h3>Factor in Total Compensation</h3>
        <p>Salary is only part of the picture. Consider equity/RSUs, signing bonus, annual bonus, PTO, remote work flexibility, professional development budget, health benefits, and retirement contributions. Sometimes a lower base salary with better equity or flexibility is worth more overall.</p>

        <h2>The Negotiation Framework: What to Say and When</h2>
        <h3>Timing: When to Bring Up Compensation</h3>
        <p>Never discuss salary before receiving an offer. If asked about expectations early in the process, deflect: &quot;I&apos;d like to learn more about the role before discussing compensation. I&apos;m confident we can find a number that works for both of us.&quot; Once you have an offer, you have maximum leverage.</p>
        <h3>The Counter: How to Ask for More</h3>
        <p>Express gratitude first, then make your case with data: &quot;Thank you for this offer — I&apos;m excited about the role. Based on my research showing that senior product managers with my experience in [city] typically earn $X-$Y, and considering [specific value you bring], I was hoping we could discuss a base salary of $Z.&quot;</p>
        <h3>Handling Pushback</h3>
        <p>If they say the salary is non-negotiable, negotiate other components: signing bonus, equity, early review for raise, PTO, or professional development budget. Always have a prioritized list of asks. Never issue ultimatums or express frustration — keep the tone collaborative and professional.</p>

        <h2>Negotiation Mistakes That Cost You Money</h2>
        <p>The biggest mistakes include: accepting the first offer without countering, negotiating without market data, giving a specific number instead of a range, focusing only on base salary, and not getting the final agreement in writing. Also avoid sharing your current salary — in many states, employers aren&apos;t legally allowed to ask.</p>
        <p>Your negotiation power starts with your application. A perfectly optimized resume that clearly demonstrates your value makes the case for higher compensation before you even walk into the interview. Learn how to build that foundation in our <Link href="/optimize" style={{ color: 'var(--primary)', fontWeight: 500 }}>AI resume optimization guide</Link>.</p>

        <h2>Negotiating Remote Work, Flexibility, and Non-Salary Benefits</h2>
        <p>In 2026, compensation extends far beyond base salary. Remote work flexibility, compressed work weeks, unlimited PTO, equity grants, professional development budgets, and home office stipends are all negotiable elements. If the company can&apos;t budge on salary, these benefits can add significant value to your total package. Prioritize the benefits that matter most to your lifestyle and career goals.</p>
        <p>When negotiating non-salary benefits, be specific: &quot;Would it be possible to include a $3,000 annual professional development budget?&quot; is more effective than &quot;Can we improve the benefits?&quot; Many hiring managers have more flexibility with non-salary benefits because these don&apos;t require the same budget approvals as base compensation increases.</p>

        <h2>Negotiating When Changing Careers</h2>
        <p>Career changers face unique negotiation challenges because their previous salary may not reflect their new market value. Focus on transferable skills and the specific value you bring from a different industry. Our guide on <Link href="/blog/career-transition-guide" style={{ color: 'var(--primary)', fontWeight: 500 }}>career transitions</Link> covers this positioning in detail.</p>

        <h2>Ready to Optimize Your Resume?</h2>
        <p>A great negotiation starts with a great resume that clearly demonstrates your value. RiResume optimizes your resume to highlight quantified achievements and position you as a top-tier candidate — setting the stage for stronger salary negotiations.</p>
        <div className={styles.articleCta}>
          <h3 className={styles.articleCtaTitle}>Try RiResume Free</h3>
          <p className={styles.articleCtaText}>Build a resume that justifies the salary you deserve. 110 tokens included, no subscription.</p>
          <a href={APP_URLS.getStarted} className={styles.articleCtaBtn}>Try RiResume Free →</a>
        </div>
      </div>
    </main>
  );
}
