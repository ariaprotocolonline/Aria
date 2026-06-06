import { useEffect } from 'react';
import { useDisconnect } from 'wagmi';

export default function ResetPage() {
  const { disconnect } = useDisconnect();

  useEffect(() => {
    disconnect();
    localStorage.clear();
    sessionStorage.clear();
    // Full reload so React re-reads localStorage from scratch (state = false)
    window.location.href = '/onboarding';
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#000', color: '#fff', fontFamily: 'monospace' }}>
      Resetting…
    </div>
  );
}
