import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useMarketData } from '../hooks/useMarketData';
import { useTokenPrice } from '../hooks/useTokenPrice';
import HeroNetwork from '../components/landing/HeroNetwork';

type Tab = 'conservative' | 'balanced' | 'aggressive';

// Logo with graceful fallback to styled letter glyph
function XLogo({ src, alt, letter, bg }: { src: string; alt: string; letter: string; bg: string }) {
  const [err, setErr] = useState(false);
  if (err) return <div className="lp-glyph" style={{ background: bg }}>{letter}</div>;
  return (
    <div className="lp-glyph lp-glyph-logo">
      <img src={src} alt={alt} onError={() => setErr(true)} />
    </div>
  );
}

export default function LandingPage({ isDarkMode: _isDarkMode, toggleDarkMode: _toggleDarkMode }: { isDarkMode: boolean; toggleDarkMode: () => void }) {
  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const navigate = useNavigate();
  // Must use the same per-wallet check as App.tsx — checking only the key causes a
  // loop where a returning wallet's old key bypasses onboarding for a NEW wallet.
  const savedWallet = localStorage.getItem('aria-onboarding-wallet');
  const onboardingDone = !!localStorage.getItem('aria-onboarding-done') &&
    !!savedWallet && !!address &&
    savedWallet === address.toLowerCase();
  const go = () => onboardingDone ? openConnectModal?.() : navigate('/onboarding');
  const [activeTab, setActiveTab] = useState<Tab>('conservative');
  const [typerText, setTyperText] = useState(' ');
  const [activeDot, setActiveDot] = useState(0);
  const pageRefs = useRef<(HTMLElement | null)[]>([]);
  const lpRef = useRef<HTMLDivElement>(null);

  // Typewriter
  useEffect(() => {
    const phrases = ['Onchain. Autonomous.'];
    let pi = 0, ci = 0, erasing = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const text = phrases[pi];
      if (!erasing) {
        ci++;
        setTyperText(text.slice(0, ci) || ' ');
        if (ci >= text.length) { erasing = true; timer = setTimeout(tick, 1800); return; }
        timer = setTimeout(tick, 65);
      } else {
        ci--;
        setTyperText(text.slice(0, ci) || ' ');
        if (ci <= 0) { erasing = false; pi = (pi + 1) % phrases.length; timer = setTimeout(tick, 350); return; }
        timer = setTimeout(tick, 35);
      }
    };
    timer = setTimeout(tick, 800);
    return () => clearTimeout(timer);
  }, []);

  // Intersection observer for dot nav + in-view animations
  useEffect(() => {
    const pages = pageRefs.current.filter(Boolean) as HTMLElement[];
    if (!pages.length) return;
    pages[0]?.classList.add('lp-in-view');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        const idx = pages.indexOf(e.target as HTMLElement);
        if (idx < 0) return;
        if (e.isIntersecting && e.intersectionRatio > 0.42) {
          e.target.classList.add('lp-in-view');
          setActiveDot(idx);
        }
      });
    }, { threshold: [0, 0.42, 0.65, 1] });
    pages.forEach(p => io.observe(p));
    return () => io.disconnect();
  }, []);

  const scrollTo = useCallback((i: number) => {
    pageRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const setRef = (i: number) => (el: HTMLElement | null) => { pageRefs.current[i] = el; };

  const { pools: marketPools } = useMarketData();
  const { eth: ethPrice } = useTokenPrice();

  const sections = ['ARIA', 'Demo', 'Problem', 'Intelligence', 'Assets', 'Profiles', 'Architecture', 'Integrations', 'Roadmap', 'CTA'];

  return (
    <div className="lp" ref={lpRef}>

      {/* ===== DOT NAV ===== */}
      <nav className="lp-dotnav" aria-label="Section navigator">
        {sections.map((label, i) => (
          <button
            key={i}
            className={activeDot === i ? 'on' : ''}
            data-label={label}
            aria-label={`Go to ${label}`}
            onClick={() => scrollTo(i)}
          />
        ))}
      </nav>

      {/* ===== TOP NAV ===== */}
      <nav className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <div className="lp-brand">
            <div className="lp-brand-mark"><img src="/logo.png" alt="ARIA" /></div>
            <span className="lp-brand-name">ARIA</span>
          </div>
          <div className="lp-nav-links">
            <a onClick={() => scrollTo(7)} style={{ cursor: 'pointer' }}>Protocol</a>
            <a onClick={() => scrollTo(5)} style={{ cursor: 'pointer' }}>Risk profiles</a>
            <a onClick={() => scrollTo(7)} style={{ cursor: 'pointer' }}>Integrations</a>
            <a href="/docs" data-tour="docs-link">Docs</a>
          </div>
          <div className="lp-nav-cta">
            <span className="lp-chain-pill"><span className="lp-d" />Mantle</span>
            <button
              className="lp-btn lp-btn-primary"
              onClick={() => go()}
            >
              Launch app →
            </button>
          </div>
        </div>
      </nav>

      {/* ===== HERO ===== */}
      <section className="lp-page lp-hero" ref={setRef(0)}>
        <div className="lp-hero-bg" />
        {/* <video
          className="lp-hero-video"
          src="/animation.mp4"
          autoPlay
          loop
          muted
          playsInline
          aria-hidden="true"
        /> */}
        <HeroNetwork />
        <div className="lp-wrap lp-hero-inner">
          <div className="lp-pill">
            <span className="lp-dot" />
            Live on Mantle, v1.0 audited and shipping
            <span className="lp-pill-tag">MAINNET</span>
          </div>
          <div className="lp-hero-content">
            <h1 className="lp-hero-h" data-tour="hero-heading">
              Real World Assets,<br />
              <em>actively</em> managed.<br />
              <span className="lp-accent-word">{typerText}</span>
            </h1>
            <p className="lp-hero-sub">
              ARIA is an autonomous protocol that puts your WETH and USDC to work, monitoring liquidity,
              capturing yield across Mantle, and rebalancing in real time. You set the risk profile.
              ARIA handles the rest, and explains every move.
            </p>
            <div className="lp-hero-actions">
              <button className="lp-btn lp-btn-primary lp-btn-lg" data-tour="connect-wallet" onClick={() => go()}>
                Connect wallet →
              </button>
              <button className="lp-btn lp-btn-lg" onClick={() => navigate('/docs')}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2.5h7L13 5.5V13.5H3z" /><path d="M10 2.5V5.5H13" /><path d="M5.5 8.5h5M5.5 10.5h5" /></svg>
                Read whitepaper
              </button>
            </div>
          </div>
        </div>
        <a className="lp-hero-scroll" onClick={() => scrollTo(1)} style={{ cursor: 'pointer' }} aria-label="Scroll to demo">
          <span>Scroll</span>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 6l4 4 4-4" /></svg>
        </a>
      </section>

      {/* ===== DEMO (browser mockup) ===== */}
      <section className="lp-page lp-stage-section" ref={setRef(1)}>
        <div className="lp-wrap">
          <div className="lp-stage" aria-label="ARIA protocol dashboard">
            <div className="lp-stage-top">
              <div className="lp-stage-dots"><span /><span /><span /></div>
              <div className="lp-stage-addr">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="6" width="10" height="8" rx="1" /><path d="M6 6V4a2 2 0 014 0v2" /></svg>
                app.aria.finance  /  vault  /  0x7c2a…f41e
              </div>
              <div className="lp-stage-addr" style={{ flex: 0, color: 'var(--accent)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)', display: 'inline-block' }} />
                Mantle
              </div>
            </div>

            <div className="lp-stage-body">

              {/* ── Top nav — mirrors real dashboard header ── */}
              <div className="lp-app-hdr">
                <div className="lp-app-brand">
                  <div className="lp-app-brand-dot" />
                  ARIA
                </div>
                {/* View tabs */}
                <div className="lp-demo-tabs">
                  {['Portfolio','Activity','Markets','Settings'].map((t, i) => (
                    <span key={t} className={`lp-demo-tab${i === 0 ? ' active' : ''}`}>{t}</span>
                  ))}
                </div>
                <div style={{ flex: 1 }} />
                <div className="lp-app-chip"><span className="lp-app-dot" />Mantle</div>
                <div className="lp-app-chip">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 9, height: 9 }}><rect x="2" y="4" width="12" height="8" rx="1.5"/><path d="M2 7h12"/></svg>
                  0x7c2a…f41e &nbsp;·&nbsp; 2.40 ETH
                </div>
                <div className="lp-app-icon-btn">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 12, height: 12 }}><path d="M3 6.5a4.5 4.5 0 019 0V10l1 1.5H2l1-1.5z"/><path d="M6 13a2 2 0 004 0"/></svg>
                </div>
              </div>

              {/* ── Portfolio view — mirrors real dashboard layout ── */}
              <div className="lp-demo-content">

                {/* Greeting row */}
                <div className="lp-dm-greet">
                  <div>
                    <h2>Good morning, <em>demo.</em></h2>
                    <div className="lp-dm-greet-sub">Vault deployed on Mantle · 2.40 WETH + 5,200 USDC</div>
                  </div>
                  <div className="lp-dm-btns">
                    <div className="lp-dm-btn">Withdraw</div>
                    <div className="lp-dm-btn primary">Deposit</div>
                  </div>
                </div>

                {/* 5 KPI cards — matches real dashboard exactly */}
                <div className="lp-dm-kpis">
                  <div className="lp-dm-kpi lead">
                    <div className="lp-dm-kk">Total vault value</div>
                    <div className="lp-dm-vv">{ethPrice > 0 ? `$${(2.4 * ethPrice + 5200).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '$—'}</div>
                    <div className="lp-dm-dd">2.40 WETH · 5,200 USDC</div>
                  </div>
                  <div className="lp-dm-kpi">
                    <div className="lp-dm-kk">Wallet balance</div>
                    <div className="lp-dm-vv">{ethPrice > 0 ? `$${(0.8 * ethPrice + 320).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '$—'}</div>
                    <div className="lp-dm-dd">0.80 WETH · 320 USDC</div>
                  </div>
                  <div className="lp-dm-kpi">
                    <div className="lp-dm-kk">MNT price</div>
                    <div className="lp-dm-vv">$0.74</div>
                    <div className="lp-dm-dd">coingecko, live</div>
                  </div>
                  <div className="lp-dm-kpi">
                    <div className="lp-dm-kk">Vault status</div>
                    <div className="lp-dm-vv" style={{ color: 'var(--accent)' }}>Active</div>
                    <div className="lp-dm-dd">live on Mantle</div>
                  </div>
                  <div className="lp-dm-kpi">
                    <div className="lp-dm-kk">Markets tracked</div>
                    <div className="lp-dm-vv">{marketPools.length > 0 ? marketPools.length : 3}</div>
                    <div className="lp-dm-dd">Mantle DeFi</div>
                  </div>
                </div>

                {/* Two-column row: portfolio chart + active strategy */}
                <div className="lp-dm-2col">

                  {/* Portfolio value chart */}
                  <div className="lp-dm-chart">
                    <div className="lp-dm-chart-h">
                      <span className="lp-dm-chart-title">Portfolio value</span>
                      <div className="lp-dm-ranges">
                        {(['24H','7D','30D','90D','ALL'] as const).map((r, i) => (
                          <span key={r} className={`lp-dm-range${i === 3 ? ' on' : ''}`}>{r}</span>
                        ))}
                      </div>
                    </div>
                    <div style={{ position: 'relative' }}>
                      <div className="lp-dm-chart-overlay">
                        <span>{ethPrice > 0 ? `$${(2.4 * ethPrice + 5200).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '$—'} total</span>
                        <span style={{ color: 'var(--accent)' }}>+12.4% this period</span>
                      </div>
                      <svg viewBox="0 0 600 80" preserveAspectRatio="none" className="lp-dm-chart-svg">
                        <defs>
                          <linearGradient id="dmg2" x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor="#75e5b0" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#75e5b0" stopOpacity="0" />
                          </linearGradient>
                        </defs>
                        <path d="M0,72 L50,68 L100,65 L150,60 L180,55 L220,48 L260,42 L300,36 L340,29 L380,23 L420,18 L460,14 L500,10 L540,7 L600,4 L600,80 L0,80 Z" fill="url(#dmg2)" />
                        <path d="M0,72 L50,68 L100,65 L150,60 L180,55 L220,48 L260,42 L300,36 L340,29 L380,23 L420,18 L460,14 L500,10 L540,7 L600,4" stroke="#75e5b0" strokeWidth="1.5" fill="none" />
                        <circle cx="600" cy="4" r="3" fill="#75e5b0" />
                        <circle cx="600" cy="4" r="7" fill="#75e5b0" opacity="0.2" />
                      </svg>
                    </div>
                  </div>

                  {/* Active strategy card */}
                  <div className="lp-dm-strat">
                    <div className="lp-dm-strat-h">
                      Active strategy
                      <span className="lp-dm-strat-badge">balanced</span>
                    </div>
                    <div className="lp-dm-strat-row">
                      <span className="lp-dm-strat-lbl">Risk profile</span>
                      <span className="lp-dm-strat-val" style={{ color: 'var(--accent)' }}>Balanced · 9–14% APY</span>
                    </div>
                    <div className="lp-dm-strat-row" style={{ background: 'rgba(117,229,176,0.05)', borderRadius: 6, padding: '5px 8px', margin: '2px 0' }}>
                      <span className="lp-dm-strat-lbl">
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: 'linear-gradient(135deg,#75e5b0,#4dd394)', display: 'inline-block', marginRight: 5 }} />
                        {marketPools[0]?.nm ?? 'Agni'} · {marketPools[0]?.sub ?? 'WETH/MNT-0.3%'}
                      </span>
                      <span className="lp-dm-strat-val" style={{ color: 'var(--accent)' }}>{marketPools[0]?.apy ?? '14.2%'}</span>
                    </div>
                    <div className="lp-dm-strat-row">
                      <span className="lp-dm-strat-lbl">
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: 'linear-gradient(135deg,#7afff0,#3dd9c4)', display: 'inline-block', marginRight: 5 }} />
                        {marketPools[1]?.nm ?? 'FusionX'} · {marketPools[1]?.sub ?? 'WETH/USDC-0.05%'}
                      </span>
                      <span className="lp-dm-strat-val">{marketPools[1]?.apy ?? '11.1%'}</span>
                    </div>
                    <div className="lp-dm-strat-row" style={{ marginTop: 4, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                      <span className="lp-dm-strat-lbl">Agent</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)', display: 'inline-block' }} />
                        <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono)', fontSize: 10 }}>scanning · 5 min cycle</span>
                      </span>
                    </div>
                  </div>

                </div>

                {/* Activity feed */}
                <div className="lp-log-h">
                  Activity feed
                  <span className="lp-live">live</span>
                </div>
                <div className="lp-log">
                  {(marketPools.length > 0 ? [
                    { ts: 'now',   body: `Reallocated 2.40 WETH → ${marketPools[0]?.nm ?? 'Agni'} ${marketPools[0]?.sub ?? 'WETH/MNT'} · ${marketPools[0]?.apy ?? '14.2%'} APY`, tag: '+192 bps', type: 'exec' },
                    { ts: '04:11', body: `${marketPools[1]?.nm ?? 'FusionX'} ${marketPools[1]?.sub ?? 'WETH/USDC'} — yield ${marketPools[1]?.apy ?? '11.1%'} · below threshold, holding`, tag: 'hold', type: 'signal' },
                    { ts: '02:31', body: 'Liquidity depth check: all active pools above floor · no action needed', tag: 'ok', type: 'signal' },
                  ] : [
                    { ts: '08:42', body: 'Reallocated 2.40 WETH → Agni WETH/MNT-0.3% · 14.2% APY', tag: '+192 bps', type: 'exec' },
                    { ts: '04:11', body: 'FusionX WETH/USDC yield 11.1% · below 75 bps threshold, holding current allocation', tag: 'hold', type: 'signal' },
                    { ts: '02:31', body: 'Liquidity depth check: all pools above floor · no action needed', tag: 'ok', type: 'signal' },
                  ]).map((item, i) => (
                    <div key={i} className={`lp-log-item ${item.type}`}>
                      <span className="lp-time">{item.ts}</span>
                      <div className="lp-body"><b>{item.body}</b> <span className="lp-tag-l">{item.tag}</span></div>
                    </div>
                  ))}
                </div>

                {/* Ask ARIA input */}
                <div className="lp-input-bar">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 11, height: 11, opacity: 0.4, flexShrink: 0 }}><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 2"/></svg>
                  Ask ARIA about your vault, a pool, or any decision…
                  <span className="lp-cursor" />
                </div>

              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== LOGO STRIP ===== */}
      <section className="lp-strip">
        <div className="lp-wrap">
          <div className="lp-strip-h">Managing capital across Mantle's RWA ecosystem</div>
          <div className="lp-logos">
            {[
              { nm: 'Agni Finance', bg: 'linear-gradient(135deg,#75e5b0,#4dd394)' },
              { nm: 'FusionX', bg: 'linear-gradient(135deg,#7afff0,#3dd9c4)' },
              { nm: 'Lendle', bg: 'linear-gradient(135deg,#ff7878,#d84a4a)' },
              { nm: 'Init Capital', bg: 'linear-gradient(135deg,#a78bff,#7a4dff)' },
              { nm: 'Pendle', bg: 'linear-gradient(135deg,#ffb685,#ff8a4a)' },
              { nm: 'Cleopatra', bg: 'linear-gradient(135deg,#8ec5ff,#5a8ed8)' },
            ].map(l => (
              <div key={l.nm} className="lp-logo">
                <span className="lp-sw" style={{ background: l.bg }} />
                {l.nm}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== PROBLEM ===== */}
      <section className="lp-page lp-problem" ref={setRef(2)}>
        <div className="lp-wrap">
          <div className="lp-sec-head" style={{ paddingTop: 80, paddingBottom: 30 }}>
            <div className="lp-eyebrow">The structural gap</div>
            <h2 className="lp-sec-h">RWA capital exists.<br />It just <em>doesn't work.</em></h2>
            <p className="lp-sec-sub">Tokenized treasuries and liquid staking gave us the assets. The infrastructure to actively manage them never caught up. Four problems define the gap.</p>
          </div>
          <div className="lp-prob-grid">
            {[
              { n: '01', h: <>Incentive-driven <em>liquidity fragility</em></>, p: 'TVL looks substantial on paper, but most depth is rented. When emissions reduce, capital exits in hours, and your exit gets the slippage. Effective risk management means detecting this before it triggers, not after.' },
              { n: '02', h: <>Yield opportunity <em>decay</em></>, p: 'Rates shift on timescales of hours across Lendle, Init Capital, Pendle, FusionX, and Agni. The spread between best and worst risk-adjusted return at any moment can exceed several hundred basis points. No human can sustain that monitoring.' },
              { n: '03', h: <>Single-position <em>concentration</em></>, p: 'Most RWA capital sits in one position and stays there. The ecosystem supports complementary strategies that collectively beat any static deployment.' },
              { n: '04', h: <>Risk <em>opacity</em></>, p: "What fraction of your pool's liquidity is incentive-dependent? What's your real exit cost at size? Without those answers, you can't make informed decisions about your own capital." },
            ].map(prob => (
              <div key={prob.n} className="lp-prob">
                <div className="lp-num">PROBLEM {prob.n}</div>
                <h3>{prob.h}</h3>
                <p>{prob.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== INTELLIGENCE LAYERS ===== */}
      <section className="lp-page" ref={setRef(3)} style={{ padding: '60px 0' }}>
        <div className="lp-wrap">
          <div className="lp-sec-head">
            <div className="lp-eyebrow">The ARIA protocol</div>
            <h2 className="lp-sec-h">Three intelligence layers,<br />operating in <em>continuous parallel.</em></h2>
            <p className="lp-sec-sub">You connect a wallet, pick a risk profile, deposit. ARIA monitors, scores, and executes, without intervention, and without ambiguity.</p>
          </div>
          <div className="lp-pillars">
            {/* Layer 1 */}
            <article className="lp-pillar">
              <div className="lp-pillar-art lp-art-1">
                {[
                  { nm: 'Agni WETH/USDC', score: 72, cls: '' },
                  { nm: 'Lendle WETH', score: 71, cls: '' },
                  { nm: 'FusionX mETH/ETH', score: 54, cls: 'warn' },
                  { nm: 'Cleopatra mETH', score: 38, cls: 'bad' },
                  { nm: 'Pendle PT-USDC', score: 81, cls: '' },
                ].map(pool => (
                  <div key={pool.nm} className="lp-pool">
                    <span className="lp-pool-lbl">{pool.nm}</span>
                    <div className="lp-meter"><i className={pool.cls} style={{ width: `${pool.score}%` }} /></div>
                    <span className={`lp-score ${pool.cls}`}>Q {pool.score}</span>
                  </div>
                ))}
              </div>
              <div className="lp-pillar-body">
                <div className="lp-pillar-num">LAYER 01, LIQUIDITY QUALITY</div>
                <h3>Score before <em>you hold.</em></h3>
                <p>Every pool gets a Liquidity Quality Score from incentive dependency, historical behavior at emission cliffs, organic volume, and depth concentration. When a score drops toward your threshold, ARIA reallocates <em>before</em> the event, not after the slippage.</p>
              </div>
            </article>

            {/* Layer 2 */}
            <article className="lp-pillar">
              <div className="lp-pillar-art lp-art-2">
                <svg viewBox="-100 -100 200 200">
                  <circle cx="0" cy="0" r="80" stroke="rgba(255,255,255,0.06)" strokeWidth="1" fill="none" />
                  <circle cx="0" cy="0" r="60" stroke="rgba(255,255,255,0.05)" strokeWidth="1" fill="none" />
                  <circle cx="0" cy="0" r="40" stroke="rgba(255,255,255,0.04)" strokeWidth="1" fill="none" />
                  <line x1="-90" y1="0" x2="90" y2="0" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                  <line x1="0" y1="-90" x2="0" y2="90" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
                  <circle cx="55" cy="-32" r="5" fill="#75e5b0" />
                  <circle cx="55" cy="-32" r="11" fill="#75e5b0" opacity="0.25" />
                  <text x="62" y="-32" fill="#75e5b0" fontSize="7" fontFamily="ui-monospace, monospace">14.2%</text>
                  <circle cx="-48" cy="-22" r="3.5" fill="#ffb685" />
                  <text x="-78" y="-22" fill="#ffb685" fontSize="6.5" fontFamily="ui-monospace, monospace">11.3%</text>
                  <circle cx="32" cy="48" r="3" fill="#8ec5ff" />
                  <text x="38" y="50" fill="#8ec5ff" fontSize="6.5" fontFamily="ui-monospace, monospace">8.4%</text>
                  <circle cx="-38" cy="36" r="2.5" fill="#7a7d83" />
                  <text x="-70" y="38" fill="#7a7d83" fontSize="6.5" fontFamily="ui-monospace, monospace">6.1%</text>
                  <line x1="0" y1="0" x2="55" y2="-32" stroke="#75e5b0" strokeWidth="0.8" opacity="0.5" />
                </svg>
                <div className="lp-art-2-center">
                  <div className="v">+192</div>
                  <div className="l">BPS DETECTED</div>
                </div>
              </div>
              <div className="lp-pillar-body">
                <div className="lp-pillar-num">LAYER 02, YIELD DETECTION</div>
                <h3>Risk-adjusted,<br />not <em>headline.</em></h3>
                <p>ARIA scans yields across every integrated protocol and recomputes risk-adjusted return using each pool's quality score, opportunity duration, and gas. Reallocation only triggers when the improvement clears your profile's threshold.</p>
              </div>
            </article>

            {/* Layer 3 */}
            <article className="lp-pillar">
              <div className="lp-pillar-art lp-art-3">
                <div className="lp-step"><span className="lp-n">1</span> withdraw <b>24,800 USDY</b> <span className="lp-arrow">→</span> Agni</div>
                <div className="lp-step"><span className="lp-n">2</span> swap path <b>USDY ↔ USDC</b> <span className="lp-gas">0.0014 ETH</span></div>
                <div className="lp-step"><span className="lp-n">3</span> deposit <b>24,800 USDY</b> <span className="lp-arrow">→</span> Lendle</div>
                <div className="lp-step"><span className="lp-n">4</span> <span className="lp-sig">multicall, 1 tx, vault-only</span></div>
                <div className="lp-hash">tx, 0x9c4a…71fe, block 84,212,901, 4.2s confirmed</div>
              </div>
              <div className="lp-pillar-body">
                <div className="lp-pillar-num">LAYER 03, AUTONOMOUS EXECUTION</div>
                <h3>One vault,<br />bounded <em>permissions.</em></h3>
                <p>When signals align, ARIA constructs swap + withdraw + deposit as a single coordinated transaction through your vault contract. Funds never leave your approved protocol set. Every action lands in your activity feed with the conditions that drove it.</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ===== ASSETS ===== */}
      <section className="lp-page lp-assets" ref={setRef(4)}>
        <div className="lp-wrap">
          <div className="lp-sec-head" style={{ padding: '60px 0 0' }}>
            <div className="lp-eyebrow">Supported assets</div>
            <h2 className="lp-sec-h">Twelve assets.<br /><em>One autonomous manager.</em></h2>
          </div>
          <div className="lp-asset-grid">

            {/* ── Core assets ── */}
            <div className="lp-asset-card lp-ac-weth">
              <div className="lp-asset-head">
                <div className="lp-glyph" style={{ background: 'linear-gradient(135deg,#75e5b0,#4dd394)' }}>W</div>
                <div className="lp-asset-name">WETH <em>Wrapped Ether</em></div>
              </div>
              <div className="lp-asset-stats">
                <div className="lp-asset-stat"><div className="k">Type</div><div className="v">Crypto native</div></div>
                <div className="lp-asset-stat"><div className="k">Under ARIA</div><div className="v up">7.8–24.1<em>%</em></div></div>
                <div className="lp-asset-stat"><div className="k">Backing</div><div className="v">ETH<em> 1:1</em></div></div>
              </div>
              <div className="lp-asset-desc">The canonical wrapped ether on Mantle. Deployed into concentrated liquidity, lending markets, and yield-optimized strategies via ARIA's approved protocol set.</div>
            </div>

            <div className="lp-asset-card lp-ac-usdc">
              <div className="lp-asset-head">
                <div className="lp-glyph" style={{ background: 'linear-gradient(135deg,#8ec5ff,#5a8ed8)' }}>U</div>
                <div className="lp-asset-name">USDC <em>USD Coin</em></div>
              </div>
              <div className="lp-asset-stats">
                <div className="lp-asset-stat"><div className="k">Type</div><div className="v">Stablecoin</div></div>
                <div className="lp-asset-stat"><div className="k">Under ARIA</div><div className="v up">6.2–18.6<em>%</em></div></div>
                <div className="lp-asset-stat"><div className="k">Backing</div><div className="v">USD<em> cash</em></div></div>
              </div>
              <div className="lp-asset-desc">Circle's regulated stablecoin. The deepest stable-asset liquidity on Mantle, deployed across lending markets, AMM pools, and yield tokenization strategies.</div>
            </div>

            {/* ── xStocks — tokenized equities via Fluxion DEX ── */}
            <div className="lp-asset-card lp-ac-xstock">
              <div className="lp-asset-head">
                <XLogo src="https://s3-symbol-logo.tradingview.com/tesla.svg" alt="Tesla" letter="T" bg="linear-gradient(135deg,#e03535,#9b1414)" />
                <div className="lp-asset-name">TSLAx <em>Tesla Inc</em></div>
                <span className="lp-soon">Soon</span>
              </div>
              <div className="lp-asset-stats">
                <div className="lp-asset-stat"><div className="k">Type</div><div className="v">Tokenized equity</div></div>
                <div className="lp-asset-stat"><div className="k">Platform</div><div className="v">Fluxion DEX</div></div>
                <div className="lp-asset-stat"><div className="k">Backing</div><div className="v">TSLA equity</div></div>
              </div>
              <div className="lp-asset-desc">Tokenized Tesla common stock on Mantle. Trade 24/7, backed 1:1 by real Tesla shares. No brokerage, no market hours.</div>
            </div>

            <div className="lp-asset-card lp-ac-xstock">
              <div className="lp-asset-head">
                <XLogo src="https://s3-symbol-logo.tradingview.com/nvidia.svg" alt="Nvidia" letter="N" bg="linear-gradient(135deg,#76b900,#4d7a00)" />
                <div className="lp-asset-name">NVDAx <em>Nvidia Corp</em></div>
                <span className="lp-soon">Soon</span>
              </div>
              <div className="lp-asset-stats">
                <div className="lp-asset-stat"><div className="k">Type</div><div className="v">Tokenized equity</div></div>
                <div className="lp-asset-stat"><div className="k">Platform</div><div className="v">Fluxion DEX</div></div>
                <div className="lp-asset-stat"><div className="k">Backing</div><div className="v">NVDA equity</div></div>
              </div>
              <div className="lp-asset-desc">Tokenized Nvidia stock on Mantle. Access the world's leading AI chip company on-chain, 24/7, with real-time settlement.</div>
            </div>

            <div className="lp-asset-card lp-ac-xstock">
              <div className="lp-asset-head">
                <XLogo src="https://s3-symbol-logo.tradingview.com/apple.svg" alt="Apple" letter="A" bg="linear-gradient(135deg,#aaaaaa,#666666)" />
                <div className="lp-asset-name">AAPLx <em>Apple Inc</em></div>
                <span className="lp-soon">Soon</span>
              </div>
              <div className="lp-asset-stats">
                <div className="lp-asset-stat"><div className="k">Type</div><div className="v">Tokenized equity</div></div>
                <div className="lp-asset-stat"><div className="k">Platform</div><div className="v">Fluxion DEX</div></div>
                <div className="lp-asset-stat"><div className="k">Backing</div><div className="v">AAPL equity</div></div>
              </div>
              <div className="lp-asset-desc">Tokenized Apple stock. Own a slice of the world's most valuable company on-chain, redeemable 1:1 for real AAPL shares.</div>
            </div>

            <div className="lp-asset-card lp-ac-xstock">
              <div className="lp-asset-head">
                <XLogo src="https://s3-symbol-logo.tradingview.com/meta-platforms.svg" alt="Meta" letter="M" bg="linear-gradient(135deg,#1877f2,#0a50c8)" />
                <div className="lp-asset-name">METAx <em>Meta Platforms</em></div>
                <span className="lp-soon">Soon</span>
              </div>
              <div className="lp-asset-stats">
                <div className="lp-asset-stat"><div className="k">Type</div><div className="v">Tokenized equity</div></div>
                <div className="lp-asset-stat"><div className="k">Platform</div><div className="v">Fluxion DEX</div></div>
                <div className="lp-asset-stat"><div className="k">Backing</div><div className="v">META equity</div></div>
              </div>
              <div className="lp-asset-desc">Tokenized Meta Platforms stock. On-chain exposure to Facebook, Instagram, and WhatsApp's parent company — no custody risk.</div>
            </div>

            <div className="lp-asset-card lp-ac-xstock">
              <div className="lp-asset-head">
                <XLogo src="https://s3-symbol-logo.tradingview.com/alphabet.svg" alt="Alphabet" letter="G" bg="linear-gradient(135deg,#4285f4,#1a56c8)" />
                <div className="lp-asset-name">GOOGLx <em>Alphabet Inc</em></div>
                <span className="lp-soon">Soon</span>
              </div>
              <div className="lp-asset-stats">
                <div className="lp-asset-stat"><div className="k">Type</div><div className="v">Tokenized equity</div></div>
                <div className="lp-asset-stat"><div className="k">Platform</div><div className="v">Fluxion DEX</div></div>
                <div className="lp-asset-stat"><div className="k">Backing</div><div className="v">GOOGL equity</div></div>
              </div>
              <div className="lp-asset-desc">Tokenized Alphabet (Google) stock on Mantle. Exposure to Search, YouTube, and Google Cloud in a single on-chain token.</div>
            </div>

            <div className="lp-asset-card lp-ac-xstock">
              <div className="lp-asset-head">
                <XLogo src="https://s3-symbol-logo.tradingview.com/microstrategy.svg" alt="MicroStrategy" letter="M" bg="linear-gradient(135deg,#f7941d,#c46a08)" />
                <div className="lp-asset-name">MSTRx <em>MicroStrategy</em></div>
                <span className="lp-soon">Soon</span>
              </div>
              <div className="lp-asset-stats">
                <div className="lp-asset-stat"><div className="k">Type</div><div className="v">Tokenized equity</div></div>
                <div className="lp-asset-stat"><div className="k">Platform</div><div className="v">Fluxion DEX</div></div>
                <div className="lp-asset-stat"><div className="k">Backing</div><div className="v">MSTR equity</div></div>
              </div>
              <div className="lp-asset-desc">Tokenized MicroStrategy stock. Leveraged Bitcoin proxy on-chain — one of the highest-beta crypto-correlated equities available.</div>
            </div>

            <div className="lp-asset-card lp-ac-xstock">
              <div className="lp-asset-head">
                <XLogo src="https://s3-symbol-logo.tradingview.com/robinhood.svg" alt="Robinhood" letter="H" bg="linear-gradient(135deg,#00c805,#009204)" />
                <div className="lp-asset-name">HOODx <em>Robinhood</em></div>
                <span className="lp-soon">Soon</span>
              </div>
              <div className="lp-asset-stats">
                <div className="lp-asset-stat"><div className="k">Type</div><div className="v">Tokenized equity</div></div>
                <div className="lp-asset-stat"><div className="k">Platform</div><div className="v">Fluxion DEX</div></div>
                <div className="lp-asset-stat"><div className="k">Backing</div><div className="v">HOOD equity</div></div>
              </div>
              <div className="lp-asset-desc">Tokenized Robinhood Markets stock. On-chain exposure to the retail trading and crypto brokerage platform.</div>
            </div>

            <div className="lp-asset-card lp-ac-xstock">
              <div className="lp-asset-head">
                <XLogo src="https://s3-symbol-logo.tradingview.com/spdr-s-p-500-etf-trust.svg" alt="SPY" letter="S" bg="linear-gradient(135deg,#d4a017,#9e7410)" />
                <div className="lp-asset-name">SPYx <em>S&P 500 ETF</em></div>
                <span className="lp-soon">Soon</span>
              </div>
              <div className="lp-asset-stats">
                <div className="lp-asset-stat"><div className="k">Type</div><div className="v">Tokenized ETF</div></div>
                <div className="lp-asset-stat"><div className="k">Platform</div><div className="v">Fluxion DEX</div></div>
                <div className="lp-asset-stat"><div className="k">Backing</div><div className="v">500 US equities</div></div>
              </div>
              <div className="lp-asset-desc">Tokenized SPDR S&P 500 ETF. Broad US equity market exposure in a single on-chain token, tradeable 24/7 on Mantle.</div>
            </div>

            <div className="lp-asset-card lp-ac-xstock">
              <div className="lp-asset-head">
                <XLogo src="https://s3-symbol-logo.tradingview.com/invesco.svg" alt="QQQ" letter="Q" bg="linear-gradient(135deg,#6c5ce7,#4530b8)" />
                <div className="lp-asset-name">QQQx <em>Nasdaq-100 ETF</em></div>
                <span className="lp-soon">Soon</span>
              </div>
              <div className="lp-asset-stats">
                <div className="lp-asset-stat"><div className="k">Type</div><div className="v">Tokenized ETF</div></div>
                <div className="lp-asset-stat"><div className="k">Platform</div><div className="v">Fluxion DEX</div></div>
                <div className="lp-asset-stat"><div className="k">Backing</div><div className="v">100 US tech cos</div></div>
              </div>
              <div className="lp-asset-desc">Tokenized Invesco QQQ ETF tracking the Nasdaq-100. Concentrated tech exposure — NVDA, AAPL, MSFT, META, AMZN and more.</div>
            </div>

            <div className="lp-asset-card lp-ac-xstock">
              <div className="lp-asset-head">
                <XLogo src="https://s3-symbol-logo.tradingview.com/circle.svg" alt="Circle" letter="C" bg="linear-gradient(135deg,#2775ca,#1550a0)" />
                <div className="lp-asset-name">CRCLx <em>Circle</em></div>
                <span className="lp-soon">Soon</span>
              </div>
              <div className="lp-asset-stats">
                <div className="lp-asset-stat"><div className="k">Type</div><div className="v">Tokenized equity</div></div>
                <div className="lp-asset-stat"><div className="k">Platform</div><div className="v">Fluxion DEX</div></div>
                <div className="lp-asset-stat"><div className="k">Backing</div><div className="v">CRCL equity</div></div>
              </div>
              <div className="lp-asset-desc">Tokenized Circle stock. On-chain exposure to the issuer of USDC — the stablecoin infrastructure company at the heart of onchain finance.</div>
            </div>

          </div>
        </div>
      </section>

      {/* ===== RISK PROFILES ===== */}
      <section className="lp-page lp-tabs-section" ref={setRef(5)}>
        <div className="lp-wrap">
          <div className="lp-sec-head" style={{ paddingTop: 60 }}>
            <div className="lp-eyebrow">Three risk profiles</div>
            <h2 className="lp-sec-h">Set your appetite once.<br />ARIA stays <em>inside the lines.</em></h2>
            <p className="lp-sec-sub">Each profile governs reallocation thresholds, approved protocols, and concentration limits. Update them anytime, pause or withdraw with no timelock.</p>
          </div>
          <div className="lp-tabs" role="tablist">
            {(['conservative', 'balanced', 'aggressive'] as Tab[]).map(t => (
              <button
                key={t}
                className={`lp-tab${activeTab === t ? ' active' : ''}`}
                data-tab={t}
                onClick={() => setActiveTab(t)}
              >
                <span className="lp-tab-dt" />
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Conservative */}
          {activeTab === 'conservative' && (
            <div className="lp-tab-panel active">
              <div>
                <div className="lp-left-lbl"><span className="lp-tab-dt" style={{ background: 'var(--blue)' }} /><span style={{ color: 'var(--blue)' }}>PROFILE 01, CONSERVATIVE</span></div>
                <h3>Capital preservation,<br /><em>compounding</em> base yield.</h3>
                <p className="lp-summary">Stays in Agni and FusionX base pools. Won't touch a pool below quality 70 or with meaningful incentive dependency. Big reallocation threshold means the protocol holds steady.</p>
                <div className="lp-params">
                  <div className="lp-param"><span className="k">Target APY</span><span className="v"><b>6–9%</b></span></div>
                  <div className="lp-param"><span className="k">Quality floor</span><span className="v">70</span></div>
                  <div className="lp-param"><span className="k">Reallocation threshold</span><span className="v">150 bps</span></div>
                  <div className="lp-param"><span className="k">Max single-pool</span><span className="v">80%</span></div>
                  <div className="lp-param"><span className="k">Approved protocols</span><span className="v">Agni, FusionX</span></div>
                  <div className="lp-param"><span className="k">Incentivized pools</span><span className="v">excluded</span></div>
                </div>
              </div>
              <div className="lp-gauge">
                <div className="lp-gauge-h">
                  <span className="t">Target APY</span>
                  <span className="lp-asset-badge"><span className="lp-d" style={{ background: 'var(--blue)' }} />Conservative</span>
                </div>
                <div className="lp-gauge-apy">7.4<em>%</em></div>
                <div className="lp-gauge-range">range <b>6.0%, 9.0%</b>, expected median</div>
                <div className="lp-gauge-bar"><i style={{ left: '24%', width: '36%' }} /></div>
                <div className="lp-gauge-ticks"><span>0%</span><span>10%</span><span>20%</span><span>30%</span></div>
                <div className="lp-gauge-pools-h">Active protocols</div>
                <div className="lp-gauge-pools">
                  {['Agni','FusionX','Lendle','Init','Pendle','Cleopatra'].map((p, i) => (
                    <span key={p} className={`lp-gauge-pool${i < 2 ? ' on' : ''}`}>{p}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Balanced */}
          {activeTab === 'balanced' && (
            <div className="lp-tab-panel active">
              <div>
                <div className="lp-left-lbl"><span className="lp-tab-dt" style={{ background: 'var(--accent)' }} /><span style={{ color: 'var(--accent)' }}>PROFILE 02, BALANCED</span></div>
                <h3>Where most users land,<br />and stay.</h3>
                <p className="lp-summary">Lending protocols enter the set. Incentive-driven pools are permitted but only above quality 60. Tighter reallocation threshold means ARIA captures more opportunities while staying disciplined.</p>
                <div className="lp-params">
                  <div className="lp-param"><span className="k">Target APY</span><span className="v"><b>9–14%</b></span></div>
                  <div className="lp-param"><span className="k">Quality floor</span><span className="v">55</span></div>
                  <div className="lp-param"><span className="k">Reallocation threshold</span><span className="v">75 bps</span></div>
                  <div className="lp-param"><span className="k">Max single-pool</span><span className="v">65%</span></div>
                  <div className="lp-param"><span className="k">Approved protocols</span><span className="v">+ Lendle, Init</span></div>
                  <div className="lp-param"><span className="k">Incentivized pools</span><span className="v">≥ Q 60</span></div>
                </div>
              </div>
              <div className="lp-gauge">
                <div className="lp-gauge-h">
                  <span className="t">Target APY</span>
                  <span className="lp-asset-badge"><span className="lp-d" style={{ background: 'var(--accent)' }} />Balanced</span>
                </div>
                <div className="lp-gauge-apy">11.8<em>%</em></div>
                <div className="lp-gauge-range">range <b>9.0%, 14.0%</b>, expected median</div>
                <div className="lp-gauge-bar"><i style={{ left: '36%', width: '36%' }} /></div>
                <div className="lp-gauge-ticks"><span>0%</span><span>10%</span><span>20%</span><span>30%</span></div>
                <div className="lp-gauge-pools-h">Active protocols</div>
                <div className="lp-gauge-pools">
                  {['Agni','FusionX','Lendle','Init','Pendle','Cleopatra'].map((p, i) => (
                    <span key={p} className={`lp-gauge-pool${i < 4 ? ' on' : ''}`}>{p}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Aggressive */}
          {activeTab === 'aggressive' && (
            <div className="lp-tab-panel active">
              <div>
                <div className="lp-left-lbl"><span className="lp-tab-dt" style={{ background: 'var(--warm)' }} /><span style={{ color: 'var(--warm)' }}>PROFILE 03, AGGRESSIVE</span></div>
                <h3>Capture the full curve,<br />with <em>discipline.</em></h3>
                <p className="lp-summary">Adds Pendle yield tokenization and Cleopatra concentrated liquidity. Leveraged yield permitted. Lower thresholds mean ARIA reacts quickly to opportunities others won't catch.</p>
                <div className="lp-params">
                  <div className="lp-param"><span className="k">Target APY</span><span className="v"><b>14–25%+</b></span></div>
                  <div className="lp-param"><span className="k">Quality floor</span><span className="v">40</span></div>
                  <div className="lp-param"><span className="k">Reallocation threshold</span><span className="v">40 bps</span></div>
                  <div className="lp-param"><span className="k">Max single-pool</span><span className="v">50%</span></div>
                  <div className="lp-param"><span className="k">Approved protocols</span><span className="v">+ Pendle, Cleopatra</span></div>
                  <div className="lp-param"><span className="k">Leveraged strategies</span><span className="v">permitted</span></div>
                </div>
              </div>
              <div className="lp-gauge">
                <div className="lp-gauge-h">
                  <span className="t">Target APY</span>
                  <span className="lp-asset-badge"><span className="lp-d" style={{ background: 'var(--warm)' }} />Aggressive</span>
                </div>
                <div className="lp-gauge-apy">19.4<em>%</em></div>
                <div className="lp-gauge-range">range <b>14.0%, 25.0%+</b>, expected median</div>
                <div className="lp-gauge-bar"><i style={{ left: '48%', width: '38%' }} /></div>
                <div className="lp-gauge-ticks"><span>0%</span><span>10%</span><span>20%</span><span>30%</span></div>
                <div className="lp-gauge-pools-h">Active protocols</div>
                <div className="lp-gauge-pools">
                  {['Agni','FusionX','Lendle','Init','Pendle','Cleopatra'].map(p => (
                    <span key={p} className="lp-gauge-pool on">{p}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===== ARCHITECTURE ===== */}
      <section className="lp-page lp-how" data-tour="how-it-works" ref={setRef(6)}>
        <div className="lp-wrap">
          <div className="lp-sec-head" style={{ padding: 0 }}>
            <div className="lp-eyebrow">Technical architecture</div>
            <h2 className="lp-sec-h">Three layers.<br />Your <em>capital</em>, your <em>contract</em>, your <em>keys.</em></h2>
          </div>
          <div className="lp-arch">
            {[
              { lvl: 'LAYER 01, VAULT CONTRACT', h: <>Funds you <em>own.</em></>, p: 'Each user gets an individually deployed vault on Mantle. ARIA holds bounded execution permission — it can move funds only between protocols you approved at vault creation. Pause or withdraw anytime, no timelock.', stats: [['Per-user vaults','isolated'], ['Approved set','user-defined'], ['Withdrawal timelock','0s']] },
              { lvl: 'LAYER 02, INTELLIGENCE', h: <>Signals, scored<br />and <em>compared.</em></>, p: 'Autonomous agent continuously queries Mantle RPCs for pool state, emissions, lending rates, and liquidity composition. Converts raw data into Quality Scores and risk-adjusted yield deltas calibrated to your profile.', stats: [['RPC poll cadence','~12s'], ['Quality factors','4'], ['Profile calibration','per-vault']] },
              { lvl: 'LAYER 03, EXECUTION', h: <>Onchain, <em>atomic</em>,<br />auditable.</>, p: 'When signals align, ARIA submits a coordinated multicall through your vault. Withdraw, swap, deposit — one transaction, one block, one row in your activity feed with every condition that drove it.', stats: [['Median time-to-action','4–6s'], ['Circuit breakers','armed'], ['Audit logs','onchain']] },
            ].map((layer, i) => (
              <div key={i} className="lp-layer">
                <div className="lp-lvl">LAYER 0{i + 1}, <b>{['VAULT CONTRACT','INTELLIGENCE','EXECUTION'][i]}</b></div>
                <h4>{layer.h}</h4>
                <p>{layer.p}</p>
                <ul>
                  {layer.stats.map(([k, v]) => (
                    <li key={k}>{k}<span className="v">{v}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== INTEGRATIONS ===== */}
      <section className="lp-page lp-grid-bg" ref={setRef(7)}>
        <div className="lp-wrap" style={{ position: 'relative' }}>
          <div className="lp-sec-head" style={{ paddingTop: 0 }}>
            <div className="lp-eyebrow">Protocol integrations</div>
            <h2 className="lp-sec-h">Six protocols.<br />One <em>execution layer.</em></h2>
            <p className="lp-sec-sub">ARIA's approved-set architecture lets users compose strategies across Mantle's DeFi stack without ever taking custody of capital.</p>
          </div>
          <div className="lp-int-grid">
            {[
              { gl: 'A', bg: 'linear-gradient(135deg,#75e5b0,#4dd394)', nm: 'Agni Finance', role: 'CL, core', p: "Concentrated liquidity for WETH/USDC and mETH/ETH pools — the foundation of ARIA's base-case deployment." },
              { gl: 'F', bg: 'linear-gradient(135deg,#7afff0,#3dd9c4)', nm: 'FusionX', role: 'AMM', p: 'Standard AMM liquidity provision focused on ETH pairs. Used across all three risk profiles.' },
              { gl: 'L', bg: 'linear-gradient(135deg,#ff7878,#d84a4a)', nm: 'Lendle', role: 'Lending', p: 'Lending and borrowing markets. WETH as collateral plus deposit yield, unlocked on Balanced and Aggressive.' },
              { gl: 'I', bg: 'linear-gradient(135deg,#a78bff,#7a4dff)', nm: 'Init Capital', role: 'Lending', p: 'Isolated lending markets. Risk-isolated yield deployment for Balanced and above.' },
              { gl: 'P', bg: 'linear-gradient(135deg,#ffb685,#ff8a4a)', nm: 'Pendle', role: 'Yield curve', p: 'Yield tokenization. ARIA rotates between PT/YT positions to lock fixed yields or capture rate expansion.' },
              { gl: 'C', bg: 'linear-gradient(135deg,#8ec5ff,#5a8ed8)', nm: 'Cleopatra', role: 'CL, aggressive', p: 'Concentrated liquidity for high-yield strategies. Reserved for the Aggressive profile.' },
            ].map(card => (
              <div key={card.nm} className="lp-int-card">
                <div className="lp-int-top">
                  <div className="lp-int-nm">
                    <span className="lp-ico" style={{ background: card.bg }}>{card.gl}</span>
                    {card.nm}
                  </div>
                  <span className="lp-role">{card.role}</span>
                </div>
                <p>{card.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TRUST ===== */}
      <section className="lp-trust">
        <div className="lp-wrap">
          <div className="lp-trust-grid">
            {[
              { k: 'SELF-CUSTODY', p: "Funds live in your individual vault. ARIA cannot move them off the approved-protocol set." },
              { k: 'NO TIMELOCK', p: "Pause execution or withdraw at any time. There is no waiting period and no negotiation." },
              { k: 'AUDITED', p: "All vault and integration contracts audited by an independent firm. Reports published publicly before mainnet." },
              { k: 'EXPLAINED', p: "Every decision is logged with the conditions that drove it. Ask ARIA in natural language for any past action." },
            ].map(tr => (
              <div key={tr.k} className="lp-tr">
                <div className="lp-tr-k">{tr.k}</div>
                <p>{tr.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== ROADMAP ===== */}
      <section className="lp-page lp-roadmap" ref={setRef(8)}>
        <div className="lp-wrap">
          <div className="lp-sec-head" style={{ padding: 0 }}>
            <div className="lp-eyebrow">Roadmap</div>
            <h2 className="lp-sec-h">From RWA agent<br />to <em>RWA infrastructure.</em></h2>
          </div>
          <div className="lp-road-grid">
            <div className="lp-phase active">
              <div className="lp-ph">PHASE I, NOW</div>
              <div className="lp-phase-nm"><em>Foundation</em></div>
              <ul>
                <li>Audited vaults deployed on Mantle mainnet</li>
                <li>Conservative + Balanced profiles live</li>
                <li>Six launch protocol integrations</li>
                <li>Dashboard, activity feed, conversational interface</li>
              </ul>
            </div>
            <div className="lp-phase">
              <div className="lp-ph">PHASE II, Q3 2026</div>
              <div className="lp-phase-nm"><em>Expansion</em></div>
              <ul>
                <li>Aggressive profile, Pendle + Cleopatra strategies</li>
                <li>Multi-asset vault management with cross-asset logic</li>
                <li>Coverage extension to new RWA instruments on Mantle</li>
                <li>Institutional API for funds and protocol integrations</li>
              </ul>
            </div>
            <div className="lp-phase future">
              <div className="lp-ph">PHASE III, 2027</div>
              <div className="lp-phase-nm"><em>Infrastructure</em></div>
              <ul>
                <li>Cross-chain deployment to additional EVM networks</li>
                <li>Third-party SDK, quality scoring + yield detection</li>
                <li>Protocol governance over fees and parameters</li>
                <li>Foundational layer for RWA capital management</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="lp-page lp-cta" ref={setRef(9)}>
        <div className="lp-cta-bg" />
        <div className="lp-wrap">
          <h2>Real World Assets exist.<br />Make them <em>work.</em></h2>
          <p>Connect your wallet, pick a profile, deposit. ARIA handles continuous monitoring, risk-adjusted reallocation, and onchain execution — and explains every move in plain language.</p>
          <div className="lp-cta-actions">
            <button className="lp-btn lp-btn-primary lp-btn-lg" onClick={() => go()}>Launch app →</button>
            <button className="lp-btn lp-btn-lg" onClick={() => navigate('/docs')}>Read whitepaper</button>
          </div>
          <div className="lp-wordmark">aria</div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="lp-footer">
        <div className="lp-wrap">
          <div className="lp-ft">
            <div className="lp-ft-brand">
              <div className="lp-brand">
                <div className="lp-brand-mark"><img src="/logo.png" alt="ARIA" /></div>
                <span className="lp-brand-name">ARIA</span>
              </div>
              <p>Autonomous RWA Intelligence Agent. The financial operating layer for Real World Assets on Mantle.</p>
            </div>
            {[
              { h: 'Protocol', links: [['Architecture','#'], ['Risk profiles','#'], ['Supported assets','#'], ['Integrations','#']] },
              { h: 'Resources', links: [['Whitepaper','#'], ['Docs','#'], ['Audits','#'], ['Brand kit','#']] },
              { h: 'Community', links: [['X / Twitter','#'], ['Discord','https://discord.gg/eKBUY2Pe9x'], ['Mirror','#'], ['GitHub','#']] },
              { h: 'Legal', links: [['Terms','#'], ['Privacy','#'], ['Risk disclosures','#']] },
            ].map(col => (
              <div key={col.h}>
                <h5>{col.h}</h5>
                <ul>{col.links.map(([l, href]) => <li key={l}><a href={href} target={href !== '#' ? '_blank' : undefined} rel={href !== '#' ? 'noopener noreferrer' : undefined}>{l}</a></li>)}</ul>
              </div>
            ))}
          </div>
          <div className="lp-ft-bottom">
            <span>© 2026 ARIA Labs, v1.0</span>
            <span className="lp-ft-right">
              <span>Built on Mantle</span>
              <span>·</span>
              <span>Audit: pending publication</span>
            </span>
          </div>
        </div>
      </footer>

    </div>
  );
}
