import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { SEO_METADATA, TESTIMONIALS, FAQ_ITEMS } from '@/data/LandingData';
import CookieBanner from '@/components/CookieBanner';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'RiResume - AI Resume Optimizer | Beat ATS Filters',
  description: 'RiResume is an AI resume optimizer that helps job seekers beat ATS filters and land more interviews. Get your ATS score, optimize your resume with AI, and generate cover letters in under 60 seconds. Free to start on Web, iOS & Android.',
  keywords: SEO_METADATA.keywords,
  metadataBase: new URL('https://riresume.com'),
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: 'RiResume - AI Resume Optimizer | Beat ATS Filters',
    description: 'RiResume is an AI resume optimizer that helps job seekers beat ATS filters and land more interviews. Get your ATS score, optimize your resume with AI, and generate cover letters in under 60 seconds. Free to start on Web, iOS & Android.',
    type: 'website',
    url: 'https://riresume.com',
    siteName: 'RiResume',
    images: [
      {
        url: '/og-image.webp',
        width: 1200,
        height: 630,
        alt: 'RiResume - AI-Powered ATS Resume Optimizer',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RiResume - AI Resume Optimizer | Beat ATS Filters',
    description: 'RiResume is an AI resume optimizer that helps job seekers beat ATS filters. Get your ATS score, optimize your resume, and generate cover letters in under 60 seconds.',
    images: ['/og-image.webp'],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/logo-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

// Enhanced SoftwareApplication schema with AggregateOffer + AggregateRating
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'RiResume',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web, iOS, Android',
  url: 'https://riresume.com',
  logo: 'https://riresume.com/logo-512.png',
  description: SEO_METADATA.description,
  offers: {
    '@type': 'AggregateOffer',
    lowPrice: '4.99',
    highPrice: '14.99',
    priceCurrency: 'USD',
    offerCount: '3',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    reviewCount: String(TESTIMONIALS.length),
  },
  author: {
    '@type': 'Organization',
    name: 'RiResume',
  },
};

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'RiResume',
  url: 'https://www.riresume.com',
  logo: 'https://www.riresume.com/logo-512.png',
  sameAs: [
    'https://apps.apple.com/us/app/riresume/id6757821173',
    'https://play.google.com/store/apps/details?id=com.jsn22.riresume&pcampaignid=web_share',
    'https://www.facebook.com/share/1HrAgt1KUB/?mibextid=wwXIfr',
    'https://www.instagram.com/riresume?igsh=YjU4MTJ5N205Y2V1',
    'https://www.threads.com/@riresume?igshid=NTc4MTIwNjQ2YQ==',
    'https://x.com/riresume?s=21&t=YyZ_r5xFMEYCKAWlqJVxFA',
    'https://bsky.app/profile/riresume.bsky.social',
    'https://www.tiktok.com/@riresume?_r=1&_t=ZT-94r59srZ1mo',
  ],
};

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'RiResume',
  url: 'https://www.riresume.com',
};

// FAQ schema from FAQ_ITEMS data
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ_ITEMS.map((faq) => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer,
    },
  })),
};

const GA_ID = 'G-SVR0P3V7TC';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="preconnect" href="https://www.google-analytics.com" />
        <link rel="preload" href="/hero-mockup-final-optimized.png" as="image" type="image/png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      </head>
      <body>
        <a href="#main-content" className="skip-to-main">Skip to main content</a>
        <div id="main-content">{children}</div>
        <CookieBanner />

        {/* Google Analytics 4 with Consent Mode v2 */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}

            // Default consent DENIED for GDPR compliance (must be before config)
            gtag('consent', 'default', {
              analytics_storage: 'denied',
              ad_storage: 'denied',
              ad_user_data: 'denied',
              ad_personalization: 'denied',
              wait_for_update: 500,
            });

            gtag('js', new Date());
            gtag('config', '${GA_ID}');

            // Restore consent if user previously accepted
            try {
              var consent = localStorage.getItem('ri_cookie_consent');
              if (consent === 'granted') {
                gtag('consent', 'update', {
                  analytics_storage: 'granted',
                  ad_storage: 'granted',
                  ad_user_data: 'granted',
                  ad_personalization: 'granted',
                });
              }
            } catch(e) {}
          `}
        </Script>
      </body>
    </html>
  );
}
