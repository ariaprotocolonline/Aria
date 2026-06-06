import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';

const BANNER_KEY = 'aria-docs-banner-dismissed';

const SECTIONS = [
  { id: 'abstract',       label: '01 — Abstract' },
  { id: 'introduction',   label: '02 — Introduction' },
  { id: 'the-problem',    label: '03 — The Problem' },
  { id: 'protocol',       label: '04 — The Protocol' },
  { id: 'ux',             label: '05 — User Experience' },
  { id: 'architecture',   label: '06 — Architecture' },
  { id: 'fees',           label: '07 — Fees' },
  { id: 'assets',         label: '08 — Supported Assets' },
  { id: 'profiles',       label: '09 — Risk Profiles' },
  { id: 'landscape',      label: '10 — Competitive Landscape' },
  { id: 'roadmap',        label: '11 — Roadmap' },
  { id: 'governance',     label: '12 — Governance' },
  { id: 'disclosures',    label: '13 — Risk Disclosures' },
  { id: 'conclusion',     label: '14 — Conclusion' },
];

export default function DocsPage({ isDarkMode: _isDarkMode, toggleDarkMode: _toggleDarkMode }: { isDarkMode: boolean; toggleDarkMode: () => void }) {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const wasConnected = useRef(isConnected);
  const [active, setActive] = useState('abstract');
  const [bannerDismissed, setBannerDismissed] = useState(
    () => localStorage.getItem(BANNER_KEY) === 'true'
  );

  const dismissBanner = () => {
    localStorage.setItem(BANNER_KEY, 'true');
    setBannerDismissed(true);
  };

  useEffect(() => {
    if (isConnected && !wasConnected.current) navigate('/');
    wasConnected.current = isConnected;
  }, [isConnected, navigate]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); }),
      { rootMargin: '-20% 0px -75% 0px' }
    );
    SECTIONS.forEach(s => { const el = document.getElementById(s.id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 96, behavior: 'smooth' });
  };

  return (
    <div className="docs-page">

      {/* ── Nav ── */}
      <nav className="lp-nav">
        <div className="lp-wrap lp-nav-inner">
          <div className="lp-brand">
            <div className="lp-brand-mark"><img src="/logo.png" alt="ARIA" /></div>
            <span className="lp-brand-name">ARIA</span>
          </div>
          <div className="lp-nav-links">
            <Link to="/">Home</Link>
            <a style={{ color: 'var(--accent)' }}>Whitepaper</a>
          </div>
          <div className="lp-nav-cta">
            <span className="lp-chain-pill"><span className="lp-d" />Mantle</span>
            <button className="lp-btn lp-btn-primary" onClick={() => openConnectModal?.()}>Launch app →</button>
          </div>
        </div>
      </nav>

      {/* ── Body ── */}
      <div className="docs-wrap">
        <div className="docs-layout">

          {/* TOC */}
          <aside className="docs-toc">
            <div className="docs-toc-head">Table of contents</div>
            {SECTIONS.map((s, i) => (
              <button key={s.id} className={`docs-toc-btn${active === s.id ? ' on' : ''}`} onClick={() => scrollTo(s.id)}>
                {s.label}
                {i === 2 && <div className="docs-toc-divider" />}
              </button>
            ))}
          </aside>

          {/* Content */}
          <article className="docs-main">

            {/* Header */}
            <header className="docs-header">
              <div className="docs-header-pill">
                <span className="docs-header-pill-dot" />
                Whitepaper
              </div>
              <h1 className="docs-header-h">ARIA</h1>
              <p className="docs-header-sub">Autonomous RWA Intelligence Agent</p>
              <div className="docs-header-meta">
                <span>Version 1.0</span>
                <span className="docs-header-meta-sep">·</span>
                <span>2026</span>
                <span className="docs-header-meta-sep">·</span>
                <span>~12 min read</span>
                <span className="docs-header-meta-sep">·</span>
                <span style={{ color: 'var(--accent)' }}>Live on Mantle</span>
              </div>
            </header>

            {/* Recently Updated banner */}
            {!bannerDismissed && (
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 14,
                background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                borderLeft: '3px solid var(--accent)',
                borderRadius: '0 6px 6px 0',
                padding: '14px 18px',
                marginBottom: 28,
                marginTop: 4,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span>⚡</span> Recently Updated
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-2)', fontStyle: 'italic', lineHeight: 1.6 }}>
                    ARIA has undergone significant updates since this document was first published.
                    The following have been added or changed: WETH and USDC as the primary managed
                    assets, per-user isolated vault deployment via ARIAVaultFactory, a Telegram bot
                    that delivers real-time action alerts and lets users converse with ARIA directly
                    from their phone, Elfa AI and Nansen intelligence integration into the agent
                    decision pipeline, natural language vault queries via the dashboard chat
                    interface, and full production security hardening across contracts, agent, and
                    server layers. A revised whitepaper is in progress.
                  </p>
                </div>
                <button
                  onClick={dismissBanner}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute)', padding: '2px 4px', fontSize: 16, lineHeight: 1, flexShrink: 0 }}
                  title="Dismiss"
                  aria-label="Dismiss banner"
                >
                  ×
                </button>
              </div>
            )}

            {/* 1. Abstract */}
            <section id="abstract" className="docs-section">
              <div className="docs-eyebrow">01 — Abstract</div>
              <h2 className="docs-section-h">What ARIA is.</h2>
              <p>
                ARIA is an autonomous protocol that manages Real World Asset capital on the Mantle blockchain. It monitors liquidity conditions, identifies yield opportunities across the Mantle ecosystem, and reallocates positions without requiring user intervention. Every decision is logged and explained in plain language so users maintain complete visibility into how their capital is being managed at all times.
              </p>
              <p>
                The protocol addresses a structural gap in decentralized finance. The growth of high-quality onchain assets has not been matched by the infrastructure needed to actively manage those positions. Capital in WETH and USDC sits largely static, unable to respond to shifting liquidity conditions or emerging yield opportunities in real time. ARIA closes that gap.
              </p>
            </section>

            {/* 2. Introduction */}
            <section id="introduction" className="docs-section">
              <div className="docs-eyebrow">02 — Introduction</div>
              <h2 className="docs-section-h">The yield problem.</h2>
              <p>
                Yield optimisation across DeFi liquidity pools is one of the most consequential opportunities in decentralised finance. WETH and USDC give users onchain access to yields across concentrated liquidity pools on Agni Finance and FusionX — two of the deepest AMMs on Mantle. Together they form the foundation of the chain's DeFi ecosystem.
              </p>
              <p>
                The existence of these instruments has not, however, resolved the fundamental challenge of capital efficiency. Yield rates shift continuously across protocols. Liquidity composition changes as incentive programs begin and end. A position that is optimal at one point in time can become suboptimal within hours. Capturing the full yield potential of RWA instruments requires a level of continuous monitoring and execution speed that no individual user can sustainably provide.
              </p>
              <p>
                ARIA is built to solve this. Rather than giving users more data to act on, it removes the requirement for user action entirely. It is not a dashboard or an alert system. It is a protocol that manages capital the way a professional portfolio manager would — with continuous attention, disciplined risk management, and systematic execution.
              </p>
            </section>

            {/* 3. The Problem */}
            <section id="the-problem" className="docs-section">
              <div className="docs-eyebrow">03 — The Problem</div>
              <h2 className="docs-section-h">Four structural gaps.</h2>
              <p>The inefficiencies affecting RWA capital on Mantle fall into four categories.</p>

              <h3 className="docs-section-h3">Incentive-driven liquidity fragility</h3>
              <p>
                A significant portion of the liquidity visible in Mantle's DeFi pools is incentive-dependent. Total value locked figures look substantial on paper, but the underlying composition reveals capital that is present only because emissions are flowing. When incentive programs end or reduce, this capital exits rapidly, creating sudden reductions in pool depth that result in material slippage. Effective risk management requires detecting this risk before it materialises, not in response to it.
              </p>

              <h3 className="docs-section-h3">Yield opportunity decay</h3>
              <p>
                Yield rates across Mantle's liquidity protocols shift on timescales measured in hours. Opportunities on Agni Finance, FusionX, and the broader Mantle DeFi ecosystem open and close continuously. The difference between the best and worst available risk-adjusted return for a given asset at any moment can exceed several hundred basis points. Capturing these requires continuous monitoring across multiple protocols simultaneously — which no individual user can sustain.
              </p>

              <h3 className="docs-section-h3">Single-position capital concentration</h3>
              <p>
                Most capital on Mantle is deployed in a single position and held indefinitely. The ecosystem supports a range of complementary strategies that collectively offer superior risk-adjusted returns compared to any single static position — but deploying them requires active management that most users are not positioned to provide.
              </p>

              <h3 className="docs-section-h3">Risk opacity</h3>
              <p>
                Users holding RWA positions on Mantle typically lack visibility into the true risk composition of their exposure. What fraction of pool liquidity is incentive-dependent? What is the realistic exit cost at their position size? What does the emissions schedule look like over the coming weeks? Answering these questions requires dedicated data infrastructure and continuous monitoring. Without answers, users cannot make informed decisions.
              </p>
            </section>

            {/* 4. The Protocol */}
            <section id="protocol" className="docs-section">
              <div className="docs-eyebrow">04 — The ARIA Protocol</div>
              <h2 className="docs-section-h">Three layers operating in continuous parallel.</h2>
              <p>
                ARIA manages WETH and USDC positions on behalf of users through three intelligence layers. The user connects their wallet, selects a risk profile, and ARIA handles everything thereafter.
              </p>

              <h3 className="docs-section-h3">Liquidity quality intelligence</h3>
              <p>
                ARIA constructs a Liquidity Quality Score for each monitored pool by analysing the incentive dependency ratio, historical liquidity behaviour at prior emissions cliffs, organic volume trends, and depth concentration metrics. Pools with high incentive dependency receive lower scores, which directly constrain ARIA's willingness to hold positions in those pools regardless of their headline yield. When a pool's quality score declines toward a user's profile threshold, ARIA evaluates available alternatives and executes a reallocation before the liquidity event occurs.
              </p>

              <h3 className="docs-section-h3">Yield opportunity detection</h3>
              <p>
                ARIA monitors yield rates across all integrated Mantle protocols in real time. For each opportunity identified, it calculates a risk-adjusted return that accounts for the pool's Liquidity Quality Score, projected opportunity duration, transaction costs, and the user's risk profile. Reallocation is triggered only when the improvement exceeds a threshold calibrated to the user's profile — preventing excessive churn while ensuring superior opportunities are captured.
              </p>

              <h3 className="docs-section-h3">Autonomous execution</h3>
              <p>
                When liquidity and yield signals align, ARIA executes the required transactions onchain without waiting for user confirmation. The protocol constructs and submits swap, withdrawal, and deposit transactions through the user's vault contract in a single coordinated sequence. Every execution is logged to the user's activity feed with a clear explanation of what was done and what conditions drove the decision.
              </p>
            </section>

            {/* 5. UX */}
            <section id="ux" className="docs-section">
              <div className="docs-eyebrow">05 — User Experience</div>
              <h2 className="docs-section-h">Always understand. Never intervene.</h2>
              <p>
                ARIA's interface is built around a single principle: users should always understand what is happening with their capital, without needing to take any action to make it happen. The dashboard presents the user's current position value and live yield, a chronological log of all protocol actions with plain-language explanations, a view of conditions ARIA is currently monitoring, and the user's selected risk profile.
              </p>
              <p>
                A conversational interface allows users to ask questions about their portfolio, current conditions across Mantle protocols, or the reasoning behind specific decisions. Responses are grounded in live portfolio state and real-time onchain data. This interface is available both on the dashboard and directly through Telegram — users can connect their vault to <a href="https://t.me/AriaRWAbot" target="_blank" rel="noopener noreferrer">@AriaRWAbot</a> and converse with ARIA from their phone at any time.
              </p>

              <h3 className="docs-section-h3">Telegram integration</h3>
              <p>
                Connecting Telegram gives users a live channel into ARIA's decision loop — every action, every market shift, delivered directly to their phone. The connection is established from the dashboard settings in one tap: ARIA generates a unique deep-link that opens the bot and binds the user's vault to their Telegram chat in a single step.
              </p>
              <p>
                Once connected, ARIA sends four types of messages automatically:
              </p>
              <div className="docs-rows">
                {[
                  { k: 'Hourly pool intelligence', v: 'Every hour, ARIA sends a snapshot of live liquidity pool conditions on Mantle — current APYs, liquidity quality scores for each pool, and which opportunity is currently best positioned for your capital. No action required.' },
                  { k: 'Reallocation alerts',      v: 'Whenever ARIA moves funds between protocols, you receive an instant notification with a plain-language explanation of the decision, the APY improvement achieved, and a link to the transaction on Mantle Explorer.' },
                  { k: 'Liquidity warnings',       v: 'If a pool\'s liquidity quality score drops below your risk mandate threshold, ARIA flags it before any action is taken — so you can monitor the situation or adjust your risk profile.' },
                  { k: 'Daily summary',            v: 'Each morning at midnight UTC, ARIA sends your total vault balance across WETH and USDC, the number of reallocations executed in the past 24 hours, and confirmation that monitoring is active.' },
                ].map(r => (
                  <div key={r.k} className="docs-row"><span className="k">{r.k}</span><span className="v">{r.v}</span></div>
                ))}
              </div>
              <p>
                The bot also responds to direct messages. Users can ask about their current position, query which pool ARIA is targeting, or request an explanation of the most recent reallocation — and receive a live, context-aware reply grounded in real onchain state. ARIA never asks for a private key, seed phrase, or signature through Telegram. The bot has no custody of funds and no ability to initiate transactions — it is a read and notification channel only.
              </p>
              <div className="docs-quote">
                <p>Transparency and autonomy are not competing values. ARIA acts without requiring user input, but it never acts without explaining itself — making the protocol accessible to users with no prior DeFi experience while remaining accountable enough for sophisticated capital allocators.</p>
              </div>
            </section>

            {/* 6. Architecture */}
            <section id="architecture" className="docs-section">
              <div className="docs-eyebrow">06 — Technical Architecture</div>
              <h2 className="docs-section-h">Your capital. Your contract. Your keys.</h2>

              <h3 className="docs-section-h3">Vault contract layer</h3>
              <p>
                Each user's capital is held in an individually deployed vault smart contract on Mantle. The vault accepts deposits of WETH and USDC and grants ARIA bounded execution permissions — the ability to move funds between a predefined set of approved protocol integrations and nothing else. ARIA cannot move funds to any address outside the approved set. The approved set is controlled exclusively by the vault owner. Users can pause execution or withdraw capital directly at any time with no timelock.
              </p>

              <h3 className="docs-section-h3">Intelligence layer</h3>
              <p>
                The intelligence layer operates as an autonomous agent that continuously queries Mantle RPC nodes for pool state, emissions schedules, lending rates, and liquidity composition data. Signal processing logic converts this raw data into Liquidity Quality Scores, risk-adjusted yield comparisons, and reallocation triggers calibrated to each user's risk profile.
              </p>

              <h3 className="docs-section-h3">Security model</h3>
              <div className="docs-rows">
                {[
                  { k: 'Fund isolation',        v: 'Per-user vaults — never pooled' },
                  { k: 'Agent permissions',     v: 'Whitelisted protocols + selectors only' },
                  { k: 'Withdrawal timelock',   v: '0 seconds' },
                  { k: 'Emergency pause',       v: 'Owner-controlled, instant' },
                  { k: 'Ownership transfer',    v: 'Two-step (Ownable2Step)' },
                  { k: 'Contract audits',       v: 'In progress — published before mainnet' },
                ].map(r => (
                  <div key={r.k} className="docs-row"><span className="k">{r.k}</span><span className="v">{r.v}</span></div>
                ))}
              </div>

              <h3 className="docs-section-h3">Protocol integrations</h3>
              <p>
                <strong>Agni Finance</strong> — concentrated liquidity AMM on Mantle. Launch pools include WETH/USDC and WETH/WMNT. <strong>FusionX</strong> — AMM liquidity provision on Mantle. Launch pool: WETH/USDC. Additional protocol integrations — including lending markets and yield tokenisation — are planned for Phase II and will be added to the approved pool list via governance.
              </p>
            </section>

            {/* 7. Fees */}
            <section id="fees" className="docs-section">
              <div className="docs-eyebrow">07 — Fees</div>
              <h2 className="docs-section-h">Simple, aligned, transparent.</h2>
              <p>
                ARIA charges two fees, both enforced at the smart contract level and both sent directly to a designated treasury address — never to the agent wallet. Fee collection can be verified onchain by any user at any time.
              </p>
              <div className="docs-rows">
                {[
                  { k: 'Management fee',    v: '0.5% per year' },
                  { k: 'Accrual cadence',   v: 'Per token, minimum 1-hour intervals' },
                  { k: 'Performance fee',   v: '10% of yield improvement' },
                  { k: 'Charged when',      v: 'Agent moves to a higher-APY position' },
                  { k: 'APY delta cap',     v: '50% — prevents fee extraction attacks' },
                  { k: 'Hard caps',         v: 'Max 20% performance, max 2% management' },
                  { k: 'Fee recipient',     v: 'Cold storage treasury — not the agent wallet' },
                  { k: 'Zero-address rule', v: 'Set recipient to 0x0 to disable all fees' },
                ].map(r => (
                  <div key={r.k} className="docs-row"><span className="k">{r.k}</span><span className="v">{r.v}</span></div>
                ))}
              </div>
              <p style={{ marginTop: 20 }}>
                The performance fee is only charged when the agent moves capital to a position with a higher APY than the current one. A move that does not improve yield incurs no performance fee. The APY delta used to calculate the fee is capped at 50 percentage points to prevent a manipulated signal from extracting excess fees. Both fee rates are set by the vault owner and cannot exceed the hard caps, regardless of what the owner sets.
              </p>
            </section>

            {/* 8. Assets — eyebrow updated to 08 above */}
            <section id="assets" className="docs-section">
              <div className="docs-eyebrow">08 — Supported Assets</div>
              <h2 className="docs-section-h">Two instruments. Deep liquidity.</h2>
              <div className="docs-rows">
                {[
                  { k: 'Asset',              v: 'WETH — Wrapped Ether' },
                  { k: 'Base yield',         v: '~8.2% APY (WETH/USDC pool)' },
                  { k: 'Under ARIA',         v: '7.8% – 24.1% target range', up: true },
                  { k: 'Backing',            v: 'ETH 1:1' },
                ].map(r => (
                  <div key={r.k} className="docs-row"><span className="k">{r.k}</span><span className={`v${r.up ? ' up' : ''}`}>{r.v}</span></div>
                ))}
              </div>
              <div className="docs-rows" style={{ marginTop: 12 }}>
                {[
                  { k: 'Asset',              v: 'USDC — USD Coin' },
                  { k: 'Base yield',         v: '~7.8% APY (WETH/USDC pool)' },
                  { k: 'Under ARIA',         v: '6.2% – 18.6% target range', up: true },
                  { k: 'Backing',            v: 'USD cash (Circle)' },
                ].map(r => (
                  <div key={r.k} className="docs-row"><span className="k">{r.k}</span><span className={`v${r.up ? ' up' : ''}`}>{r.v}</span></div>
                ))}
              </div>
            </section>

            {/* 8. Risk Profiles */}
            <section id="profiles" className="docs-section">
              <div className="docs-eyebrow">09 — Risk Profiles</div>
              <h2 className="docs-section-h">Set your appetite once.</h2>
              <p>Users select one of three risk profiles at onboarding. The profile governs reallocation thresholds, approved protocol tiers, and concentration limits, and can be updated at any time.</p>
              <div className="docs-profile-grid">
                <div className="docs-profile-card con">
                  <div className="docs-profile-lbl con">Profile 01</div>
                  <div className="docs-profile-nm"><em>Conservative</em></div>
                  {[
                    ['Target APY', '6 – 9%'],
                    ['Quality floor', '70'],
                    ['Realloc. threshold', '150 bps'],
                    ['Max single-pool', '80%'],
                    ['Incentivized pools', 'excluded'],
                  ].map(([k, v]) => (
                    <div key={k} className="docs-profile-stat">{k}<span>{v}</span></div>
                  ))}
                </div>
                <div className="docs-profile-card bal">
                  <div className="docs-profile-lbl bal">Profile 02</div>
                  <div className="docs-profile-nm"><em>Balanced</em></div>
                  {[
                    ['Target APY', '9 – 14%'],
                    ['Quality floor', '55'],
                    ['Realloc. threshold', '75 bps'],
                    ['Max single-pool', '65%'],
                    ['Incentivized pools', '≥ Q 60'],
                  ].map(([k, v]) => (
                    <div key={k} className="docs-profile-stat">{k}<span>{v}</span></div>
                  ))}
                </div>
                <div className="docs-profile-card agg">
                  <div className="docs-profile-lbl agg">Profile 03</div>
                  <div className="docs-profile-nm"><em>Aggressive</em></div>
                  {[
                    ['Target APY', '14 – 25%+'],
                    ['Quality floor', '40'],
                    ['Realloc. threshold', '40 bps'],
                    ['Max single-pool', '50%'],
                    ['Incentivized pools', 'permitted'],
                  ].map(([k, v]) => (
                    <div key={k} className="docs-profile-stat">{k}<span>{v}</span></div>
                  ))}
                </div>
              </div>
            </section>

            {/* 9. Landscape */}
            <section id="landscape" className="docs-section">
              <div className="docs-eyebrow">10 — Competitive Landscape</div>
              <h2 className="docs-section-h">Why existing protocols fall short.</h2>
              <p>
                Yield optimisation in DeFi is a populated category. The majority of existing protocols operate on fixed rule-based logic — moving capital between pools according to predefined criteria. They automate execution but do not adapt to changing market structure. They cannot distinguish organic liquidity from incentive-driven depth and cannot modify their behaviour in response to conditions they have not been explicitly programmed to handle.
              </p>
              <p>
                ARIA's differentiation rests on three specific capabilities. The first is liquidity quality scoring — no existing yield protocol distinguishes between organic and incentive-driven liquidity composition, and this is the foundation of ARIA's risk management. The second is true autonomy — ARIA executes without user confirmation, because the user's role is to define their risk appetite and everything else should be handled by the protocol. The third is explainability — every protocol decision is accompanied by a plain-language explanation, which builds the trust that drives long-term capital retention.
              </p>
            </section>

            {/* 10. Roadmap */}
            <section id="roadmap" className="docs-section">
              <div className="docs-eyebrow">11 — Roadmap</div>
              <h2 className="docs-section-h">From RWA agent to RWA infrastructure.</h2>
              <div className="docs-phases">
                <div className="docs-phase active">
                  <div className="docs-phase-lbl">Phase I — Now</div>
                  <div className="docs-phase-nm">Foundation</div>
                  <ul>
                    <li>Audited vaults deployed on Mantle mainnet</li>
                    <li>All three risk profiles live</li>
                    <li>Agni Finance + FusionX pool integrations</li>
                    <li>Dashboard, activity feed, conversational interface, Telegram notifications</li>
                  </ul>
                </div>
                <div className="docs-phase">
                  <div className="docs-phase-lbl">Phase II — Q3 2026</div>
                  <div className="docs-phase-nm">Expansion</div>
                  <ul>
                    <li>Aggressive profile, Pendle + Cleopatra strategies</li>
                    <li>Multi-asset vault management, cross-asset logic</li>
                    <li>Coverage expansion to new RWA instruments</li>
                    <li>Institutional API for funds and protocols</li>
                  </ul>
                </div>
                <div className="docs-phase future">
                  <div className="docs-phase-lbl">Phase III — 2027</div>
                  <div className="docs-phase-nm">Infrastructure</div>
                  <ul>
                    <li>Cross-chain deployment to other EVM networks</li>
                    <li>Third-party SDK, quality scoring + yield detection</li>
                    <li>Protocol governance over fees and parameters</li>
                    <li>Foundational layer for RWA capital management</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* 11. Governance */}
            <section id="governance" className="docs-section">
              <div className="docs-eyebrow">12 — Governance</div>
              <h2 className="docs-section-h">Long-term stakeholder control.</h2>
              <p>
                ARIA's governance model gives long-term stakeholders meaningful input over protocol parameters without compromising the integrity of the agent's risk management logic. Governance scope covers protocol fee parameters, approved protocol whitelist additions and removals, Liquidity Quality Score methodology updates, and treasury allocation. The core execution logic of the intelligence layer is excluded from governance scope.
              </p>
              <p>
                Full governance documentation, token distribution details, and vesting schedules will be published in a dedicated governance paper prior to Phase II launch.
              </p>
            </section>

            {/* 12. Risk Disclosures */}
            <section id="disclosures" className="docs-section">
              <div className="docs-eyebrow">13 — Risk Disclosures</div>
              <h2 className="docs-section-h">Read these before depositing.</h2>
              <div className="docs-risk-list">
                {[
                  { h: 'Smart contract risk', p: "ARIA's vault contracts are subject to the risk of programming errors or exploits. All contracts will be audited prior to mainnet deployment. Audits reduce but do not eliminate this risk." },
                  { h: 'Protocol integration risk', p: "ARIA operates within third-party DeFi protocols. A failure, exploit, or governance action affecting an integrated protocol could affect user capital held in that protocol." },
                  { h: 'Execution risk', p: "Autonomous execution introduces the possibility of incorrect signal interpretation or transaction failure under adverse network conditions. ARIA includes circuit breakers that pause execution when anomalous conditions are detected." },
                  { h: 'Liquidity risk', p: "Despite ARIA's liquidity quality monitoring, rapid liquidity events can occur faster than the protocol can respond. Exit costs can increase materially during periods of market stress." },
                  { h: 'Regulatory risk', p: "The regulatory treatment of tokenized RWA instruments and autonomous DeFi protocols is evolving. Changes in applicable law or regulation could affect ARIA's operations or the availability of supported assets." },
                ].map(r => (
                  <div key={r.h} className="docs-risk-item">
                    <div className="docs-risk-item-head">{r.h}</div>
                    <p>{r.p}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* 13. Conclusion */}
            <section id="conclusion" className="docs-section">
              <div className="docs-eyebrow">14 — Conclusion</div>
              <h2 className="docs-section-h">RWA capital exists. Make it work.</h2>
              <p>
                The infrastructure for productive RWA capital deployment exists on Mantle. The assets are there. The protocols are there. The liquidity is there. What has been missing is a protocol capable of putting that capital to work continuously, adapting to changing conditions in real time, and doing so in a way that any user can understand and trust.
              </p>
              <p>
                ARIA is that protocol. It manages capital with the discipline of a systematic investment process, the transparency of a complete audit trail, and the accessibility of a product designed for any level of DeFi experience.
              </p>
              <div className="docs-end">
                <p>
                  <a href="https://x.com/aria_rwa?s=21" target="_blank" rel="noopener noreferrer">@ARIA_rwa</a>
                  &nbsp;·&nbsp;
                  <a href="https://ariaprotocol.online" target="_blank" rel="noopener noreferrer">ariaprotocol.online</a>
                </p>
                <p style={{ marginTop: 8 }}>
                  This document is provided for informational purposes only and does not constitute an offer to sell or a solicitation to buy any securities or financial instruments.
                </p>
              </div>
            </section>

          </article>
        </div>
      </div>

      {/* ── Footer ── */}
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
              { h: 'Protocol',   links: [['Architecture','#'], ['Risk profiles','#'], ['Supported assets','#'], ['Integrations','#']] },
              { h: 'Resources',  links: [['Whitepaper','#'], ['Docs','#'], ['Audits','#'], ['Brand kit','#']] },
              { h: 'Community',  links: [['X / Twitter','#'], ['Discord','https://discord.gg/eKBUY2Pe9x'], ['Mirror','#'], ['GitHub','#']] },
              { h: 'Legal',      links: [['Terms','#'], ['Privacy','#'], ['Risk disclosures','#']] },
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
