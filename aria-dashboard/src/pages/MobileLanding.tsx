import { useNavigate } from 'react-router-dom';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

/* ─── Data ──────────────────────────────────────────────────────── */

const PROFILES = [
  {
    key: 'conservative',
    label: 'Conservative',
    apy: '6–10%',
    color: '#8ec5ff',
    border: 'rgba(142,197,255,0.22)',
    glow:   'rgba(142,197,255,0.08)',
    desc: 'Capital preservation first. Top-tier pools only. Lower APY, minimal drawdown risk.',
    params: [
      { k: 'Min liquidity score', v: '0.70' },
      { k: 'APY improvement gate', v: '150 bps' },
    ],
  },
  {
    key: 'balanced',
    label: 'Balanced',
    apy: '9–14%',
    color: '#75e5b0',
    border: 'rgba(117,229,176,0.25)',
    glow:   'rgba(117,229,176,0.06)',
    desc: 'Optimal risk-adjusted yield. Broad protocol access with safety gates enforced.',
    params: [
      { k: 'Min liquidity score', v: '0.55' },
      { k: 'APY improvement gate', v: '75 bps' },
    ],
  },
  {
    key: 'aggressive',
    label: 'Aggressive',
    apy: '12–22%',
    color: '#ffb685',
    border: 'rgba(255,182,133,0.22)',
    glow:   'rgba(255,182,133,0.06)',
    desc: 'Maximum yield. Full protocol range, tighter monitoring, higher reallocation velocity.',
    params: [
      { k: 'Min liquidity score', v: '0.40' },
      { k: 'APY improvement gate', v: '40 bps' },
    ],
  },
];

const STEPS = [
  { n: '01', h: 'Connect your wallet', b: 'Your personal vault deploys on Mantle, owned exclusively by your address. No custodian, no multisig.' },
  { n: '02', h: 'Choose a risk profile', b: 'Conservative, Balanced, or Aggressive. You set the APY target and risk tolerance. ARIA enforces it in code.' },
  { n: '03', h: 'ARIA works 24/7', b: 'Every 5 minutes, ARIA scans Agni Finance and FusionX. Better yield that clears safety gates triggers automatic reallocation.' },
];

const ASSETS = [
  { sym: 'WETH', name: 'Wrapped Ether',   apy: '7.8–24.1%', bg: 'linear-gradient(135deg,#627eea,#3a4fd4)', letter: 'E' },
  { sym: 'USDC', name: 'USD Coin',         apy: '6.2–18.6%', bg: 'linear-gradient(135deg,#2775ca,#1a5ba8)', letter: 'U' },
  { sym: 'MNT',  name: 'Mantle',           apy: 'Gas + yield', bg: 'linear-gradient(135deg,#75e5b0,#4dd394)', letter: 'M' },
];

const SECURITY = [
  'Agent can ONLY reallocate between whitelisted protocols',
  'Agent can NEVER withdraw funds to any external wallet',
  'You can withdraw at any time, even when paused',
  'Every move is on-chain. Verifiable and auditable.',
];

/* ─── Component ─────────────────────────────────────────────────── */

