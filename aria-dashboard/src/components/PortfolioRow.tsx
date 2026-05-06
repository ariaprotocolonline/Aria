import React, { useState } from 'react';
import { RiskProfile } from '../services/claude';
import { usePortfolioData } from '../hooks/usePortfolioData';
import DepositModal from './DepositModal';
import WithdrawModal from './WithdrawModal';

interface PortfolioRowProps {
  riskProfile: RiskProfile;
  setRiskProfile: (rp: RiskProfile) => void;
  blendedApy?: number | null;
}

const RISK_COLORS: Record<RiskProfile, { activeBg: string; activeText: string; activeBorder: string }> = {
  Conservative: { activeBg: '#003C33', activeText: '#5EE0B2', activeBorder: '#5EE0B2' },
  Balanced:     { activeBg: '#003C33', activeText: '#7FE5C2', activeBorder: '#7FE5C2' },
  Aggressive:   { activeBg: '#003C33', activeText: '#BFE6D8', activeBorder: '#BFE6D8' },
};

const PortfolioRow: React.FC<PortfolioRowProps> = ({ riskProfile, setRiskProfile, blendedApy }) => {
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);

  const {
    address,
    vaultDeployed,
    usdyDisplay,
    methDisplay,
    nativeDisplay,
    nativeSymbol,
    nativeLoading,
    totalUsd,
  } = usePortfolioData();

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);

  const currentApy = blendedApy != null
    ? `${blendedApy.toFixed(1)}%`
    : riskProfile === 'Conservative' ? '6.4%' : riskProfile === 'Balanced' ? '12.8%' : '24.5%';

  const label = vaultDeployed ? 'Vault Balance' : 'Wallet Balance';

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 py-8 border-b border-soft">
        {/* Total Position Value */}
        <div data-tour="vault-balance" className="flex flex-col justify-between p-6 bg-card border border-soft rounded-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold tracking-wide text-text-secondary uppercase">
              {label}
            </span>
            {!vaultDeployed && (
              <span className="text-[10px] font-mono text-text-secondary border border-soft rounded px-1.5 py-0.5 uppercase tracking-wider">
                Testnet
              </span>
            )}
          </div>
          <h2 className="font-serif text-4xl text-text-primary tracking-tight mb-4">
            {formatCurrency(totalUsd)}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowDeposit(true)}
              className="flex-1 py-2 text-sm font-semibold bg-accent text-white rounded-sm hover:opacity-90 transition-opacity"
            >
              Deposit
            </button>
            <button
              data-tour="withdraw-btn"
              onClick={() => setShowWithdraw(true)}
              className="flex-1 py-2 text-sm font-semibold border border-soft text-text-primary rounded-sm hover:bg-bg-soft transition-colors"
            >
              Withdraw
            </button>
          </div>
        </div>

        {/* Live APY */}
        <div className="flex flex-col justify-center p-6 bg-card border border-soft rounded-sm">
          <span className="text-sm font-semibold tracking-wide text-text-secondary uppercase mb-2">
            Live Blended APY
          </span>
          <h2 className="font-serif text-4xl text-text-primary tracking-tight">{currentApy}</h2>
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between text-xs text-text-secondary">
              <span>USDY</span>
              <span>{usdyDisplay.toFixed(4)}</span>
            </div>
            <div className="flex justify-between text-xs text-text-secondary">
              <span>mETH</span>
              <span>{methDisplay.toFixed(4)}</span>
            </div>
            {!vaultDeployed && address && (
              <div className="flex justify-between text-xs text-text-secondary">
                <span>{nativeSymbol}</span>
                <span>{nativeLoading ? '…' : nativeDisplay.toFixed(4)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Risk Profile Selector */}
        <div className="flex flex-col justify-center p-6 bg-card border border-soft rounded-sm">
          <span className="text-sm font-semibold tracking-wide text-text-secondary uppercase mb-4">
            Risk Mandate
          </span>
          <div className="flex border border-soft rounded-md overflow-hidden">
            {(['Conservative', 'Balanced', 'Aggressive'] as RiskProfile[]).map((rp) => {
              const colors = RISK_COLORS[rp];
              const isActive = riskProfile === rp;
              return (
                <button
                  key={rp}
                  onClick={() => setRiskProfile(rp)}
                  className="flex-1 py-2 text-sm font-medium transition-colors"
                  style={
                    isActive
                      ? { background: colors.activeBg, color: colors.activeText, borderColor: colors.activeBorder }
                      : undefined
                  }
                >
                  {rp}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} />}
      {showWithdraw && <WithdrawModal onClose={() => setShowWithdraw(false)} />}
    </>
  );
};

export default PortfolioRow;
