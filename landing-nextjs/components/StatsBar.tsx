import { STATS } from '@/data/LandingData';
import styles from './StatsBar.module.css';

export default function StatsBar() {
  return (
    <section className={styles.statsBar}>
      {STATS.map((stat, i) => (
        <div key={i} className={styles.statItem}>
          <span className={styles.statValue}>{stat.value}</span>
          <span className={styles.statLabel}>{stat.label}</span>
        </div>
      ))}
    </section>
  );
}