export default function MobileLanding({ isDarkMode: _d, toggleDarkMode: _t }: { isDarkMode: boolean; toggleDarkMode: () => void }) {
  const { openConnectModal } = useConnectModal();
  const { address } = useAccount();
  const navigate = useNavigate();

  const savedWallet = localStorage.getItem('aria-onboarding-wallet');
  const onboardingDone =
    !!localStorage.getItem('aria-onboarding-done') &&
    !!savedWallet && !!address &&
    savedWallet === address.toLowerCase();

  const go = () => (onboardingDone ? openConnectModal?.() : navigate('/onboarding'));

  return (
    <div className="mob">

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="mob-nav">
        <div className="mob-nav-inner">
          <div className="lp-brand">
            <div className="lp-brand-mark">
              <img src="/logo.png" alt="ARIA" />
            </div>
            <span className="lp-brand-name">ARIA</span>
          </div>
          <button className="lp-btn lp-btn-primary mob-nav-cta" onClick={go}>
            Launch app →
          </button>
        </div>
        <div className="mob-nav-links">
          <a href="#how" data-tour="how-it-works">Protocol</a>
          <a href="#profiles">Risk profiles</a>
          <a href="#assets">Integrations</a>
          <a href="/docs" data-tour="docs-link">Docs</a>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <section className="mob-hero">
        {/* Same gradient + dot-grid as desktop hero */}
        <div className="mob-hero-bg" />
        <div className="mob-hero-grid" />

        <div className="mob-hero-content">
          {/* Same pill badge as desktop — identical text */}
          <div className="lp-pill mob-pill">
            <span className="lp-dot" />
            Live on Mantle, v1.0 audited and shipping
            <span className="lp-pill-tag">MAINNET</span>
          </div>

          <h1 className="mob-h1">
            Real World Assets,<br />
            <em>actively</em> managed.<br />
            <span className="lp-accent-word">Onchain. Autonomous.</span>
          </h1>

          <p className="mob-hero-sub">
            ARIA is an autonomous protocol that puts your WETH and USDC to work, monitoring liquidity,
            capturing yield across Mantle, and rebalancing in real time. You set the risk profile.
            ARIA handles the rest, and explains every move.
          </p>

          <div className="mob-hero-actions">
            <button className="lp-btn lp-btn-primary lp-btn-lg mob-btn-full" data-tour="connect-wallet" onClick={go}>
              Connect wallet →
            </button>
            <button className="lp-btn lp-btn-lg mob-btn-full" onClick={() => navigate('/docs')}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 2.5h7L13 5.5V13.5H3z" />
                <path d="M10 2.5V5.5H13" />
                <path d="M5.5 8.5h5M5.5 10.5h5" />
              </svg>
              Read whitepaper
            </button>
          </div>
        </div>
      </section>

      {/* ── KPI STRIP (first section below fold) ────────────── */}
      <div className="mob-kpis-section">
        <div className="mob-kpis">
          <div className="mob-kpi">
            <div className="mob-kpi-v" style={{ color: 'var(--accent)' }}>9–22%</div>
            <div className="mob-kpi-k">Target APY</div>
          </div>
          <div className="mob-kpi-div" />
          <div className="mob-kpi">
            <div className="mob-kpi-v">5<span>min</span></div>
            <div className="mob-kpi-k">Scan cycle</div>
          </div>
          <div className="mob-kpi-div" />
          <div className="mob-kpi">
            <div className="mob-kpi-v">24<span>/7</span></div>
            <div className="mob-kpi-k">Autonomous</div>
          </div>
          <div className="mob-kpi-div" />
          <div className="mob-kpi">
            <div className="mob-kpi-v" style={{ fontSize: 13, color: 'var(--accent)' }}>Non-custodial</div>
            <div className="mob-kpi-k">Your keys</div>
          </div>
        </div>
      </div>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <section className="mob-section">
        <div className="mob-sec-head">
          <div className="lp-eyebrow">How it works</div>
          <h2 className="mob-sec-h">Three steps to<br /><em>autonomous yield.</em></h2>
        </div>

        {/* lp-arch-style bordered container — same as desktop architecture section */}
        <div className="mob-arch">
          {STEPS.map((s, i) => (
            <div key={s.n} className="mob-arch-item" style={i < STEPS.length - 1 ? { borderBottom: '1px solid rgba(255,255,255,0.07)' } : {}}>
              <div className="mob-arch-num">{s.n}</div>
              <div className="mob-arch-body">
                <div className="mob-arch-h">{s.h}</div>
                <div className="mob-arch-p">{s.b}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── RISK PROFILES ───────────────────────────────────── */}
      <section className="mob-section mob-section-grid">
        <div className="mob-sec-head">
          <div className="lp-eyebrow">Risk profiles</div>
          <h2 className="mob-sec-h">You set the tolerance.<br /><em>ARIA enforces it.</em></h2>
        </div>

        <div className="mob-profiles">
          {PROFILES.map(p => (
            <div
              key={p.key}
              className="mob-profile"
              style={{ borderColor: p.border, background: p.glow }}
            >
              <div className="mob-profile-top">
                <span className="mob-profile-label" style={{ color: p.color }}>{p.label}</span>
                <span className="mob-profile-apy" style={{ color: p.color }}>{p.apy} <em>APY</em></span>
              </div>
              <p className="mob-profile-desc">{p.desc}</p>
              <div className="mob-profile-params">
                {p.params.map(param => (
                  <div className="mob-profile-param" key={param.k}>
                    <span>{param.k}</span>
                    <span style={{ color: 'var(--ink)' }}>{param.v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── SUPPORTED ASSETS ────────────────────────────────── */}
      <section className="mob-section">
        <div className="mob-sec-head">
          <div className="lp-eyebrow">Supported assets</div>
          <h2 className="mob-sec-h">Two assets.<br /><em>One autonomous manager.</em></h2>
        </div>

        <div className="mob-assets">
          {ASSETS.map(a => (
            <div className="mob-asset" key={a.sym}>
              <div className="lp-glyph" style={{ background: a.bg }}>{a.letter}</div>
              <div className="mob-asset-body">
                <div className="mob-asset-sym">{a.sym}</div>
                <div className="mob-asset-name">{a.name}</div>
              </div>
              <div className="mob-asset-apy">{a.apy}</div>
            </div>
          ))}
        </div>
        <p className="mob-asset-note">
          Tokenized equity assets (TSLAx, AAPLx, NVDAx) coming in v2 via Fluxion DEX.
        </p>
      </section>

      {/* ── SECURITY MODEL ──────────────────────────────────── */}
      <section className="mob-section mob-section-grid">
        <div className="mob-sec-head">
          <div className="lp-eyebrow">Security model</div>
          <h2 className="mob-sec-h">Code-enforced.<br /><em>Not just promised.</em></h2>
        </div>

        <div className="mob-security">
          {SECURITY.map(s => (
            <div className="mob-sec-row" key={s}>
              <div className="mob-sec-check">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M3 8l3.5 3.5L13 5" />
                </svg>
              </div>
              <span>{s}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────── */}
      <section className="mob-cta">
        {/* Same radial glow as desktop lp-cta */}
        <div className="mob-cta-bg" />
        <h2 className="mob-cta-h">
          Ready to put your<br /><em>assets to work?</em>
        </h2>
        <p className="mob-cta-p">
          Connect your wallet. Your vault deploys in one transaction. ARIA starts immediately.
        </p>
        <button className="lp-btn lp-btn-primary lp-btn-lg mob-cta-btn" onClick={go}>
          Get started →
        </button>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="mob-footer">
        <div className="mob-footer-top">
          <div className="lp-brand mob-footer-brand">
            <div className="lp-brand-mark" style={{ width: 22, height: 22 }}>
              <img src="/logo.png" alt="ARIA" />
            </div>
            <span className="lp-brand-name" style={{ fontSize: 14 }}>ARIA Protocol</span>
          </div>
          <div className="mob-footer-links">
            <a href="/docs">Docs</a>
            <a href="/docs#security">Security</a>
            <a href="/docs#roadmap">Roadmap</a>
          </div>
        </div>
        <div className="lp-ft-bottom" style={{ paddingTop: 20, marginTop: 20 }}>
          <span>Non-custodial autonomous yield on Mantle.</span>
          <span>© 2026 ARIA</span>
        </div>
      </footer>

    </div>
  );
}
