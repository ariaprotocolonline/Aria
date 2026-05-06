import LandingNav from '../components/landing/LandingNav';
import HeroSection from '../components/landing/HeroSection';
import HowItWorks from '../components/landing/HowItWorks';
import LiveStatsBar from '../components/landing/LiveStatsBar';
import SupportedAssets from '../components/landing/SupportedAssets';
import TrustSection from '../components/landing/TrustSection';
import Footer from '../components/landing/Footer';

interface LandingPageProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ isDarkMode, toggleDarkMode }) => {
  return (
    <div className="min-h-screen bg-bg text-text-primary transition-colors duration-300 flex flex-col font-sans">
      <LandingNav
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
      />
      <main className="flex-1">
        <HeroSection />
        <HowItWorks />
        <LiveStatsBar />
        <SupportedAssets />
        <TrustSection />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
