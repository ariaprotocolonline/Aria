import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAgentMemory } from '../../hooks/useAgentMemory';
import { usePortfolioData } from '../../hooks/usePortfolioData';
import { Send, CheckCircle, Plus, ArrowLeft, MessageSquare } from 'lucide-react';
import { env } from '../../config/env';

const FEED_URL = env.FEED_URL || 'http://localhost:3001';

interface AgentMemoryEntry {
  id: string;
  timestamp: string;
  cycleNumber: number;
  decision: {
    shouldReallocate: boolean;
    fromProtocol: string | null;
    toProtocol: string | null;
    reason: string;
    apyImprovementBps: number;
    liquidityScore: number;
    confidence: number;
  };
  outcome: { executed: boolean; txHash?: string; explanation: string };
  marketContext: {
    riskProfile: string;
    topOpportunityApy: number;
    poolsScanned: number;
  };
}

interface MemoryData {
  summary: string;
  recent: AgentMemoryEntry[];
}

const AriaIconLarge = () => (
  <svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="25" width="70" height="50" rx="20" fill="#ffffff" stroke="#000000" strokeWidth="3"/>
    <rect x="25" y="35" width="50" height="30" rx="10" fill="#0F1110"/>
    <ellipse cx="40" cy="50" rx="5" ry="7" fill="#5EE0B2"/>
    <ellipse cx="60" cy="50" rx="5" ry="7" fill="#5EE0B2"/>
    <line x1="50" y1="25" x2="50" y2="15" stroke="#000000" strokeWidth="3"/>
    <circle cx="50" cy="12" r="4" fill="#000000"/>
    <rect x="10" y="40" width="8" height="20" rx="4" fill="#ffffff" stroke="#000000" strokeWidth="3"/>
    <rect x="82" y="40" width="8" height="20" rx="4" fill="#ffffff" stroke="#000000" strokeWidth="3"/>
    <line x1="20" y1="20" x2="25" y2="15" stroke="#5EE0B2" strokeWidth="3" strokeLinecap="round"/>
    <line x1="80" y1="20" x2="75" y2="15" stroke="#5EE0B2" strokeWidth="3" strokeLinecap="round"/>
    <line x1="15" y1="30" x2="10" y2="30" stroke="#5EE0B2" strokeWidth="3" strokeLinecap="round"/>
    <line x1="85" y1="30" x2="90" y2="30" stroke="#5EE0B2" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

const AriaIconSmall = () => (
  <svg width="24" height="24" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="25" width="70" height="50" rx="20" fill="#ffffff" stroke="#000000" strokeWidth="3"/>
    <rect x="25" y="35" width="50" height="30" rx="10" fill="#0F1110"/>
    <ellipse cx="40" cy="50" rx="5" ry="7" fill="#5EE0B2"/>
    <ellipse cx="60" cy="50" rx="5" ry="7" fill="#5EE0B2"/>
    <line x1="50" y1="25" x2="50" y2="15" stroke="#000000" strokeWidth="3"/>
    <circle cx="50" cy="12" r="4" fill="#000000"/>
    <rect x="10" y="40" width="8" height="20" rx="4" fill="#ffffff" stroke="#000000" strokeWidth="3"/>
    <rect x="82" y="40" width="8" height="20" rx="4" fill="#ffffff" stroke="#000000" strokeWidth="3"/>
    <line x1="20" y1="20" x2="25" y2="15" stroke="#5EE0B2" strokeWidth="3" strokeLinecap="round"/>
    <line x1="80" y1="20" x2="75" y2="15" stroke="#5EE0B2" strokeWidth="3" strokeLinecap="round"/>
    <line x1="15" y1="30" x2="10" y2="30" stroke="#5EE0B2" strokeWidth="3" strokeLinecap="round"/>
    <line x1="85" y1="30" x2="90" y2="30" stroke="#5EE0B2" strokeWidth="3" strokeLinecap="round"/>
  </svg>
);

const AgentChat: React.FC = () => {
  const {
    conversations,
    currentConversation,
    sendMessage,
    startNewConversation,
    loadConversation
  } = useAgentMemory();

  const { toContextString } = usePortfolioData();

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'conversations' | 'memory'>('conversations');
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const [memoryLoading, setMemoryLoading] = useState(false);
  const [clearingMemory, setClearingMemory] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<'sidebar' | 'chat'>('sidebar');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [currentConversation?.messages, isTyping]);

  useEffect(() => {
    if (!currentConversation && conversations.length === 0) {
      startNewConversation();
      setMobilePanel('chat');
    } else if (!currentConversation && conversations.length > 0) {
      loadConversation(conversations[0].id);
    }
  }, [conversations, currentConversation, startNewConversation, loadConversation]);

  const fetchMemory = useCallback(async () => {
    setMemoryLoading(true);
    try {
      const res = await fetch(`${FEED_URL}/memory`);
      if (res.ok) setMemoryData(await res.json());
    } catch { /* agent offline */ }
    finally { setMemoryLoading(false); }
  }, []);

  useEffect(() => {
    if (sidebarTab === 'memory') fetchMemory();
  }, [sidebarTab, fetchMemory]);

  const handleClearMemory = async () => {
    if (!confirm('Clear all agent memory? This cannot be undone.')) return;
    setClearingMemory(true);
    try {
      await fetch(`${FEED_URL}/memory`, { method: 'DELETE' });
      await fetchMemory();
    } catch { /* ignore */ }
    finally { setClearingMemory(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;
    const userMsg = input.trim();
    setInput('');
    setIsTyping(true);
    await sendMessage(userMsg, toContextString());
    setIsTyping(false);
  };

  const handleChipClick = (text: string) => setInput(text);

  return (
    <div className="flex flex-col h-[100dvh] bg-bg text-text-primary font-sans transition-colors duration-300">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b border-soft bg-bg z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* Back to sidebar — mobile only, chat panel only */}
          {mobilePanel === 'chat' && (
            <button
              onClick={() => setMobilePanel('sidebar')}
              className="md:hidden flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
              aria-label="Back to conversations"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <AriaIconLarge />
          <div>
            <h1 className="font-serif text-lg md:text-xl font-bold tracking-tight text-text-primary">
              ARIA Agent
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse drop-shadow-[0_0_4px_#5EE0B2]"></div>
              <span className="text-[10px] uppercase tracking-widest font-semibold text-text-secondary">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Conversations icon — mobile only, chat panel only */}
          {mobilePanel === 'chat' && (
            <button
              onClick={() => setMobilePanel('sidebar')}
              className="md:hidden p-2 border border-soft rounded-sm bg-card hover:bg-bg-soft transition-colors"
              aria-label="Conversations"
            >
              <MessageSquare size={16} className="text-text-secondary" />
            </button>
          )}
          <Link
            to="/"
            className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-3 py-1.5 border border-soft rounded-sm hover:bg-bg-soft"
          >
            <span className="hidden sm:inline">Back to Dashboard</span>
            <span className="sm:hidden">← Back</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar — full width on mobile, fixed width on desktop */}
        <aside className={`
          flex-col border-r border-soft bg-bg-soft flex-shrink-0
          w-full md:w-[260px]
          ${mobilePanel === 'sidebar' ? 'flex' : 'hidden'} md:flex
        `}>
          {/* Sidebar tab switcher */}
          <div className="flex border-b border-soft">
            <button
              onClick={() => setSidebarTab('conversations')}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-widest transition-colors ${
                sidebarTab === 'conversations'
                  ? 'text-text-primary border-b-2 border-accent bg-bg'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Chats
            </button>
            <button
              onClick={() => setSidebarTab('memory')}
              className={`flex-1 py-3 text-xs font-semibold uppercase tracking-widest transition-colors ${
                sidebarTab === 'memory'
                  ? 'text-text-primary border-b-2 border-accent bg-bg'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Memory
            </button>
          </div>

          {sidebarTab === 'conversations' ? (
            <>
              <div className="p-4 border-b border-soft">
                <button
                  onClick={() => { startNewConversation(); setMobilePanel('chat'); }}
                  className="w-full flex items-center justify-center gap-2 bg-bg border border-soft text-text-primary py-2 rounded-sm hover:border-text-secondary transition-colors text-sm font-medium shadow-sm"
                >
                  <Plus size={16} /> New Conversation
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversations.map(conv => (
                  <button
                    key={conv.id}
                    onClick={() => { loadConversation(conv.id); setMobilePanel('chat'); }}
                    className={`w-full text-left p-4 border-b border-soft/50 transition-colors ${
                      currentConversation?.id === conv.id
                        ? 'bg-accent/10 border-l-4 border-l-accent'
                        : 'hover:bg-bg'
                    }`}
                  >
                    <div className="text-sm font-medium text-text-primary truncate">{conv.title}</div>
                    <div className="text-xs text-text-secondary mt-1">
                      {new Date(conv.createdAt).toLocaleDateString()}
                    </div>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto flex flex-col">
              {memoryLoading ? (
                <div className="flex items-center justify-center flex-1">
                  <span className="text-xs text-text-secondary">Loading…</span>
                </div>
              ) : !memoryData ? (
                <div className="flex items-center justify-center flex-1 p-4 text-center">
                  <span className="text-xs text-text-secondary">Agent offline or no memory yet.</span>
                </div>
              ) : (
                <>
                  {/* Summary */}
                  <div className="p-4 border-b border-soft">
                    <p className="text-[10px] uppercase tracking-widest text-text-secondary font-semibold mb-2">Summary</p>
                    <pre className="text-xs text-text-primary whitespace-pre-wrap leading-relaxed font-sans">
                      {memoryData.summary}
                    </pre>
                  </div>

                  {/* Recent decisions */}
                  <div className="p-4 flex-1">
                    <p className="text-[10px] uppercase tracking-widest text-text-secondary font-semibold mb-3">Recent Decisions</p>
                    <div className="flex flex-col gap-3">
                      {memoryData.recent.slice(0, 10).map(entry => (
                        <div key={entry.id} className="border border-soft rounded-sm p-3 bg-bg">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                              entry.outcome.executed
                                ? 'bg-accent/20 text-accent'
                                : 'bg-text-secondary/10 text-text-secondary'
                            }`}>
                              {entry.outcome.executed ? 'Executed' : 'Held'}
                            </span>
                            <span className="text-[10px] text-text-secondary">
                              {new Date(entry.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-xs text-text-primary leading-snug line-clamp-3">{entry.decision.reason}</p>
                          {entry.decision.toProtocol && (
                            <p className="text-[10px] text-text-secondary mt-1">→ {entry.decision.toProtocol}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Clear button */}
                  <div className="p-4 border-t border-soft">
                    <button
                      onClick={handleClearMemory}
                      disabled={clearingMemory}
                      className="w-full py-2 text-xs font-semibold text-red-500 border border-red-200 rounded-sm hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
                    >
                      {clearingMemory ? 'Clearing…' : 'Clear Agent Memory'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </aside>

        {/* Main Chat Area — full width on mobile, flex-1 on desktop */}
        <main className={`
          flex-col relative bg-bg flex-1
          ${mobilePanel === 'chat' ? 'flex' : 'hidden'} md:flex
        `}>
          <div ref={containerRef} className="flex-1 overflow-y-auto p-6 md:p-12 flex flex-col gap-8">
            {currentConversation?.messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} w-full`}>
                <div className={`flex gap-4 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {msg.role === 'aria' && (
                    <div className="flex-shrink-0 mt-1">
                      <AriaIconSmall />
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <div className={`p-4 rounded-lg text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-text-primary text-bg shadow-md'
                        : msg.error
                          ? 'bg-card border-l-4 border-l-yellow-400 border-y border-r border-soft text-text-primary shadow-sm'
                          : 'bg-card border border-soft text-text-primary shadow-sm'
                    }`}>
                      {msg.content}
                    </div>
                    {msg.action && msg.action.type === 'reminder' && (
                      <div className="flex items-center gap-2 text-accent text-xs font-medium pl-1 animate-fade-in">
                        <CheckCircle size={14} />
                        Reminder set for {msg.action.time}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start w-full">
                <div className="flex gap-4 max-w-[80%]">
                  <div className="flex-shrink-0 mt-1"><AriaIconSmall /></div>
                  <div className="p-4 rounded-lg bg-card border border-soft shadow-sm flex items-center gap-1.5 h-[52px]">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-6 bg-bg border-t border-soft flex-shrink-0">
            <div className="max-w-4xl mx-auto flex flex-col gap-3">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {['Check my position', "What's my APY?", 'Set a reminder', 'Explain last action'].map(chip => (
                  <button
                    key={chip}
                    onClick={() => handleChipClick(chip)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full border border-soft bg-card text-xs font-medium text-text-secondary hover:text-text-primary hover:border-text-secondary transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <form onSubmit={handleSubmit} className="flex gap-4 relative">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Message ARIA..."
                  disabled={isTyping}
                  className="flex-1 bg-bg-soft border border-soft rounded-md pl-4 pr-14 py-4 text-base md:text-sm text-text-primary focus:outline-none focus:border-text-secondary shadow-inner"
                />
                <button
                  type="submit"
                  disabled={isTyping || !input.trim()}
                  className="absolute right-2 top-2 bottom-2 bg-accent text-white px-4 rounded font-medium disabled:opacity-50 hover:bg-opacity-90 transition-opacity flex items-center justify-center"
                >
                  <Send size={18} />
                </button>
              </form>
              <div className="text-center text-[10px] text-text-secondary uppercase tracking-widest mt-2">
                ARIA is an autonomous agent. Capital at risk.
              </div>
            </div>
          </div>
        </main>
      </div>
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default AgentChat;
