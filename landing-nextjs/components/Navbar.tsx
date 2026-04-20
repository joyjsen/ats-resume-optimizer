'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Menu, X, FileSearch, FileEdit, PlusCircle, FilePlus,
  Mail, BookOpen, GraduationCap, ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  ANALYSIS_ITEMS, ESSENTIALS_ITEMS, CONNECT_ITEMS,
  BLOG_CATEGORIES, INLINE_COPY, APP_URLS,
  type NavDropdownItem,
} from '@/data/LandingData';
import styles from './Navbar.module.css';

type DropdownKey = 'analysis' | 'essentials' | 'blog' | 'connect' | null;

const NAV_ITEMS: { key: DropdownKey; label: string }[] = [
  { key: 'analysis', label: 'Analysis & Optimization' },
  { key: 'essentials', label: 'Job Application Essentials' },
  { key: 'blog', label: 'Blog' },
  { key: 'connect', label: 'Connect' },
];

const iconMap: Record<string, React.ReactNode> = {
  'file-search': <FileSearch size={20} />,
  'file-edit': <FileEdit size={20} />,
  'plus-circle': <PlusCircle size={20} />,
  'file-plus': <FilePlus size={20} />,
  'mail': <Mail size={20} />,
  'book-open': <BookOpen size={20} />,
  'graduation-cap': <GraduationCap size={20} />,
};

export default function Navbar() {
  const [activeDropdown, setActiveDropdown] = useState<DropdownKey>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleDropdown = (key: DropdownKey) => {
    setActiveDropdown(activeDropdown === key ? null : key);
  };

  const handleItemClick = useCallback((sectionId?: string) => {
    setActiveDropdown(null);
    setMobileMenuOpen(false);
    if (!sectionId) return;
    setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  const handlePricing = useCallback(() => {
    setActiveDropdown(null);
    setMobileMenuOpen(false);
    document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <>
      <header className={`${styles.header} ${scrolled ? styles.headerScrolled : ''}`}>
        {/* Logo */}
        <Link href="/" className={styles.logo}>
          <Image src="/logo-72.png" alt="RiResume Logo" width={36} height={36} className={styles.logoImg} unoptimized />
          <span className={styles.logoText}>RiResume</span>
        </Link>

        {/* Desktop Nav */}
        <nav className={styles.nav} aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              className={`${styles.navItem} ${activeDropdown === item.key ? styles.navItemActive : ''}`}
              onClick={() => toggleDropdown(item.key)}
            >
              {item.label}
              <span className={styles.navChevron}>
                {activeDropdown === item.key ? '▲' : '▼'}
              </span>
            </button>
          ))}
          <button className={styles.navItem} onClick={handlePricing}>
            Pricing
          </button>
        </nav>

        {/* Actions */}
        <div className={styles.actions}>
          <a href={APP_URLS.login} className={styles.signInBtn}>
            {INLINE_COPY.cta.signIn}
          </a>
          <a href={APP_URLS.getStarted} className={styles.getStartedBtn}>
            {INLINE_COPY.cta.getStarted}
          </a>
          <button
            className={styles.menuBtn}
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={28} />
          </button>
        </div>
      </header>

      {/* Dropdown Content */}
      {activeDropdown && (
        <>
          <div className={styles.dropdownWrap}>
            <DropdownContent
              activeDropdown={activeDropdown}
              onItemClick={handleItemClick}
            />
          </div>
          <div
            className={styles.dropdownOverlay}
            onClick={() => setActiveDropdown(null)}
          />
        </>
      )}

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className={styles.mobileOverlay}>
          <div className={styles.mobileBackdrop} onClick={() => setMobileMenuOpen(false)} />
          <div className={styles.mobileContent}>
            <div className={styles.mobileHeader}>
              <span className={styles.mobileMenuTitle}>Menu</span>
              <button className={styles.mobileCloseBtn} onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
                <X size={28} />
              </button>
            </div>

            <span className={styles.mobileSectionTitle}>Analysis &amp; Optimization</span>
            {ANALYSIS_ITEMS.map((item, i) => (
              <a key={i} href={`#${item.sectionId}`} className={styles.mobileSubLink} onClick={() => handleItemClick(item.sectionId)}>
                {item.label}
              </a>
            ))}

            <span className={styles.mobileSectionTitle} style={{ marginTop: 20 }}>Job Application Essentials</span>
            {ESSENTIALS_ITEMS.map((item, i) => (
              <a key={i} href={`#${item.sectionId}`} className={styles.mobileSubLink} onClick={() => handleItemClick(item.sectionId)}>
                {item.label}
              </a>
            ))}

            <div className={styles.mobileDivider} />

            <span className={styles.mobileSectionTitle} style={{ marginTop: 20 }}>Blog</span>
            {BLOG_CATEGORIES.map((cat, i) => (
              <div key={i}>
                <span className={styles.mobileSubLabel}>{cat.title}</span>
                {cat.topics.map((topic, j) => (
                  <Link key={j} href={topic.url} className={styles.mobileSubLink} onClick={() => setMobileMenuOpen(false)}>
                    {topic.label}
                  </Link>
                ))}
              </div>
            ))}
            <Link href="/blog" className={`${styles.mobileLink} ${styles.mobileLinkAccent}`} onClick={() => setMobileMenuOpen(false)} style={{ marginTop: 8, marginBottom: 8 }}>
              View All Posts →
            </Link>

            <div className={styles.mobileDivider} />

            <a href="#pricing-section" className={styles.mobileLink} onClick={handlePricing}>
              Pricing
            </a>
            <a href={APP_URLS.login} className={`${styles.mobileLink} ${styles.mobileLinkAccent}`}>
              Sign In
            </a>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================================================ */
function DropdownContent({
  activeDropdown,
  onItemClick,
}: {
  activeDropdown: DropdownKey;
  onItemClick: (sectionId?: string) => void;
}) {
  if (activeDropdown === 'blog') return <BlogDropdown />;
  const items =
    activeDropdown === 'analysis' ? ANALYSIS_ITEMS :
    activeDropdown === 'essentials' ? ESSENTIALS_ITEMS :
    activeDropdown === 'connect' ? CONNECT_ITEMS : [];

  return (
    <div className={styles.dropdownPanel}>
      <div className={styles.dropdownGrid}>
        {items.map((item, i) => (
          <a
            key={i}
            href={item.sectionId ? `#${item.sectionId}` : '#'}
            className={styles.dropdownItem}
            onClick={(e) => { e.preventDefault(); onItemClick(item.sectionId); }}
          >
            <div className={styles.dropdownItemIcon}>
              {iconMap[item.icon || ''] || null}
            </div>
            <div>
              <div className={styles.labelRow}>
                <span className={styles.dropdownItemLabel}>{item.label}</span>
                {item.comingSoon && <span className={styles.comingSoonBadge}>Coming Soon</span>}
              </div>
              {item.description && <p className={styles.dropdownItemDesc}>{item.description}</p>}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function BlogDropdown() {
  return (
    <div className={styles.dropdownPanel}>
      <div className={styles.blogGrid}>
        {BLOG_CATEGORIES.map((cat, i) => (
          <div key={i} className={styles.blogColumn}>
            <h4 className={styles.blogColumnTitle}>{cat.title}</h4>
            {cat.topics.map((topic, j) => (
              <Link key={j} href={topic.url} className={styles.blogTopic}>
                {topic.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className={styles.blogViewAll}>
        <Link href="/blog" className={styles.blogViewAllLink}>
          View All Posts →
        </Link>
      </div>
    </div>
  );
}
