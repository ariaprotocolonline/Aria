import React, { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useTour, TourStep } from '../../hooks/useTour';
import TourCursor from './TourCursor';
import TourTooltip from './TourTooltip';

// ─── Step definitions ──────────────────────────────────────────────────────

const LANDING_STEPS: TourStep[] = [
  {
    selector: 'body',
    heading: 'Welcome to ARIA',
    body: "ARIA is your autonomous RWA intelligence agent on Mantle. Let me give you a quick tour.",
  },
  {
    selector: '[data-tour="connect-wallet"]',
    heading: 'Connect Your Wallet',
    body: 'Start here. ARIA supports MetaMask and all major wallets on Mantle network.',
    action: true,
  },
  {
    selector: '[data-tour="hero-heading"]',
    heading: 'Billions in Untapped Capital',
    body: 'ARIA continuously monitors liquidity and yield opportunities across Mantle — even when you\'re offline.',
  },
  {
    selector: '[data-tour="how-it-works"]',
    heading: 'Three Intelligence Layers',
    body: 'Liquidity scanning, yield detection, and autonomous execution. ARIA handles all three so you don\'t have to.',
  },
  {
    selector: '[data-tour="docs-link"]',
    heading: 'Read the Whitepaper',
    body: 'Everything about how ARIA works is documented transparently. No black boxes.',
  },
];

const DASHBOARD_STEPS: TourStep[] = [
  {
    selector: '[data-tour="vault-balance"]',
    heading: 'Your Vault Balance',
    body: 'Your real-time balance across USDY and mETH. Every reallocation ARIA makes is reflected here instantly.',
  },
  {
    selector: '[data-tour="wallet-button"]',
    heading: 'Your Connected Wallet',
    body: 'Your wallet address lives here. Click it anytime to disconnect from ARIA when you\'re done.',
  },
  {
    selector: '[data-tour="withdraw-btn"]',
    heading: 'Withdraw Anytime',
    body: 'Your funds are never locked. Hit Withdraw to pull your USDY or mETH back to your wallet at any time.',
  },
  {
    selector: '[data-tour="intelligence-feed"]',
    heading: "ARIA's Live Feed",
    body: 'Every decision ARIA makes is logged here in plain English — no transaction hashes, just clear explanations.',
  },
  {
    selector: '[data-tour="market-pools"]',
    heading: 'Live Market Pools',
    body: 'Real-time yield opportunities ARIA is scanning across Mantle protocols. This data drives your returns.',
  },
  {
    selector: '[data-tour="ask-aria"]',
    heading: 'Chat With ARIA',
    body: 'Ask ARIA anything — portfolio strategy, market conditions, or why it made a specific move.',
  },
  {
    selector: '[data-tour="agent-button"]',
    heading: 'Full Agent Mode',
    body: 'Open the full ARIA agent interface for deeper conversations, reminders, and multi-step portfolio commands.',
    action: true,
  },
  {
    selector: 'body',
    heading: "You're All Set",
    body: 'ARIA is actively watching your positions 24/7. Replay this tour anytime from your profile settings.',
  },
];

// ─── Shared sub-components ─────────────────────────────────────────────────

