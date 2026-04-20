'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import { INLINE_COPY, APP_URLS } from '@/data/LandingData';
import styles from './Hero.module.css';

export default function Hero() {
  const [jobUrl, setJobUrl] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (jobUrl.trim()) {
      window.location.href = APP_URLS.withJobUrl(jobUrl.trim());
    } else {
      window.location.href = APP_URLS.getStarted;
    }
  };

  return (
    <section className={styles.hero}>
      <div className={styles.heroInner}>
        <div className={styles.heroLeft}>
          <h1 className={styles.tagline}>
            {INLINE_COPY.hero.headline}{' '}
            <span className={styles.highlight}>{INLINE_COPY.hero.headlineHighlight}</span>
          </h1>
          <p className={styles.subtext}>{INLINE_COPY.hero.subtext}</p>
          <form onSubmit={handleSubmit} className={styles.inputWrapper}>
            <input
              type="text"
              className={styles.input}
              placeholder={INLINE_COPY.hero.inputPlaceholder}
              value={jobUrl}
              onChange={(e) => setJobUrl(e.target.value)}
            />
            <button type="submit" className={styles.inputBtn}>
              {INLINE_COPY.hero.cta}
            </button>
          </form>
          <p className={styles.ctaSubtext}>{INLINE_COPY.hero.ctaSubtext}</p>
          {INLINE_COPY.hero.ctaSecondary && (
            <a href={INLINE_COPY.hero.ctaSecondaryUrl} className={styles.secondaryCta}>
              {INLINE_COPY.hero.ctaSecondary}
            </a>
          )}
        </div>
        <div className={styles.heroRight}>
          <div className={styles.mockup}>
            <Image
              src="/hero-mockup-final-optimized.png"
              alt="RiResume AI Resume Optimizer Dashboard showing 92% ATS compatibility score"
              width={656}
              height={408}
              className={styles.mockupImage}
              unoptimized
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
