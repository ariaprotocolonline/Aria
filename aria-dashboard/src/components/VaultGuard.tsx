import React, { useState, useEffect, useCallback, useRef } from 'react';
import { type Address, zeroAddress } from 'viem';
import { useAccount } from 'wagmi';
import { useVaultFactory } from '../hooks/useVaultFactory';

interface VaultGuardProps {
  children: (vaultAddress: Address) => React.ReactNode;
}

const VaultGuard: React.FC<VaultGuardProps> = ({ children }) => {
  const { address } = useAccount();
  const { userVaultAddress, hasVault, createVault, isPending, factoryDeployed } = useVaultFactory();
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const hasTriggered = useRef(false);

  // Reset trigger guard when the connected address changes
  useEffect(() => {
    hasTriggered.current = false;
    setFailed(false);
  }, [address]);

  const attemptCreate = useCallback(async () => {
    setFailed(false);
    setCreating(true);
    try {
      await createVault();
    } catch (err) {
      console.error('Vault creation failed:', err);
      setFailed(true);
    } finally {
      setCreating(false);
    }
  }, [createVault]);

  useEffect(() => {
    if (
      address &&
      factoryDeployed &&
      hasVault === false &&
      !isPending &&
      !creating &&
      !failed &&              // don't retry after a failure/denial
      !hasTriggered.current  // fire at most once per connected address
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
            You need a small amount of MNT for gas to create your vault.
            Get free testnet MNT at <strong>faucet.testnet.mantle.xyz</strong>, then tap retry.
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

      {children(vaultAddress)}
    </>
  );
};

export default VaultGuard;
