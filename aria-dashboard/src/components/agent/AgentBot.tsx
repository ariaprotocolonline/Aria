import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from 'wagmi';
import { Reminder } from '../../hooks/useAgentMemory';
import { env } from '../../config/env';
import { usePortfolioData } from '../../hooks/usePortfolioData';

const AriaIcon = () => (
  <svg width="40" height="40" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <rect x="15" y="25" width="70" height="50" rx="20" fill="#ffffff" stroke="#000000" strokeWidth="3"/>
    <rect x="25" y="35" width="50" height="30" rx="10" fill="#0F1110"/>
    <ellipse cx="40" cy="50" rx="5" ry="7" fill="#5EE0B2" className="animate-pulse drop-shadow-[0_0_4px_#5EE0B2]"/>
    <ellipse cx="60" cy="50" rx="5" ry="7" fill="#5EE0B2" className="animate-pulse drop-shadow-[0_0_4px_#5EE0B2]" style={{ animationDelay: '500ms' }}/>
    <line x1="50" y1="25" x2="50" y2="15" stroke="#000000" strokeWidth="3"/>
    <circle cx="50" cy="12" r="4" fill="#000000" className="animate-pulse"/>
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

interface QuickMessage {
  role: 'user' | 'aria';
  content: string;
  error?: 'rate_limit' | 'capacity';
}

const AgentBot: React.FC = () => {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { toContextString } = usePortfolioData();
  const [isOpen, setIsOpen] = useState(false);
  const [showQuickChat, setShowQuickChat] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  
  // Quick Chat State
  const [messages, setMessages] = useState<QuickMessage[]>(() => {
    const saved = localStorage.getItem('aria-quick-chat');
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reminders State
  const [activeReminders, setActiveReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    localStorage.setItem('aria-quick-chat', JSON.stringify(messages));
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]);

  useEffect(() => {
    // Check reminders every 10 seconds
    const checkReminders = () => {
      const savedStr = localStorage.getItem('aria-reminders');
      if (savedStr) {
        const reminders: Reminder[] = JSON.parse(savedStr);
        const now = Date.now();
        const due = reminders.filter(r => r.timestamp <= now);
        
        if (due.length > 0) {
          setActiveReminders(prev => {
            const newReminders = due.filter(d => !prev.find(p => p.id === d.id));
            return [...prev, ...newReminders];
          });
          
          // Remove due reminders from storage
          const pending = reminders.filter(r => r.timestamp > now);
          localStorage.setItem('aria-reminders', JSON.stringify(pending));
        }
      }
    };

    checkReminders();
    const interval = setInterval(checkReminders, 10000);
    return () => clearInterval(interval);
  }, []);

  const dismissReminder = (id: string) => {
    setActiveReminders(prev => prev.filter(r => r.id !== id));
  };

  const handleQuickChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput('');
    
    // Maintain max 3 messages history plus the new one
    const newMessages = [...messages, { role: 'user' as const, content: userMsg }].slice(-4);
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const history = newMessages.map(m => ({
        role: m.role === 'aria' ? 'assistant' : 'user',
        content: m.content
      }));

      const portfolioCtx = toContextString();
      const systemPrompt = portfolioCtx
        ? `You are ARIA, an autonomous RWA intelligence agent on Mantle. Keep responses concise.\n\n` +
          `The dashboard has injected the user's LIVE portfolio data below. ` +
          `This data is real — never say you lack access to it. Answer balance questions directly from these numbers.\n\n${portfolioCtx}`
        : `You are ARIA, an autonomous RWA intelligence agent on Mantle. Keep responses concise.`;

      const url = env.API_URL ? `${env.API_URL}/api/chat` : env.ANTHROPIC_API_URL;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (!env.API_URL) {
        headers['anthropic-version'] = env.ANTHROPIC_VERSION;
        headers['anthropic-dangerous-direct-browser-access'] = 'true';
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model:         env.ANTHROPIC_MODEL,
          max_tokens:    300,
          walletAddress: address ?? '',
          system:        systemPrompt,
          messages:      history,
        }),
      });

      if (response.status === 429) {
        setMessages(prev =>
          [...prev, { role: 'aria' as const, content: 'You have reached your daily message limit. This resets at midnight.', error: 'rate_limit' as const }].slice(-3)
        );
      } else if (response.status === 503) {
        setMessages(prev =>
          [...prev, { role: 'aria' as const, content: 'ARIA chat is at capacity. Try again shortly.', error: 'capacity' as const }].slice(-3)
        );
      } else if (response.ok) {
        const data = await response.json();
        setMessages(prev => [...prev, { role: 'aria' as const, content: data.content[0].text }].slice(-3));
      } else {
        setMessages(prev => [...prev, { role: 'aria' as const, content: 'Something went wrong. Please try again.' }].slice(-3));
      }
    } catch {
      setMessages(prev => [...prev, { role: 'aria' as const, content: 'Something went wrong. Please try again.' }].slice(-3));
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      {/* Global Reminders Toasts */}
      <div className="fixed bottom-20 left-3 md:bottom-6 md:left-6 z-[9999] flex flex-col gap-4">
        {activeReminders.map(reminder => (
          <div key={reminder.id} className="bg-bg border-l-4 border-l-accent border-y border-r border-y-soft border-r-soft p-4 rounded-r-md shadow-lg flex flex-col gap-3 w-72 animate-fade-in">
            <div className="flex items-center gap-3">
              <AriaIconSmall />
              <span className="font-semibold text-sm text-text-primary">ARIA Reminder</span>
            </div>
            <p className="text-sm text-text-primary leading-relaxed">{reminder.text}</p>
            <button 
              onClick={() => dismissReminder(reminder.id)}
              className="self-end text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
            >
              Dismiss
            </button>
          </div>
        ))}
      </div>

      <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[9999] flex flex-col items-end gap-4">
        {/* Expanded Popup / Chat Bubble */}
        {isOpen && (
          <div 
            className="bg-bg border border-soft rounded-xl shadow-2xl overflow-hidden w-[calc(100vw-32px)] md:w-[320px] transition-all duration-200 ease-out origin-bottom-right"
            style={{ animation: 'scaleIn 0.2s ease-out forwards' }}
          >
            {showOnboarding ? (
              <div className="flex flex-col h-[400px]">
                <div className="p-4 border-b border-soft flex items-center justify-between bg-bg-soft">
                  <div className="flex items-center gap-2">
                    <AriaIconSmall />
                    <span className="font-serif font-bold text-text-primary">Getting Started</span>
                  </div>
                  <button onClick={() => setShowOnboarding(false)} className="text-xs text-text-secondary hover:text-text-primary">Back</button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 text-sm text-text-primary leading-relaxed">
                  <div>
                    <h4 className="font-bold mb-1 text-accent">Welcome to ARIA</h4>
                    <p className="text-text-secondary">Your Autonomous RWA Intelligence Agent. We make it easy to transition from Web2 to Web3.</p>
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">How the Dashboard Works</h4>
                    <p className="text-text-secondary">Connect your wallet to view your portfolio. ARIA tracks your assets (like WETH and USDC) on the Mantle network.</p>
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Getting Started & Earning</h4>
                    <p className="text-text-secondary">Select your Risk Profile (Conservative, Balanced, or Aggressive). ARIA automatically monitors the market 24/7, reallocating your capital to find the best yields securely. You earn passive APY instantly without manual trading.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setShowOnboarding(false);
                      navigate('/agent');
                    }}
                    className="mt-2 w-full bg-[#95A395] text-white py-2 rounded-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Enter Agent Mode
                  </button>
                </div>
              </div>
            ) : showQuickChat ? (
              <div className="flex flex-col h-[350px]">
                <div className="p-4 border-b border-soft flex items-center justify-between bg-bg-soft">
                  <div className="flex items-center gap-2">
                    <AriaIconSmall />
                    <span className="font-serif font-bold text-text-primary">ARIA</span>
                  </div>
                  <button onClick={() => setShowQuickChat(false)} className="text-xs text-text-secondary hover:text-text-primary">Back</button>
                </div>
                
                <div ref={containerRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
                  {messages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`text-sm p-3 rounded-lg max-w-[85%] leading-relaxed ${
                        msg.role === 'user'
                          ? 'bg-text-primary text-bg'
                          : msg.error
                            ? 'bg-bg-soft text-text-primary border-l-4 border-l-yellow-400 border-y border-r border-soft'
                            : 'bg-bg-soft text-text-primary border border-soft'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="text-sm p-3 rounded-lg bg-bg-soft text-text-primary border border-soft flex gap-1 items-center">
                        <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></div>
                        <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  )}
                </div>
                
                <form onSubmit={handleQuickChatSubmit} className="p-3 border-t border-soft bg-bg flex gap-2">
                  <input 
                    type="text" 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Ask something..."
                    className="flex-1 bg-bg-soft border border-soft rounded-md px-3 py-2 text-sm focus:outline-none"
                    disabled={isTyping}
                  />
                  <button 
                    type="submit" 
                    disabled={isTyping || !input.trim()}
                    className="bg-accent text-white px-3 py-2 rounded-md text-sm font-medium disabled:opacity-50"
                  >
                    Send
                  </button>
                </form>
              </div>
            ) : (
              <div className="p-6 flex flex-col items-center text-center">
                <div className="mb-4">
                  <AriaIcon />
                </div>
                <h3 className="font-serif text-xl font-bold text-text-primary mb-2">Switch to Agent Mode?</h3>
                <p className="text-sm text-text-secondary mb-6 leading-relaxed">
                  Get a dedicated space to chat with ARIA, set reminders, and let ARIA act on your behalf while you're away.
                </p>
                <div className="flex flex-col gap-3 w-full">
                  <button 
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/agent');
                    }}
                    className="w-full bg-[#95A395] text-white py-2.5 rounded-sm font-medium hover:opacity-90 transition-opacity"
                  >
                    Enter Agent Mode
                  </button>
                  <button
                    onClick={() => setShowQuickChat(true)}
                    className="w-full border border-soft text-text-primary py-2.5 rounded-sm font-medium hover:bg-bg-soft transition-colors"
                  >
                    Just ask a question
                  </button>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      window.dispatchEvent(new CustomEvent('aria-replay-tour'));
                    }}
                    className="w-full border border-soft text-text-primary py-2.5 rounded-sm font-medium hover:bg-bg-soft transition-colors"
                  >
                    Tour Guide
                  </button>
                  <button
                    onClick={() => setShowOnboarding(true)}
                    className="w-full text-text-secondary py-2 text-sm font-medium hover:text-text-primary transition-colors underline decoration-soft underline-offset-4"
                  >
                    You are a new user get onboarded
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Floating Button */}
        <button
          data-tour="agent-button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex flex-col items-center justify-center transition-transform hover:scale-105"
          style={{ animation: 'float 3s ease-in-out infinite' }}
        >
          <AriaIcon />
        </button>
      </div>

      <style>{`
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
          100% { transform: translateY(0px); }
        }
        @keyframes scan {
          0% { transform: translateX(-15px); }
          100% { transform: translateX(40px); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
};

export default AgentBot;
