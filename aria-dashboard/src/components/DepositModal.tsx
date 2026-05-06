import React, { useState } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { formatUnits, parseUnits, type Address } from 'viem';
import { useDeposit, useTokenBalance } from '../hooks/useARIAVault';
import { TOKEN_ADDRESSES, SUPPORTED_TOKENS, type SupportedToken } from '../contracts/addresses';

interface DepositModalProps {
  onClose: () => void;
}

const DepositModal: React.FC<DepositModalProps> = ({ onClose }) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const [selectedToken, setSelectedToken] = useState<SupportedToken>('USDY');
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'idle' | 'approving' | 'depositing' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const tokenAddr = (TOKEN_ADDRESSES[chainId]?.[selectedToken] ?? '0x0000000000000000000000000000000000000000') as Address;
  const { approveAndDeposit, isPending } = useDeposit();
  const { data: walletBalance } = useTokenBalance(selectedToken, address);

  const formattedBalance = walletBalance !== undefined
    ? parseFloat(formatUnits(walletBalance as bigint, 18)).toFixed(4)
    : '—';

  const handleMax = () => {
    if (walletBalance !== undefined) {
      setAmount(formatUnits(walletBalance as bigint, 18));
    }
  };

  const vaultDeployed = tokenAddr !== '0x0000000000000000000000000000000000000000';

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    if (!vaultDeployed) {
      setStep('error');
      setErrorMsg('Vault not deployed on this network. Switch to Mantle Mainnet or Sepolia.');
      return;
    }
    setErrorMsg('');
    try {
      setStep('approving');
      await approveAndDeposit(selectedToken, tokenAddr, parseUnits(amount, 18));
      setStep('done');
    } catch (err: unknown) {
      setStep('error');
      setErrorMsg(err instanceof Error ? err.message : 'Transaction failed');
    }
  };

  const isLoading = step === 'approving' || step === 'depositing' || isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card border border-soft rounded-sm w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-serif text-xl text-text-primary">Deposit</h2>
          <button
            onClick={onClose}
            className="text-text-secondary hover:text-text-primary transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {step === 'done' ? (
          <div className="text-center py-8">
            <div className="text-accent text-4xl mb-3">✓</div>
            <p className="text-text-primary font-medium">Deposit successful</p>
            <p className="text-text-secondary text-sm mt-1">
              {amount} {selectedToken} added to your vault
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full py-3 bg-accent text-white font-semibold rounded-sm hover:opacity-90 transition-opacity"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Token selector */}
            <div className="mb-4">
              <label className="text-xs font-semibold tracking-wide text-text-secondary uppercase mb-2 block">
                Asset
              </label>
              <div className="flex border border-soft rounded-sm overflow-hidden">
                {SUPPORTED_TOKENS.map((t) => (
                  <button
                    key={t}
                    onClick={() => { setSelectedToken(t); setAmount(''); }}
                    className={`flex-1 py-2 text-sm font-medium transition-colors ${
                      selectedToken === t
                        ? 'bg-accent text-white'
                        : 'bg-card text-text-secondary hover:bg-bg-soft'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount input */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold tracking-wide text-text-secondary uppercase">
                  Amount
                </label>
                <span className="text-xs text-text-secondary">
                  Balance: {formattedBalance} {selectedToken}
                </span>
              </div>
              <div className="flex items-center border border-soft rounded-sm overflow-hidden">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="flex-1 bg-card text-text-primary px-4 py-3 outline-none text-sm"
                />
                <button
                  onClick={handleMax}
                  className="px-3 py-3 text-xs font-semibold text-accent hover:opacity-80 border-l border-soft"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Step indicator */}
            {step !== 'idle' && step !== 'error' && (
              <div className="mb-4 flex items-center gap-3 text-sm text-text-secondary">
                <span className={step === 'approving' ? 'text-accent font-medium' : 'text-text-secondary'}>
                  1. Approve
                </span>
                <span className="text-text-secondary">→</span>
                <span className={step === 'depositing' ? 'text-accent font-medium' : 'text-text-secondary'}>
                  2. Deposit
                </span>
              </div>
            )}

            {step === 'error' && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-sm">
                <p className="text-xs text-red-600 dark:text-red-400 break-words">{errorMsg}</p>
              </div>
            )}

            {!vaultDeployed && (
              <p className="mb-4 text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-sm px-3 py-2">
                Vault not deployed on this network. Switch to Mantle to deposit.
              </p>
            )}
            <button
              onClick={handleDeposit}
              disabled={isLoading || !amount || parseFloat(amount) <= 0 || !vaultDeployed}
              className="w-full py-3 bg-accent text-white font-semibold rounded-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading
                ? step === 'approving'
                  ? 'Approving…'
                  : 'Depositing…'
                : `Deposit ${selectedToken}`}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DepositModal;
