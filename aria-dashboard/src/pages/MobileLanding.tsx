import { useNavigate } from 'react-router-dom';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

const PROFILES = [
  {
    key: 'conservative',
    label: 'Conservative',
    apy: '6 – 10%',
    color: '#8ec5ff',
    desc: 'Capital preservation first. Only top-tier liquidity pools. Lower APY, minimal drawdown risk.',
    params: [
      { k: 'Min liquidity score', v: '0.70' },
      { k: 'APY improvement gate', v: '150 bps' },
      { k: 'Reallocation freq', v: 'Low' },
    ],
  },
  {
    key: 'balanced',
    label: 'Balanced',
    apy: '9 – 14%',
    color: '#75e5b0',
    desc: 'Optimal risk-adjusted yield. Broad protocol access, safety gates still enforced.',
    params: [
      { k: 'Min liquidity score', v: '0.55' },
      { k: 'APY improvement gate', v: '75 bps' },
      { k: 'Reallocation freq', v: 'Moderate' },
    ],
  },
  {
    key: 'aggressive',
    label: 'Aggressive',
    apy: '12 – 22%',
    color: '#ffb685',
    desc: 'Maximum yield pursuit. Full protocol range, tighter monitoring, higher reallocation velocity.',
    params: [
      { k: 'Min liquidity score', v: '0.40' },
      { k: 'APY improvement gate', v: '40 bps' },
      { k: 'Reallocation freq', v: 'High' },
    ],
  },
];

const STEPS = [
  { n: '1', h: 'Connect your wallet', b: 'Your personal vault is deployed on Mantle, owned exclusively by your address. No custodian, no multisig.' },
  { n: '2', h: 'Choose a risk profile', b: 'Conservative, Balanced, or Aggressive. You set the APY target and risk tolerance. ARIA enforces it.' },
  { n: '3', h: 'ARIA works 24/7', b: 'Every 5 minutes, ARIA scans Agni Finance and FusionX. When a better yield clears the safety gates, it reallocates automatically.' },
];

const ASSETS = [
  { sym: 'WETH', name: 'Wrapped Ether',   apy: '7.8 – 24.1%', color: '#627eea' },
  { sym: 'USDC', name: 'USD Coin',         apy: '6.2 – 18.6%', color: '#2775ca' },
  { sym: 'MNT',  name: 'Mantle',           apy: 'Gas + yield',  color: '#75e5b0' },
];

