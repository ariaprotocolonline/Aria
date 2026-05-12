import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import LandingNav from '../components/landing/LandingNav';
import Footer from '../components/landing/Footer';
import { ArrowUp, Download, Menu } from 'lucide-react';

interface DocsPageProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const sections = [
  { id: 'abstract', title: '1. Abstract' },
  { id: 'introduction', title: '2. Introduction' },
  { id: 'the-problem', title: '3. The Problem' },
  { id: 'the-aria-protocol', title: '4. The ARIA Protocol' },
  { id: 'user-experience', title: '5. User Experience' },
  { id: 'technical-architecture', title: '6. Technical Architecture' },
  { id: 'supported-assets', title: '7. Supported Assets' },
  { id: 'risk-profiles', title: '8. Risk Profiles' },
  { id: 'competitive-landscape', title: '9. Competitive Landscape' },
  { id: 'roadmap', title: '10. Roadmap' },
  { id: 'governance', title: '11. Governance' },
  { id: 'risk-disclosures', title: '12. Risk Disclosures' },
  { id: 'conclusion', title: '13. Conclusion' }
];

const DocsPage: React.FC<DocsPageProps> = ({ isDarkMode, toggleDarkMode }) => {
  const navigate = useNavigate();
  const { isConnected } = useAccount();
  const wasConnected = useRef(isConnected);
  const [activeSection, setActiveSection] = useState('abstract');
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    // Scroll spy
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-20% 0px -80% 0px' }
    );

    sections.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    // Back to top visibility
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };

    window.addEventListener('scroll', handleScroll);
    handleScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (isConnected && !wasConnected.current) {
      navigate('/');
    }
    wasConnected.current = isConnected;
  }, [isConnected, navigate]);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      // Offset for sticky header
      const y = el.getBoundingClientRect().top + window.scrollY - 100;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-bg text-text-primary transition-colors duration-300 flex flex-col font-sans">
      <LandingNav
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
      />
      
      {/* Mobile Dropdown Header */}
      <div className="md:hidden sticky top-[73px] z-40 bg-bg border-b border-soft px-6 py-4 flex items-center justify-between shadow-sm">
        <span className="text-sm font-semibold text-text-primary flex items-center gap-2">
          <Menu size={16} /> Jump to section:
        </span>
        <select 
          className="bg-bg-soft border border-soft text-text-primary text-sm rounded-sm px-3 py-1.5 outline-none font-medium"
          value={activeSection}
          onChange={(e) => scrollToSection(e.target.value)}
        >
          {sections.map(s => (
            <option key={s.id} value={s.id}>{s.title}</option>
          ))}
        </select>
      </div>

      <main className="flex-1 max-w-7xl mx-auto w-full flex px-4 md:px-12 lg:px-24 py-8 md:py-12 gap-12 relative">
        
        {/* Left Sidebar Desktop */}
        <aside className="hidden md:block w-[260px] flex-shrink-0">
          <div className="sticky top-[120px] flex flex-col gap-3">
            <h3 className="font-semibold text-text-primary text-sm uppercase tracking-wider mb-2">Table of Contents</h3>
            {sections.map(section => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={`text-left text-sm transition-colors py-1 ${
                  activeSection === section.id 
                    ? 'text-accent font-semibold' 
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {section.title}
              </button>
            ))}
          </div>
        </aside>

        {/* Right Content */}
        <div className="flex-1 min-w-0 w-full flex justify-center">
          <article className="max-w-[720px] w-full min-w-0 text-[16px] leading-[1.8] font-sans text-left md:text-justify text-text-primary">
            
            {/* Header Area */}
            <div className="mb-12 border-b border-soft pb-8">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-serif text-3xl font-bold text-text-primary">ARIA</span>
              </div>
              <h2 className="font-serif text-2xl text-text-secondary italic mb-6">Autonomous RWA Intelligence Agent</h2>
              <div className="text-sm text-text-secondary mb-8">Whitepaper | Version 1.0 | 2026</div>
              
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-text-secondary font-medium">~12 min read</span>
                <a href="/ARIA_Whitepaper.pdf" download="ARIA_Whitepaper.pdf" className="flex items-center gap-2 text-accent border border-accent rounded-sm px-4 py-2 text-sm font-medium hover:bg-accent/10 transition-colors">
                  <Download size={16} />
                  Download PDF
                </a>
              </div>
            </div>

            {/* Content Sections */}
            <section id="abstract" className="mb-12 scroll-mt-[100px]">
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-6 text-text-primary">1. Abstract</h2>
              <p className="mb-6">
                ARIA is an autonomous protocol that manages Real World Asset capital on the Mantle blockchain. It monitors liquidity conditions, identifies yield opportunities across the Mantle ecosystem, and reallocates positions without requiring user intervention. Every decision is logged and explained in plain language so users maintain complete visibility into how their capital is being managed at all times.
              </p>
              <p>
                The protocol addresses a structural gap in decentralized finance. The growth of high-quality onchain assets has not been matched by the infrastructure needed to actively manage those positions. Capital in WETH and USDC sits largely static, unable to respond to shifting liquidity conditions or emerging yield opportunities in real time. ARIA closes that gap.
              </p>
            </section>

            <section id="introduction" className="mb-12 scroll-mt-[100px]">
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-6 text-text-primary">2. Introduction</h2>
              <p className="mb-6">
                Yield optimisation across DeFi liquidity pools is one of the most consequential opportunities in decentralised finance. WETH, the canonical wrapped ether on Mantle, and USDC, the leading dollar stablecoin, give users onchain access to yields across concentrated liquidity pools on Agni Finance and FusionX. Both assets trade with deep liquidity on Mantle and together form the foundation of the chain's DeFi ecosystem.
              </p>
              <p className="mb-6">
                The existence of these instruments has not, however, resolved the fundamental challenge of capital efficiency in DeFi. Yield rates shift continuously across protocols. Liquidity composition changes as incentive programs begin and end. A position that is optimal at one point in time can become suboptimal within hours. Capturing the full yield potential of RWA instruments requires a level of continuous monitoring and execution speed that no individual user can sustainably provide.
              </p>
              <p>
                ARIA is built to solve this. Rather than giving users more data to act on, it removes the requirement for user action entirely. It is not a dashboard or an alert system. It is a protocol that manages capital the way a professional portfolio manager would, with continuous attention, disciplined risk management, and systematic execution.
              </p>
            </section>

            <section id="the-problem" className="mb-12 scroll-mt-[100px]">
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-6 text-text-primary">3. The Problem</h2>
              <p className="mb-6">The structural inefficiencies affecting RWA capital on Mantle fall into four categories.</p>
              
              <h3 className="font-serif text-xl font-bold mb-4 mt-8">Incentive-Driven Liquidity Fragility</h3>
              <p className="mb-6">
                A significant portion of the liquidity visible in Mantle's DeFi pools is incentive-dependent. Total value locked figures look substantial on paper, but the underlying composition reveals capital that is present only because emissions are flowing. When incentive programs end or reduce, this capital exits rapidly, creating sudden reductions in pool depth that result in material slippage for users trying to exit. Effective risk management requires detecting this risk before it materializes, not in response to it.
              </p>

              <h3 className="font-serif text-xl font-bold mb-4 mt-8">Yield Opportunity Decay</h3>
              <p className="mb-6">
                Yield rates across Mantle's liquidity protocols shift on timescales measured in hours. Opportunities on Agni Finance, FusionX, and the broader Mantle DeFi ecosystem open and close continuously. The difference between the best and worst available risk-adjusted return for a given asset at any moment can exceed several hundred basis points. Capturing these opportunities requires continuous monitoring across multiple protocols simultaneously, which no individual user can sustainably maintain.
              </p>

              <h3 className="font-serif text-xl font-bold mb-4 mt-8">Single-Position Capital Concentration</h3>
              <p className="mb-6">
                Most capital on Mantle is deployed in a single position and held there indefinitely. The ecosystem supports a range of complementary strategies that collectively offer superior risk-adjusted returns compared to any single static position. Deploying WETH into concentrated liquidity ranges, rotating USDC across stable pools on Agni Finance and FusionX — these approaches require active management that most users are not positioned to provide.
              </p>

              <h3 className="font-serif text-xl font-bold mb-4 mt-8">Risk Opacity</h3>
              <p>
                Users holding RWA positions on Mantle typically lack visibility into the true risk composition of their exposure. What fraction of pool liquidity is incentive-dependent? What is the realistic exit cost at their position size? What does the emissions schedule look like over the coming weeks? Answering these questions requires dedicated data infrastructure and continuous monitoring. Without answers, users cannot make informed decisions about their capital.
              </p>
            </section>

            <section id="the-aria-protocol" className="mb-12 scroll-mt-[100px]">
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-6 text-text-primary">4. The ARIA Protocol</h2>
              <p className="mb-6">
                ARIA manages WETH and USDC positions on behalf of users through three intelligence layers that operate in continuous parallel. The user connects their wallet, selects a risk profile, and ARIA handles everything thereafter.
              </p>

              <h3 className="font-serif text-xl font-bold mb-4 mt-8">Liquidity Quality Intelligence</h3>
              <p className="mb-6">
                ARIA constructs a Liquidity Quality Score for each monitored pool by analyzing the incentive dependency ratio, historical liquidity behavior at prior emissions cliffs, organic volume trends, and depth concentration metrics. Pools with high incentive dependency receive lower scores, which directly constrain ARIA's willingness to hold positions in those pools regardless of their headline yield. When a pool's quality score declines toward a user's profile threshold, ARIA evaluates available alternatives and executes a reallocation before the liquidity event occurs.
              </p>

              <h3 className="font-serif text-xl font-bold mb-4 mt-8">Yield Opportunity Detection</h3>
              <p className="mb-6">
                ARIA monitors yield rates across all integrated Mantle protocols in real time. For each opportunity identified, it calculates a risk-adjusted return that accounts for the pool's Liquidity Quality Score, projected opportunity duration, transaction costs, and the user's risk profile. Reallocation is triggered only when the improvement exceeds a threshold calibrated to the user's profile, preventing excessive churn while ensuring superior opportunities are captured.
              </p>

              <h3 className="font-serif text-xl font-bold mb-4 mt-8">Autonomous Execution</h3>
              <p>
                When liquidity and yield signals align, ARIA executes the required transactions onchain without waiting for user confirmation. The protocol constructs and submits swap, withdrawal, and deposit transactions through the user's vault contract in a single coordinated sequence. Every execution is logged to the user's activity feed with a clear explanation of what was done and what conditions drove the decision.
              </p>
            </section>

            <section id="user-experience" className="mb-12 scroll-mt-[100px]">
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-6 text-text-primary">5. User Experience</h2>
              <p className="mb-6">
                ARIA's interface is built around a single principle: users should always understand what is happening with their capital, without needing to take any action to make it happen. The dashboard presents the user's current position value and live yield, a chronological log of all protocol actions with plain-language explanations, a view of conditions ARIA is currently monitoring, and the user's selected risk profile.
              </p>
              <p className="mb-6">
                A conversational interface allows users to ask questions about their portfolio, current conditions across Mantle protocols, or the reasoning behind specific decisions. Responses are grounded in live portfolio state and real-time onchain data.
              </p>
              
              <blockquote className="border-l-4 border-accent bg-bg-soft font-serif italic pl-6 pr-4 py-4 my-8 text-base md:text-lg text-text-secondary">
                "Transparency and autonomy are not competing values. ARIA acts without requiring user input, but it never acts without explaining itself. This makes the protocol accessible to users with no prior DeFi experience while remaining accountable enough for sophisticated capital allocators."
              </blockquote>
            </section>

            <section id="technical-architecture" className="mb-12 scroll-mt-[100px]">
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-6 text-text-primary">6. Technical Architecture</h2>
              
              <h3 className="font-serif text-xl font-bold mb-4 mt-8">Vault Contract Layer</h3>
              <p className="mb-6">
                Each user's capital is held in an individually deployed vault smart contract on Mantle. The vault accepts deposits of WETH and USDC and grants ARIA bounded execution permissions — the ability to move funds between a predefined set of approved protocol integrations and nothing else. ARIA cannot move funds to any address outside the approved set. The approved set is defined by the user at vault creation and can only be modified by the vault owner. Users can pause execution or withdraw capital directly at any time with no timelock.
              </p>

              <h3 className="font-serif text-xl font-bold mb-4 mt-8">Intelligence Layer</h3>
              <p className="mb-6">
                The intelligence layer operates as an autonomous agent that continuously queries Mantle RPC nodes for pool state, emissions schedules, lending rates, and liquidity composition data. Signal processing logic converts this raw data into Liquidity Quality Scores, risk-adjusted yield comparisons, and reallocation triggers calibrated to each user's risk profile.
              </p>

              <h3 className="font-serif text-xl font-bold mb-4 mt-8">Protocol Integrations</h3>
              <p className="mb-6">
                <strong>Agni Finance</strong> — concentrated liquidity AMM on Mantle. Launch pools: WETH/USDT (<code className="font-mono text-xs bg-bg-soft px-1 rounded">0x628f…bd4</code>), WETH/WMNT (<code className="font-mono text-xs bg-bg-soft px-1 rounded">0x585e…94a7</code>), and USDC/USDT (<code className="font-mono text-xs bg-bg-soft px-1 rounded">0x1686…4ae0</code>). <strong>FusionX</strong> — AMM liquidity provision on Mantle. Launch pools: WETH/USDT (<code className="font-mono text-xs bg-bg-soft px-1 rounded">0xbe18…3650</code>) and USDC/USDT (<code className="font-mono text-xs bg-bg-soft px-1 rounded">0x6488…1ca065</code>). Additional protocol integrations — including lending markets and yield tokenisation — are planned for Phase II and will be added to the approved pool list via governance.
              </p>

              <h3 className="font-serif text-xl font-bold mb-4 mt-8">Security</h3>
              <p>
                User funds are held in individual vault contracts and never pooled. The agent can only interact with user-approved protocol addresses. Every transaction is logged onchain and visible to the user in real time. All smart contracts will be audited by an independent security firm prior to mainnet launch, with reports published publicly.
              </p>
            </section>

            <section id="supported-assets" className="mb-12 scroll-mt-[100px]">
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-6 text-text-primary">7. Supported Assets</h2>
              <p className="mb-6">
                <strong>WETH</strong> is the canonical wrapped ether on Mantle, pegged 1:1 to ETH and deployed across concentrated liquidity pools on Agni Finance and FusionX. It carries a base yield of approximately 8.2% APY in the WETH/USDT pool. Under ARIA management, target yield ranges from 7.8% to 9.5% APY depending on the pool and risk profile.
              </p>
              <p>
                <strong>USDC</strong> is the leading dollar stablecoin on Mantle, deployed across stable pools on Agni Finance and FusionX. It carries a base yield of approximately 4.2% APY. Under ARIA management, USDC is rotated between pools to capture the best available stable yield at any given time.
              </p>
            </section>

            <section id="risk-profiles" className="mb-12 scroll-mt-[100px]">
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-6 text-text-primary">8. Risk Profiles</h2>
              <p className="mb-6">
                Users select one of three risk profiles at onboarding. The profile governs reallocation thresholds, approved protocol tiers, and concentration limits, and can be updated at any time.
              </p>
              
              <ul className="list-none space-y-6">
                <li>
                  <strong className="font-serif text-lg">Conservative.</strong> Target APY range of 6% to 9%. Operates within Agni Finance and FusionX base pools only. Liquidity quality floor of 70. Reallocation requires 150 basis points of APY improvement. Maximum single-pool exposure of 80%. Incentivized pools excluded entirely.
                </li>
                <li>
                  <strong className="font-serif text-lg">Balanced.</strong> Target APY range of 9% to 14%. Operates across all five live Agni Finance and FusionX pools, including higher-yield WETH/WMNT. Liquidity quality floor of 55. Reallocation requires 75 basis points of APY improvement. Maximum single-pool exposure of 65%. Incentivized pools permitted above a quality score of 60.
                </li>
                <li>
                  <strong className="font-serif text-lg">Aggressive.</strong> Target APY range of 14% to 25% and above. Accesses all live pools with preference for highest-APY WETH positions. Liquidity quality floor of 40. Reallocation requires 40 basis points of APY improvement. Maximum single-pool exposure of 50%. Incentivized pools permitted. Leveraged yield strategies and additional high-yield protocol integrations added in Phase II.
                </li>
              </ul>
            </section>

            <section id="competitive-landscape" className="mb-12 scroll-mt-[100px]">
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-6 text-text-primary">9. Competitive Landscape</h2>
              <p className="mb-6">
                Yield optimization in DeFi is a populated category. The majority of existing protocols operate on fixed rule-based logic, moving capital between pools according to predefined criteria. They automate execution but do not adapt to changing market structure. They cannot distinguish organic liquidity from incentive-driven depth and cannot modify their behavior in response to conditions they have not been explicitly programmed to handle.
              </p>
              <p>
                ARIA's differentiation rests on three specific capabilities. The first is liquidity quality scoring — no existing yield protocol distinguishes between organic and incentive-driven liquidity composition, and this is the foundation of ARIA's risk management. The second is true autonomy — ARIA executes without user confirmation, because the user's role is to define their risk appetite and everything else should be handled by the protocol. The third is explainability — every protocol decision is accompanied by a plain-language explanation, which builds the trust that drives long-term capital retention.
              </p>
            </section>

            <section id="roadmap" className="mb-12 scroll-mt-[100px]">
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-6 text-text-primary">10. Roadmap</h2>
              
              <h3 className="font-serif text-xl font-bold mb-2 mt-8">Phase I — Foundation</h3>
              <p className="mb-6">
                ARIA's core infrastructure is established on Mantle mainnet. Audited vault contracts are deployed. Conservative and Balanced risk profiles go live across the five launch pool integrations on Agni Finance and FusionX. The dashboard, activity feed, and conversational interface are released publicly. The objective is to establish the core value proposition in production and build an initial user base of capital allocators on Mantle.
              </p>

              <h3 className="font-serif text-xl font-bold mb-2 mt-8">Phase II — Expansion</h3>
              <p className="mb-6">
                Asset coverage expands to include additional tokens achieving sufficient liquidity on Mantle. The Aggressive risk profile launches with Pendle and Cleopatra strategies. Multi-asset vault management enables ARIA to optimise combined WETH and USDC positions with cross-asset logic. An institutional API provides programmatic access to the intelligence layer for funds and protocol integrations.
              </p>

              <h3 className="font-serif text-xl font-bold mb-2 mt-8">Phase III — Infrastructure</h3>
              <p>
                ARIA is positioned as foundational infrastructure for RWA capital management across DeFi. Cross-chain deployment extends the protocol to RWA capital on other EVM networks. A third-party integration SDK allows other protocols to embed ARIA's liquidity quality scoring and yield detection into their own products. Protocol governance is introduced, giving long-term stakeholders control over parameter setting, protocol approvals, and treasury allocation.
              </p>
            </section>

            <section id="governance" className="mb-12 scroll-mt-[100px]">
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-6 text-text-primary">11. Governance</h2>
              <p>
                ARIA's governance model gives long-term stakeholders meaningful input over protocol parameters without compromising the integrity of the agent's risk management logic. Governance scope covers protocol fee parameters, approved protocol whitelist additions and removals, Liquidity Quality Score methodology updates, and treasury allocation. The core execution logic of the intelligence layer is excluded from governance scope. Full governance documentation, token distribution details, and vesting schedules will be published in a dedicated governance paper prior to Phase II launch.
              </p>
            </section>

            <section id="risk-disclosures" className="mb-12 scroll-mt-[100px]">
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-6 text-text-primary">12. Risk Disclosures</h2>
              <p className="mb-6">Prospective users should carefully consider the following material risks before depositing capital.</p>
              
              <ul className="list-none space-y-4">
                <li><strong>Smart Contract Risk.</strong> ARIA's vault contracts are subject to the risk of programming errors or exploits. All contracts will be audited prior to mainnet deployment. Audits reduce but do not eliminate this risk.</li>
                <li><strong>Protocol Integration Risk.</strong> ARIA operates within third-party DeFi protocols. A failure, exploit, or governance action affecting an integrated protocol could affect user capital held in that protocol.</li>
                <li><strong>Execution Risk.</strong> Autonomous execution introduces the possibility of incorrect signal interpretation or transaction failure under adverse network conditions. ARIA includes circuit breakers that pause execution when anomalous conditions are detected.</li>
                <li><strong>Liquidity Risk.</strong> Despite ARIA's liquidity quality monitoring, rapid liquidity events can occur faster than the protocol can respond. Exit costs can increase materially during periods of market stress.</li>
                <li><strong>Regulatory Risk.</strong> The regulatory treatment of tokenized RWA instruments and autonomous DeFi protocols is evolving. Changes in applicable law or regulation could affect ARIA's operations or the availability of supported assets.</li>
              </ul>
            </section>

            <section id="conclusion" className="mb-12 scroll-mt-[100px]">
              <h2 className="font-serif text-2xl md:text-3xl font-bold mb-6 text-text-primary">13. Conclusion</h2>
              <p className="mb-6">
                The infrastructure for productive RWA capital deployment exists on Mantle. The assets are there. The protocols are there. The liquidity is there. What has been missing is a protocol capable of putting that capital to work continuously, adapting to changing conditions in real time, and doing so in a way that any user can understand and trust.
              </p>
              <p className="mb-6">
                ARIA is that protocol. It manages capital with the discipline of a systematic investment process, the transparency of a complete audit trail, and the accessibility of a product designed for any level of DeFi experience.
              </p>
              <p className="font-serif text-xl italic text-text-secondary">
                RWA capital exists. It just does not work. ARIA makes it work.
              </p>
              
              <div className="mt-12 pt-8 border-t border-soft text-sm text-text-secondary text-center space-y-2">
                <p>For further information: <a href="https://aria-protocol.xyz" className="text-accent hover:underline">aria-protocol.xyz</a> | <a href="https://docs.aria-protocol.xyz" className="text-accent hover:underline">docs.aria-protocol.xyz</a> | <a href="https://x.com/aria_rwa?s=21" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">@ARIA_rwa</a></p>
                <p className="text-[12px]">This document is provided for informational purposes only and does not constitute an offer to sell or a solicitation to buy any securities or financial instruments.</p>
              </div>
            </section>
          </article>
        </div>

      </main>
      
      <Footer />

      {/* Back to Top Button */}
      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-8 right-8 p-3 bg-card border border-soft rounded-full shadow-lg text-text-secondary hover:text-accent hover:border-accent transition-all z-50 animate-fade-in"
          aria-label="Back to top"
        >
          <ArrowUp size={20} />
        </button>
      )}
    </div>
  );
};

export default DocsPage;
