import { TESTIMONIALS, INLINE_COPY, APP_URLS } from '@/data/LandingData';
import styles from './Testimonials.module.css';

function StarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#f59e0b" stroke="none">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

export default function Testimonials() {
  return (
    <section id="testimonials" className={styles.section}>
      <h2 className="sectionTitle">{INLINE_COPY.sections.testimonials.title}</h2>
      <p className="sectionSubtitle">{INLINE_COPY.sections.testimonials.subtitle}</p>
      <div className={styles.grid}>
        {TESTIMONIALS.map((t, i) => (
          <div key={i} className={styles.card}>
            <div className={styles.stars}>
              {[...Array(5)].map((_, j) => (
                <StarIcon key={j} />
              ))}
            </div>
            <p className={styles.content}>&ldquo;{t.content}&rdquo;</p>
            <div className={styles.author}>
              <div className={styles.avatar}>{t.avatar}</div>
              <div>
                <p className={styles.name}>{t.name}</p>
                <p className={styles.role}>{t.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <a href={APP_URLS.getStarted} className={styles.viewAllBtn}>
        {INLINE_COPY.cta.viewAllReviews}
      </a>
    </section>
  );
}
