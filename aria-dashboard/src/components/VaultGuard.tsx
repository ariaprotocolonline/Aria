import React, { useState, useEffect, useCallback, useRef } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useAccount } from 'wagmi';
import { useVaultFactory } from '../hooks/useVaultFactory';
import { useTelegram } from '../hooks/useTelegram';

interface VaultGuardProps {
  children: (vaultAddress: Address) => React.ReactNode;
}

const VaultGuard: React.FC<VaultGuardProps> = ({ children }) => {
  const { address } = useAccount();
  const { userVaultAddress, hasVault, createVault, isPending, factoryDeployed } = useVaultFactory();
  const { status: tgStatus, generateLink } = useTelegram();
  const [failed,       setFailed]       = useState(false);
  const [creating,     setCreating]     = useState(false);
  const [showTgPrompt, setShowTgPrompt] = useState(false);
  const hasTriggered = useRef(false);

  useEffect(() => {
    hasTriggered.current = false;
    setFailed(false);
  }, [address]);

  useEffect(() => {
    if (!failed) return;
    const t = setTimeout(() => setFailed(false), 5000);
    return () => clearTimeout(t);
  }, [failed]);

  const attemptCreate = useCallback(async () => {
    setFailed(false);
    setCreating(true);
    try {
      await createVault();
      if (!localStorage.getItem('aria-telegram-prompted') && !tgStatus.connected) {
        setShowTgPrompt(true);
      }
    } catch (err) {
      console.error('Vault creation failed:', err);
      setFailed(true);
    } finally {
      setCreating(false);
    }
  }, [createVault, tgStatus.connected]);

  useEffect(() => {
    if (
      address &&
      factoryDeployed &&
      hasVault === false &&
      !isPending &&
      !creating &&
      !failed &&
      !hasTriggered.current
    ) {
      hasTriggered.current = true;
      attemptCreate();
    }
  }, [address, hasVault, factoryDeployed, isPending, creating, failed, attemptCreate]);

  const vaultAddress: Address =
    (hasVault && userVaultAddress && userVaultAddress !== zeroAddress)
      ? userVaultAddress
      : zeroAddress;

  const showBanner = factoryDeployed && (creating || isPending) && !failed;

  return (
    <>
      {showBanner && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: 'rgba(149, 163, 149, 0.95)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '8px 16px',
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            style={{ animation: 'aria-spin 0.9s linear infinite', flexShrink: 0 }}
          >
            <circle cx="7" cy="7" r="6" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
            <path d="M7 1a6 6 0 0 1 6 6" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span style={{ fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#ffffff', fontWeight: 500, letterSpacing: '0.02em' }}>
            Setting up your ARIA vault on Mantle…
          </span>
        </div>
      )}

      {failed && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            zIndex: 9999,
            background: 'var(--bg, #ffffff)',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            padding: '12px 16px',
            fontFamily: 'Arial, sans-serif',
            fontSize: 12,
            color: '#dc2626',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            maxWidth: 280,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠ Vault setup failed</div>
          <div style={{ color: '#6b7280', marginBottom: 10, lineHeight: 1.4 }}>
            You need a small amount of MNT in your wallet to cover the gas fee for vault creation.
            Add MNT to your wallet and tap retry.
          </div>
          <button
            onClick={() => {
              hasTriggered.current = false;
              attemptCreate();
            }}
            style={{
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Retry
          </button>
        </div>
      )}

      <style>{`@keyframes aria-spin { to { transform: rotate(360deg); } }`}</style>

      {showTgPrompt && (
        <div style={{
          position:'fixed', bottom:24, right:24, zIndex:9998,
          background:'var(--bg)', border:'1px solid var(--line)',
          borderRadius:12, padding:'18px 20px', maxWidth:300,
          boxShadow:'0 8px 32px rgba(0,0,0,0.18)', fontFamily:'inherit',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            <span style={{ fontWeight:600, fontSize:13, color:'var(--ink)' }}>Connect Telegram</span>
          </div>
          <p style={{ fontSize:12, color:'var(--ink-2)', lineHeight:1.5, margin:'0 0 14px' }}>
            Get notified when ARIA acts on your behalf. Chat with ARIA directly from your phone.
          </p>
          <div style={{ display:'flex', gap:8 }}>
            <button
              style={{
                flex:1, padding:'7px 0', background:'var(--accent)', color:'#0a1b10',
                border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer',
              }}
              onClick={async () => {
                const link = await generateLink();
                if (link) window.open(link, '_blank');
                localStorage.setItem('aria-telegram-prompted', 'true');
                setShowTgPrompt(false);
              }}
            >
              Connect
            </button>
            <button
              style={{
                flex:1, padding:'7px 0', background:'transparent', color:'var(--mute)',
                border:'1px solid var(--line)', borderRadius:7, fontSize:12, cursor:'pointer',
              }}
              onClick={() => {
                localStorage.setItem('aria-telegram-prompted', 'true');
                setShowTgPrompt(false);
              }}
            >
              Maybe later
            </button>
          </div>
        </div>
      )}

      {children(vaultAddress)}
    </>
  );
};

export default VaultGuard;
