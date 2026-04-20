import {
  FileSearch, Wand2, Puzzle, MailOpen, BookOpen, GraduationCap,
} from 'lucide-react';
import { FEATURES, INLINE_COPY } from '@/data/LandingData';
import styles from './FeaturesGrid.module.css';

const featureIconMap: Record<string, React.ReactNode> = {
  'file-search-outline': <FileSearch size={28} />,
  'auto-fix': <Wand2 size={28} />,
  'puzzle-plus-outline': <Puzzle size={28} />,
  'email-edit-outline': <MailOpen size={28} />,
  'book-open-page-variant-outline': <BookOpen size={28} />,
  'school-outline': <GraduationCap size={28} />,
};

export default function FeaturesGrid() {
  return (
    <section id="features" className={styles.section}>
      <h2 className="sectionTitle">{INLINE_COPY.sections.features.title}</h2>
      <p className="sectionSubtitle">{INLINE_COPY.sections.features.subtitle}</p>
      <div className={styles.grid}>
        {FEATURES.map((f, i) => (
          <div key={i} className={styles.card}>
            <div
              className={styles.iconWrap}
              style={{ backgroundColor: `${f.accentColor}15`, color: f.accentColor }}
            >
              {featureIconMap[f.icon] || null}
            </div>
            <h3 className={styles.cardTitle}>{f.title}</h3>
            <p className={styles.cardDesc}>{f.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
