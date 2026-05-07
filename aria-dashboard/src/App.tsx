import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { type Address } from 'viem';
import TopNav from './components/TopNav';
import PortfolioRow from './components/PortfolioRow';
import MiddleRow from './components/MiddleRow';
import ChatPanel from './components/ChatPanel';
import BottomStats from './components/BottomStats';
import LandingPage from './pages/LandingPage';
import AgentBot from './components/agent/AgentBot';

const DocsPage  = lazy(() => import('./pages/DocsPage'));
const AgentChat = lazy(() => import('./components/agent/AgentChat'));
import OnboardingTour from './components/onboarding/OnboardingTour';
import ErrorBoundary from './components/ErrorBoundary';
import NetworkGuard from './components/NetworkGuard';
import VaultGuard from './components/VaultGuard';
import { RiskProfile, type FeedItem } from './services/claude';
import { useVaultPaused } from './hooks/useARIAVault';

function Dashboard({
  riskProfile,
  setRiskProfile,
  isDarkMode,
  toggleDarkMode,
  vaultAddress,
}: {
  riskProfile: RiskProfile;
  setRiskProfile: (rp: RiskProfile) => void;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  vaultAddress: Address;
}) {
  const isPaused = useVaultPaused(vaultAddress).data as boolean | undefined;
  const [liveFeed, setLiveFeed] = useState<FeedItem[]>([]);

  const handleFeedUpdate = useCallback((items: FeedItem[]) => {
    setLiveFeed(items);
  }, []);

  const blendedApy = useMemo(() => {
    try {
      const raw = localStorage.getItem('aria-pool-cache');
      if (!raw) return null;
      const cache = JSON.parse(raw) as { riskProfile: string; pools: { apy: string }[] };
      if (cache.riskProfile !== riskProfile || !Array.isArray(cache.pools)) return null;
      const apys = cache.pools
        .map(p => parseFloat(p.apy.replace('%', '')))
        .filter(a => !isNaN(a));
      return apys.length > 0 ? apys.reduce((a, b) => a + b, 0) / apys.length : null;
    } catch {
      return null;
    }
  }, [riskProfile]);

  return (
    <div className="min-h-screen bg-bg text-text-primary transition-colors duration-300">
      <TopNav isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
      <div className="px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto flex flex-col">
          {isPaused && (
            <div className="mt-4 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-sm text-sm text-yellow-800 dark:text-yellow-300 font-medium">
              Agent execution is paused. Your funds are safe. You can still withdraw.
            </div>
          )}
          <main className="flex-1 flex flex-col">
            <PortfolioRow riskProfile={riskProfile} setRiskProfile={setRiskProfile} blendedApy={blendedApy} />
            <MiddleRow riskProfile={riskProfile} onFeedUpdate={handleFeedUpdate} />
            <ChatPanel riskProfile={riskProfile} />
          </main>
          <BottomStats liveFeed={liveFeed} />
        </div>
      </div>
      <AgentBot />
    </div>
  );
}

function App() {
  const { isConnected } = useAccount();
  const [riskProfile, setRiskProfile] = useState<RiskProfile>(
    () => (localStorage.getItem('aria-risk-profile') as RiskProfile) || 'Balanced'
  );

  const handleSetRiskProfile = (rp: RiskProfile) => {
    setRiskProfile(rp);
    localStorage.setItem('aria-risk-profile', rp);
  };
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  return (
    <ErrorBoundary>
      <Router>
        <NetworkGuard>
          <OnboardingTour />
          <Routes>
            <Route
              path="/"
              element={
                !isConnected ? (
                  <LandingPage isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
                ) : (
                  <VaultGuard>
                    {(vaultAddress) => (
                      <Dashboard
                        riskProfile={riskProfile}
                        setRiskProfile={handleSetRiskProfile}
                        isDarkMode={isDarkMode}
                        toggleDarkMode={toggleDarkMode}
                        vaultAddress={vaultAddress}
                      />
                    )}
                  </VaultGuard>
                )
              }
            />
            <Route
              path="/docs"
              element={
                <Suspense fallback={null}>
                  <DocsPage isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
                </Suspense>
              }
            />
            <Route
              path="/agent"
              element={
                !isConnected ? (
                  <Navigate to="/" replace />
                ) : (
                  <Suspense fallback={null}>
                    <AgentChat />
                  </Suspense>
                )
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </NetworkGuard>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
