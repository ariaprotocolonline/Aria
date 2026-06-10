import { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount, useBalance, useDisconnect, useChainId, useWriteContract } from 'wagmi';
import { formatUnits, parseUnits, type Address } from 'viem';
import { useAgentMemory } from '../hooks/useAgentMemory';
import { useVaultPaused, useVaultAgent, useVaultBalance, useDeposit, useWithdraw, useAddCustomAsset } from '../hooks/useARIAVault';
import { TOKEN_ADDRESSES } from '../contracts/addresses';
import { env } from '../config/env';
import { useTokenPrice } from '../hooks/useTokenPrice';
import { useMarketData } from '../hooks/useMarketData';
import { usePortfolioHistory } from '../hooks/usePortfolioHistory';
import { useTelegram } from '../hooks/useTelegram';
import { useXStockPortfolio } from '../hooks/useXStockPortfolio';

// TradingView public CDN — used by every major trading terminal for stock logos
const XSTOCK_LOGOS: Record<string, string> = {
  TSLAx:  '/assets/logos/tesla.svg',
  NVDAx:  '/assets/logos/nvidia.svg',
  AAPLx:  '/assets/logos/apple.svg',
  METAx:  '/assets/logos/meta.svg',
  GOOGLx: '/assets/logos/alphabet.svg',
  MSTRx:  '/assets/logos/microstrategy.svg',
  HOODx:  '/assets/logos/robinhood.svg',
  SPYx:   '/assets/logos/spy.svg',
  QQQx:   '/assets/logos/invesco.svg',
  CRCLx:  '/assets/logos/circle.svg',
};

function XStockGlyph({ symbol, size = 28 }: { symbol: string; size?: number }) {
  const logo = XSTOCK_LOGOS[symbol];
  const letter = symbol.charAt(0);
  const style: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%',
    background: 'linear-gradient(135deg,#a78bff,#7a4dff)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
  };
  if (!logo) return <span style={style}><span style={{ fontSize: size * 0.4, color: '#fff', fontWeight: 600 }}>{letter}</span></span>;
  return (
    <span style={style}>
      <img
        src={logo}
        alt={symbol}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
        onError={e => {
          const img = e.currentTarget;
          img.style.display = 'none';
          const parent = img.parentElement;
          if (parent) parent.innerHTML = `<span style="font-size:${Math.round(size*0.4)}px;color:#fff;font-weight:600">${letter}</span>`;
        }}
      />
    </span>
  );
}

type View = 'direct' | 'portfolio' | 'performance' | 'activity' | 'markets' | 'profile' | 'settings';
type ActivityPane = 'feed' | 'memory' | 'onchain';
type RiskProfile = 'conservative' | 'balanced' | 'aggressive';

interface FeedItem { ts: string; type: string; body: string; why: string; tag: string; tagClass: string; }

const hhmm = () => {
  const d = new Date();
  return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
};

function fmtAddr(addr?: string) {
  if (!addr) return '—';
  return addr.slice(0,6) + '…' + addr.slice(-4);
}

function fmtBal(val?: bigint, decimals = 18, digits = 4) {
  if (val === undefined || val === null) return (0).toFixed(digits);
  return parseFloat(formatUnits(val, decimals)).toFixed(digits);
}

