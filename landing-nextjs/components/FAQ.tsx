'use client';

import { useState } from 'react';
import { FAQ_ITEMS, INLINE_COPY } from '@/data/LandingData';
import styles from './FAQ.module.css';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq-section" className={styles.section}>
      <h2 className="sectionTitle">{INLINE_COPY.sections.faq.title}</h2>
      <p className="sectionSubtitle">{INLINE_COPY.sections.faq.subtitle}</p>
      <div className={styles.list}>
        {FAQ_ITEMS.map((faq, i) => (
          <div key={i} className={styles.item}>
            <button className={styles.question} onClick={() => toggle(i)}>
              <span className={styles.questionText}>{faq.question}</span>
              <span className={`${styles.chevron} ${openIndex === i ? styles.chevronOpen : ''}`}>
                ▼
              </span>
            </button>
            <div className={`${styles.answerWrap} ${openIndex === i ? styles.answerWrapOpen : ''}`}>
              <p className={styles.answerText}>{faq.answer}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
