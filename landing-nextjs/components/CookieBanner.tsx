'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './CookieBanner.module.css';

const CONSENT_KEY = 'ri_cookie_consent';

declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

function updateConsent(granted: boolean) {
  if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
    const value = granted ? 'granted' : 'denied';
    window.gtag('consent', 'update', {
      analytics_storage: value,
      ad_storage: value,
      ad_user_data: value,
      ad_personalization: value,
    });
  }
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    updateConsent(true);
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(CONSENT_KEY, 'denied');
    updateConsent(false);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className={styles.banner}>
      <div className={styles.content}>
        <p className={styles.text}>
          We use cookies to analyze site traffic and improve your experience.
          By clicking Accept, you consent to our use of cookies in accordance
          with our{' '}
          <a href="https://app.riresume.com/settings/privacy" target="_blank" rel="noopener noreferrer" className={styles.link}>
            Privacy Policy
          </a>
          .
        </p>
        <div className={styles.buttons}>
          <button className={styles.acceptBtn} onClick={handleAccept}>
            Accept All
          </button>
          <button className={styles.declineBtn} onClick={handleDecline}>
            Decline
          </button>
        </div>
      </div>
    </div>
  );
}
