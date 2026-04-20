import Image from 'next/image';
import { INLINE_COPY } from '@/data/LandingData';
import styles from './MobileAppBanner.module.css';

/* Inline SVG icons for Apple and Google Play */
function AppleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M17.05 20.28c-.98.95-2.05 1.78-3.15 1.76-1.09-.02-1.74-.6-3.14-.6-1.42 0-2.19.6-3.12.62-1.12.02-2.31-.88-3.32-1.88-2.07-2.04-3.18-5.83-1.08-8.83 1.05-1.5 2.58-2.45 4.04-2.43 1.13.02 2.11.75 2.8.75s1.84-.88 3.19-.74c.57.02 2.18.23 3.2 1.72-.08.05-1.92 1.12-1.9 3.33.02 2.65 2.33 3.56 2.36 3.58-.02.06-.37 1.25-1.08 2.22zM13.62 4.41c.62-.75 1.03-1.78.91-2.82-.89.04-1.97.6-2.61 1.35-.57.65-1.07 1.71-.94 2.73 1 .08 2.02-.51 2.64-1.26z" />
    </svg>
  );
}

function PlayStoreIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M3.61 2.16c-.16.18-.26.46-.26.8v18.08c0 .34.1.62.26.8l.06.06L14.33 11.23v-.2L3.67 2.1l-.06.06zM17.86 14.77l-3.53-3.53v-.2l3.53-3.53.11.06 4.18 2.38c1.2.68 1.2 1.8 0 2.48l-4.18 2.38-.11.06z" />
    </svg>
  );
}

export default function MobileAppBanner() {
  return (
    <section className={styles.banner}>
      <div className={styles.inner}>
        <Image
          src="/logo-72.png"
          alt="RiResume App Icon"
          width={72}
          height={72}
          className={styles.icon}
          unoptimized
        />
        <h2 className={styles.title}>{INLINE_COPY.mobileBanner.title}</h2>
        <p className={styles.subtitle}>{INLINE_COPY.mobileBanner.subtitle}</p>
        <div className={styles.badges}>
          <a
            href={INLINE_COPY.mobileBanner.appStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.badgeBtn}
          >
            <AppleIcon />
            <div className={styles.badgeTextWrap}>
              <span className={styles.badgeSmall}>{INLINE_COPY.mobileBanner.appStoreSmall}</span>
              <span className={styles.badgeBig}>{INLINE_COPY.mobileBanner.appStoreBig}</span>
            </div>
          </a>
          <a
            href={INLINE_COPY.mobileBanner.playStoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.badgeBtn}
          >
            <PlayStoreIcon />
            <div className={styles.badgeTextWrap}>
              <span className={styles.badgeSmall}>{INLINE_COPY.mobileBanner.playStoreSmall}</span>
              <span className={styles.badgeBig}>{INLINE_COPY.mobileBanner.playStoreBig}</span>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}
