import React from 'react';
import { Menu, Moon, Sun } from 'lucide-react';

import { useAccount, useDisconnect } from 'wagmi';

interface TopNavProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const truncate = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const TopNav: React.FC<TopNavProps> = ({ isDarkMode, toggleDarkMode }) => {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();

  return (
    <nav className="sticky top-0 z-50 bg-bg/80 backdrop-blur-md border-b border-soft">
      <div className="relative max-w-7xl mx-auto px-4 md:px-12 lg:px-24 flex items-center py-4 md:py-5">

        {/* Left — dark mode always visible + Agent Active badge on desktop */}
        <div className="flex items-center gap-2 md:gap-3">
          <button
            onClick={toggleDarkMode}
            className="p-2 border border-soft rounded-md bg-card hover:bg-bg-soft transition-colors"
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? <Sun size={16} className="text-text-secondary" /> : <Moon size={16} className="text-text-secondary" />}
          </button>
        </div>

        {/* Center — ARIA always perfectly centred */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <h1 className="font-serif text-2xl md:text-3xl font-bold tracking-tight text-accent">ARIA</h1>
        </div>

        {/* Right — controls */}
        <div className="ml-auto flex items-center gap-2 md:gap-4">
          {/* Wallet button */}
          <button
            data-tour="wallet-button"
            onClick={() => disconnect()}
            className="p-2 md:px-3 md:py-1.5 border border-soft rounded-md bg-card hover:bg-bg-soft transition-colors text-sm font-medium text-text-primary"
            title="Click to disconnect"
          >
            {/* Mobile: 3-line icon when connected */}
            <span className="md:hidden flex items-center justify-center">
              {address ? <Menu size={18} className="text-text-primary" /> : <span>—</span>}
            </span>
            {/* Desktop: truncated address */}
            <span className="hidden md:inline">
              {address ? truncate(address) : '—'}
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