const SECURITY = [
  'Agent can ONLY reallocate between whitelisted protocols',
  'Agent can NEVER withdraw to an external wallet',
  'Owner withdraws at any time, even when paused',
  'All moves on-chain — verifiable, auditable',
];

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

      {/* NAV */}
      <nav className="mob-nav">
        <div className="mob-brand">
          <img src="/logo.png" alt="ARIA" width={26} height={26} />
          <span>ARIA</span>
        </div>
        <button className="mob-cta-sm" onClick={go}>Launch app</button>
      </nav>

      {/* HERO */}
      <section className="mob-hero">
        <div className="mob-hero-bg" />
        <div className="mob-pill">
          <span className="mob-dot" />
          Live on Mantle · v1.0
          <span className="mob-pill-tag">MAINNET</span>
        </div>
        <h1 className="mob-h1">
          Real World Assets,<br />
          <em>actively</em> managed.
        </h1>
        <p className="mob-sub">
          ARIA puts your WETH and USDC to work autonomously. You set the risk profile. ARIA handles the yield, explains every move.
        </p>
        <div className="mob-hero-btns">
          <button className="mob-btn-primary" onClick={go}>Connect wallet →</button>
          <button className="mob-btn-ghost" onClick={() => navigate('/docs')}>Read whitepaper</button>
        </div>

        {/* inline trust stats */}
        <div className="mob-stats">
          <div className="mob-stat">
            <div className="mob-stat-v">9–22<span>%</span></div>
            <div className="mob-stat-k">Target APY</div>
          </div>
          <div className="mob-stat-div" />
          <div className="mob-stat">
            <div className="mob-stat-v">5<span>min</span></div>
            <div className="mob-stat-k">Scan cycle</div>
          </div>
          <div className="mob-stat-div" />
          <div className="mob-stat">
            <div className="mob-stat-v">Non<span>-custodial</span></div>
            <div className="mob-stat-k">Your keys</div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="mob-section">
        <div className="mob-eyebrow">How it works</div>
        <h2 className="mob-h2">Three steps to autonomous yield.</h2>
        <div className="mob-steps">
          {STEPS.map(s => (
            <div className="mob-step" key={s.n}>
              <div className="mob-step-n">{s.n}</div>
              <div className="mob-step-body">
                <div className="mob-step-h">{s.h}</div>
                <div className="mob-step-p">{s.b}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* RISK PROFILES */}
      <section className="mob-section">
        <div className="mob-eyebrow">Risk profiles</div>
        <h2 className="mob-h2">You set the tolerance.<br />ARIA enforces it.</h2>
        <div className="mob-profiles">
          {PROFILES.map(p => (
            <div className="mob-profile" key={p.key}>
              <div className="mob-profile-top">
                <div>
                  <div className="mob-profile-label" style={{ color: p.color }}>{p.label}</div>
                  <div className="mob-profile-apy" style={{ color: p.color }}>{p.apy} <span>APY</span></div>
                </div>
              </div>
              <div className="mob-profile-desc">{p.desc}</div>
              <div className="mob-profile-params">
                {p.params.map(param => (
                  <div className="mob-profile-param" key={param.k}>
                    <span className="mob-profile-pk">{param.k}</span>
                    <span className="mob-profile-pv">{param.v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ASSETS */}
      <section className="mob-section">
        <div className="mob-eyebrow">Supported assets</div>
        <h2 className="mob-h2">Start with what you have.</h2>
        <div className="mob-assets">
          {ASSETS.map(a => (
            <div className="mob-asset" key={a.sym}>
              <div className="mob-asset-dot" style={{ background: a.color }} />
              <div className="mob-asset-body">
                <div className="mob-asset-sym">{a.sym}</div>
                <div className="mob-asset-name">{a.name}</div>
              </div>
              <div className="mob-asset-apy">{a.apy}</div>
            </div>
          ))}
        </div>
        <p className="mob-asset-note">Tokenized equity assets (TSLAx, AAPLx, etc.) coming in v2 via Fluxion DEX.</p>
      </section>

      {/* SECURITY */}
      <section className="mob-section">
        <div className="mob-eyebrow">Security model</div>
        <h2 className="mob-h2">Code-enforced.<br />Not just promised.</h2>
        <div className="mob-security">
          {SECURITY.map(s => (
            <div className="mob-sec-row" key={s}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#75e5b0" strokeWidth="2">
                <path d="M3 8l3.5 3.5L13 5" />
              </svg>
              <span>{s}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mob-cta">
        <div className="mob-cta-bg" />
        <h2 className="mob-cta-h">Ready to put your assets to work?</h2>
        <p className="mob-cta-p">Connect your wallet. Your vault deploys in one transaction.</p>
        <button className="mob-btn-primary mob-btn-lg" onClick={go}>Get started →</button>
      </section>

      {/* FOOTER */}
      <footer className="mob-footer">
        <div className="mob-footer-brand">
          <img src="/logo.png" alt="ARIA" width={20} height={20} />
          <span>ARIA Protocol</span>
        </div>
        <div className="mob-footer-links">
          <a href="/docs">Docs</a>
          <a href="/docs#security">Security</a>
          <a href="/docs#roadmap">Roadmap</a>
        </div>
        <div className="mob-footer-copy">Non-custodial autonomous yield on Mantle. © 2026 ARIA Protocol.</div>
      </footer>

    </div>
  );
}
