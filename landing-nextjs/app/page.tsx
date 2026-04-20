import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import StatsBar from '@/components/StatsBar';
import FeaturesGrid from '@/components/FeaturesGrid';
import HowItWorks from '@/components/HowItWorks';
import DetailedFeatures from '@/components/DetailedFeatures';
import BlogPreview from '@/components/BlogPreview';
import Testimonials from '@/components/Testimonials';
import Pricing from '@/components/Pricing';
import FAQ from '@/components/FAQ';
import MobileAppBanner from '@/components/MobileAppBanner';
import Footer from '@/components/Footer';

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <StatsBar />
      <FeaturesGrid />
      <HowItWorks />
      <DetailedFeatures />
      <Testimonials />
      <BlogPreview />
      <Pricing />
      <MobileAppBanner />
      <FAQ />
      <Footer />
    </main>
  );
}
