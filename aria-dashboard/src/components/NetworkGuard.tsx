import React from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { mantleMainnet, mantleTestnet } from '../wagmi';

const SUPPORTED_CHAIN_IDS: number[] = [mantleMainnet.id, mantleTestnet.id];

const NetworkGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending } = useSwitchChain();

  const isWrongNetwork = isConnected && !SUPPORTED_CHAIN_IDS.includes(chainId);

  if (!isWrongNetwork) return <>{children}</>;

  return (
    <>
      {children}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="max-w-md w-full mx-6 border border-soft bg-card rounded-sm p-8 text-center shadow-2xl">
          <div className="w-2 h-2 bg-yellow-400 rounded-full mx-auto mb-6 animate-pulse" />
          <h2 className="font-serif text-2xl text-text-primary mb-3">Wrong Network</h2>
          <p className="text-text-secondary text-sm mb-6 leading-relaxed">
            ARIA operates on Mantle. Please switch your wallet to{' '}
            <strong className="text-text-primary">Mantle Mainnet</strong> or{' '}
            <strong className="text-text-primary">Mantle Sepolia</strong> to continue.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => switchChain({ chainId: mantleMainnet.id })}
              disabled={isPending}
              className="w-full py-3 bg-accent text-white font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50 text-sm"
            >
              {isPending ? 'Switching…' : 'Switch to Mantle Mainnet'}
            </button>
            <button
              onClick={() => switchChain({ chainId: mantleTestnet.id })}
              disabled={isPending}
              className="w-full py-3 border border-soft text-text-primary font-medium rounded-sm hover:bg-bg-soft transition-colors disabled:opacity-50 text-sm"
            >
              {isPending ? 'Switching…' : 'Switch to Mantle Sepolia (Testnet)'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default NetworkGuard;
