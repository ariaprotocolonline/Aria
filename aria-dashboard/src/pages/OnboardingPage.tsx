import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, useDisconnect } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useTelegram } from '../hooks/useTelegram';

type Step = 1 | 2 | 3 | 4 | 5 | 6;
type Profile = 'conservative' | 'balanced' | 'aggressive';

function fmtAddr(addr?: string) {
  if (!addr) return '—';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

export default function OnboardingPage({ onComplete }: { onComplete: () => void; isDarkMode?: boolean; toggleDarkMode?: () => void }) {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { status: tgStatus, generateLink, refresh: refreshTg } = useTelegram();

  const [step, setStep]       = useState<Step>(1);
  const [tos, setTos]         = useState(false);
  const [nickname, setNickname] = useState(() => localStorage.getItem('aria-nickname') || '');
  const [profile, setProfile] = useState<Profile>(() => (localStorage.getItem('aria-profile') as Profile) || 'balanced');
  const [tgLink, setTgLink]   = useState<string | null>(null);
  const [tgLinkErr, setTgLinkErr] = useState('');

  const displayName = nickname.trim() || 'anon';

  const profileLabels: Record<Profile, string> = {
    conservative: 'Conservative, 6–9% APY',
    balanced:     'Balanced, 9–14% APY',
    aggressive:   'Aggressive, 14–25%+ APY',
  };

  const goTo = (s: Step) => setStep(s);

  const finish = () => {
    localStorage.setItem('aria-nickname', nickname.trim() || 'anon');
    localStorage.setItem('aria-profile', profile);
    localStorage.setItem('aria-onboarding-done', '1');
    if (address) localStorage.setItem('aria-onboarding-wallet', address.toLowerCase());
    goTo(4);
  };

  const enter = () => { onComplete(); navigate('/'); };

  // Skip onboarding entirely if this wallet already completed it
  useEffect(() => {
    if (!address) return;
    const done = localStorage.getItem('aria-onboarding-done');
    const savedWallet = localStorage.getItem('aria-onboarding-wallet');
    if (done && savedWallet === address.toLowerCase()) {
      onComplete();
      navigate('/');
    }
  }, [address]);

  // Step 5 — generate Telegram link on entry
  useEffect(() => {
    if (step !== 5 || tgLink) return;
    setTgLinkErr('');
    generateLink().then(link => {
      if (link) setTgLink(link);
      else setTgLinkErr('Could not reach the bot server. You can connect from Settings later.');
    });
  }, [step]);

  // Step 5 — poll for connection confirmation (every 3s)
  useEffect(() => {
    if (step !== 5) return;
    const id = setInterval(refreshTg, 3_000);
    return () => clearInterval(id);
  }, [step, refreshTg]);

  const TOTAL_STEPS = 5;
  const progressStep = step <= 5 ? step : 5;

  return (
    <div className="ob-root">
      <div className="ob-bg" />

      {/* Top bar */}
      <header className="ob-top">
        <a className="ob-brand" href="/">
          <span className="ob-brand-mark"><img src="/logo.png" alt="ARIA" /></span>
          ARIA
        </a>
        <div className="ob-top-right">
          {isConnected && (
            <button className="ob-quit" onClick={() => disconnect()}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              Disconnect
            </button>
          )}
        </div>
      </header>

      <main className="ob-shell">
        {/* Progress dots */}
        {step < 6 && (
          <div className="ob-progress">
            {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(i => (
              <span key={i} className={`ob-dot${i < progressStep ? ' done' : i === progressStep ? ' active' : ''}`} />
            ))}
            <span className="ob-plbl">Step {progressStep} of {TOTAL_STEPS}</span>
          </div>
        )}

        <div className="ob-card">

          {/* ── STEP 1: Wallet ── */}
          {step === 1 && (
            <section className="ob-step ob-fadeIn">
              <div className="ob-eyebrow">Step 1, Wallet</div>
              <h1>Connect your <em>wallet</em></h1>
              <p className="ob-lead">ARIA reads and acts onchain through a vault contract you own. Choose your wallet below to get started.</p>

              {isConnected ? (
                <>
                  <div className="ob-wallets">
                    <div className="ob-wallet ob-wallet-selected">
                      <span className="ob-wallet-ico" style={{ background: 'linear-gradient(135deg,#75e5b0,#4dd394)' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M3 10h18" /></svg>
                      </span>
                      <div>
                        <div className="ob-wallet-nm">Wallet connected</div>
                        <div className="ob-wallet-sub" style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>{fmtAddr(address)}</div>
                      </div>
                      <span className="ob-check">
                        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l3 3 7-7" /></svg>
                      </span>
                    </div>
                  </div>

                  <div className="ob-legal">
                    <label>
                      <input type="checkbox" checked={tos} onChange={e => setTos(e.target.checked)} />
                      <span>I've read the <a href="#">Terms of Use</a> and <a href="#">Risk Disclosures</a>. I understand ARIA executes onchain transactions on my behalf within my approved protocol set.</span>
                    </label>
                  </div>

                  <div className="ob-actions">
                    <button className="ob-btn ob-primary" disabled={!tos} onClick={() => goTo(2)}>
                      Continue
                      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <ConnectButton.Custom>
                    {({ openConnectModal, mounted }) => (
                      <div className="ob-wallet-options" aria-hidden={!mounted}>
                        <button className="ob-wallet-opt" onClick={openConnectModal} type="button">
                          <span className="ob-wallet-opt-ico">
                            <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="#E8871E"/><path d="M11.5 15.5c4.7-4.7 12.3-4.7 17 0l.6.6c.2.2.2.6 0 .8l-2 2c-.1.1-.3.1-.4 0l-.8-.8c-3.3-3.3-8.5-3.3-11.8 0l-.8.8c-.1.1-.3.1-.4 0l-2-2c-.2-.2-.2-.6 0-.8l.6-.6zm21 3.9l1.8 1.8c.2.2.2.6 0 .8l-8 8c-.2.2-.6.2-.8 0l-5.7-5.7c-.1-.1-.2-.1-.2 0l-5.7 5.7c-.2.2-.6.2-.8 0l-8-8c-.2-.2-.2-.6 0-.8l1.8-1.8c.2-.2.6-.2.8 0l5.7 5.7c.1.1.2.1.2 0l5.7-5.7c.2-.2.6-.2.8 0l5.7 5.7c.1.1.2.1.2 0l5.7-5.7c.2-.2.5-.2.8 0z" fill="#fff"/></svg>
                          </span>
                          <div className="ob-wallet-opt-body"><div className="ob-wallet-opt-nm">MetaMask</div><div className="ob-wallet-opt-sub">Browser extension or mobile app</div></div>
                          <svg className="ob-wallet-opt-arr" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                        </button>
                        <button className="ob-wallet-opt" onClick={openConnectModal} type="button">
                          <span className="ob-wallet-opt-ico">
                            <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="#3B99FC"/><path d="M12 15.4c4.4-4.4 11.6-4.4 16 0l.5.5c.2.2.2.5 0 .7l-1.8 1.8c-.1.1-.3.1-.4 0l-.7-.7c-3.1-3.1-8.1-3.1-11.2 0l-.7.7c-.1.1-.3.1-.4 0l-1.8-1.8c-.2-.2-.2-.5 0-.7l.5-.5zm19.8 3.7l1.6 1.6c.2.2.2.5 0 .7l-7.3 7.3c-.2.2-.5.2-.7 0l-5.1-5.1c0-.1-.1-.1-.2 0l-5.1 5.1c-.2.2-.5.2-.7 0l-7.3-7.3c-.2-.2-.2-.5 0-.7l1.6-1.6c.2-.2.5-.2.7 0l5.1 5.1c.1.1.2.1.2 0l5.1-5.1c.2-.2.5-.2.7 0l5.1 5.1c.1.1.2.1.2 0l5.1-5.1c.2-.2.5-.2.7 0z" fill="#fff"/></svg>
                          </span>
                          <div className="ob-wallet-opt-body"><div className="ob-wallet-opt-nm">WalletConnect</div><div className="ob-wallet-opt-sub">300+ wallets supported</div></div>
                          <svg className="ob-wallet-opt-arr" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                        </button>
                        <button className="ob-wallet-opt" onClick={openConnectModal} type="button">
                          <span className="ob-wallet-opt-ico">
                            <svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="20" fill="#1652F0"/><path d="M20 10c-5.5 0-10 4.5-10 10s4.5 10 10 10 10-4.5 10-10-4.5-10-10-10zm-2.5 14.5v-9l7 4.5-7 4.5z" fill="#fff"/></svg>
                          </span>
                          <div className="ob-wallet-opt-body"><div className="ob-wallet-opt-nm">Coinbase Wallet</div><div className="ob-wallet-opt-sub">Self-custody by Coinbase</div></div>
                          <svg className="ob-wallet-opt-arr" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                        </button>
                        <button className="ob-wallet-opt ob-wallet-opt-more" onClick={openConnectModal} type="button">
                          <span className="ob-wallet-opt-ico ob-wallet-opt-ico-grid"><span/><span/><span/><span/></span>
                          <div className="ob-wallet-opt-body"><div className="ob-wallet-opt-nm">More wallets</div><div className="ob-wallet-opt-sub">Rabby, Trust, Phantom &amp; more</div></div>
                          <svg className="ob-wallet-opt-arr" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
                        </button>
                        {!mounted && null}
                      </div>
                    )}
                  </ConnectButton.Custom>
                </>
              )}
            </section>
          )}

          {/* ── STEP 2: Name ── */}
          {step === 2 && (
            <section className="ob-step ob-fadeIn">
              <div className="ob-eyebrow">Step 2, Identity</div>
              <h1>What should ARIA <em>call you?</em></h1>
              <p className="ob-lead">Choose a name ARIA will use in its greetings, activity log, and conversations. You can change it anytime in settings. It never leaves your vault.</p>

              <div className="ob-label">Your name</div>
              <div className="ob-name-field">
                <input
                  type="text"
                  placeholder="e.g. Maya, anon, hodler…"
                  autoComplete="off"
                  maxLength={32}
                  value={nickname}
                  autoFocus
                  onChange={e => setNickname(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && nickname.trim().length > 0) goTo(3); }}
                />
              </div>

              <div className="ob-preview">
                <div className="ob-ph">ARIA will say…</div>
                <div className="ob-pmsg">Good morning, <em><span className="ob-nm">{displayName}</span>.</em></div>
                <div className="ob-psub">Your vault is live on <span style={{ color: 'var(--accent)', fontFamily: 'var(--mono)' }}>Mantle</span>. ARIA is watching.</div>
              </div>

              <div className="ob-hint">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6" /><path d="M8 7v4M8 4.5v.5" /></svg>
                Stored locally and on your vault contract, never shared.
              </div>

              <div className="ob-actions">
                <button className="ob-btn ob-text" onClick={() => goTo(1)}>← Back</button>
                <button className="ob-btn ob-primary" disabled={nickname.trim().length < 1} onClick={() => goTo(3)}>
                  Continue
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
                </button>
              </div>
            </section>
          )}

          {/* ── STEP 3: Risk profile ── */}
          {step === 3 && (
            <section className="ob-step ob-fadeIn">
              <div className="ob-eyebrow">Step 3, Risk profile</div>
              <h1>Pick your <em>risk profile</em></h1>
              <p className="ob-lead">This sets ARIA's reallocation thresholds, approved protocols, and concentration limits. You can change profiles anytime, withdraw with no timelock.</p>

              <div className="ob-profiles">
                {([
                  { id: 'conservative', nm: 'Conservative', desc: 'Base pools only, quality floor 70, 150 bps threshold', apy: '6–9%', dot: 'var(--blue)' },
                  { id: 'balanced',     nm: 'Balanced',     desc: '+ Agni, FusionX, quality floor 55, 75 bps threshold', apy: '9–14%', dot: 'var(--accent)' },
                  { id: 'aggressive',   nm: 'Aggressive',   desc: '+ xStocks via Fluxion, quality floor 40, 40 bps threshold', apy: '14–25%+', dot: 'var(--warm)' },
                ] as const).map(p => (
                  <button key={p.id} className={`ob-profile${profile === p.id ? ' ob-selected' : ''}`} onClick={() => setProfile(p.id)}>
                    <span className="ob-pdt" style={{ background: profile === p.id ? p.dot : 'transparent', borderColor: p.dot }} />
                    <div className="ob-pbody">
                      <div className="ob-pnm">{p.nm}</div>
                      <div className="ob-pdesc">{p.desc}</div>
                    </div>
                    <div className="ob-papy">
                      <b style={{ color: profile === p.id ? p.dot : undefined }}>{p.apy}</b>
                      target APY
                    </div>
                  </button>
                ))}
              </div>

              <div className="ob-hint">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6" /><path d="M8 7v4M8 4.5v.5" /></svg>
                <span><b style={{ color: 'var(--ink)', fontWeight: 500 }}>Most users pick Balanced.</b> ARIA earns ~12% APY while staying out of incentive-rented liquidity.</span>
              </div>

              <div className="ob-actions">
                <button className="ob-btn ob-text" onClick={() => goTo(2)}>← Back</button>
                <button className="ob-btn ob-primary" onClick={finish}>
                  Continue
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
                </button>
              </div>
            </section>
          )}

          {/* ── STEP 4: Telegram opt-in ── */}
          {step === 4 && (
            <section className="ob-step ob-fadeIn">
              <div className="ob-eyebrow">Step 4, Notifications</div>
              <h1>Use ARIA directly in <em>Telegram</em></h1>
              <p className="ob-lead">Get real-time alerts when ARIA moves your funds, receive daily portfolio summaries, and chat with ARIA directly from your phone, without opening the dashboard.</p>

              <div style={{ display:'flex', flexDirection:'column', gap:14, margin:'28px 0' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:16, padding:'18px 20px', border:'1px solid var(--line)', borderRadius:12, background:'rgba(255,255,255,0.02)' }}>
                  <span style={{ width:36, height:36, borderRadius:8, background:'color-mix(in srgb, var(--accent) 12%, transparent)', border:'1px solid color-mix(in srgb, var(--accent) 25%, transparent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                      <path d="M3 6.5a4.5 4.5 0 019 0V10l1 1.5H2l1-1.5z"/>
                      <path d="M6 13a2 2 0 004 0"/>
                    </svg>
                  </span>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>Instant trade alerts</div>
                    <div style={{ fontSize:13, color:'var(--mute)', lineHeight:1.5 }}>Know the moment ARIA reallocates, with the reason, amounts, and transaction hash.</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'flex-start', gap:16, padding:'18px 20px', border:'1px solid var(--line)', borderRadius:12, background:'rgba(255,255,255,0.02)' }}>
                  <span style={{ width:36, height:36, borderRadius:8, background:'color-mix(in srgb, var(--accent) 12%, transparent)', border:'1px solid color-mix(in srgb, var(--accent) 25%, transparent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                      <path d="M3 4h10v6H7l-3 3V4z"/>
                    </svg>
                  </span>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>Chat with ARIA anywhere</div>
                    <div style={{ fontSize:13, color:'var(--mute)', lineHeight:1.5 }}>Ask about your positions, request explanations, or check your portfolio directly in Telegram via @AriaRWAbot.</div>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'flex-start', gap:16, padding:'18px 20px', border:'1px solid var(--line)', borderRadius:12, background:'rgba(255,255,255,0.02)' }}>
                  <span style={{ width:36, height:36, borderRadius:8, background:'color-mix(in srgb, var(--accent) 12%, transparent)', border:'1px solid color-mix(in srgb, var(--accent) 25%, transparent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="1.5">
                      <path d="M2 12l3-4 3 2 3-5 3 3"/>
                      <path d="M2 14h12"/>
                    </svg>
                  </span>
                  <div>
                    <div style={{ fontWeight:600, fontSize:14, marginBottom:4 }}>Daily digest</div>
                    <div style={{ fontSize:13, color:'var(--mute)', lineHeight:1.5 }}>A concise morning summary of overnight activity, your current yield, and what ARIA is watching.</div>
                  </div>
                </div>
              </div>

              <div className="ob-actions">
                <button className="ob-btn ob-text" onClick={() => goTo(6)}>Skip for now</button>
                <button className="ob-btn ob-primary" onClick={() => goTo(5)}>
                  Connect Telegram
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              </div>
            </section>
          )}

          {/* ── STEP 5: Telegram connect ── */}
          {step === 5 && (
            <section className="ob-step ob-fadeIn">
              <div className="ob-eyebrow">Step 5, Connect bot</div>
              <h1>Open <em>@AriaRWAbot</em></h1>
              <p className="ob-lead">Tap the button below to open Telegram. The bot will link to your wallet automatically, no typing required.</p>

              <div style={{ textAlign:'center', margin:'32px 0' }}>
                {tgStatus.connected ? (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
                    <div style={{ width:64, height:64, borderRadius:'50%', background:'color-mix(in srgb, var(--accent) 15%, transparent)', border:'2px solid var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M3 8l3.5 3.5L13 5"/></svg>
                    </div>
                    <div>
                      <div style={{ fontWeight:600, fontSize:16, color:'var(--accent)' }}>Telegram connected!</div>
                      {tgStatus.username && (
                        <div style={{ fontFamily:'var(--mono)', fontSize:13, color:'var(--mute)', marginTop:4 }}>@{tgStatus.username}</div>
                      )}
                    </div>
                  </div>
                ) : tgLinkErr ? (
                  <div style={{ color:'var(--mute)', fontSize:13, fontFamily:'var(--mono)', maxWidth:340, margin:'0 auto', lineHeight:1.6 }}>{tgLinkErr}</div>
                ) : tgLink ? (
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20 }}>
                    <div style={{ width:80, height:80, borderRadius:'50%', background:'linear-gradient(135deg,#29aae1,#1e90d0)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 0 32px rgba(41,170,225,0.25)' }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="white"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg>
                    </div>
                    <a
                      href={tgLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ob-btn ob-primary"
                      style={{ textDecoration:'none', padding:'14px 32px', fontSize:15, display:'inline-flex', alignItems:'center', gap:10 }}
                    >
                      Open @AriaRWAbot
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M9 3h4v4M7 9l6-6"/></svg>
                    </a>
                    <div style={{ fontFamily:'var(--mono)', fontSize:11.5, color:'var(--mute)' }}>
                      Waiting for connection
                      <span style={{ display:'inline-block', marginLeft:6 }}>
                        <span style={{ animation:'pulse 1.2s ease-in-out infinite', display:'inline-block', width:6, height:6, borderRadius:'50%', background:'var(--accent)' }} />
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ color:'var(--mute)', fontSize:13, fontFamily:'var(--mono)' }}>Generating secure link…</div>
                )}
              </div>

              <div className="ob-hint">
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6" /><path d="M8 7v4M8 4.5v.5" /></svg>
                The link is one-time use and expires in 10 minutes. You can always reconnect from Settings.
              </div>

              <div className="ob-actions">
                <button className="ob-btn ob-text" onClick={() => goTo(4)}>← Back</button>
                <button
                  className="ob-btn ob-primary"
                  onClick={() => goTo(6)}
                  style={tgStatus.connected ? {} : { opacity:0.7 }}
                >
                  {tgStatus.connected ? 'Continue' : 'Skip, I\'ll do it later'}
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
                </button>
              </div>
            </section>
          )}

          {/* ── STEP 6: Success ── */}
          {step === 6 && (
            <section className="ob-step ob-fadeIn">
              <div className="ob-success">
                <div className="ob-success-mark">
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8l3.5 3.5L13 5" /></svg>
                </div>
                <h1>You're in, <em>{displayName}.</em></h1>
                <p className="ob-lead">Your vault is deployed. ARIA is already scanning Mantle for your first allocation. You will see live activity the moment you enter.</p>

                <div className="ob-summary">
                  <div className="ob-sum-row">
                    <span className="ob-sum-k">Network</span>
                    <span className="ob-sum-v">
                      <span style={{ display:'inline-block', width:6, height:6, borderRadius:'50%', background:'var(--accent)', boxShadow:'0 0 6px var(--accent)', marginRight:6 }} />
                      Mantle
                    </span>
                  </div>
                  <div className="ob-sum-row">
                    <span className="ob-sum-k">Wallet</span>
                    <span className="ob-sum-v" style={{ fontFamily:'var(--mono)' }}>{fmtAddr(address)}</span>
                  </div>
                  <div className="ob-sum-row">
                    <span className="ob-sum-k">Risk profile</span>
                    <span className="ob-sum-v ob-sum-accent">{profileLabels[profile]}</span>
                  </div>
                  <div className="ob-sum-row">
                    <span className="ob-sum-k">Telegram</span>
                    <span className="ob-sum-v" style={{ color: tgStatus.connected ? 'var(--accent)' : 'var(--mute)' }}>
                      {tgStatus.connected ? `● Connected${tgStatus.username ? ` @${tgStatus.username}` : ''}` : 'Not connected. Add from Settings.'}
                    </span>
                  </div>
                  <div className="ob-sum-row">
                    <span className="ob-sum-k">ARIA will call you</span>
                    <span className="ob-sum-v" style={{ fontFamily:'var(--serif)', fontStyle:'italic', fontSize:16 }}>{displayName}</span>
                  </div>
                </div>

                <button className="ob-btn ob-primary" style={{ padding:'14px 28px', fontSize:15 }} onClick={enter}>
                  Enter vault
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
                </button>
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  );
}
