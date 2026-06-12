import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useTour, TourStep } from '../../hooks/useTour';
import TourCursor from './TourCursor';
import TourTooltip from './TourTooltip';

// ─── Step definitions ───────────────────────────────────────────────────────

const LANDING_STEPS: TourStep[] = [
  {
    heading: 'Welcome to ARIA',
    body: 'ARIA is your autonomous yield intelligence agent on Mantle. It monitors liquidity, captures yield, and rebalances your portfolio, fully automated.',
  },
  {
    selector: '[data-tour="connect-wallet"]',
    heading: 'Connect Your Wallet',
    body: 'Click "Connect wallet" to get started. ARIA supports MetaMask, WalletConnect, Coinbase Wallet, and all major wallets on Mantle.',
  },
  {
    selector: '[data-tour="how-it-works"]',
    heading: 'How It Works',
    body: 'ARIA scans Agni Finance and FusionX every 5 minutes, scores every pool by APY and liquidity depth, then reallocates when a better opportunity clears its safety gates.',
  },
  {
    selector: '[data-tour="docs-link"]',
    heading: 'Read the Docs',
    body: 'Everything about how ARIA works is documented. No black boxes. Tap Docs to read the full whitepaper before depositing.',
  },
  {
    heading: 'Ready to start?',
    body: 'Connect your wallet to deploy your personal vault on Mantle. Your funds stay non-custodial. ARIA can only rebalance inside pre-approved protocols.',
  },
];

const DASHBOARD_STEPS: TourStep[] = [
  {
    selector: '[data-tour="vault-balance"]',
    heading: 'Your Vault Balance',
    body: 'Live WETH and USDC balance across your personal vault on Mantle. Every reallocation ARIA executes is reflected here in real time.',
  },
  {
    selector: '[data-tour="withdraw-btn"]',
    heading: 'Withdraw Anytime',
    body: 'Your funds are never locked. Tap Withdraw to pull WETH or USDC back to your wallet. No timelock, no delay, even when ARIA is active.',
  },
  {
    selector: '[data-tour="deposit-btn"]',
    heading: 'Deposit to Your Vault',
    body: 'Send WETH or USDC into your vault and ARIA immediately starts putting it to work across the highest-scoring pools on Mantle.',
  },
  {
    selector: '[data-tour="intelligence-feed"]',
    heading: "ARIA's Live Feed",
    body: 'Every decision ARIA makes is logged here in plain English: what moved, why it moved, and what the outcome was. Full transparency.',
  },
  {
    selector: '[data-tour="telegram-settings"]',
    heading: 'Settings & Controls',
    body: 'Adjust your risk profile, pause the agent, configure fees, and connect Telegram for real-time alerts — all from here.',
  },
  {
    selector: '[data-tour="ask-aria"]',
    heading: 'Chat With ARIA',
    body: 'Ask ARIA anything: portfolio strategy, market conditions, why it made a specific move. It knows your full position history.',
  },
  {
    heading: "You're All Set",
    body: 'ARIA is watching your positions 24/7. You can replay this tour anytime from the Settings panel.',
  },
];

// ─── Highlight styles injected once ─────────────────────────────────────────

const HIGHLIGHT_STYLES = `
  .aria-tour-highlight {
    outline: 2px solid #95A395 !important;
    outline-offset: 4px !important;
    border-radius: 8px !important;
    box-shadow: 0 0 0 4px rgba(149,163,149,0.18) !important;
    transition: outline 0.2s ease, box-shadow 0.2s ease !important;
  }
`;

// ─── Welcome modal ───────────────────────────────────────────────────────────

