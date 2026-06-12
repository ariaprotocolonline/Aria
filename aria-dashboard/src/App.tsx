import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import OnboardingPage from './pages/OnboardingPage';
import ResetPage from './pages/ResetPage';
import VaultGuard from './components/VaultGuard';
import ErrorBoundary from './components/ErrorBoundary';
import NetworkGuard from './components/NetworkGuard';
import OnboardingTour from './components/onboarding/OnboardingTour';

const DocsPage = lazy(() => import('./pages/DocsPage'));

function TourFab() {
  const { isConnected } = useAccount();
  const onboardingDone = !!localStorage.getItem('aria-onboarding-done');
  if (isConnected && onboardingDone) return null;
  return (
    <button
      className="lp-tour-fab"
      onClick={() => window.dispatchEvent(new Event('aria-show-tour-welcome'))}
      title="Take a guided tour"
    >
      <span className="lp-tour-fab-lbl">Ask</span>
      <span className="lp-tour-fab-nm">aria</span>
      <span className="lp-tour-fab-dot" />
    </button>
  );
}

function App() {
  const { address, isConnected } = useAccount();

  const [isDarkMode, setIsDarkMode] = useState(
    () => localStorage.getItem('aria-theme') !== 'light'
  );
  // Per-wallet onboarding: true only if THIS wallet completed onboarding
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    if (!address) { setOnboardingDone(false); return; }
    const done = !!localStorage.getItem('aria-onboarding-done');
    const savedWallet = localStorage.getItem('aria-onboarding-wallet');
    setOnboardingDone(done && !!savedWallet && savedWallet === address.toLowerCase());
  }, [address]);

  const toggleDarkMode = () => setIsDarkMode(d => !d);

  useEffect(() => {
    document.documentElement.dataset.theme = isDarkMode ? 'dark' : 'light';
    localStorage.setItem('aria-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  return (
    <ErrorBoundary>
      <Router>
        <NetworkGuard>
          <OnboardingTour />
          <TourFab />
          <Routes>
            <Route
              path="/"
              element={
                onboardingDone && isConnected ? (
                  <VaultGuard>
                    {(vaultAddress) => <Dashboard vaultAddress={vaultAddress} />}
                  </VaultGuard>
                ) : (
                  <LandingPage isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
                )
              }
            />
            <Route
              path="/onboarding"
              element={
                <OnboardingPage onComplete={() => setOnboardingDone(true)} isDarkMode={isDarkMode} toggleDarkMode={toggleDarkMode} />
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
            <Route path="/reset" element={<ResetPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </NetworkGuard>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
