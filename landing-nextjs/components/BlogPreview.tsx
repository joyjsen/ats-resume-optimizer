'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { BLOG_POSTS, INLINE_COPY } from '@/data/LandingData';
import styles from './BlogPreview.module.css';

function BlogCardImage({ src, alt, category }: { src: string; alt: string; category: string }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={styles.cardImage}
        style={{
          background: 'var(--gradient-brand)',
          width: '100%',
          height: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--white)',
          fontSize: 16,
          fontWeight: 600,
          letterSpacing: 0.5,
        }}
      >
        {category}
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={360}
      height={200}
      className={styles.cardImage}
      unoptimized
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export default function BlogPreview() {
  return (
    <section id="blog" className={styles.section}>
      <div className={styles.headerRow}>
        <div className={styles.headerText}>
          <h2 className="sectionTitle" style={{ textAlign: 'left' }}>
            {INLINE_COPY.sections.blog.title}
          </h2>
          <p className="sectionSubtitle" style={{ textAlign: 'left', margin: 0 }}>
            {INLINE_COPY.sections.blog.subtitle}
          </p>
        </div>
        <Link href="/blog" className={styles.seeAllBtn}>
          {INLINE_COPY.sections.blog.seeAll}
        </Link>
      </div>
      <div className={styles.grid}>
        {BLOG_POSTS.map((post) => (
          <article key={post.id} className={styles.card}>
            <Link href={post.url}>
              <BlogCardImage
                src={post.image}
                alt={`${post.title} - RiResume Blog`}
                category={post.category}
              />
              <div className={styles.cardContent}>
                <div className={styles.meta}>
                  <span className={styles.category}>{post.category}</span>
                  <span className={styles.readTime}>{post.readTime}</span>
                </div>
                <h3 className={styles.cardTitle}>{post.title}</h3>
                <p className={styles.cardDesc}>{post.description}</p>
                <span className={styles.cardDate}>{post.date}</span>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
