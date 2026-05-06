import React, { useState, useEffect, useCallback } from 'react';
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

  const attemptCreate = useCallback(async () => {
    setFailed(false);
    setCreating(true);
    try {
      await createVault();
    } catch (err) {
      console.error('Silent vault creation failed:', err);
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
      !creating
    ) {
      attemptCreate();
    }
  }, [address, hasVault, factoryDeployed, isPending, creating, attemptCreate]);

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
          {/* Spinner */}
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
        <button
          onClick={attemptCreate}
          style={{
            position: 'fixed',
            bottom: 20,
            left: 20,
            zIndex: 9999,
            background: 'var(--bg, #ffffff)',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            padding: '10px 16px',
            fontFamily: 'Arial, sans-serif',
            fontSize: 12,
            color: '#dc2626',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>⚠</span>
          <span>Vault setup failed. Tap to retry.</span>
        </button>
      )}

      <style>{`@keyframes aria-spin { to { transform: rotate(360deg); } }`}</style>

      {children(vaultAddress)}
    </>
  );
};

export default VaultGuard;