const WelcomeModal: React.FC<{ onStart: () => void; onSkip: () => void }> = ({ onStart, onSkip }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 100000,
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
    animation: 'wFadeIn 0.3s ease-out forwards',
  }}>
    <div style={{
      background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 18,
      padding: '44px 38px 36px', maxWidth: 360, width: '100%', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      boxShadow: '0 28px 70px rgba(0,0,0,0.22)',
      animation: 'wSlideUp 0.35s cubic-bezier(0.25,0.46,0.45,0.94) forwards',
    }}>
      {/* Logo circle */}
      <div style={{
        width: 60, height: 60, borderRadius: '50%',
        border: '1.5px solid var(--line)', background: 'var(--panel)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 22,
      }}>
        <span style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 700, color: 'var(--accent)' }}>A</span>
      </div>

      <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: '0 0 10px' }}>
        Welcome to ARIA
      </h2>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.7, margin: '0 0 30px', maxWidth: 280 }}>
        Want a quick guided tour? ARIA will walk you through the key features. Takes about 90 seconds.
      </p>

      <button
        onClick={onStart}
        style={{
          width: '100%', padding: '13px', background: 'var(--accent)',
          color: '#0a1b10', border: 'none', borderRadius: 9,
          fontSize: 14, fontWeight: 700, cursor: 'pointer', marginBottom: 10,
          letterSpacing: '0.01em',
        }}
      >
        Show me around →
      </button>
      <button
        onClick={onSkip}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--mute)', padding: 8 }}
      >
        Skip tour
      </button>
    </div>
    <style>{`
      @keyframes wFadeIn   { from { opacity:0 } to { opacity:1 } }
      @keyframes wSlideUp  { from { opacity:0; transform:translateY(20px) } to { opacity:1; transform:translateY(0) } }
    `}</style>
  </div>
);

// ─── Tour engine ─────────────────────────────────────────────────────────────

const TourEngine: React.FC<{ steps: TourStep[]; storageKey: string }> = ({ steps, storageKey }) => {
  const {
    isActive, showWelcome, currentStepIndex, totalSteps, currentStep,
    cursorPos, hasArrived, tooltipVisible,
    startTour, skip, next, back, restart, showWelcomeModal,
  } = useTour(steps, storageKey);

  // aria-replay-tour → restart directly (Settings panel)
  // aria-show-tour-welcome → show the "Want a tour?" modal first (landing FAB)
  useEffect(() => {
    const handleReplay   = () => restart();
    const handleWelcome  = () => showWelcomeModal();
    window.addEventListener('aria-replay-tour',        handleReplay);
    window.addEventListener('aria-show-tour-welcome',  handleWelcome);
    return () => {
      window.removeEventListener('aria-replay-tour',       handleReplay);
      window.removeEventListener('aria-show-tour-welcome', handleWelcome);
    };
  }, [restart, showWelcomeModal]);

  if (showWelcome) return <WelcomeModal onStart={startTour} onSkip={skip} />;
  if (!isActive)   return null;

  return (
    <>
      <style>{HIGHLIGHT_STYLES}</style>

      {/* Animated cursor */}
      <TourCursor x={cursorPos.x} y={cursorPos.y} hasArrived={hasArrived} />

      {/* Tooltip — appears near cursor after it lands */}
      <TourTooltip
        heading={currentStep.heading}
        body={currentStep.body}
        currentStep={currentStepIndex + 1}
        totalSteps={totalSteps}
        onNext={next}
        onBack={back}
        onFinish={skip}
        onSkip={skip}
        x={cursorPos.x}
        y={cursorPos.y}
        visible={tooltipVisible}
      />
    </>
  );
};

// ─── Public component ────────────────────────────────────────────────────────

const OnboardingTour: React.FC = () => {
  const { isConnected, address } = useAccount();
  const { pathname } = useLocation();

  if (pathname === '/onboarding' || pathname === '/reset') return null;

  const savedWallet = localStorage.getItem('aria-onboarding-wallet');
  const onDashboard =
    isConnected &&
    pathname === '/' &&
    !!localStorage.getItem('aria-onboarding-done') &&
    !!savedWallet && !!address &&
    savedWallet === address.toLowerCase();

  return onDashboard
    ? <TourEngine steps={DASHBOARD_STEPS} storageKey="aria-tour-complete" />
    : <TourEngine steps={LANDING_STEPS}   storageKey="aria-landing-tour-complete" />;
};

export default OnboardingTour;
