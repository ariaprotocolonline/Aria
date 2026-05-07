import React from 'react';
import ReactDOM from 'react-dom/client';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import { wagmiConfig } from './wagmi';
import App from './App.tsx';
import './index.css';

const queryClient = new QueryClient();

const ariaTheme = lightTheme({
  accentColor: '#95A395',
  accentColorForeground: '#FFFFFF',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'small',
});

const root = ReactDOM.createRoot(document.getElementById('root')!);

root.render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={ariaTheme}>
          <App />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);

// Hide splash after React's first paint
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    (window as { __hideSplash?: () => void }).__hideSplash?.();
  });
});
