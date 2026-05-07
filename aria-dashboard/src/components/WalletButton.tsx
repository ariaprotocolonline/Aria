import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';

const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const btnStyle: React.CSSProperties = {
  background: '#95A395',
  color: '#FFFFFF',
  fontFamily: 'Syne, sans-serif',
  fontWeight: 700,
  borderRadius: '10px',
  border: 'none',
  padding: '6px 10px',
  cursor: 'pointer',
  fontSize: '12px',
  lineHeight: 1,
  whiteSpace: 'nowrap',
  WebkitAppearance: 'none',
  touchAction: 'manipulation',
};

const WalletButton = () => {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
        const connected = mounted && account && chain;

        return (
          <div
            {...(!mounted && {
              'aria-hidden': true,
              style: { opacity: 0, pointerEvents: 'none', userSelect: 'none' },
            })}
          >
            {!connected ? (
              <button onClick={openConnectModal} style={btnStyle} type="button">
                Connect Wallet
              </button>
            ) : (
              <button onClick={openAccountModal} style={btnStyle} type="button">
                {account.ensName ?? truncate(account.address)}
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
};

export default WalletButton;
