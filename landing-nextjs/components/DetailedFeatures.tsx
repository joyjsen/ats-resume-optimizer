'use client';

import { useState, FormEvent } from 'react';
import {
  FileSearch, Wand2, Puzzle, FilePlus, MailOpen, Lightbulb, GraduationCap,
  CheckCircle, Zap, Download, Filter, Bot, Brain, PenLine, BadgeCheck,
  ListChecks, MessageSquareQuote, UserCheck, Target, Star, SlidersHorizontal,
  TrendingUp, Search, AlertCircle, Rocket,
} from 'lucide-react';
import { DETAILED_FEATURES, VALUE_PROPS, INLINE_COPY, APP_URLS } from '@/data/LandingData';
import styles from './DetailedFeatures.module.css';

/* ============================================================
   Icon mappings
   ============================================================ */
const detailIconMap: Record<string, React.ReactNode> = {
  'file-search-outline': <FileSearch size={28} />,
  'auto-fix': <Wand2 size={28} />,
  'puzzle-plus-outline': <Puzzle size={28} />,
  'file-plus-outline': <FilePlus size={28} />,
  'email-edit-outline': <MailOpen size={28} />,
  'lightbulb-on-outline': <Lightbulb size={28} />,
  'school-outline': <GraduationCap size={28} />,
};

const valueIconMap: Record<string, React.ReactNode> = {
  'lightning-bolt': <Zap size={22} />,
  'download': <Download size={22} />,
  'filter-variant': <Filter size={22} />,
  'robot': <Bot size={22} />,
  'brain': <Brain size={22} />,
  'pencil-box-multiple-outline': <PenLine size={22} />,
  'check-decagram': <BadgeCheck size={22} />,
  'format-list-bulleted-type': <ListChecks size={22} />,
  'auto-fix': <Wand2 size={22} />,
  'comment-quote-outline': <MessageSquareQuote size={22} />,
  'account-check': <UserCheck size={22} />,
  'bullseye-arrow': <Target size={22} />,
  'star-shooting-outline': <Star size={22} />,
  'tune-vertical': <SlidersHorizontal size={22} />,
  'trending-up': <TrendingUp size={22} />,
  'magnify-expand': <Search size={22} />,
  'alert-decagram': <AlertCircle size={22} />,
  'rocket-launch': <Rocket size={22} />,
};

/* ============================================================
   ValueProps Interleaved (3 cards at a time)
   ============================================================ */
function ValuePropInterleaved({ items }: { items: typeof VALUE_PROPS }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.valueSection}>
      <div className={styles.valueGrid}>
        {items.map((vp, i) => (
          <div key={i} className={styles.valueCard}>
            <div className={styles.valueIconWrap}>
              {valueIconMap[vp.icon] || <Zap size={22} />}
            </div>
            <h4 className={styles.valueTitle}>{vp.title}</h4>
            <p className={styles.valueDesc}>{vp.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ============================================================
   Single Detailed Feature Section
   ============================================================ */
function DetailedFeatureSection({
  feature,
  index,
}: {
  feature: typeof DETAILED_FEATURES[number];
  index: number;
}) {
  const [jobUrl, setJobUrl] = useState('');
  const isReversed = index % 2 === 1;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (jobUrl.trim()) {
      window.location.href = APP_URLS.withJobUrl(jobUrl.trim());
    } else {
      window.location.href = APP_URLS.getStarted;
    }
  };

  return (
    <section
      id={feature.id}
      className={`${styles.featureSection} ${index % 2 === 0 ? '' : styles.featureSectionAlt}`}
    >
      <div className={`${styles.featureInner} ${isReversed ? styles.featureInnerReverse : ''}`}>
        <div className={styles.featureContent}>
          <h2 className={styles.featureTitle}>{feature.title}</h2>
          <p className={styles.featureSubtitle} style={{ color: feature.accentColor }}>
            {feature.subtitle}
          </p>
          <p className={styles.featureDesc}>{feature.description}</p>
          <ul className={styles.benefitList}>
            {feature.benefits.map((b, i) => (
              <li key={i} className={styles.benefitItem}>
                <CheckCircle size={20} color={feature.accentColor} />
                <span className={styles.benefitText}>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.featureVisual}>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>
            {INLINE_COPY.detailedFeature.tryItLabel}
          </p>
          <form onSubmit={handleSubmit} className={styles.inputContainer}>
            <textarea
              className={styles.featureTextarea}
              placeholder={INLINE_COPY.detailedFeature.inputPlaceholder}
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
            />
            <button
              type="submit"
              className={styles.actionBtn}
              style={{ backgroundColor: feature.accentColor }}
            >
              {feature.btnText}
            </button>
            <span className={styles.loginNote}>{INLINE_COPY.detailedFeature.loginNote}</span>
          </form>
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   Main Component — interleaves DetailedFeatures with ValueProps
   ============================================================ */
export default function DetailedFeatures() {
  const valuePropChunks: (typeof VALUE_PROPS)[] = [];
  for (let i = 0; i < VALUE_PROPS.length; i += 3) {
    valuePropChunks.push(VALUE_PROPS.slice(i, i + 3));
  }

  return (
    <>
      {DETAILED_FEATURES.map((feature, index) => {
        const propSlice = valuePropChunks[index] || [];
        return (
          <div key={feature.id}>
            <DetailedFeatureSection feature={feature} index={index} />
            {propSlice.length > 0 && <ValuePropInterleaved items={propSlice} />}
          </div>
        );
      })}
    </>
  );
}