interface WelcomeModalProps {
  onStart: () => void;
  onSkip: () => void;
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({ onStart, onSkip }) => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      zIndex: 100000,
      background: 'rgba(0,0,0,0.55)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      animation: 'wFadeIn 0.35s ease-out forwards',
    }}
  >
    <div
      style={{
        background: 'var(--bg, #ffffff)',
        border: '1px solid var(--border, #E5E7E6)',
        borderRadius: '16px',
        padding: '40px 36px',
        maxWidth: '340px',
        width: '100%',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxShadow: '0 24px 60px rgba(0,0,0,0.16)',
      }}
    >
      {/* Logo mark */}
      <div
        style={{
          width: 60,
          height: 60,
          borderRadius: '50%',
          border: '1px solid var(--border, #E5E7E6)',
          background: 'var(--bg-soft, #F8F8F6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <span style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 700, color: 'var(--text-primary, #0F1110)' }}>
          A
        </span>
      </div>

      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: 'var(--text-primary, #0F1110)', margin: '0 0 10px' }}>
        Welcome to ARIA
      </h2>
      <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 13, color: 'var(--text-secondary, #6B6F6C)', lineHeight: 1.65, margin: '0 0 28px' }}>
        Before you begin, would you like a quick tour of how ARIA's intelligence engine works?
      </p>

      <button
        onClick={onStart}
        style={{
          width: '100%',
          padding: '12px',
          background: '#95A395',
          color: '#ffffff',
          border: 'none',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: 600,
          cursor: 'pointer',
          marginBottom: '10px',
        }}
      >
        Show me around
      </button>
      <button
        onClick={onSkip}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '13px',
          color: 'var(--text-secondary, #6B6F6C)',
          textDecoration: 'underline',
          textUnderlineOffset: '3px',
          padding: '8px',
        }}
      >
        Skip tour
      </button>
    </div>

    <style>{`
      @keyframes wFadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
    `}</style>
  </div>
);

// ─── Inner tour overlay ────────────────────────────────────────────────────

interface TourOverlayProps {
  steps: TourStep[];
  storageKey: string;
}

const TourOverlay: React.FC<TourOverlayProps> = ({ steps, storageKey }) => {
  const {
    isActive,
    showWelcome,
    currentStepIndex,
    totalSteps,
    currentStep,
    targetRect,
    hasArrived,
    startTour,
    skip,
    next,
    back,
    restart,
  } = useTour(steps, storageKey);

  // Listen for the global replay event dispatched by the TopNav button
  useEffect(() => {
    const handler = () => restart();
    window.addEventListener('aria-replay-tour', handler);
    return () => window.removeEventListener('aria-replay-tour', handler);
  }, [restart]);

  if (showWelcome) return <WelcomeModal onStart={startTour} onSkip={skip} />;
  if (!isActive || !targetRect) return null;

  const isBodyStep = currentStep.selector === 'body';

  return (
    <>
      {/* Highlight ring around target element */}
      {!isBodyStep && (
        <div
          style={{
            position: 'fixed',
            zIndex: 99997,
            pointerEvents: 'none',
            borderRadius: '8px',
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            border: '2px solid #95A395',
            boxShadow: '0 0 0 4px #95A39530',
            opacity: hasArrived ? 1 : 0,
            transition: 'top 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), left 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), width 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), height 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 0.3s ease-out',
          }}
        />
      )}

      <TourCursor
        x={targetRect.cx}
        y={targetRect.cy}
        hasArrived={hasArrived}
        actionTriggered={currentStep.action}
      />

      <TourTooltip
        heading={currentStep.heading}
        body={currentStep.body}
        currentStep={currentStepIndex + 1}
        totalSteps={totalSteps}
        onNext={next}
        onBack={back}
        onFinish={skip}
        onSkip={skip}
        x={targetRect.cx}
        y={targetRect.cy}
        visible={hasArrived}
      />
    </>
  );
};

// ─── Public component ──────────────────────────────────────────────────────

const OnboardingTour: React.FC = () => {
  const { isConnected } = useAccount();

  // When wallet connects, mark the landing tour complete so it doesn't restart
  // if the user later disconnects, and so the dashboard tour doesn't fire on
  // top of the wallet connection flow.
  useEffect(() => {
    if (isConnected) {
      localStorage.setItem('aria-landing-tour-complete', 'true');
    }
  }, [isConnected]);

  return isConnected ? (
    <TourOverlay steps={DASHBOARD_STEPS} storageKey="aria-tour-complete" />
  ) : (
    <TourOverlay steps={LANDING_STEPS} storageKey="aria-landing-tour-complete" />
  );
};

export default OnboardingTour;
