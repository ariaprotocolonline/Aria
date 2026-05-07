import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useAccount } from 'wagmi';
import { RiskProfile, chatWithAria } from '../services/claude';
import { usePortfolioData } from '../hooks/usePortfolioData';

interface ChatPanelProps {
  riskProfile: RiskProfile;
}

interface Message {
  id: string;
  role: 'user' | 'aria';
  content: string;
  error?: 'rate_limit' | 'capacity';
}

const ChatPanel: React.FC<ChatPanelProps> = ({ riskProfile }) => {
  const { address } = useAccount();
  const { toContextString } = usePortfolioData();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      role: 'aria',
      content: 'I am ARIA. How can I assist you in managing your Mantle portfolio today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: input.trim()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    let ariaContent = '';
    let ariaError: Message['error'] = undefined;
    try {
      ariaContent = await chatWithAria(
        userMessage.content,
        riskProfile,
        messages.map(m => ({ role: m.role, content: m.content })),
        address,
        toContextString(),
      );
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      const safeMsg =
        raw.startsWith('You have reached') ||
        raw.startsWith('ARIA chat is at capacity') ||
        raw.startsWith('Please connect your wallet') ||
        raw.startsWith('ARIA is unavailable')
          ? raw
          : 'Something went wrong. Please try again.';
      ariaContent = safeMsg;
      ariaError =
        raw.includes('reached') || raw.includes('limit') ? 'rate_limit' :
        raw.includes('capacity') ? 'capacity' :
        undefined;
    }

    const agentMessage: Message = {
      id: `msg-${Date.now()+1}`,
      role: 'aria',
      content: ariaContent,
      error: ariaError,
    };

    setMessages(prev => [...prev, agentMessage]);
    setIsLoading(false);
  };

  return (
    <div className="py-8 border-b border-soft">
      <h3 data-tour="ask-aria" className="font-serif text-2xl font-semibold text-text-primary mb-6">Ask ARIA</h3>
      <div className="flex flex-col border border-soft bg-card rounded-sm h-[400px]">
        {/* Chat Messages */}
        <div ref={containerRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] min-w-0 p-4 rounded-sm text-sm leading-relaxed break-words ${
                msg.role === 'user'
                  ? 'bg-text-primary text-bg'
                  : msg.error
                    ? 'bg-bg border-l-4 border-l-yellow-400 border-y border-r border-soft text-text-primary'
                    : 'bg-bg border border-soft text-text-primary'
              }`}>
                {msg.role === 'aria' && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-1.5 h-1.5 bg-accent rounded-full"></div>
                    <span className="text-[10px] font-bold tracking-widest uppercase text-text-secondary">ARIA</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] p-4 rounded-sm text-sm bg-bg border border-soft text-text-primary flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-bg border-t border-soft">
          <form onSubmit={handleSend} className="flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Query position strategy or market conditions..."
              className="flex-1 bg-bg-soft border border-soft rounded-sm px-4 py-3 text-base md:text-sm focus:outline-none focus:border-text-secondary transition-colors"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="bg-accent text-white px-6 py-3 rounded-sm font-medium text-sm hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