export default function Dashboard({ vaultAddress }: { vaultAddress?: string }) {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();

  const wethAddrRaw = TOKEN_ADDRESSES[chainId]?.WETH as Address | undefined;
  const usdcAddrRaw = TOKEN_ADDRESSES[chainId]?.USDC as Address | undefined;
  // Fallback to zeroAddress so wagmi types are satisfied; enabled guard prevents the call firing
  const wethAddr = (wethAddrRaw ?? '0x0000000000000000000000000000000000000000') as Address;
  const usdcAddr = (usdcAddrRaw ?? '0x0000000000000000000000000000000000000000') as Address;

  const wethBalance = useBalance({ address, token: wethAddr, query: { enabled: !!address && !!wethAddrRaw, refetchInterval: 15_000 } });
  const usdcBalance = useBalance({ address, token: usdcAddr, query: { enabled: !!address && !!usdcAddrRaw, refetchInterval: 15_000 } });
  const vaultWeth = useVaultBalance('WETH');
  const vaultUsdc = useVaultBalance('USDC');
  const { data: isPausedRaw } = useVaultPaused(vaultAddress as Address | undefined);
  const { data: agentAddrRaw } = useVaultAgent(vaultAddress as Address | undefined);
  const isPaused = isPausedRaw as boolean | undefined;
  const agentAddr = agentAddrRaw as string | undefined;

  const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
  const vaultDeployed = !!vaultAddress && vaultAddress !== ZERO_ADDR;

  const deposit = useDeposit();
  const withdraw = useWithdraw();
  const { writeContractAsync } = useWriteContract();

  const {
    conversations,
    currentConversation,
    sendMessage,
    startNewConversation,
    loadConversation,
    clearAll,
    siweSigningIn,
  } = useAgentMemory();

  // ── UI State ───────────────────────────────────────────────────────────────
  const [view, setView] = useState<View>('portfolio');
  const [actPane, setActPane] = useState<ActivityPane>('feed');
  const [chartRange, setChartRange] = useState('30D');
  const [riskProfile, setRiskProfile] = useState<RiskProfile>(() =>
    (localStorage.getItem('aria-profile') as RiskProfile) || 'balanced'
  );
  const [isDark, setIsDark] = useState(() => localStorage.getItem('aria-theme') !== 'light');
  const [sideOpen, setSideOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [addrCopied, setAddrCopied] = useState(false);
  const [notifRead, setNotifRead] = useState(false);
  const [askCollapsed, setAskCollapsed] = useState(true);
  const [askShowConv, setAskShowConv] = useState(false);
  const [askInput, setAskInput] = useState('');
  const [dlInput, setDlInput] = useState('');
  const [dlTyping, setDlTyping] = useState(false);
  const [slQ, setSlQ] = useState(() => { try { return JSON.parse(localStorage.getItem('aria-thresholds') || '{}').slQ ?? 55; } catch { return 55; } });
  const [slD, setSlD] = useState(() => { try { return JSON.parse(localStorage.getItem('aria-thresholds') || '{}').slD ?? 75; } catch { return 75; } });
  const [slM, setSlM] = useState(() => { try { return JSON.parse(localStorage.getItem('aria-thresholds') || '{}').slM ?? 65; } catch { return 65; } });
  const [perfFee, setPerfFee] = useState(1000);
  const [mgmtFee, setMgmtFee] = useState(50);
  const [agentInput, setAgentInput] = useState('');
  const [depositInput, setDepositInput] = useState('');
  const [withdrawInput, setWithdrawInput] = useState('');
  const [depositToken, setDepositToken] = useState<'WETH' | 'USDC'>('WETH');

  // Custom asset state
  interface CustomPool { id: string; protocol: string; tokenSymbol: string; tokenAddress: string; tokenInSymbol: string; poolAddress: string; routerAddress: string; feeTier: number; apyBps: number; addedAt: string; }
  const [customPools, setCustomPools] = useState<CustomPool[]>([]);
  const [caName, setCaName] = useState('');
  const [caSymbol, setCaSymbol] = useState('');
  const [caToken, setCaToken] = useState('');
  const [caDecimals, setCaDecimals] = useState('18');
  const [caPool, setCaPool] = useState('');
  const [caRouter, setCaRouter] = useState('');
  const [caFee, setCaFee] = useState(500);
  const [caApy, setCaApy] = useState('');
  const [caTokenIn, setCaTokenIn] = useState<'WETH' | 'USDC'>('WETH');
  const [caAdding, setCaAdding] = useState(false);
  const [caError, setCaError] = useState('');
  const [caSuccess, setCaSuccess] = useState('');
  const { addCustomAsset } = useAddCustomAsset();
  const [liveFeed, setLiveFeed] = useState<FeedItem[]>([]);
  const [userName, setUserName] = useState(() => localStorage.getItem('aria-nickname') || 'anon');
  const [filtersCt, setFiltersCt] = useState('all');
  const [marketFilter, setMarketFilter] = useState<'all'|'weth'|'usdc'>('all');
  const [onchainFilter, setOnchainFilter] = useState<'all'|'deposits'|'withdrawals'>('all');
  const [txModal, setTxModal] = useState<null | 'deposit' | 'withdraw'>(null);
  const [txError, setTxError] = useState('');
  const [setAgentPending, setSetAgentPending] = useState(false);
  const [setAgentError, setSetAgentError] = useState('');
  const [setAgentSuccess, setSetAgentSuccess] = useState('');
  const [pausePending, setPausePending] = useState(false);
  const dlThreadRef = useRef<HTMLDivElement>(null);
  const askThreadRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLElement>(null);

  // ── Theme sync ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('aria-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('aria-theme', 'light');
    }
  }, [isDark]);

  // ── body.view-direct ───────────────────────────────────────────────────────
  useEffect(() => {
    document.body.classList.toggle('view-direct', view === 'direct');
  }, [view]);

  // ── Scroll top on view change ──────────────────────────────────────────────
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'auto' });
  }, [view]);

  // ── Scroll DL thread ──────────────────────────────────────────────────────
  useEffect(() => {
    if (dlThreadRef.current) {
      dlThreadRef.current.scrollTop = dlThreadRef.current.scrollHeight;
    }
  }, [currentConversation?.messages, dlTyping]);

  useEffect(() => {
    if (askThreadRef.current) {
      askThreadRef.current.scrollTop = askThreadRef.current.scrollHeight;
    }
  }, [currentConversation?.messages]);

  // ── Live feed polling ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!env.FEED_URL) return;
    const poll = async () => {
      try {
        const r = await fetch(`${env.FEED_URL}/feed`);
        if (r.ok) setLiveFeed(await r.json());
      } catch { /* silent */ }
    };
    poll();
    const id = setInterval(poll, 15000);
    return () => clearInterval(id);
  }, []);

  // ── Load custom pools ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch(`${env.API_URL}/api/pools`)
      .then(r => r.ok ? r.json() : [])
      .then(setCustomPools)
      .catch(() => {});
  }, [caSuccess]);

  // ── Add custom asset ───────────────────────────────────────────────────────
  const handleAddCustomAsset = useCallback(async () => {
    setCaError(''); setCaSuccess('');
    if (!caName || !caToken || !caPool || !caRouter) { setCaError('Fill in all required fields.'); return; }
    if (!/^0x[a-fA-F0-9]{40}$/.test(caToken) || !/^0x[a-fA-F0-9]{40}$/.test(caPool) || !/^0x[a-fA-F0-9]{40}$/.test(caRouter)) {
      setCaError('Token, pool, and router must be valid 0x addresses.'); return;
    }
    setCaAdding(true);
    try {
      // 1. Whitelist on vault contract
      await addCustomAsset(caToken as Address, caRouter as Address);
      // 2. Register pool config with agent
      const session = sessionStorage.getItem(`siwe-session-${address?.toLowerCase()}`);
      await fetch(`${env.API_URL}/api/pools`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session}` } : {}) },
        body: JSON.stringify({
          protocol: caName,
          tokenSymbol: caSymbol || caName,
          tokenAddress: caToken,
          tokenDecimals: parseInt(caDecimals) || 18,
          tokenInAddress: caTokenIn === 'WETH' ? wethAddr : usdcAddr,
          tokenInSymbol: caTokenIn,
          poolAddress: caPool,
          routerAddress: caRouter,
          feeTier: caFee,
          apyBps: Math.round(parseFloat(caApy || '5') * 100),
          addedBy: address,
        }),
      });
      setCaSuccess(`${caName} added to ARIA. The agent will start analyzing it next cycle.`);
      setCaName(''); setCaSymbol(''); setCaToken(''); setCaPool(''); setCaRouter(''); setCaApy('');
    } catch (e) {
      setCaError(e instanceof Error ? e.message : 'Failed to add asset.');
    } finally {
      setCaAdding(false);
    }
  }, [caName, caSymbol, caToken, caDecimals, caPool, caRouter, caFee, caApy, caTokenIn, address, wethAddr, usdcAddr, addCustomAsset]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const copyAddr = useCallback(async () => {
    try { await navigator.clipboard.writeText(address ?? ''); } catch { /* ignore */ }
    setAddrCopied(true);
    setTimeout(() => setAddrCopied(false), 1400);
  }, [address]);

  const handleDlSend = useCallback(async () => {
    const t = dlInput.trim();
    if (!t) return;
    setDlInput('');
    setDlTyping(true);
    if (!currentConversation) startNewConversation();
    await sendMessage(t, buildPortfolioContext());
    setDlTyping(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dlInput, currentConversation, sendMessage, startNewConversation]);

  const handleAskSend = useCallback(async () => {
    const t = askInput.trim();
    if (!t) return;
    setAskInput('');
    await sendMessage(t, buildPortfolioContext());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askInput, sendMessage]);

  const handleDeposit = useCallback(async () => {
    if (!depositInput) return;
    setTxError('');
    try {
      const tokenAddr = depositToken === 'WETH' ? wethAddr : usdcAddr;
      const decimals = depositToken === 'WETH' ? 18 : 6;
      await deposit.approveAndDeposit(depositToken, tokenAddr, parseUnits(depositInput, decimals));
      setDepositInput('');
      setTxModal(null);
      await Promise.all([vaultWeth.refetch(), vaultUsdc.refetch(), wethBalance.refetch(), usdcBalance.refetch()]);
    } catch (e) { setTxError(e instanceof Error ? e.message.slice(0, 90) : 'Transaction failed'); }
  }, [depositInput, depositToken, wethAddr, usdcAddr, deposit, vaultWeth, vaultUsdc, wethBalance, usdcBalance]);

  const handleWithdraw = useCallback(async () => {
    if (!withdrawInput) return;
    setTxError('');
    try {
      const tokenAddr = depositToken === 'WETH' ? wethAddr : usdcAddr;
      const decimals = depositToken === 'WETH' ? 18 : 6;
      await withdraw.withdraw(tokenAddr, parseUnits(withdrawInput, decimals));
      setWithdrawInput('');
      setTxModal(null);
      await Promise.all([vaultWeth.refetch(), vaultUsdc.refetch(), wethBalance.refetch(), usdcBalance.refetch()]);
    } catch (e) { setTxError(e instanceof Error ? e.message.slice(0, 90) : 'Transaction failed'); }
  }, [withdrawInput, depositToken, wethAddr, usdcAddr, withdraw, vaultWeth, vaultUsdc, wethBalance, usdcBalance]);

  const isValidAddr = (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v.trim());

  // Vault ABI fragments for owner-only actions
  const VAULT_WRITE_ABI = [
    { name:'setAgent',  type:'function', inputs:[{name:'newAgent', type:'address'}], outputs:[], stateMutability:'nonpayable' },
    { name:'pause',     type:'function', inputs:[], outputs:[], stateMutability:'nonpayable' },
    { name:'unpause',   type:'function', inputs:[], outputs:[], stateMutability:'nonpayable' },
  ] as const;

  const resolvedVault = (vaultAddress ?? '0x0000000000000000000000000000000000000000') as `0x${string}`;

  const handleSetAgent = useCallback(async () => {
    if (!isValidAddr(agentInput) || !vaultDeployed) return;
    setSetAgentError(''); setSetAgentSuccess(''); setSetAgentPending(true);
    try {
      await writeContractAsync({ address: resolvedVault, abi: VAULT_WRITE_ABI, functionName: 'setAgent', args: [agentInput.trim() as `0x${string}`] });
      setSetAgentSuccess('Agent updated successfully.');
      setAgentInput('');
    } catch (e) {
      setSetAgentError(e instanceof Error ? e.message.slice(0, 80) : 'Transaction failed');
    } finally { setSetAgentPending(false); }
  }, [agentInput, resolvedVault, writeContractAsync]);

  const handlePauseToggle = useCallback(async () => {
    if (!vaultDeployed) return;
    setPausePending(true);
    try {
      await writeContractAsync({ address: resolvedVault, abi: VAULT_WRITE_ABI, functionName: isPaused ? 'unpause' : 'pause' });
    } catch { /* user rejected or failed — no-op */ }
    finally { setPausePending(false); }
  }, [isPaused, resolvedVault, writeContractAsync]);

  const handleExportCSV = useCallback(() => {
    if (liveFeed.length === 0) return;
    const header = 'timestamp,type,body,reason,tag';
    const rows = liveFeed.map(f =>
      [f.ts, f.type, `"${f.body.replace(/"/g,'""')}"`, `"${f.why.replace(/"/g,'""')}"`, f.tag].join(',')
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `aria-activity-${new Date().toISOString().slice(0,10)}.csv`; a.click();
  }, [liveFeed]);

  const switchView = (v: View) => {
    setView(v);
    setSideOpen(false);
  };

  const vaultWethFmt = fmtBal(vaultWeth.data as bigint | undefined, 18, 4);
  const vaultUsdcFmt = fmtBal(vaultUsdc.data as bigint | undefined, 6, 2);
  const wethBalFmt = fmtBal(wethBalance.data?.value, 18, 4);
  const usdcBalFmt = fmtBal(usdcBalance.data?.value, 6, 2);

  const { eth: ethPrice, mnt: mntPrice } = useTokenPrice();
  const { pools: marketPools, loading: marketsLoading, lastUpdated: marketsUpdated } = useMarketData();
  const { status: tgStatus, loading: tgLoading, generateLink: tgGenerateLink, disconnect: tgDisconnect } = useTelegram();
  const [settingsTgLink, setSettingsTgLink] = useState<string | null>(null);
  const [settingsTgErr, setSettingsTgErr]   = useState<string | null>(null);
  useEffect(() => { if (tgStatus.connected) setSettingsTgLink(null); }, [tgStatus.connected]);
  const { positions: xStockPositions, heldPositions: xStockHeld, totalValueUsd: xStockTotalUsd } = useXStockPortfolio();

  const vaultWethNum = parseFloat(vaultWethFmt) || 0;
  const vaultUsdcNum = parseFloat(vaultUsdcFmt) || 0;
  const wethBalNum   = parseFloat(wethBalFmt)   || 0;
  const usdcBalNum   = parseFloat(usdcBalFmt)   || 0;

  // isFetched is never true when a query is disabled — use !isLoading as the fallback
  // so balances show 0.00 immediately instead of —
  const vaultDataLoaded  = (vaultWeth.isFetched  || !vaultWeth.isLoading)  && (vaultUsdc.isFetched  || !vaultUsdc.isLoading);
  const walletDataLoaded = (wethBalance.isFetched || !wethBalance.isLoading) && (usdcBalance.isFetched || !usdcBalance.isLoading);

  const { forRange: portfolioForRange } = usePortfolioHistory(vaultWethNum, vaultUsdcNum, ethPrice, xStockTotalUsd);

  const totalVaultUsd  = vaultWethNum * ethPrice + vaultUsdcNum + xStockTotalUsd;
  const totalWalletUsd = wethBalNum   * ethPrice + usdcBalNum;

  const buildPortfolioContext = (): string => {
    const lines: string[] = [
      `LIVE VAULT BALANCES (authoritative — do not invent numbers outside these):`,
      `  WETH in vault: ${vaultWethFmt} WETH`,
      `  USDC in vault: ${vaultUsdcFmt} USDC`,
      `  Total vault value: ~$${totalVaultUsd.toFixed(2)} USD`,
      `  Wallet WETH: ${wethBalFmt} WETH`,
      `  Wallet USDC: ${usdcBalFmt} USDC`,
      `  ETH price: $${ethPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      `  Vault status: ${isPaused ? 'paused' : 'active'}`,
    ];
    if (xStockHeld.length > 0) {
      lines.push(`  xStock positions:`);
      xStockHeld.forEach(p => lines.push(`    ${p.symbol}: ${p.balanceHuman.toFixed(4)} (≈$${p.valueUsd.toFixed(2)})`));
    } else {
      lines.push(`  xStock positions: none held`);
    }
    return lines.join('\n');
  };

  // Show '—' only while data is still loading. Once fetched, show $0.00 for genuine zero balances.
  const fmtUsd = (v: number, loaded = true) =>
    !loaded ? '—' :
    v >= 1_000_000 ? `$${(v/1_000_000).toFixed(2)}M` :
    v >= 1_000     ? `$${(v/1_000).toFixed(1)}k` :
                     `$${v.toFixed(2)}`;

  // Allocation ring: WETH arc vs USDC arc, full circumference = 2π*40 ≈ 251.33
  const RING_CIRC = 251.33;
  const wethValueUsd = vaultWethNum * ethPrice;
  const ringTotal = wethValueUsd + vaultUsdcNum;
  const wethArc = ringTotal > 0 ? (wethValueUsd / ringTotal) * RING_CIRC : RING_CIRC / 2;
  const usdcArc = RING_CIRC - wethArc;

  // ── Render helpers ─────────────────────────────────────────────────────────
  const NavItem = ({ v, icon, label, badge, dataTour }: { v?: View; icon: React.ReactNode; label: React.ReactNode; badge?: React.ReactNode; dataTour?: string }) => (
    <a
      className={`nav-it${v && view === v ? ' active' : ''}${v === 'direct' ? ' it-direct' : ''}`}
      onClick={e => { e.preventDefault(); if (v) switchView(v); }}
      style={{ cursor: 'pointer' }}
      data-tour={dataTour}
    >
      {icon}{label}{badge}
    </a>
  );

  return (
    <div className={`app`}>

      {/* ====== TOP BAR ====== */}
      <header className="top">
        <a
          className={`brand${sideOpen ? ' open' : ''}`}
          onClick={e => {
            if (window.matchMedia('(max-width: 960px)').matches) {
              e.preventDefault();
              setSideOpen(s => !s);
            }
          }}
          href="/"
        >
          <span className="brand-mark"><img src="/logo.png" alt="ARIA" /></span>
          ARIA
        </a>
        <span className="top-sep" />
        <div className="search">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="7" cy="7" r="4.5"/><path d="m10.5 10.5 3 3"/></svg>
          <input type="text" placeholder="Search pools, protocols, txs…" aria-label="Search" />
          <span className="kbd">⌘K</span>
        </div>

        <div className="top-right">
          {/* Wallet chip */}
          <div className={`wallet-wrap${walletOpen ? ' open' : ''}`} data-tour="wallet-button">
            <button className="chip" onClick={e => { e.stopPropagation(); setNotifOpen(false); setWalletOpen(o => !o); }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="2" y="4" width="12" height="8" rx="1.5"/>
                <path d="M2 7h12"/>
              </svg>
              <span className="name">{fmtAddr(address)}</span>
              <span className="chip-eth">{wethBalFmt} ETH</span>
            </button>
            {walletOpen && (
              <div className="wallet-pop" style={{ opacity: 1, transform: 'translateY(0)', pointerEvents: 'auto' }}>
                <div className="wp-head">
                  <div className="wp-ident">
                    <div className="wp-avatar" />
                    <div>
                      <div className="wp-addr">{fmtAddr(address)}</div>
                      <div className="wp-net"><span className="d" />Mantle, connected</div>
                    </div>
                  </div>
                  <button className={`wp-icon${addrCopied ? ' copied' : ''}`} onClick={copyAddr} title="Copy address">
                    {addrCopied
                      ? <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l3 3 7-7"/></svg>
                      : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="5" width="8" height="8" rx="1.5"/><path d="M3 11V4a1 1 0 011-1h7"/></svg>
                    }
                  </button>
                </div>
                <div className="wp-bal">
                  <div className="wp-bal-row"><span className="wp-bal-l">WETH</span><span className="wp-bal-v">{wethBalFmt}</span></div>
                  <div className="wp-bal-row"><span className="wp-bal-l">USDC</span><span className="wp-bal-v">{usdcBalFmt}</span></div>
                </div>
                <div className="wp-actions">
                  <a className="wp-link" href={`${env.MANTLE_EXPLORER_URL}/address/${address}`} target="_blank" rel="noopener">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 3h4v4M7 9l6-6M11 9v3a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1h3"/></svg>
                    View on Mantle Explorer
                  </a>
                  <button className="wp-disc" onClick={() => { disconnect(); setWalletOpen(false); }}>
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 3h2a1 1 0 011 1v8a1 1 0 01-1 1h-2"/><path d="M7 5L4 8l3 3M4 8h7"/></svg>
                    Disconnect wallet
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Theme toggle */}
          <button className="icon-btn" onClick={() => setIsDark(d => !d)} title="Toggle theme">
            {isDark
              ? <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13 9.5A5.5 5.5 0 016.5 3a5.5 5.5 0 100 11A5.5 5.5 0 0013 9.5z"/></svg>
              : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41"/></svg>
            }
          </button>

          {/* Notifications */}
          <div className={`notif-wrap${notifOpen ? ' open' : ''}`}>
            <button className="icon-btn" onClick={e => { e.stopPropagation(); setWalletOpen(false); setNotifOpen(o => !o); }} title="Notifications">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6.5a4.5 4.5 0 019 0V10l1 1.5H2l1-1.5z"/><path d="M6 13a2 2 0 004 0"/></svg>
              <span className={`badge${notifRead || liveFeed.length === 0 ? ' hidden' : ''}`} />
            </button>
            {notifOpen && (
              <div className="notif-pop" style={{ opacity: 1, transform: 'translateY(0)', pointerEvents: 'auto' }}>
                <div className="np-head">
                  <div>
                    <div className="np-title">From <em>ARIA</em></div>
                    <div className="np-sub">
                      <span className="d" />
                      {notifRead || liveFeed.length === 0 ? 'all caught up' : <><b>{liveFeed.length}</b> events · live</>}
                    </div>
                  </div>
                  <button className="np-mark" onClick={() => setNotifRead(true)}>Mark all read</button>
                </div>
                <div className="np-list">
                  {liveFeed.length > 0 ? liveFeed.slice(0, 5).map((item, i) => (
                    <button key={i} className={`np-row ${item.tagClass || item.type}`} onClick={() => { setNotifRead(true); setNotifOpen(false); switchView('activity'); }}>
                      <span className="np-ic">
                        {item.type === 'exec' || item.tagClass === 'exec'
                          ? <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                          : item.type === 'warn' || item.tagClass === 'warn'
                          ? <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2L14 13H2z"/><path d="M8 6v3M8 11v.5"/></svg>
                          : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/><path d="M8 4v4l2 2"/></svg>
                        }
                      </span>
                      <div className="np-body">
                        <div className="np-t">{item.body}</div>
                        <div className="np-m">{item.why}</div>
                        <div className="np-foot"><span className="np-ts">{item.ts}</span><span className={`np-tag ${item.tagClass || ''}`}>{item.tag}</span></div>
                      </div>
                    </button>
                  )) : (
                    <div style={{ padding: '20px 16px', color: 'var(--mute)', fontSize: 13, textAlign: 'center' }}>
                      No events yet.<br />
                      <span style={{ fontSize: 11, fontFamily: 'var(--mono)' }}>{env.FEED_URL ? 'Waiting for agent…' : 'Set VITE_FEED_URL to enable live events.'}</span>
                    </div>
                  )}
                </div>
                <div className="np-actions">
                  <a className="np-link" onClick={() => { setNotifOpen(false); switchView('activity'); }} style={{ cursor: 'pointer' }}>View all activity →</a>
                  <a className="np-link mute" onClick={() => { setNotifOpen(false); switchView('settings'); }} style={{ cursor: 'pointer' }}>Notification settings</a>
                </div>
              </div>
            )}
          </div>

          {/* Settings btn */}
          <button className="icon-btn" onClick={() => switchView('settings')} title="Settings">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2"/><path d="M13 8a5 5 0 00-.1-1l1.4-1.1-1.5-2.5L11 4a5 5 0 00-1.7-1L9 1.5H7l-.3 1.5A5 5 0 005 4l-1.7-.6-1.5 2.5L3.1 7A5 5 0 003 8c0 .3 0 .7.1 1L1.7 10.1l1.5 2.5L5 12a5 5 0 001.7 1L7 14.5h2l.3-1.5A5 5 0 0011 12l1.7.6 1.5-2.5L12.9 9c.1-.3.1-.6.1-1z"/></svg>
          </button>
        </div>
      </header>

      {/* Mobile sidebar backdrop */}
      {sideOpen && <div className="side-backdrop show" onClick={() => setSideOpen(false)} />}

      {/* ====== SIDEBAR ====== */}
      <aside className={`side${sideOpen ? ' open' : ''}`}>
        <div className="grp">Vault</div>
        <NavItem v="direct" icon={
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle className="pulse" cx="8" cy="8" r="3" stroke="currentColor" fill="none" opacity="0.5"/>
            <circle cx="8" cy="8" r="2" fill="currentColor"/>
            <path d="M2.5 8a5.5 5.5 0 011-3M13.5 8a5.5 5.5 0 00-1-3M2.5 8a5.5 5.5 0 001 3M13.5 8a5.5 5.5 0 01-1 3"/>
          </svg>
        } label="ARIA" badge={<span className="pct" style={{ color: 'var(--accent)' }}>live</span>} dataTour="agent-button" />
        <NavItem v="portfolio" icon={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2.5" y="3" width="11" height="10" rx="1.5"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>} label="Portfolio" />
        <NavItem v="performance" icon={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2.5 13l4-6 3 4 4-7"/></svg>} label="Performance" />
        <NavItem v="activity" icon={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10v8H3z"/><path d="M3 7h10M6 4v8"/></svg>} label="Activity" />
        <NavItem v="markets" icon={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/><path d="M3.5 8h9M8 2.5v11"/></svg>} label="Markets" />

        <div className="grp">Allocations</div>
        <a className="nav-it" style={{ cursor: 'default' }}>
          <span style={{ width:15,height:15,borderRadius:4,background:'linear-gradient(135deg,#75e5b0,#4dd394)', display:'inline-block' }} />
          WETH <span className="pct">{vaultWethFmt} ETH</span>
        </a>
        <a className="nav-it" style={{ cursor: 'default' }}>
          <span style={{ width:15,height:15,borderRadius:4,background:'linear-gradient(135deg,#8ec5ff,#5a8ed8)', display:'inline-block' }} />
          USDC <span className="pct">{vaultUsdcFmt}</span>
        </a>

        <div className="grp">Account</div>
        <NavItem v="profile" icon={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 13.5c.7-2.4 2.5-4 5-4s4.3 1.6 5 4"/><circle cx="8" cy="5.5" r="2.5"/></svg>} label="Profile" />
        <NavItem v="settings" icon={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2"/><path d="M13 8a5 5 0 00-.1-1l1.4-1.1-1.5-2.5L11 4a5 5 0 00-1.7-1L9 1.5H7l-.3 1.5A5 5 0 005 4l-1.7-.6-1.5 2.5L3.1 7A5 5 0 003 8c0 .3 0 .7.1 1L1.7 10.1l1.5 2.5L5 12a5 5 0 001.7 1L7 14.5h2l.3-1.5A5 5 0 0011 12l1.7.6 1.5-2.5L12.9 9c.1-.3.1-.6.1-1z"/></svg>} label="Settings" />

        <div className="side-profile">
          <div className="lbl">Active profile</div>
          <div className="nm">{riskProfile.charAt(0).toUpperCase() + riskProfile.slice(1)}</div>
          <div className="rng">Target <b>{riskProfile === 'conservative' ? '6–9%' : riskProfile === 'balanced' ? '9–14%' : '14–25%+'} APY</b></div>
          <button className="btn-tiny" onClick={() => switchView('profile')}>Change profile</button>
        </div>
      </aside>

      {/* ====== MAIN ====== */}
      <main ref={mainRef} className="main" onClick={() => { setNotifOpen(false); setWalletOpen(false); }}>

        {/* ============ DIRECT LINE VIEW ============ */}
        <section className={`view${view === 'direct' ? ' active' : ''}`} data-view="direct">
          <div className="dl-head">
            <div>
              <h1><em>ARIA</em></h1>
              <div className="sub"><span className="d" />online, {env.FEED_URL ? 'live' : 'ready'}</div>
            </div>
            <div className="h-actions">
              <button className="btn" onClick={() => clearAll()}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 5l6 6M11 5l-6 6"/></svg>
                Clear memory
              </button>
            </div>
          </div>

          <div className="dl-grid">
            {/* Left rail */}
            <aside className="dl-rail">
              <div className="dl-rail-head">
                <span className="ttl">Conversations</span>
                <button className="new" onClick={startNewConversation} title="New conversation">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 3v10M3 8h10"/></svg>
                </button>
              </div>
              <div className="dl-rail-list">
                {conversations.length === 0 && (
                  <div style={{ padding: '12px 10px', color: 'var(--mute)', fontSize: 12 }}>No conversations yet</div>
                )}
                {conversations.map(conv => (
                  <div
                    key={conv.id}
                    className={`dl-rail-row${currentConversation?.id === conv.id ? ' on' : ''}`}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <div>
                      <div className="t">{conv.title}</div>
                      <div className="m">{conv.messages.length} msgs</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="dl-rail-foot">
                <span>{conversations.reduce((a,c) => a + c.messages.length, 0)} entries in memory</span>
                <span>active</span>
              </div>
            </aside>

            {/* Main thread */}
            <section className="dl-main">
              <div className="dl-thread" ref={dlThreadRef}>
                {!currentConversation && (
                  <div className="dl-msg aria">
                    <div className="role">aria, {hhmm()}</div>
                    <div className="text">Hi. I'm managing your vault on Mantle. Ask me anything about your positions, past moves, or to explain a decision.</div>
                  </div>
                )}
                {currentConversation?.messages.map((msg, i) => (
                  <div key={i} className={`dl-msg ${msg.role}`}>
                    <div className="role">{msg.role === 'aria' ? 'aria' : userName}, {msg.timestamp}</div>
                    <div className="text">{msg.content}</div>
                  </div>
                ))}
                {dlTyping && (
                  <div className="dl-msg aria">
                    <div className="role">aria, {hhmm()}</div>
                    <div className="dl-typing"><i/><i/><i/></div>
                  </div>
                )}
              </div>

              <div className="dl-foot">
                <div className="dl-prompts">
                  <span className="p" onClick={() => { setDlInput("Summarize today's moves"); }}>Summarize today's moves</span>
                  <span className="p" onClick={() => setDlInput('What is my best 30d position?')}>What's my best 30d position?</span>
                  <span className="p" onClick={() => setDlInput('Switch profile to Conservative')}>Switch to Conservative</span>
                  <span className="p" onClick={() => setDlInput('Explain my fees this week')}>Explain my fees this week</span>
                </div>
                <div className="dl-input">
                  <input
                    type="text"
                    placeholder="Talk to ARIA, ask, instruct, or test a hypothetical…"
                    value={dlInput}
                    onChange={e => setDlInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleDlSend(); } }}
                  />
                  <button className="send" onClick={handleDlSend}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                  </button>
                </div>
                <div className="dl-meta">
                  <span className="rl">
                    {siweSigningIn
                      ? <span style={{ color: 'var(--warm)', fontStyle: 'italic' }}>Check your wallet. A signing request is pending...</span>
                      : 'Direct line to ARIA'
                    }
                  </span>
                  <span>Enter to send, Shift+Enter for newline</span>
                </div>
              </div>
            </section>
          </div>
        </section>

        {/* ============ PORTFOLIO VIEW ============ */}
        <section className={`view${view === 'portfolio' ? ' active' : ''}`} data-view="portfolio">

          <div className="greet">
            <div>
              <h1>Good morning, <em><span>{userName}</span>.</em></h1>
              <div className="sub">Vault deployed on Mantle · <b>{vaultWethFmt} WETH + {vaultUsdcFmt} USDC</b></div>
            </div>
            <div className="actions">
              <button className="btn" data-tour="withdraw-btn" onClick={() => { setDepositToken('WETH'); setWithdrawInput(''); setTxError(''); setTxModal('withdraw'); }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2v9M4 7l4 4 4-4M3 14h10"/></svg>
                Withdraw
              </button>
              <button className="btn primary" onClick={() => { setDepositToken('WETH'); setDepositInput(''); setTxError(''); setTxModal('deposit'); }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 13V4M4 8l4-4 4 4M3 2h10"/></svg>
                Deposit
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div className="kpis">
            <div className="kpi lead" data-tour="vault-balance">
              <div className="k">Total vault value</div>
              <div className="v">{fmtUsd(totalVaultUsd, vaultDataLoaded)}</div>
              <div className="d">
                <span className="lbl">
                  {vaultWethFmt} WETH · {vaultUsdcFmt} USDC
                  {xStockHeld.length > 0 && ` · ${xStockHeld.length} xStock${xStockHeld.length > 1 ? 's' : ''}`}
                </span>
              </div>
            </div>
            <div className="kpi">
              <div className="k">Wallet balance</div>
              <div className="v up">{fmtUsd(totalWalletUsd, walletDataLoaded)}</div>
              <div className="d"><span className="lbl">{wethBalFmt} WETH · {usdcBalFmt} USDC</span></div>
            </div>
            <div className="kpi">
              <div className="k">MNT price</div>
              <div className="v">{mntPrice > 0 ? `$${mntPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}</div>
              <div className="d"><span className="lbl">coingecko, live</span></div>
            </div>
            <div className="kpi">
              <div className="k">Vault status</div>
              <div className="v" style={{ color: isPaused ? 'var(--warm)' : 'var(--accent)' }}>
                {isPaused === undefined ? '—' : isPaused ? 'Paused' : 'Active'}
              </div>
              <div className="d"><span className="lbl">{isPaused ? 'no reallocations' : 'live on Mantle'}</span></div>
            </div>
            <div className="kpi">
              <div className="k">Markets tracked</div>
              <div className="v">{marketsLoading ? '…' : marketPools.length}</div>
              <div className="d"><span className="lbl">{marketsUpdated ? `updated ${marketsUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}` : 'loading…'}</span></div>
            </div>
          </div>

          {/* Chart + Strategy */}
          <div className="row-2">
            <section className="card">
              <div className="card-head">
                <h3>Portfolio value</h3>
                <div className="ranges">
                  {['24H','7D','30D','90D','ALL'].map(r => (
                    <button key={r} className={chartRange === r ? 'on' : ''} onClick={() => setChartRange(r)}>{r}</button>
                  ))}
                </div>
              </div>
              {(() => {
                const ch = portfolioForRange(chartRange);
                return (
                  <>
                    <div className="chart">
                      <div className="chart-overlay">
                        <span>{fmtUsd(totalVaultUsd, vaultDataLoaded)} total</span>
                        {mntPrice > 0 && <span style={{ color: 'var(--accent)' }}>MNT ${mntPrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}</span>}
                      </div>
                      <div className="chart-y">
                        <span>{ch.yLabels.high}</span>
                        <span>{ch.yLabels.midHigh}</span>
                        <span>{ch.yLabels.midLow}</span>
                        <span>{ch.yLabels.low}</span>
                      </div>
                      <svg viewBox="0 0 700 280" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="currentColor" stopOpacity="0.32"/>
                            <stop offset="100%" stopColor="currentColor" stopOpacity="0"/>
                          </linearGradient>
                          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                            <path d="M50 0H0V50" stroke="color-mix(in srgb, var(--ink) 3.5%, transparent)" strokeWidth="1" fill="none"/>
                          </pattern>
                        </defs>
                        <rect width="700" height="280" fill="url(#grid)"/>
                        <line x1="0" y1="140" x2="700" y2="140" stroke="color-mix(in srgb, var(--ink) 5%, transparent)" strokeDasharray="3 4"/>
                        {ch.hasData ? (
                          <>
                            <path d={ch.fillPath} fill="url(#g)"/>
                            <path d={ch.linePath} stroke="currentColor" strokeWidth="1.6" fill="none"/>
                            <circle cx="700" cy={ch.dotY} r="4" fill="currentColor"/>
                          </>
                        ) : (
                          /* No history yet — show a flat baseline at current value */
                          <line
                            x1="20" y1="140" x2="700" y2="140"
                            stroke="currentColor" strokeWidth="1.6"
                            strokeOpacity="0.4" strokeDasharray="6 4"
                          />
                        )}
                      </svg>
                    </div>
                    <div className="chart-x">
                      {ch.xLabels.map((l, i) => <span key={i}>{l}</span>)}
                    </div>
                  </>
                );
              })()}
            </section>

            <section className="card">
              <div className="card-head">
                <h3>Active strategy</h3>
                <span className="sub" style={{ color:'var(--accent)' }}>{riskProfile}</span>
              </div>
              <div className="strat-list">
                {/* Profile row */}
                <div className="it">
                  <span className="icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12l3-4 3 2 3-5 3 3"/><path d="M2 14h12"/></svg></span>
                  <div className="body">
                    <div className="t">{riskProfile === 'conservative' ? 'Conservative yield' : riskProfile === 'balanced' ? 'Balanced yield' : 'Aggressive yield'}</div>
                    <div className="m">{riskProfile === 'conservative' ? 'Base pools · floor 70 · 150 bps threshold' : riskProfile === 'balanced' ? 'Agni + FusionX · floor 55 · 75 bps threshold' : 'All pools + xStocks · floor 40 · 40 bps threshold'}</div>
                  </div>
                  <span className="v" style={{ color:'var(--accent)' }}>{riskProfile === 'conservative' ? '6–9%' : riskProfile === 'balanced' ? '9–14%' : '14–25%+'}</span>
                </div>
                {/* Top candidate pool */}
                {marketPools.length > 0 && (
                  <div className="it">
                    <span className="icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8l3 3 7-7"/></svg></span>
                    <div className="body">
                      <div className="t">{marketPools[0].nm} {marketPools[0].sub}</div>
                      <div className="m">Top candidate · Q {marketPools[0].q}/100 · TVL {marketPools[0].depth}</div>
                    </div>
                    <span className="v" style={{ color:'var(--accent)' }}>{marketPools[0].apy}</span>
                  </div>
                )}
                {/* Second candidate or agent row */}
                {marketPools.length > 1 ? (
                  <div className="it">
                    <span className="icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/><path d="M8 4v4l2 2"/></svg></span>
                    <div className="body">
                      <div className="t">{marketPools[1].nm} {marketPools[1].sub}</div>
                      <div className="m">Watching · Q {marketPools[1].q}/100 · TVL {marketPools[1].depth}</div>
                    </div>
                    <span className="v">{marketPools[1].apy}</span>
                  </div>
                ) : (
                  <div className="it hold">
                    <span className="icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/><path d="M8 4v4l2 2"/></svg></span>
                    <div className="body">
                      <div className="t">Scanning pools</div>
                      <div className="m">Fetching Mantle DeFi opportunities</div>
                    </div>
                    <span className="v">—</span>
                  </div>
                )}
                {/* Vault / agent status */}
                <div className={`it${!vaultDeployed ? ' hold' : isPaused ? ' warn' : ''}`}>
                  <span className="icon">
                    {vaultDeployed
                      ? <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="10" height="8" rx="1"/><path d="M5 6V4a3 3 0 016 0v2"/></svg>
                      : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="10" height="8" rx="1"/><path d="M5 6V4a3 3 0 016 0v2"/><path d="M8 10v2"/></svg>
                    }
                  </span>
                  <div className="body">
                    <div className="t">{vaultDeployed ? 'Vault on Mantle' : 'Vault not deployed'}</div>
                    <div className="m">{vaultDeployed ? fmtAddr(vaultAddress) : 'Deploy to start earning'}</div>
                  </div>
                  <span className="v">{vaultDeployed ? (isPaused ? 'paused' : 'live') : 'pending'}</span>
                </div>
              </div>
              <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--line)', display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize:'11.5px', color:'var(--mute)' }}>
                <span>Pools tracked <span style={{ color:'var(--ink)' }}>{marketPools.length}</span></span>
                <span>Status <span style={{ color: vaultDeployed ? (isPaused ? 'var(--warm)' : 'var(--accent)') : 'var(--mute)' }}>{vaultDeployed ? (isPaused ? 'paused' : 'live') : 'awaiting deployment'}</span></span>
              </div>
            </section>
          </div>

          {/* Allocations + Positions */}
          <div className="row-3">
            <section className="card">
              <div className="card-head">
                <h3>Allocations</h3>
                <span className="sub">by asset</span>
              </div>
              <div className="alloc-rings">
                <div className="alloc-ring">
                  <svg viewBox="-50 -50 100 100">
                    <circle r="40" cx="0" cy="0" fill="none" stroke="color-mix(in srgb, var(--ink) 5%, transparent)" strokeWidth="10"/>
                    <circle r="40" cx="0" cy="0" fill="none" stroke="url(#dual)" strokeWidth="10" strokeDasharray={`${wethArc.toFixed(1)} ${usdcArc.toFixed(1)}`} strokeDashoffset="0" transform="rotate(-90)"/>
                    <defs>
                      <linearGradient id="dual" x1="0" x2="1" y1="0" y2="0">
                        <stop offset="0%" stopColor="currentColor"/>
                        <stop offset="62%" stopColor="#4dd394"/>
                        <stop offset="62.5%" stopColor="#8ec5ff"/>
                        <stop offset="100%" stopColor="#5a8ed8"/>
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="ctr">
                    <span className="v">{vaultWethFmt}</span>
                    <span className="l">WETH</span>
                  </div>
                </div>
                <div className="alloc-keys">
                  <div className="alloc-key">
                    <span className="dot a" />
                    <span className="nm">WETH</span>
                    <span className="v"><b>{vaultWethFmt}</b> ETH</span>
                  </div>
                  <div className="alloc-key">
                    <span className="dot b" />
                    <span className="nm">USDC</span>
                    <span className="v"><b>{vaultUsdcFmt}</b> USDC</span>
                  </div>
                </div>
              </div>
              <div style={{ fontFamily:'var(--mono)', fontSize:'11px', color:'var(--mute)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:10 }}>Vault positions</div>
              <div className="pos-list">
                <div className="pos">
                  <span className="glyph" style={{ background:'linear-gradient(135deg,#75e5b0,#4dd394)' }}>W</span>
                  <div className="body">
                    <div className="t">WETH in vault</div>
                    <div className="m"><span className="q">deployed</span>, Mantle</div>
                  </div>
                  <div className="amt">{vaultWethFmt}<div className="sub">ETH</div></div>
                  <div className="apy">—</div>
                </div>
                <div className="pos">
                  <span className="glyph" style={{ background:'linear-gradient(135deg,#8ec5ff,#5a8ed8)' }}>U</span>
                  <div className="body">
                    <div className="t">USDC in vault</div>
                    <div className="m"><span className="q">deployed</span>, stable</div>
                  </div>
                  <div className="amt">{vaultUsdcFmt}<div className="sub">USDC</div></div>
                  <div className="apy">—</div>
                </div>

                {/* ── xStocks section ── */}
                {xStockPositions.length > 0 && (
                  <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--line)' }}>
                    <div style={{ fontFamily:'var(--mono)', fontSize:'10.5px', color:'var(--mute)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:10, display:'flex', justifyContent:'space-between' }}>
                      <span>xStocks · Fluxion DEX</span>
                      {xStockHeld.length > 0 && (
                        <span style={{ color:'var(--accent)' }}>${xStockTotalUsd.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })} held</span>
                      )}
                    </div>
                    {xStockPositions.map(pos => {
                      const isHeld = pos.balance > 0n;
                      return (
                        <div key={pos.symbol} className="pos" style={{ opacity: isHeld ? 1 : 0.55 }}>
                          <XStockGlyph symbol={pos.symbol} size={28} />
                          <div className="body">
                            <div className="t">{pos.symbol}</div>
                            <div className="m">
                              {isHeld
                                ? <><span className="q">held</span>, {pos.label}</>
                                : <span style={{ color:'var(--mute)' }}>{pos.label}</span>
                              }
                            </div>
                          </div>
                          <div className="amt">
                            {isHeld ? pos.balanceHuman.toFixed(4) : '—'}
                            <div className="sub">{pos.symbol}</div>
                          </div>
                          <div className="apy" style={{ color: pos.priceUsd > 0 ? 'var(--accent)' : 'var(--mute)', fontSize:12 }}>
                            {pos.priceUsd > 0
                              ? `$${pos.priceUsd.toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}`
                              : 'loading…'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </section>

            {/* Live monitoring + Activity feed — combined card */}
            <section className="card" data-tour="intelligence-feed" style={{ display:'flex', flexDirection:'column', gap:0 }}>
              <div className="card-head">
                <h3>Live monitoring</h3>
                <div style={{ display:'flex', alignItems:'center', gap:12, fontFamily:'var(--mono)', fontSize:12 }}>
                  {env.FEED_URL && (
                    <span style={{ display:'inline-flex', alignItems:'center', gap:6, color:'var(--accent)' }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:'var(--accent)', boxShadow:'0 0 8px var(--accent)', display:'inline-block' }} />
                      {liveFeed.length > 0 ? 'live' : 'connected'}
                    </span>
                  )}
                  <button className="btn" style={{ padding:'4px 10px', fontSize:'11px', background:'transparent' }} onClick={() => switchView('activity')}>All activity</button>
                </div>
              </div>

              {/* Monitoring mini-cards */}
              <div className="mon-grid">
                <div className="mon-card">
                  <div className="h"><div className="nm">Vault <span className="sub">WETH</span></div><span className={`q-bubble${vaultDeployed ? ' good' : ''}`}>{vaultDeployed ? 'active' : 'no vault'}</span></div>
                  <div className="lns">
                    <div className="ln"><span>Balance</span><span className="v good">{vaultDeployed ? `${vaultWethFmt} ETH` : '—'}</span></div>
                    <div className="ln"><span>Status</span><span className="v">{vaultDeployed ? (isPaused ? 'paused' : 'live') : '—'}</span></div>
                    <div className="ln"><span>Agent</span><span className="v">{vaultDeployed ? (agentAddr && agentAddr !== ZERO_ADDR ? 'set' : 'none') : '—'}</span></div>
                  </div>
                </div>
                <div className="mon-card">
                  <div className="h"><div className="nm">Vault <span className="sub">USDC</span></div><span className={`q-bubble${vaultDeployed ? ' good' : ''}`}>{vaultDeployed ? 'active' : 'no vault'}</span></div>
                  <div className="lns">
                    <div className="ln"><span>Balance</span><span className="v good">{vaultDeployed ? `${vaultUsdcFmt} USDC` : '—'}</span></div>
                    <div className="ln"><span>Network</span><span className="v">Mantle</span></div>
                    <div className="ln"><span>Vault</span><span className="v">{vaultDeployed ? fmtAddr(vaultAddress) : '—'}</span></div>
                  </div>
                </div>
                <div className="mon-card">
                  <div className="h"><div className="nm">Wallet <span className="sub">WETH</span></div><span className="q-bubble good">wallet</span></div>
                  <div className="lns">
                    <div className="ln"><span>Balance</span><span className="v good">{wethBalFmt} ETH</span></div>
                    <div className="ln"><span>Available</span><span className="v">to deposit</span></div>
                  </div>
                </div>
                <div className="mon-card">
                  <div className="h"><div className="nm">Wallet <span className="sub">USDC</span></div><span className="q-bubble good">wallet</span></div>
                  <div className="lns">
                    <div className="ln"><span>Balance</span><span className="v good">{usdcBalFmt} USDC</span></div>
                    <div className="ln"><span>Available</span><span className="v">to deposit</span></div>
                  </div>
                </div>
              </div>

              {/* Activity feed — same card, separated by a divider */}
              <div style={{ borderTop:'1px solid var(--line)', marginTop:16, paddingTop:14 }}>
                <div className="feed">
                  {liveFeed.length > 0 ? liveFeed.slice(0,5).map((item, i) => (
                    <div key={i} className={`feed-row ${item.type}`}>
                      <span className="ts">{item.ts}</span>
                      <span className="icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg></span>
                      <div className="body"><b>{item.body}</b><div className="why">{item.why}</div></div>
                      <span className={`tag ${item.tagClass}`}>{item.tag}</span>
                    </div>
                  )) : marketPools.length > 0 ? (
                    <>
                      <div className="feed-row exec">
                        <span className="ts">live</span>
                        <span className="icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg></span>
                        <div className="body">
                          <b>ARIA scanning Mantle · {riskProfile} profile</b>
                          <div className="why">
                            {vaultDeployed
                              ? `${vaultWethFmt} WETH + ${vaultUsdcFmt} USDC deployed · ${marketPools.length} pools tracked`
                              : `${marketPools.length} pools tracked · deposit to activate reallocation`}
                          </div>
                        </div>
                        <span className="tag">{vaultDeployed ? (isPaused ? 'paused' : 'live') : 'ready'}</span>
                      </div>
                      {marketPools.slice(0,3).map((pool, i) => (
                        <div key={i} className={`feed-row ${pool.q >= 70 ? 'exec' : pool.q >= 55 ? 'signal' : 'warn'}`}>
                          <span className="ts">now</span>
                          <span className="icon">
                            {pool.q >= 70
                              ? <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8l3 3 7-7"/></svg>
                              : <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/><path d="M8 4v4l2 2"/></svg>
                            }
                          </span>
                          <div className="body">
                            <b>{pool.nm} {pool.sub}: {pool.apy} APY</b>
                            <div className="why">Quality {pool.q}/100 · TVL {pool.depth} · {pool.status}</div>
                          </div>
                          <span className={`tag ${pool.q >= 70 ? '' : pool.q >= 55 ? 'mute' : 'red'}`}>Q {pool.q}</span>
                        </div>
                      ))}
                    </>
                  ) : marketsLoading ? (
                    <div className="feed-row signal">
                      <span className="ts">—</span>
                      <span className="icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/><path d="M8 4v4l2 2"/></svg></span>
                      <div className="body"><b>Fetching Mantle pools…</b><div className="why">Querying DefiLlama yields API.</div></div>
                      <span className="tag mute">loading</span>
                    </div>
                  ) : (
                    <div className="feed-row hold">
                      <span className="ts">—</span>
                      <span className="icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/><path d="M8 4v4l2 2"/></svg></span>
                      <div className="body"><b>Vault ready. No events yet.</b><div className="why">{env.FEED_URL ? 'Agent connected. Waiting for first reallocation.' : 'Configure VITE_FEED_URL to stream live agent events.'}</div></div>
                      <span className="tag mute">standby</span>
                    </div>
                  )}
                </div>
                <div style={{ textAlign:'center', paddingTop:14, marginTop:6, borderTop:'1px solid var(--line)' }}>
                  <button className="btn" style={{ background:'transparent' }} onClick={() => switchView('activity')}>View full activity log →</button>
                </div>
              </div>
            </section>
          </div>
        </section>

        {/* ============ PERFORMANCE VIEW ============ */}
        <section className={`view${view === 'performance' ? ' active' : ''}`} data-view="performance">
          <div className="view-head">
            <div>
              <h1>Performance</h1>
              <div className="sub">Returns and risk metrics for your vault on Mantle</div>
            </div>
            <div className="filters" role="tablist">
              {['All time','YTD','90d','30d','7d'].map(r => (
                <button key={r} className={chartRange === r ? 'on' : ''} onClick={() => setChartRange(r)}>{r}</button>
              ))}
            </div>
          </div>

          <div className="ret-grid" style={{ marginBottom:22 }}>
            <div className="ret-cell">
              <div className="k">Total vault value</div>
              <div className="v">{fmtUsd(totalVaultUsd, vaultDataLoaded)}</div>
              <div className="d"><b>{vaultWethFmt} WETH + {vaultUsdcFmt} USDC</b></div>
            </div>
            <div className="ret-cell">
              <div className="k">Wallet balance</div>
              <div className="v dim">{fmtUsd(totalWalletUsd, walletDataLoaded)}</div>
              <div className="d"><b>{wethBalFmt} WETH + {usdcBalFmt} USDC</b></div>
            </div>
            <div className="ret-cell">
              <div className="k">MNT price</div>
              <div className="v dim">{mntPrice > 0 ? `$${mntPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : '—'}</div>
              <div className="d"><b>live, coingecko</b></div>
            </div>
            <div className="ret-cell">
              <div className="k">Markets tracked</div>
              <div className="v dim">{marketsLoading ? '…' : marketPools.length}</div>
              <div className="d"><b>Mantle DeFi</b></div>
            </div>
            <div className="ret-cell">
              <div className="k">Status</div>
              <div className="v" style={{ color: isPaused ? 'var(--warm)' : 'var(--accent)', fontSize:22 }}>{isPaused ? 'Paused' : 'Active'}</div>
              <div className="d"><b>{isPaused ? 'no reallocations' : 'live'}</b></div>
            </div>
          </div>

          <div className="row-2" style={{ marginBottom:22 }}>
            <section className="card">
              <div className="card-head"><h3>Vault overview</h3><span className="sub">live</span></div>
              <div style={{ display:'flex', flexDirection:'column', gap:14, paddingTop:4 }}>
                {(() => {
                  const totalAll = totalVaultUsd + totalWalletUsd || 1;
                  return [
                    { lbl:'WETH in vault',  v: vaultWethFmt + ' ETH',  pct: Math.round((vaultWethNum * ethPrice / totalAll) * 100) },
                    { lbl:'USDC in vault',  v: vaultUsdcFmt + ' USDC', pct: Math.round((vaultUsdcNum / totalAll) * 100) },
                    { lbl:'Wallet WETH',    v: wethBalFmt + ' ETH',    pct: Math.round((wethBalNum * ethPrice / totalAll) * 100) },
                    { lbl:'Wallet USDC',    v: usdcBalFmt + ' USDC',   pct: Math.round((usdcBalNum / totalAll) * 100) },
                  ];
                })().map(row => (
                  <div key={row.lbl} style={{ display:'grid', gridTemplateColumns:'140px 1fr 90px', gap:14, alignItems:'center', fontSize:13 }}>
                    <div style={{ color:'var(--ink-2)' }}>{row.lbl}</div>
                    <div style={{ height:8, borderRadius:6, background:'color-mix(in srgb,var(--ink) 4%,transparent)', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${row.pct}%`, background:'linear-gradient(90deg,var(--accent-2),var(--accent))' }} />
                    </div>
                    <div style={{ fontFamily:'var(--mono)', fontSize:13, color:'var(--accent)', textAlign:'right' }}>{row.v}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="card-head"><h3>Vault metrics</h3><span className="sub">live</span></div>
              <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                {[
                  ['Vault address', fmtAddr(vaultAddress)],
                  ['Agent address', fmtAddr(agentAddr) || '—'],
                  ['Network', 'Mantle'],
                  ['Status', isPaused ? 'Paused' : 'Active'],
                  ['WETH balance', vaultWethFmt + ' ETH'],
                  ['USDC balance', vaultUsdcFmt + ' USDC'],
                ].map(([k,v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'12px 0', borderBottom:'1px solid var(--line)', fontSize:13 }}>
                    <span style={{ color:'var(--ink-2)' }}>{k}</span>
                    <span style={{ fontFamily:'var(--mono)', color:'var(--ink)' }}>{v}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="card" style={{ marginBottom:22 }}>
            <div className="card-head"><h3>Monthly heatmap</h3><span className="sub">2026</span></div>
            <div className="heat">
              {['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].map((mo) => (
                <div key={mo} className="cell">
                  <span className="mo">{mo}</span>
                </div>
              ))}
            </div>
            <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--mute)', marginTop:8 }}>Yield history will populate as the agent completes reallocation cycles.</div>
          </section>
        </section>

        {/* ============ ACTIVITY VIEW ============ */}
        <section className={`view${view === 'activity' ? ' active' : ''}`} data-view="activity">
          <div className="view-head">
            <div>
              <h1>Activity log</h1>
              <div className="sub">Every decision ARIA has made, with reasoning. <b>{conversations.reduce((a,c) => a + c.messages.length, 0)} messages</b> in memory</div>
            </div>
            <div style={{ display:'flex', gap:10, alignItems:'center' }}>
              <button className="btn" onClick={() => { setActPane('feed'); setTimeout(() => document.getElementById('actTabs')?.scrollIntoView({ behavior:'smooth' }), 50); }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10M5 8h6M7 12h2"/></svg>
                Filter
              </button>
              <button className="btn" onClick={handleExportCSV} disabled={liveFeed.length === 0} title={liveFeed.length === 0 ? 'No events to export yet' : 'Download activity as CSV'}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7l5 5 5-5M8 12V2"/></svg>
                Export CSV
              </button>
            </div>
          </div>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18, gap:14, flexWrap:'wrap' }}>
            <div className="subtabs" id="actTabs">
              {(['feed','memory','onchain'] as ActivityPane[]).map(p => (
                <button key={p} className={actPane === p ? 'on' : ''} onClick={() => setActPane(p)}>
                  {p === 'feed' ? 'Intelligence feed' : p === 'memory' ? 'Agent memory' : 'On-chain'}
                  <span className="ct">{p === 'feed' ? liveFeed.length || '—' : p === 'memory' ? conversations.reduce((a,c)=>a+c.messages.length,0) : '—'}</span>
                </button>
              ))}
            </div>
            <div style={{ fontFamily:'var(--mono)', fontSize:'11.5px', color:'var(--mute)', display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:6,height:6,borderRadius:'50%',background:'var(--accent)',boxShadow:'0 0 8px var(--accent)',display:'inline-block' }} />
              {env.FEED_URL ? 'streaming live' : 'no feed configured'}
            </div>
          </div>

          {/* Feed pane */}
          <div className={`subpane${actPane === 'feed' ? ' on' : ''}`} data-pane="feed">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, gap:14, flexWrap:'wrap' }}>
              <div className="filters">
                {[
                  { label:'All',          key:'all',           match: (_:FeedItem) => true },
                  { label:'Reallocations',key:'reallocations',  match: (f:FeedItem) => f.tag === 'ACTION' || f.type === 'exec' },
                  { label:'Signals',      key:'signals',        match: (f:FeedItem) => f.tag === 'OPPORTUNITY' || f.type === 'signal' },
                  { label:'Warnings',     key:'warnings',       match: (f:FeedItem) => f.tag === 'ALERT' || f.type === 'warn' },
                ].map(({ label, key, match }) => (
                  <button key={key} className={filtersCt === key ? 'on' : ''} onClick={() => setFiltersCt(key)}>
                    {label}<span className="ct">{liveFeed.filter(match).length || '0'}</span>
                  </button>
                ))}
              </div>
            </div>
            <section className="card">
              <div className="feed">
                {liveFeed.length > 0 ? liveFeed.filter(f => {
                  if (filtersCt === 'all') return true;
                  if (filtersCt === 'reallocations') return f.tag === 'ACTION' || f.type === 'exec';
                  if (filtersCt === 'signals') return f.tag === 'OPPORTUNITY' || f.type === 'signal';
                  if (filtersCt === 'warnings') return f.tag === 'ALERT' || f.type === 'warn';
                  return true;
                }).map((item,i) => (
                  <div key={i} className={`feed-row ${item.type}`}>
                    <span className="ts">{item.ts}</span>
                    <span className="icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg></span>
                    <div className="body"><b>{item.body}</b><div className="why">{item.why}</div></div>
                    <span className={`tag ${item.tagClass}`}>{item.tag}</span>
                  </div>
                )) : (
                  <div className="feed-row hold">
                    <span className="ts">now</span>
                    <span className="icon"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="5.5"/></svg></span>
                    <div className="body">
                      <b>No live feed data</b>
                      <div className="why">{env.FEED_URL ? 'Waiting for agent events…' : 'Configure VITE_FEED_URL to enable live intelligence feed.'}</div>
                    </div>
                    <span className="tag mute">offline</span>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Memory pane */}
          <div className={`subpane${actPane === 'memory' ? ' on' : ''}`} data-pane="memory">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, fontFamily:'var(--mono)', fontSize:'11.5px', color:'var(--mute)', flexWrap:'wrap', gap:10 }}>
              <span>Last <span style={{ color:'var(--ink)' }}>{Math.min(conversations.reduce((a,c)=>a+c.messages.length,0), 20)}</span> agent decisions, ranked by cycle</span>
              <span>Memory size <span style={{ color:'var(--ink)' }}>{conversations.reduce((a,c)=>a+c.messages.length,0)} messages</span></span>
            </div>
            <div className="mem-grid">
              {conversations.slice(0,6).flatMap(conv =>
                conv.messages.filter(m => m.role === 'aria').slice(-1).map((msg, i) => (
                  <div key={`${conv.id}-${i}`} className={`mem-card${msg.action?.type === 'reminder' ? ' exec' : ''}`}>
                    <div className="mem-head">
                      <span className="mem-cycle">{conv.title.slice(0,20)}</span>
                      <span className={`mem-action${!msg.action ? ' hold' : ''}`}>{msg.action?.type || 'reply'}</span>
                      <span className="mem-time">{msg.timestamp}</span>
                    </div>
                    <div className="mem-reason">{msg.content.slice(0,120)}{msg.content.length > 120 ? '…' : ''}</div>
                    <div className="mem-foot">
                      <span className="stat"><b>{conv.messages.length} msgs</b></span>
                    </div>
                  </div>
                ))
              )}
              {conversations.length === 0 && (
                <div className="mem-card" style={{ gridColumn:'1/-1' }}>
                  <div className="mem-reason" style={{ color:'var(--mute)' }}>No agent memory yet. Start a conversation in the Direct Line view.</div>
                </div>
              )}
            </div>
          </div>

          {/* On-chain pane */}
          <div className={`subpane${actPane === 'onchain' ? ' on' : ''}`} data-pane="onchain">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:10 }}>
              <div className="filters">
                {(['all','deposits','withdrawals'] as const).map(f => (
                  <button key={f} className={onchainFilter === f ? 'on' : ''} onClick={() => setOnchainFilter(f)}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}<span className="ct">—</span>
                  </button>
                ))}
              </div>
              <span style={{ fontFamily:'var(--mono)', fontSize:'11.5px', color:'var(--mute)' }}>
                Watching vault <span style={{ color:'var(--ink)' }}>{fmtAddr(vaultAddress)}</span>
              </span>
            </div>
            <section className="card" style={{ padding:'8px 22px' }}>
              <div className="tx-row dep">
                <span className="ic"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v8M4 7l4-4 4 4M3 13h10"/></svg></span>
                <span className="type">Vault</span>
                <div className="body">
                  <div className="t">Vault contract <span className="pa">{fmtAddr(vaultAddress)}</span></div>
                  <div className="ts">Mantle mainnet, active</div>
                </div>
                <div className="amt">deployed</div>
                <a className="hash" href={`${env.MANTLE_EXPLORER_URL}/address/${vaultAddress}`} target="_blank" rel="noopener">
                  {fmtAddr(vaultAddress)}
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 3h4v4M7 9l6-6"/></svg>
                </a>
              </div>
              {agentAddr && (
                <div className="tx-row upd">
                  <span className="ic"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2"/><path d="M13 8a5 5 0 00-.1-1l1.4-1.1-1.5-2.5L11 4a5 5 0 00-1.7-1L9 1.5H7l-.3 1.5A5 5 0 005 4l-1.7-.6-1.5 2.5L3.1 7A5 5 0 003 8c0 .3 0 .7.1 1L1.7 10.1l1.5 2.5L5 12a5 5 0 001.7 1L7 14.5h2l.3-1.5A5 5 0 0011 12l1.7.6 1.5-2.5L12.9 9c.1-.3.1-.6.1-1z"/></svg></span>
                  <span className="type">Agent</span>
                  <div className="body">
                    <div className="t">Agent address <span className="pa">{fmtAddr(agentAddr)}</span></div>
                    <div className="ts">set on vault contract</div>
                  </div>
                  <div className="amt" style={{ color:'var(--mute)' }}>admin</div>
                  <a className="hash" href={`${env.MANTLE_EXPLORER_URL}/address/${agentAddr}`} target="_blank" rel="noopener">
                    {fmtAddr(agentAddr)}
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 3h4v4M7 9l6-6"/></svg>
                  </a>
                </div>
              )}
            </section>
          </div>
        </section>

        {/* ============ MARKETS VIEW ============ */}
        <section className={`view${view === 'markets' ? ' active' : ''}`} data-view="markets">
          <div className="view-head">
            <div>
              <h1>Markets</h1>
              <div className="sub">Mantle DeFi ecosystem. Pools monitored by the ARIA agent.</div>
            </div>
            <div className="filters" role="tablist">
              {(['all','weth','usdc'] as const).map(f => {
                const count = f === 'all' ? marketPools.length : marketPools.filter(p => p.asset === f.toUpperCase()).length;
                return <button key={f} className={marketFilter === f ? 'on' : ''} onClick={() => setMarketFilter(f)}>{f === 'all' ? 'All' : f.toUpperCase()}<span className="ct">{count}</span></button>;
              })}
            </div>
          </div>

          <section className="card" data-tour="market-pools" style={{ padding:0, overflow:'hidden' }}>
            <div className="tbl-scroll">
              <table className="tbl">
                <thead>
                  <tr>
                    <th className="sortable">Protocol, Pool</th>
                    <th className="sortable">Asset</th>
                    <th className="r sortable">Quality</th>
                    <th className="r sortable">APY</th>
                    <th className="r">Incentive ratio</th>
                    <th className="r">Depth @ exit</th>
                    <th className="r">Trend 24h</th>
                    <th className="r">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {marketsLoading ? (
                    <tr><td colSpan={8} style={{ textAlign:'center', padding:'32px 0', color:'var(--mute)', fontFamily:'var(--mono)', fontSize:12 }}>Loading market data…</td></tr>
                  ) : marketPools.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign:'center', padding:'32px 0', color:'var(--mute)', fontFamily:'var(--mono)', fontSize:12 }}>No Mantle pools found. Check network or configure VITE_FEED_URL.</td></tr>
                  ) : marketPools.filter(p => marketFilter === 'all' || p.asset === marketFilter.toUpperCase()).map((row, i) => (
                    <tr key={i}>
                      <td>
                        <div className="pair">
                          <span className="gl" style={{ background: row.bg }}>{row.gl}</span>
                          <span><span className="nm">{row.nm}</span><span className="sub">{row.sub}</span></span>
                        </div>
                      </td>
                      <td className="mono">{row.asset}</td>
                      <td className="r">
                        <span className={`q-pill${row.q < 55 ? ' bad' : row.q < 70 ? ' mid' : ''}`}>
                          <span className="d" />{row.q}
                        </span>
                      </td>
                      <td className="r" style={{ color: row.q < 55 ? 'var(--red)' : row.q < 70 ? 'var(--warm)' : 'var(--accent)', fontSize:'13.5px' }}>{row.apy}</td>
                      <td className="r mono" style={{ color: parseFloat(row.inc) > 0.6 ? 'var(--warm)' : undefined }}>{row.inc}</td>
                      <td className="r mono">{row.depth}</td>
                      <td className="r">
                        <span className={`trend-bar ${row.trend}`}>
                          {[6,9,7,11,14,13,16].map((h,j) => <i key={j} style={{ height: h + (row.trend === 'down' ? (16-h) : 0) }} />)}
                        </span>
                      </td>
                      <td className="r mono" style={{ color: row.statusColor }}>{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16, fontFamily:'var(--mono)', fontSize:'11.5px', color:'var(--mute)' }}>
            <span>Quality floor <span style={{ color:'var(--ink)' }}>55</span>, pools below floor excluded automatically</span>
            <span>{marketsUpdated ? `DefiLlama · updated ${marketsUpdated.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:false })}` : env.FEED_URL ? 'Live from feed' : 'DefiLlama yields API'}</span>
          </div>

          {/* ── xStocks block ── */}
          <div style={{ marginTop:36 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, flexWrap:'wrap', gap:10 }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <h3 style={{ margin:0, fontSize:16, fontWeight:600 }}>xStocks</h3>
                  <span style={{
                    fontFamily:'var(--mono)', fontSize:10, letterSpacing:'0.08em', textTransform:'uppercase',
                    background:'color-mix(in srgb, var(--accent) 12%, transparent)',
                    border:'1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
                    color:'var(--accent)', padding:'2px 8px', borderRadius:5,
                  }}>10 of 10 verified</span>
                </div>
                <div style={{ fontFamily:'var(--mono)', fontSize:11.5, color:'var(--mute)', marginTop:5 }}>
                  Tokenized US equities · Mantle × Bybit × BackedFi × Flowdesk · live April 10 2026 · via Fluxion DEX
                </div>
              </div>
              <a
                href="https://explorer.mantle.xyz"
                target="_blank"
                rel="noopener"
                style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--accent)', display:'inline-flex', alignItems:'center', gap:5 }}
              >
                Verify on explorer
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 3h4v4M7 9l6-6"/></svg>
              </a>
            </div>

            <section className="card" style={{ padding:0, overflow:'hidden' }}>
              <div className="tbl-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Underlying</th>
                      <th className="r">Contract address</th>
                      <th className="r">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { sym:'TSLAx',  label:'Tesla Inc',          addr:'0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0', verified:true },
                      { sym:'NVDAx',  label:'Nvidia Corporation', addr:'0xc845b2894dbddd03858fd2d643b4ef725fe0849d', verified:true },
                      { sym:'AAPLx',  label:'Apple Inc',          addr:'0x9d275685dc284c8eb1c79f6aba7a63dc75ec890a', verified:true },
                      { sym:'METAx',  label:'Meta Platforms',     addr:'0x96702be57cd9777f835117a809c7124fe4ec989a', verified:true },
                      { sym:'GOOGLx', label:'Alphabet (Google)',  addr:'0xe92f673ca36c5e2efd2de7628f815f84807e803f', verified:true },
                      { sym:'MSTRx',  label:'MicroStrategy',      addr:'0xae2f842ef90c0d5213259ab82639d5bbf649b08e', verified:true },
                      { sym:'HOODx',  label:'Robinhood Markets',  addr:'0xe1385fdd5ffb10081cd52c56584f25efa9084015', verified:true },
                      { sym:'SPYx',   label:'S&P 500 ETF',        addr:'0x90a2a4c76b5d8c0bc892a69ea28aa775a8f2dd48', verified:true },
                      { sym:'QQQx',   label:'Nasdaq-100 ETF',     addr:'0xa753a7395cae905cd615da0b82a53e0560f250af', verified:true },
                      { sym:'CRCLx',  label:'Circle',             addr:'0xfebded1b0986a8ee107f5ab1a1c5a813491deceb', verified:true },
                    ].map((row, i) => (
                      <tr key={i}>
                        <td>
                          <div className="pair">
                            <XStockGlyph symbol={row.sym} size={24} />
                            <span className="nm" style={{ marginLeft:8 }}>{row.sym}</span>
                          </div>
                        </td>
                        <td style={{ color:'var(--ink-2)', fontSize:13 }}>{row.label}</td>
                        <td className="r">
                          {row.verified ? (
                            <a
                              href={`https://explorer.mantle.xyz/token/${row.addr}`}
                              target="_blank"
                              rel="noopener"
                              style={{ fontFamily:'var(--mono)', fontSize:11.5, color:'var(--accent)', display:'inline-flex', alignItems:'center', gap:4 }}
                            >
                              {row.addr.slice(0, 6)}…{row.addr.slice(-4)}
                              <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 3h4v4M7 9l6-6"/></svg>
                            </a>
                          ) : (
                            <span style={{ fontFamily:'var(--mono)', fontSize:11.5, color:'var(--mute)' }}>
                              {row.addr.slice(0, 6)}…{row.addr.slice(-4)}
                            </span>
                          )}
                        </td>
                        <td className="r">
                          {row.verified ? (
                            <span style={{ fontFamily:'var(--mono)', fontSize:11, letterSpacing:'0.06em', color:'var(--accent)' }}>
                              ● live
                            </span>
                          ) : (
                            <span style={{ fontFamily:'var(--mono)', fontSize:11, letterSpacing:'0.06em', color:'var(--warm)' }}>
                              verify address
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <div style={{ marginTop:10, fontFamily:'var(--mono)', fontSize:'11px', color:'var(--mute)', display:'flex', justifyContent:'space-between', flexWrap:'wrap', gap:6 }}>
              <span>All 10 addresses verified on Mantlescan · <a href="https://explorer.mantle.xyz" target="_blank" rel="noopener" style={{ color:'var(--accent)' }}>explorer.mantle.xyz</a></span>
              <span>Backed 1:1 by underlying securities · Swiss DLT Act compliant</span>
            </div>
          </div>
        </section>

        {/* ============ PROFILE VIEW ============ */}
        <section className={`view${view === 'profile' ? ' active' : ''}`} data-view="profile">
          <div className="view-head">
            <div>
              <h1>Your <em>profile</em></h1>
              <div className="sub">Identity, risk appetite, and the parameters ARIA operates inside on your behalf.</div>
            </div>
          </div>

          {/* Identity card */}
          <section className="ident-card" style={{ marginBottom:22 }}>
            <div className="ident-avatar">
              {userName.charAt(0).toLowerCase()}
            </div>
            <div>
              <div className="nm">Hi, <em>{userName}.</em></div>
              <div className="meta">
                <div className="it"><span>Wallet</span><span className="v" style={{ fontFamily:'var(--mono)' }}>{fmtAddr(address)}</span></div>
                <div className="it"><span>Vault contract</span><span className="v" style={{ fontFamily:'var(--mono)' }}>{fmtAddr(vaultAddress)}</span></div>
                <div className="it"><span>Network</span><span className="v">Mantle</span></div>
                <div className="it"><span>Status</span><span className="v accent">● active</span></div>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, alignItems:'end' }}>
              <button className="btn" onClick={() => {
                const n = prompt('Enter your name:', userName);
                if (n) { setUserName(n); localStorage.setItem('aria-nickname', n); }
              }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 11l5-7 5 7M3 11l5 3 5-3"/></svg>
                Change name
              </button>
              <a className="btn" href={`${env.MANTLE_EXPLORER_URL}/address/${vaultAddress}`} target="_blank" rel="noopener">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                View on explorer
              </a>
            </div>
          </section>

          {/* Risk profile picker */}
          <section className="card" style={{ marginBottom:22 }}>
            <div className="card-head">
              <h3>Risk profile</h3>
              <span className="sub">switch anytime, no timelock</span>
            </div>
            <div className="prof-picker">
              {([
                { id:'conservative', nm:'Conservative', rng:'6–9% APY', desc:'Only highest-quality pools. Slow to rotate, low drawdown.', q:70, d:120, m:50, dot:'var(--blue)' },
                { id:'balanced', nm:'Balanced', rng:'9–14% APY', desc:'Stable + curve plays. Active rotation when delta clears threshold.', q:55, d:75, m:65, dot:'var(--accent)' },
                { id:'aggressive', nm:'Aggressive', rng:'14–25%+ APY', desc:'Full curve incl. incentive pools. Higher rotation, higher variance.', q:40, d:50, m:80, dot:'var(--warm)' },
              ] as const).map(prof => (
                <div
                  key={prof.id}
                  className={`prof-card${riskProfile === prof.id ? ' on' : ''}`}
                  onClick={() => {
                    setRiskProfile(prof.id);
                    setSlQ(prof.q);
                    setSlD(prof.d);
                    setSlM(prof.m);
                    localStorage.setItem('aria-profile', prof.id);
                  }}
                >
                  <div className="head">
                    <span className="dt" style={{ background: prof.dot }} />
                    <span className="check">
                      <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 8l3 3 7-7"/></svg>
                    </span>
                  </div>
                  <h4>{prof.nm}</h4>
                  <div className="rng">{prof.rng}</div>
                  <p>{prof.desc}</p>
                  <div className="params">
                    <div className="ln"><span>Quality floor</span><span className="v">{prof.q}</span></div>
                    <div className="ln"><span>Reallocation Δ</span><span className="v">{prof.d} bps</span></div>
                    <div className="ln"><span>Max single</span><span className="v">{prof.m}%</span></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Custom thresholds */}
          <section className="card" style={{ marginBottom:22 }}>
            <div className="card-head">
              <h3>Custom thresholds</h3>
              <span className="sub">override profile defaults</span>
            </div>
            <div>
              <div className="slider-row">
                <div>
                  <div className="lbl">Quality floor</div>
                  <div className="lbl"><span className="desc">Pools below this score are excluded from your candidate set.</span></div>
                  <input type="range" min="30" max="90" value={slQ} onChange={e => setSlQ(+e.target.value)} />
                </div>
                <div className="v">{slQ}</div>
              </div>
              <div className="slider-row">
                <div>
                  <div className="lbl">Reallocation threshold</div>
                  <div className="lbl"><span className="desc">Minimum risk-adjusted improvement (in bps) before ARIA moves funds.</span></div>
                  <input type="range" min="25" max="200" value={slD} onChange={e => setSlD(+e.target.value)} />
                </div>
                <div className="v">{slD} bps</div>
              </div>
              <div className="slider-row">
                <div>
                  <div className="lbl">Max single position</div>
                  <div className="lbl"><span className="desc">No more than this share of vault in any one pool.</span></div>
                  <input type="range" min="30" max="100" value={slM} onChange={e => setSlM(+e.target.value)} />
                </div>
                <div className="v">{slM}%</div>
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:14, marginTop:6, borderTop:'1px solid var(--line)', fontFamily:'var(--mono)', fontSize:'11.5px', color:'var(--mute)' }}>
              <span>Custom overrides active</span>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn" style={{ padding:'7px 14px', fontSize:12 }} onClick={() => { setSlQ(55); setSlD(75); setSlM(65); localStorage.removeItem('aria-thresholds'); }}>Reset to Balanced</button>
                <button className="btn primary" style={{ padding:'7px 14px', fontSize:12 }} onClick={() => { localStorage.setItem('aria-thresholds', JSON.stringify({ slQ, slD, slM })); alert('Custom thresholds saved.'); }}>Save changes</button>
              </div>
            </div>
          </section>
        </section>

        {/* ============ SETTINGS VIEW ============ */}
        <section className={`view${view === 'settings' ? ' active' : ''}`} data-view="settings">
          <div className="view-head">
            <div>
              <h1>Settings</h1>
              <div className="sub">Notifications, security, and advanced execution parameters.</div>
            </div>
          </div>

          {/* Vault contract */}
          <section className="card" style={{ marginBottom:22 }}>
            <div className="card-head">
              <h3>Vault contract <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--accent)', background:'rgba(117,229,176,0.1)', border:'1px solid rgba(117,229,176,0.28)', padding:'2px 7px', borderRadius:5, marginLeft:8, letterSpacing:'0.04em', verticalAlign:2 }}>owner</span></h3>
              <span className="sub" style={{ fontFamily:'var(--mono)' }}>{fmtAddr(address)}, Mantle</span>
            </div>

            <div className="vault-grid">
              <div className="vault-cell">
                <div className="k">Agent address</div>
                <div className="v">
                  <span style={{ fontFamily: agentAddr && agentAddr !== ZERO_ADDR ? 'var(--mono)' : undefined, color: agentAddr && agentAddr !== ZERO_ADDR ? undefined : 'var(--mute)' }}>
                    {agentAddr && agentAddr !== ZERO_ADDR ? agentAddr : '—'}
                  </span>
                  {agentAddr && agentAddr !== ZERO_ADDR && (
                    <>
                      <button className="copy-btn" onClick={() => navigator.clipboard.writeText(agentAddr)} title="Copy">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="5" width="8" height="8" rx="1.5"/><path d="M3 11V4a1 1 0 011-1h7"/></svg>
                      </button>
                      <a href={`${env.MANTLE_EXPLORER_URL}/address/${agentAddr}`} target="_blank" rel="noopener" title="View on Mantlescan" style={{ color:'var(--mute)', display:'inline-flex' }}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13"><path d="M9 3h4v4M7 9l6-6"/><path d="M13 9v4H3V3h4"/></svg>
                      </a>
                    </>
                  )}
                </div>
                <div className="hint">Wallet allowed to call <code style={{ fontFamily:'var(--mono)', color:'var(--ink-2)' }}>reallocate()</code> on the vault.</div>
              </div>
              <div className="vault-cell">
                <div className="k">Vault address</div>
                <div className="v">
                  <span style={{ fontFamily: vaultDeployed ? 'var(--mono)' : undefined, color: vaultDeployed ? undefined : 'var(--mute)' }}>
                    {vaultDeployed ? vaultAddress : '—'}
                  </span>
                  {vaultDeployed && (
                    <>
                      <button className="copy-btn" onClick={() => navigator.clipboard.writeText(vaultAddress!)} title="Copy">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="5" y="5" width="8" height="8" rx="1.5"/><path d="M3 11V4a1 1 0 011-1h7"/></svg>
                      </button>
                      <a href={`${env.MANTLE_EXPLORER_URL}/address/${vaultAddress}`} target="_blank" rel="noopener" title="View on Mantlescan" style={{ color:'var(--mute)', display:'inline-flex' }}>
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13"><path d="M9 3h4v4M7 9l6-6"/><path d="M13 9v4H3V3h4"/></svg>
                      </a>
                    </>
                  )}
                </div>
                <div className="hint">Your personal ARIA vault contract on Mantle.{!vaultDeployed && ' Deploy the contracts to get started.'}</div>
              </div>
            </div>

            {/* Pause toggle */}
            <div className="pref-row">
              <div className="lbl">Paused
                <div className="desc">Stops <code style={{ fontFamily:'var(--mono)', color:'var(--ink-2)' }}>reallocate()</code> calls. Existing positions remain deployed. Deposits and withdrawals still work.</div>
              </div>
              <label className="switch" style={{ opacity: pausePending || !vaultDeployed ? 0.6 : 1 }}>
                <input type="checkbox" checked={isPaused ?? false} onChange={handlePauseToggle} disabled={pausePending || !vaultDeployed} />
                <span className="sl" />
              </label>
            </div>

            {/* Set agent */}
            <div className="pref-row" style={{ display:'block' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:18 }}>
                <div className="lbl">Set agent
                  <div className="desc">Rotate which address can trigger reallocations. Owner-only.</div>
                </div>
                <span style={{ fontFamily:'var(--mono)', fontSize:'10.5px', color:'var(--mute)' }}>setAgent(address)</span>
              </div>
              <div className="addr-input">
                <input
                  type="text"
                  placeholder="0x… new agent address"
                  value={agentInput}
                  onChange={e => setAgentInput(e.target.value)}
                />
                <button onClick={handleSetAgent} disabled={!isValidAddr(agentInput) || setAgentPending || !vaultDeployed}>
                  {setAgentPending ? 'Sending…' : 'Set agent'}
                </button>
              </div>
              {setAgentError   && <div style={{ color:'var(--red,#f87171)', fontFamily:'var(--mono)', fontSize:11, marginTop:6 }}>{setAgentError}</div>}
              {setAgentSuccess && <div style={{ color:'var(--accent)', fontFamily:'var(--mono)', fontSize:11, marginTop:6 }}>{setAgentSuccess}</div>}
            </div>

            {/* Performance fee */}
            <div className="slider-row">
              <div>
                <div className="lbl">Performance fee</div>
                <div className="lbl"><span className="desc">Share of realized APY improvement on each reallocation, paid to recipient.</span></div>
                <input type="range" min="0" max="2000" step="50" value={perfFee} onChange={e => setPerfFee(+e.target.value)} />
                <div className="fee-readout"><b>setPerformanceFeeBps(_bps)</b>, hard cap <span className="fee-cap">2000 bps (20%)</span></div>
              </div>
              <div className="v">{(perfFee/100).toFixed(1)}%</div>
            </div>

            {/* Management fee */}
            <div className="slider-row">
              <div>
                <div className="lbl">Management fee</div>
                <div className="lbl"><span className="desc">Annualized fee on balance, accrued max once per hour per token.</span></div>
                <input type="range" min="0" max="200" step="5" value={mgmtFee} onChange={e => setMgmtFee(+e.target.value)} />
                <div className="fee-readout"><b>setManagementFeeBps(_bps)</b>, hard cap <span className="fee-cap">200 bps (2%)</span></div>
              </div>
              <div className="v">{(mgmtFee/100).toFixed(2)}%</div>
            </div>

            {/* Deposit / Withdraw */}
            <div style={{ marginTop:18, paddingTop:14, borderTop:'1px solid var(--line)' }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:'11px', color:'var(--mute)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:10 }}>Deposit / Withdraw</div>
              <div style={{ display:'flex', gap:8, marginBottom:10 }}>
                <button className={`btn${depositToken === 'WETH' ? ' primary' : ''}`} style={{ padding:'5px 12px', fontSize:'12px' }} onClick={() => setDepositToken('WETH')}>WETH</button>
                <button className={`btn${depositToken === 'USDC' ? ' primary' : ''}`} style={{ padding:'5px 12px', fontSize:'12px' }} onClick={() => setDepositToken('USDC')}>USDC</button>
              </div>
              <div className="addr-input">
                <input type="number" placeholder={`Deposit amount (${depositToken})`} value={depositInput} onChange={e => setDepositInput(e.target.value)} />
                <button onClick={handleDeposit} disabled={deposit.isPending || !depositInput || !vaultDeployed}>{deposit.isPending ? 'Depositing…' : 'Deposit'}</button>
              </div>
              {deposit.error && <div style={{ color:'var(--red)', fontFamily:'var(--mono)', fontSize:11, marginTop:6 }}>{deposit.error.message?.slice(0,80)}</div>}
              <div className="addr-input" style={{ marginTop:8 }}>
                <input type="number" placeholder={`Withdraw amount (${depositToken})`} value={withdrawInput} onChange={e => setWithdrawInput(e.target.value)} />
                <button onClick={handleWithdraw} disabled={withdraw.isPending || !withdrawInput || !vaultDeployed}>{withdraw.isPending ? 'Withdrawing…' : 'Withdraw'}</button>
              </div>
              {withdraw.error && <div style={{ color:'var(--red)', fontFamily:'var(--mono)', fontSize:11, marginTop:6 }}>{withdraw.error.message?.slice(0,80)}</div>}
            </div>
          </section>

          {/* Custom Assets */}
          <section className="card" style={{ marginBottom:22 }}>
            <div className="card-head">
              <h3>Custom assets <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--blue)', background:'rgba(100,160,255,0.1)', border:'1px solid rgba(100,160,255,0.28)', padding:'2px 7px', borderRadius:5, marginLeft:8, letterSpacing:'0.04em', verticalAlign:2 }}>RWA</span></h3>
              <span className="sub">Add any Mantle token for ARIA to manage</span>
            </div>

            {/* Existing custom pools */}
            {customPools.length > 0 && (
              <div style={{ marginBottom:18 }}>
                {customPools.map(p => (
                  <div key={p.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:10, border:'1px solid var(--line)', marginBottom:8 }}>
                    <div>
                      <span style={{ fontWeight:500, fontSize:14 }}>{p.tokenSymbol}</span>
                      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--mute)', marginLeft:8 }}>{p.protocol}</span>
                      <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--accent)', marginLeft:8 }}>{(p.apyBps/100).toFixed(1)}% est.</span>
                    </div>
                    <button
                      className="btn"
                      style={{ padding:'4px 10px', fontSize:11, color:'var(--red,#f87171)' }}
                      onClick={async () => {
                        const session = sessionStorage.getItem(`siwe-session-${address?.toLowerCase()}`);
                        await fetch(`${env.API_URL}/api/pools/${p.id}?wallet=${address}`, { method:'DELETE', headers: session ? { Authorization:`Bearer ${session}` } : {} });
                        setCustomPools(prev => prev.filter(x => x.id !== p.id));
                      }}
                    >Remove</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new asset form */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <div style={{ fontFamily:'var(--mono)', fontSize:'10.5px', color:'var(--mute)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:5 }}>Protocol name *</div>
                <input className="field-input" type="text" placeholder="e.g. Ondo Finance OUSG" value={caName} onChange={e => setCaName(e.target.value)} />
              </div>
              <div>
                <div style={{ fontFamily:'var(--mono)', fontSize:'10.5px', color:'var(--mute)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:5 }}>Token symbol</div>
                <input className="field-input" type="text" placeholder="OUSG" value={caSymbol} onChange={e => setCaSymbol(e.target.value)} />
              </div>
              <div>
                <div style={{ fontFamily:'var(--mono)', fontSize:'10.5px', color:'var(--mute)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:5 }}>Token address *</div>
                <input className="field-input" type="text" placeholder="0x… token contract" value={caToken} onChange={e => setCaToken(e.target.value)} />
              </div>
              <div>
                <div style={{ fontFamily:'var(--mono)', fontSize:'10.5px', color:'var(--mute)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:5 }}>Token decimals</div>
                <input className="field-input" type="number" placeholder="18" value={caDecimals} onChange={e => setCaDecimals(e.target.value)} />
              </div>
              <div>
                <div style={{ fontFamily:'var(--mono)', fontSize:'10.5px', color:'var(--mute)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:5 }}>Pool address *</div>
                <input className="field-input" type="text" placeholder="0x… UniV3 pool" value={caPool} onChange={e => setCaPool(e.target.value)} />
              </div>
              <div>
                <div style={{ fontFamily:'var(--mono)', fontSize:'10.5px', color:'var(--mute)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:5 }}>Router address *</div>
                <input className="field-input" type="text" placeholder="0x… DEX router" value={caRouter} onChange={e => setCaRouter(e.target.value)} />
              </div>
              <div>
                <div style={{ fontFamily:'var(--mono)', fontSize:'10.5px', color:'var(--mute)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:5 }}>Swap from</div>
                <div style={{ display:'flex', gap:6 }}>
                  <button className={`btn${caTokenIn === 'WETH' ? ' primary' : ''}`} style={{ flex:1, padding:'7px 0', fontSize:12, justifyContent:'center' }} onClick={() => setCaTokenIn('WETH')}>WETH</button>
                  <button className={`btn${caTokenIn === 'USDC' ? ' primary' : ''}`} style={{ flex:1, padding:'7px 0', fontSize:12, justifyContent:'center' }} onClick={() => setCaTokenIn('USDC')}>USDC</button>
                </div>
              </div>
              <div>
                <div style={{ fontFamily:'var(--mono)', fontSize:'10.5px', color:'var(--mute)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:5 }}>Fee tier</div>
                <div style={{ display:'flex', gap:6 }}>
                  {[100,500,3000,10000].map(f => (
                    <button key={f} className={`btn${caFee === f ? ' primary' : ''}`} style={{ flex:1, padding:'7px 0', fontSize:11, justifyContent:'center' }} onClick={() => setCaFee(f)}>{f === 100 ? '0.01%' : f === 500 ? '0.05%' : f === 3000 ? '0.3%' : '1%'}</button>
                  ))}
                </div>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <div style={{ fontFamily:'var(--mono)', fontSize:'10.5px', color:'var(--mute)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:5 }}>Estimated APY (%)</div>
                <input className="field-input" type="number" step="0.1" placeholder="e.g. 5.2" value={caApy} onChange={e => setCaApy(e.target.value)} />
              </div>
            </div>

            {caError && <div style={{ color:'var(--red,#f87171)', fontFamily:'var(--mono)', fontSize:11, marginTop:10 }}>{caError}</div>}
            {caSuccess && <div style={{ color:'var(--accent)', fontFamily:'var(--mono)', fontSize:11, marginTop:10 }}>{caSuccess}</div>}

            <div style={{ marginTop:14, display:'flex', alignItems:'center', gap:12 }}>
              <button className="btn primary" style={{ padding:'9px 22px' }} onClick={handleAddCustomAsset} disabled={caAdding || !caName || !caToken || !caPool || !caRouter}>
                {caAdding ? 'Whitelisting…' : '+ Add to vault'}
              </button>
              <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--mute)' }}>Sends up to 3 transactions · owner-only</span>
            </div>
          </section>

          {/* Notifications */}
          <section className="card" id="notifCard" style={{ marginBottom:22, scrollMarginTop:72 }}>
            <div className="card-head">
              <h3>Notifications</h3>
              <span className="sub">choose what reaches you</span>
            </div>
            <div>
              {[
                { lbl:'Reallocations', desc:'Every time ARIA moves your funds.', checked:true },
                { lbl:'Liquidity warnings', desc:'Incentive cliffs, depth collapses, or pool quality crossing your floor.', checked:true },
                { lbl:'Yield signals', desc:'Rate improvements that did not clear your threshold (informational).', checked:false },
                { lbl:'Daily digest', desc:'Single morning email with overnight activity and current positions.', checked:true },
              ].map(({ lbl, desc, checked }) => (
                <div key={lbl} className="pref-row">
                  <div className="lbl">{lbl}<div className="desc">{desc}</div></div>
                  <label className="switch"><input type="checkbox" defaultChecked={checked} /><span className="sl" /></label>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:14, marginTop:6, borderTop:'1px solid var(--line)', gap:14 }}>
              <span style={{ fontFamily:'var(--mono)', fontSize:'11.5px', color:'var(--mute)' }}>Channels</span>
              <div style={{ display:'flex', gap:6 }}>
                <button className="btn" style={{ padding:'6px 12px', fontSize:12, borderColor:'var(--accent)', color:'var(--accent)', background:'rgba(117,229,176,0.06)' }}>In-app ✓</button>
                <button className="btn" style={{ padding:'6px 12px', fontSize:12 }} onClick={() => alert('Email notifications coming soon.')}>Email</button>
                <button className="btn" style={{ padding:'6px 12px', fontSize:12 }} onClick={() => document.getElementById('telegramCard')?.scrollIntoView({ behavior:'smooth' })}>Telegram</button>
                <button className="btn" style={{ padding:'6px 12px', fontSize:12 }} onClick={() => alert('Webhook notifications coming soon.')}>Webhook</button>
              </div>
            </div>
          </section>

          {/* Security */}
          <section className="card" style={{ marginBottom:22 }}>
            <div className="card-head"><h3>Security</h3><span className="sub">defense in depth</span></div>
            <div>
              {[
                { lbl:'Withdrawal allowlist', desc:'Only your connected wallet can withdraw. Add cold-storage addresses to extend. On-chain enforcement via the vault contract. Withdrawals always go to the vault owner.', action:<button className="btn" style={{ padding:'7px 14px', fontSize:12 }} onClick={() => { switchView('activity'); setActPane('onchain'); }}>View on-chain</button> },
                { lbl:'Auto-disconnect', desc:'Disconnect wallet after 30 min of inactivity.', action:<label className="switch"><input type="checkbox" defaultChecked /><span className="sl" /></label> },
                { lbl:'Hardware wallet signing', desc:'Require Ledger/Trezor signature for deposits and profile changes above $50k.', action:<label className="switch"><input type="checkbox" /><span className="sl" /></label> },
              ].map(({ lbl, desc, action }) => (
                <div key={lbl} className="pref-row">
                  <div className="lbl">{lbl}<div className="desc">{desc}</div></div>
                  {action}
                </div>
              ))}
            </div>
          </section>

          {/* Execution */}
          <section className="card" style={{ marginBottom:22 }}>
            <div className="card-head"><h3>Execution</h3><span className="sub">advanced</span></div>
            <div>
              <div className="slider-row">
                <div>
                  <div className="lbl">Max gas per move</div>
                  <div className="lbl"><span className="desc">Cap on gas spent per reallocation. ARIA holds if move would exceed this.</span></div>
                  <input type="range" min="5" max="50" defaultValue="20" />
                </div>
                <div className="v">0.0020 ETH</div>
              </div>
              <div className="slider-row">
                <div>
                  <div className="lbl">Max slippage</div>
                  <div className="lbl"><span className="desc">Per-swap slippage tolerance. Lower = more conservative routes.</span></div>
                  <input type="range" min="5" max="100" defaultValue="30" />
                </div>
                <div className="v">0.30%</div>
              </div>
              <div className="pref-row">
                <div className="lbl">MEV protection<div className="desc">Route private mempool for swaps above $25k.</div></div>
                <label className="switch"><input type="checkbox" defaultChecked /><span className="sl" /></label>
              </div>
            </div>
          </section>

          {/* Appearance */}
          <section className="card" style={{ marginBottom:22 }}>
            <div className="card-head"><h3>Appearance</h3><span className="sub">presentation</span></div>
            <div>
              <div className="pref-row">
                <div className="lbl">Theme<div className="desc">Switch between dark and light. Synced across devices.</div></div>
                <div style={{ display:'flex', gap:6 }}>
                  <button
                    className="btn"
                    style={isDark ? {} : { borderColor:'var(--accent)', color:'var(--accent)', background:'rgba(117,229,176,0.06)' }}
                    onClick={() => setIsDark(true)}
                  >Dark</button>
                  <button
                    className="btn"
                    style={!isDark ? { borderColor:'var(--accent)', color:'var(--accent)', background:'rgba(117,229,176,0.06)' } : {}}
                    onClick={() => setIsDark(false)}
                  >Light</button>
                </div>
              </div>
            </div>
          </section>

          {/* Telegram */}
          <section className="card" id="telegramCard" style={{ marginBottom:22 }} data-tour="telegram-settings">
            <div className="card-head">
              <h3>Telegram notifications</h3>
              <span className="sub">{tgStatus.connected ? <span style={{ color:'var(--accent)' }}>● Connected</span> : 'Not connected'}</span>
            </div>
            {tgStatus.connected ? (
              <div className="pref-row">
                <div className="lbl">
                  Connected
                  {tgStatus.username && (
                    <div className="desc">Linked to <span style={{ fontFamily:'var(--mono)' }}>@{tgStatus.username}</span></div>
                  )}
                </div>
                <button
                  className="btn"
                  style={{ padding:'7px 14px', fontSize:12 }}
                  disabled={tgLoading}
                  onClick={tgDisconnect}
                >
                  Disconnect
                </button>
              </div>
            ) : settingsTgLink ? (
              <div style={{ padding:'4px 0 8px' }}>
                <div className="desc" style={{ marginBottom:12 }}>
                  Tap the link below to open @AriaRWAbot and complete linking. Or copy it and open manually in Telegram.
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                  <a
                    href={settingsTgLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn primary"
                    style={{ padding:'8px 16px', fontSize:12, display:'inline-flex', alignItems:'center', gap:7, textDecoration:'none' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    Open @AriaRWAbot
                  </a>
                  <button
                    className="btn"
                    style={{ padding:'8px 14px', fontSize:12 }}
                    onClick={() => { navigator.clipboard.writeText(settingsTgLink).catch(() => {}); }}
                  >
                    Copy link
                  </button>
                  <button
                    className="btn"
                    style={{ padding:'8px 14px', fontSize:12, color:'var(--mute)' }}
                    onClick={() => setSettingsTgLink(null)}
                  >
                    Reset
                  </button>
                </div>
                <div style={{ marginTop:10, fontFamily:'var(--mono)', fontSize:10, color:'var(--mute)', wordBreak:'break-all' }}>
                  {settingsTgLink}
                </div>
              </div>
            ) : (
              <div className="pref-row">
                <div className="lbl">
                  Connect Telegram
                  <div className="desc">Get real-time alerts when ARIA reallocates your funds, plus a daily summary. Chat with ARIA directly from @AriaRWAbot.</div>
                  {settingsTgErr && (
                    <div style={{ marginTop:6, fontSize:11, color:'var(--red)' }}>{settingsTgErr}</div>
                  )}
                </div>
                <button
                  className="btn primary"
                  style={{ padding:'7px 16px', fontSize:12, display:'flex', alignItems:'center', gap:7 }}
                  disabled={tgLoading}
                  onClick={async () => {
                    setSettingsTgErr(null);
                    if (!address) {
                      setSettingsTgErr('Wallet not connected. Please reconnect your wallet and try again.');
                      return;
                    }
                    const link = await tgGenerateLink();
                    if (link) {
                      setSettingsTgLink(link);
                    } else {
                      setSettingsTgErr('Could not reach the bot server. Check that aria-tgbot is running (pm2 status).');
                    }
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  {tgLoading ? 'Generating…' : 'Connect Telegram'}
                </button>
              </div>
            )}
          </section>

          {/* Danger zone */}
          <section className="card danger">
            <div className="card-head head">
              <h3>Danger zone</h3>
              <span className="sub" style={{ color:'var(--red)' }}>irreversible</span>
            </div>
            <div>
              <div className="pref-row">
                <div className="lbl">Clear ARIA memory<div className="desc">Delete all conversation history and agent memory. Cannot be undone.</div></div>
                <button className="btn btn-danger" style={{ padding:'7px 14px', fontSize:12 }} onClick={() => { if (confirm('Clear all ARIA memory?')) clearAll(); }}>Clear all</button>
              </div>
              <div className="pref-row">
                <div className="lbl">Disconnect wallet<div className="desc">Sign out of this session.</div></div>
                <button className="btn" style={{ padding:'7px 14px', fontSize:12 }} onClick={() => disconnect()}>Disconnect</button>
              </div>
            </div>
          </section>
        </section>

      </main>

      {/* ====== Floating Ask ARIA ====== */}
      <div
        className={`ask${askCollapsed ? ' collapsed' : ''}${askShowConv ? ' conv' : ''}`}
        id="ask"
        data-tour="ask-aria"
        onClick={() => { if (askCollapsed) setAskCollapsed(false); }}
      >
        <div className="ask-top">
          <div>
            <div className="lbl" style={{ marginBottom:2 }}>Ask</div>
            <div className="nm">aria</div>
          </div>
          <span className="live" title={env.FEED_URL ? `GET /health, ${env.FEED_URL}` : 'aria-agent offline'}>
            {env.FEED_URL ? 'online' : 'ready'}
          </span>
          <span className="nav-mini">
            <button title="Conversations" onClick={e => { e.stopPropagation(); setAskShowConv(true); setAskCollapsed(false); }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 4h10v6H7l-3 3V4z"/></svg>
            </button>
            <button title="New chat" onClick={e => { e.stopPropagation(); startNewConversation(); setAskShowConv(false); }}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 3v10M3 8h10"/></svg>
            </button>
          </span>
          <span className="toggle" onClick={e => { e.stopPropagation(); setAskCollapsed(true); setAskShowConv(false); }}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6l4 4 4-4"/></svg>
          </span>
        </div>

        {/* Thread */}
        <div className="ask-thread" ref={askThreadRef}>
          {!currentConversation && (
            <div className="ask-msg aria">Hi. Ask me anything about your vault, positions, or recent moves.</div>
          )}
          {currentConversation?.messages.map((msg, i) => (
            <div key={i} className={`ask-msg ${msg.role}`}>{msg.content}</div>
          ))}
        </div>

        <div className="ask-suggest">
          <span className="s" onClick={e => { e.stopPropagation(); setAskInput("What's my best 30d position?"); }}>What's my best 30d position?</span>
          <span className="s" onClick={e => { e.stopPropagation(); setAskInput('Why is FusionX flagged?'); }}>Why is FusionX flagged?</span>
          <span className="s" onClick={e => { e.stopPropagation(); setAskInput('Switch to Aggressive'); }}>Switch to Aggressive</span>
        </div>

        <div className="ask-input" onClick={e => e.stopPropagation()}>
          <input
            placeholder="Ask about your vault, a pool, or any decision…"
            value={askInput}
            onChange={e => setAskInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAskSend(); } }}
          />
          <button className="send" onClick={e => { e.stopPropagation(); handleAskSend(); }}>
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
          </button>
        </div>
        <div className="ask-meta" onClick={e => e.stopPropagation()}>
          <span className="rl" title="Daily message limit"><b>{currentConversation?.messages.filter(m=>m.role==='user').length ?? 0}</b> messages this session</span>
          <span className="uptime">ARIA vault</span>
        </div>

        {/* Conversations drawer */}
        <div className="conv-pane">
          <div className="ask-top" style={{ borderBottom:'1px solid var(--line)' }}>
            <button style={{ border:'none', background:'transparent', color:'var(--mute)', cursor:'pointer', padding:0, display:'inline-flex', alignItems:'center', gap:6, fontFamily:'inherit', fontSize:13 }}
              onClick={e => { e.stopPropagation(); setAskShowConv(false); }}>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 4L6 8l4 4"/></svg>
              Back
            </button>
            <span className="nm" style={{ marginLeft:'auto', fontSize:14, fontFamily:'var(--sans)', fontStyle:'normal' }}>Conversations</span>
          </div>
          <div className="conv-list">
            {conversations.map(conv => (
              <div key={conv.id} className={`conv-row${currentConversation?.id === conv.id ? ' active' : ''}`}
                onClick={e => { e.stopPropagation(); loadConversation(conv.id); setAskShowConv(false); }}>
                <div>
                  <div className="t">{conv.title}</div>
                  <div className="m"><span>{conv.messages.length} msgs</span></div>
                </div>
              </div>
            ))}
            {conversations.length === 0 && <div style={{ padding:14, color:'var(--mute)', fontSize:12 }}>No conversations</div>}
          </div>
          <div className="conv-foot" onClick={e => e.stopPropagation()}>
            <span>conversations</span>
            <button onClick={e => { e.stopPropagation(); startNewConversation(); setAskShowConv(false); }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M8 3v10M3 8h10"/></svg>
              New chat
            </button>
          </div>
        </div>
      </div>

      {/* Close popovers on outside click */}
      {(notifOpen || walletOpen) && (
        <div
          style={{ position:'fixed', inset:0, zIndex:25 }}
          onClick={() => { setNotifOpen(false); setWalletOpen(false); }}
        />
      )}

      {/* ── Deposit / Withdraw modal ── */}
      {txModal && (
        <div
          style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(4px)' }}
          onClick={() => { setTxModal(null); setTxError(''); }}
        >
          <div
            style={{ background:'var(--card)', border:'1px solid var(--line)', borderRadius:16, padding:'28px 28px 24px', width:420, maxWidth:'92vw', boxShadow:'0 24px 64px rgba(0,0,0,0.4)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:22 }}>
              <div>
                <h3 style={{ margin:0, fontSize:17, fontWeight:600 }}>
                  {txModal === 'deposit' ? 'Deposit into vault' : 'Withdraw from vault'}
                </h3>
                <div style={{ fontFamily:'var(--mono)', fontSize:11.5, color:'var(--mute)', marginTop:4 }}>
                  {txModal === 'deposit' ? 'Funds move from your wallet → vault' : 'Funds move from vault → your wallet'}
                </div>
              </div>
              <button
                onClick={() => { setTxModal(null); setTxError(''); }}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--mute)', padding:6, display:'flex', alignItems:'center' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 4l8 8M12 4l-8 8"/></svg>
              </button>
            </div>

            {/* Token selector */}
            <div style={{ display:'flex', gap:8, marginBottom:18 }}>
              {(['WETH','USDC'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setDepositToken(t); setDepositInput(''); setWithdrawInput(''); setTxError(''); }}
                  style={{
                    flex:1, padding:'10px 0', borderRadius:10, border:'1px solid',
                    borderColor: depositToken === t ? 'var(--accent)' : 'var(--line)',
                    background: depositToken === t ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                    color: depositToken === t ? 'var(--accent)' : 'var(--ink-2)',
                    fontFamily:'var(--mono)', fontWeight:600, fontSize:13, cursor:'pointer',
                    transition:'all .15s',
                  }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Balances */}
            <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'var(--mono)', fontSize:12, color:'var(--mute)', marginBottom:12, padding:'10px 14px', background:'rgba(255,255,255,0.03)', borderRadius:8, border:'1px solid var(--line)' }}>
              <div>
                <div style={{ marginBottom:3 }}>Wallet</div>
                <div style={{ color:'var(--ink)', fontWeight:600 }}>
                  {depositToken === 'WETH' ? wethBalFmt : usdcBalFmt} {depositToken}
                </div>
              </div>
              <div style={{ width:1, background:'var(--line)' }} />
              <div style={{ textAlign:'right' }}>
                <div style={{ marginBottom:3 }}>Vault</div>
                <div style={{ color:'var(--accent)', fontWeight:600 }}>
                  {depositToken === 'WETH' ? vaultWethFmt : vaultUsdcFmt} {depositToken}
                </div>
              </div>
            </div>

            {/* Amount input */}
            <div style={{ marginBottom:6 }}>
              <div style={{ fontFamily:'var(--mono)', fontSize:'10.5px', color:'var(--mute)', letterSpacing:'0.07em', textTransform:'uppercase', marginBottom:7 }}>Amount</div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input
                  type="number"
                  min="0"
                  step="any"
                  autoFocus
                  placeholder={`0.00 ${depositToken}`}
                  value={txModal === 'deposit' ? depositInput : withdrawInput}
                  onChange={e => txModal === 'deposit' ? setDepositInput(e.target.value) : setWithdrawInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { txModal === 'deposit' ? handleDeposit() : handleWithdraw(); } }}
                  style={{ flex:1, background:'transparent', border:'1px solid var(--line)', borderRadius:8, padding:'11px 14px', color:'var(--ink)', fontFamily:'var(--mono)', fontSize:15, outline:'none' }}
                />
                {/* Max button */}
                <button
                  onClick={() => {
                    const maxWallet = depositToken === 'WETH' ? wethBalFmt : usdcBalFmt;
                    const maxVault  = depositToken === 'WETH' ? vaultWethFmt : vaultUsdcFmt;
                    const val = txModal === 'deposit' ? maxWallet : maxVault;
                    if (txModal === 'deposit') setDepositInput(val); else setWithdrawInput(val);
                  }}
                  style={{ padding:'11px 14px', borderRadius:8, border:'1px solid var(--line)', background:'transparent', color:'var(--accent)', fontFamily:'var(--mono)', fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}
                >
                  Max
                </button>
              </div>
            </div>

            {/* Error */}
            {txError && (
              <div style={{ fontFamily:'var(--mono)', fontSize:11.5, color:'var(--red,#f87171)', marginTop:8, lineHeight:1.5 }}>{txError}</div>
            )}

            {/* Action button */}
            <button
              onClick={txModal === 'deposit' ? handleDeposit : handleWithdraw}
              disabled={txModal === 'deposit' ? (deposit.isPending || !depositInput) : (withdraw.isPending || !withdrawInput)}
              style={{
                width:'100%', marginTop:20, padding:'13px 0', borderRadius:10, border:'none', cursor:'pointer',
                background: txModal === 'deposit' ? 'var(--accent)' : 'color-mix(in srgb, var(--warm) 80%, transparent)',
                color: txModal === 'deposit' ? '#0a1a12' : '#fff',
                fontWeight:700, fontSize:14, fontFamily:'var(--sans)',
                opacity: (txModal === 'deposit' ? (deposit.isPending || !depositInput) : (withdraw.isPending || !withdrawInput)) ? 0.5 : 1,
                transition:'opacity .15s',
              }}
            >
              {txModal === 'deposit'
                ? (deposit.isPending ? 'Approving & depositing…' : `Deposit ${depositInput || ''} ${depositToken}`)
                : (withdraw.isPending ? 'Withdrawing…' : `Withdraw ${withdrawInput || ''} ${depositToken}`)
              }
            </button>

            <div style={{ textAlign:'center', marginTop:12, fontFamily:'var(--mono)', fontSize:11, color:'var(--mute)' }}>
              {txModal === 'deposit' ? '2 transactions: approve + deposit' : '1 transaction: withdraw to your wallet'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
