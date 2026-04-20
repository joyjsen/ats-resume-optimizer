import Link from 'next/link';
import { ALL_BLOG_POSTS, BLOG_CATEGORIES } from '@/data/LandingData';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import styles from './page.module.css';

export const metadata = {
  title: 'Blog | RiResume - AI Resume Optimizer',
  description: 'Expert advice on resume optimization, ATS scores, cover letters, interview preparation, and career growth. Stay ahead in your job search with RiResume.',
};

/* Group posts by category for organized display */
const CATEGORY_ORDER = ['ATS Optimization', 'Resume Tips', 'Resume Resources', 'Cover Letter', 'Interview', 'Career Growth'];

export default function BlogIndex() {
  /* Build category → posts map */
  const grouped = new Map<string, typeof ALL_BLOG_POSTS>();
  for (const post of ALL_BLOG_POSTS) {
    const list = grouped.get(post.category) || [];
    list.push(post);
    grouped.set(post.category, list);
  }

  return (
    <>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>RiResume Blog</h1>
          <p className={styles.subtitle}>
            Expert advice on resume optimization, cover letters, interview preparation, and career growth — {ALL_BLOG_POSTS.length} articles and counting.
          </p>
        </div>

        {/* Render by category */}
        {CATEGORY_ORDER.map((cat) => {
          const posts = grouped.get(cat);
          if (!posts || posts.length === 0) return null;
          return (
            <section key={cat} className={styles.categorySection}>
              <h2 className={styles.categoryHeading}>{cat}</h2>
              <div className={styles.grid}>
                {posts.map((post) => (
                  <article key={post.id} className={styles.card}>
                    <Link href={post.url}>
                      <div className={styles.cardImagePlaceholder}>
                        {post.category}
                      </div>
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
        })}
      </main>
      <Footer />
    </>
  );
}
