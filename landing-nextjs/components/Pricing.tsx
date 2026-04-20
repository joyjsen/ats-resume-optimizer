import { PRICING_TIERS, TOKEN_COSTS, INLINE_COPY, APP_URLS } from '@/data/LandingData';
import styles from './Pricing.module.css';

export default function Pricing() {
  return (
    <section id="pricing-section" className={styles.section}>
      <h2 className="sectionTitle">{INLINE_COPY.sections.pricing.title}</h2>
      <p className="sectionSubtitle">{INLINE_COPY.sections.pricing.subtitle}</p>
      <div className={styles.pricingRow}>
        {PRICING_TIERS.map((tier) => (
          <div
            key={tier.id}
            className={`${styles.card} ${tier.highlighted ? styles.cardHighlight : ''}`}
          >
            {tier.badge && <span className={styles.badge}>{tier.badge}</span>}
            <h3 className={styles.name}>{tier.name}</h3>
            <span className={styles.tokens}>{tier.tokens}</span>
            <span className={styles.tokensLabel}>tokens</span>
            <span className={styles.price}>${tier.price}</span>
            <p className={styles.desc}>{tier.description}</p>
            {tier.bonusPercent && (
              <span className={styles.bonus}>+{tier.bonusPercent}% bonus tokens</span>
            )}
            <a
              href={APP_URLS.getStarted}
              className={`${styles.btn} ${tier.highlighted ? styles.btnPrimary : styles.btnOutline}`}
            >
              Get Started
            </a>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
        {INLINE_COPY.sections.pricing.tokenCostsLabel}
      </p>
      <div className={styles.tokenCostsRow}>
        {TOKEN_COSTS.map((tc, i) => (
          <div key={i} className={styles.tokenCostChip}>
            <span className={styles.tokenCostLabel}>{tc.action}</span>
            <span className={styles.tokenCostValue}>{tc.cost} tokens</span>
          </div>
        ))}
      </div>
    </section>
  );
}
