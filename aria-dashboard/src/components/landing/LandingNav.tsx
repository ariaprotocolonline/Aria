import { Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import WalletButton from '../WalletButton';

interface LandingNavProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const LandingNav: React.FC<LandingNavProps> = ({ isDarkMode, toggleDarkMode }) => {
  return (
    <nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-md border-b border-soft">
      <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-24 flex items-center py-5">
        {/* Left — dark mode + docs */}
        <div className="flex-1 flex items-center gap-4">
          <button
            onClick={toggleDarkMode}
            className="p-2 border border-soft rounded-md bg-card hover:bg-bg-soft transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? <Sun size={16} className="text-text-secondary" /> : <Moon size={16} className="text-text-secondary" />}
          </button>
          <Link
            data-tour="docs-link"
            to="/docs"
            className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Read Docs
          </Link>
        </div>

        {/* Center — ARIA */}
        <div className="flex items-center justify-center">
          <Link to="/" className="font-serif text-3xl font-bold tracking-tight text-accent">
            ARIA
          </Link>
        </div>

        {/* Right — connect wallet */}
        <div className="flex-1 flex items-center justify-end">
          <WalletButton />
        </div>
      </div>
    </nav>
  );
};

export default LandingNav;
