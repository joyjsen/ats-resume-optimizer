import { Link2, Brain, Download } from 'lucide-react';
import { STEPS, INLINE_COPY } from '@/data/LandingData';
import styles from './HowItWorks.module.css';

const stepIconMap: Record<string, React.ReactNode> = {
  'link-variant': <Link2 size={28} />,
  'brain': <Brain size={28} />,
  'download': <Download size={28} />,
};

export default function HowItWorks() {
  return (
    <section id="how-it-works" className={styles.section}>
      <h2 className="sectionTitle">{INLINE_COPY.sections.howItWorks.title}</h2>
      <p className="sectionSubtitle">{INLINE_COPY.sections.howItWorks.subtitle}</p>
      <div className={styles.stepsRow}>
        {STEPS.map((step, i) => (
          <div key={i}>
            <div className={styles.stepCard}>
              <span className={styles.stepNumber}>{step.number}</span>
              <div className={styles.iconWrap}>
                {stepIconMap[step.icon] || null}
              </div>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepDesc}>{step.description}</p>
            </div>
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <a
          href="#pricing-section"
          style={{
            display: 'inline-block',
            padding: '14px 36px',
            backgroundColor: 'var(--primary)',
            color: 'var(--white)',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 16,
            transition: 'background-color 0.2s',
          }}
        >
          View Pricing &amp; Get Started →
        </a>
      </div>
    </section>
  );
}
