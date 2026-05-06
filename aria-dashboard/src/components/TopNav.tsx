import React from 'react';
import { Activity, Moon, Sun } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAccount, useDisconnect } from 'wagmi';

interface TopNavProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const TopNav: React.FC<TopNavProps> = ({ isDarkMode, toggleDarkMode }) => {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();

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
            to="/docs"
            className="hidden md:block text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            Read Docs
          </Link>
        </div>

        {/* Center — ARIA */}
        <div className="flex items-center justify-center">
          <h1 className="font-serif text-3xl font-bold tracking-tight text-accent">ARIA</h1>
        </div>

        {/* Right — network + wallet */}
        <div className="flex-1 flex items-center gap-4 justify-end text-sm font-medium text-text-secondary">
          <div className="hidden md:flex items-center gap-2">
            <Activity size={16} className="text-accent" />
            <span>Mantle Network</span>
          </div>
          <button
            data-tour="wallet-button"
            onClick={() => disconnect()}
            className="px-3 py-1.5 border border-soft rounded-md bg-card hover:bg-bg-soft transition-colors"
            title="Click to disconnect"
          >
            {address ? truncate(address) : '—'}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
