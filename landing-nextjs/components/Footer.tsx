import Link from 'next/link';
import { Facebook, Instagram, Twitter, MessageCircle, Music, Linkedin } from 'lucide-react';
import { FOOTER_COLUMNS, SOCIAL_LINKS, INLINE_COPY } from '@/data/LandingData';
import styles from './Footer.module.css';

/* Bluesky butterfly SVG — lucide-react doesn't include it */
const BlueskySvg = () => (
  <svg width="18" height="18" viewBox="0 0 568 501" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M123.121 33.664C188.241 82.553 258.281 181.68 284 234.873C309.719 181.68 379.759 82.553 444.879 33.664C489.726 -1.611 568 -28.906 568 57.947C568 76.164 558.011 204.001 552.222 224.337C534.333 288.19 462.222 303.685 397.778 293.695C515.556 312.867 544.444 383.442 480 454.018C355.867 590.026 302.111 420.297 288.875 374.96C287.394 370.026 284.533 370.44 284 370.44C283.467 370.44 280.606 370.026 279.125 374.96C265.889 420.297 212.133 590.026 88 454.018C23.556 383.442 52.444 312.867 170.222 293.695C105.778 303.685 33.667 288.19 15.778 224.337C9.989 204.001 0 76.164 0 57.947C0 -28.906 78.274 -1.611 123.121 33.664Z" />
  </svg>
);

const socialIconMap: Record<string, React.ReactNode> = {
  facebook: <Facebook size={18} />,
  instagram: <Instagram size={18} />,
  'x-twitter': <Twitter size={18} />,
  threads: <MessageCircle size={18} />,
  bluesky: <BlueskySvg />,
  tiktok: <Music size={18} />,
  linkedin: <Linkedin size={18} />,
};

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <h3 className={styles.brandName}>{INLINE_COPY.footer.brandName}</h3>
            <p className={styles.brandDesc}>{INLINE_COPY.footer.brandDesc}</p>
          </div>
          {FOOTER_COLUMNS.map((col, i) => (
            <div key={i} className={styles.footerCol}>
              <h4 className={styles.colTitle}>{col.title}</h4>
              {col.links.map((link, j) => {
                if (link.href.startsWith('#')) {
                  return (
                    <a key={j} href={link.href} className={styles.footerLink}>
                      {link.label}
                    </a>
                  );
                }
                if (link.href.startsWith('mailto:')) {
                  return (
                    <a key={j} href={link.href} className={styles.footerLink}>
                      {link.label}
                    </a>
                  );
                }
                return (
                  <Link key={j} href={link.href} className={styles.footerLink}>
                    {link.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
        <div className={styles.footerBottom}>
          <span className={styles.copyright}>{INLINE_COPY.footer.copyright}</span>
          <div className={styles.socialRow}>
            {SOCIAL_LINKS.map((s, i) => (
              <a
                key={i}
                href={s.url}
                className={styles.socialIcon}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={s.label || s.icon}
              >
                {socialIconMap[s.icon] || null}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
