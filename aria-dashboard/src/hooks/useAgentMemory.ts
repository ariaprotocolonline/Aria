import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { env } from '../config/env';
import { buildSystemPrompt } from '../services/claude';

export interface Message {
  role: 'user' | 'aria';
  content: string;
  timestamp: string;
  action?: {
    type: string;
    text?: string;
    time?: string;
  };
  error?: 'rate_limit' | 'capacity';
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  messages: Message[];
}

export interface Reminder {
  id: string;
  text: string;
  time: string;
  timestamp: number;
}

const STORAGE_KEY   = 'aria-conversations';
const REMINDERS_KEY = 'aria-reminders';
const MAX_CONVERSATIONS = 50;
const PROXY_URL = env.API_URL || 'http://localhost:3002';

// ── Server persistence ─────────────────────────────────────────────────────

async function loadFromServer(wallet: string): Promise<Conversation[]> {
  try {
    const res = await fetch(`${PROXY_URL}/conversations/${wallet}`);
    if (!res.ok) throw new Error('Failed to load');
    return res.json();
  } catch {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
      return [];
    }
  }
}

async function saveToServer(wallet: string, conversation: Conversation): Promise<void> {
  // Always update localStorage cache first
  try {
    const existing: Conversation[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    const idx = existing.findIndex(c => c.id === conversation.id);
    if (idx >= 0) existing[idx] = conversation; else existing.unshift(conversation);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing.slice(0, MAX_CONVERSATIONS)));
  } catch { /* ignore */ }

  // Best-effort server save
  try {
    await fetch(`${PROXY_URL}/conversations/${wallet}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...conversation, updatedAt: new Date().toISOString() }),
    });
  } catch { /* server unreachable — localStorage only */ }
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function callProxy(body: Record<string, unknown>): Promise<Response> {
  if (env.API_URL) {
    return fetch(`${env.API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  return fetch(env.ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': env.ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model:      body.model,
      max_tokens: body.max_tokens,
      system:     body.system,
      messages:   body.messages,
    }),
  });
}

function parseReminderTime(timeString: string): number {
  const now = new Date();

  if (timeString.toLowerCase().includes('tomorrow')) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const timeMatch = timeString.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2] ?? '0');
      const meridiem = timeMatch[3].toLowerCase();
      if (meridiem === 'pm' && hours !== 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      tomorrow.setHours(hours, minutes, 0, 0);
    } else {
      tomorrow.setHours(9, 0, 0, 0);
    }
    return tomorrow.getTime();
  }

  const inMatch = timeString.match(/in\s+(\d+)\s+(minute|hour|day)/i);
  if (inMatch) {
    const amount = parseInt(inMatch[1]);
    const unit = inMatch[2].toLowerCase();
    const ms = unit === 'minute' ? amount * 60_000
      : unit === 'hour' ? amount * 3_600_000
      : amount * 86_400_000;
    return now.getTime() + ms;
  }

  const atMatch = timeString.match(/at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (atMatch) {
    let hours = parseInt(atMatch[1]);
    const minutes = parseInt(atMatch[2] ?? '0');
    const meridiem = atMatch[3]?.toLowerCase();
    if (meridiem === 'pm' && hours !== 12) hours += 12;
    if (meridiem === 'am' && hours === 12) hours = 0;
    const target = new Date(now);
    target.setHours(hours, minutes, 0, 0);
    if (target.getTime() < now.getTime()) target.setDate(target.getDate() + 1);
    return target.getTime();
  }

  return now.getTime() + 3_600_000;
}

const ts = () =>
  new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

// ── Hook ───────────────────────────────────────────────────────────────────

export const useAgentMemory = () => {
  const { address } = useAccount();

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    } catch {
      return [];
    }
  });

  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  // Load from server when wallet connects — server is source of truth
  useEffect(() => {
    if (!address) return;
    loadFromServer(address).then(serverConvs => {
      if (serverConvs.length > 0) {
        setConversations(serverConvs);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverConvs));
      }
    });
  }, [address]);

  const currentConversation = conversations.find(c => c.id === currentConversationId) || null;

  const startNewConversation = () => {
    const id = `conv-${Date.now()}`;
    const newConv: Conversation = {
      id,
      title: 'New Conversation',
      createdAt: new Date().toISOString(),
      messages: [],
    };
    setConversations(prev => {
      const updated = [newConv, ...prev].slice(0, MAX_CONVERSATIONS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
    setCurrentConversationId(id);
    return id;
  };

  const loadConversation = (id: string) => setCurrentConversationId(id);

  const clearAll = () => {
    setConversations([]);
    setCurrentConversationId(null);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REMINDERS_KEY);
  };

  const sendMessage = async (content: string, portfolioContext?: string) => {
    let convId = currentConversationId;
    if (!convId) convId = startNewConversation();

    const userMessage: Message = { role: 'user', content, timestamp: ts() };

    let updatedConversation: Conversation | null = null;

    setConversations(prev => prev.map(c => {
      if (c.id === convId) {
        const title = c.messages.length === 0
          ? content.substring(0, 40) + (content.length > 40 ? '...' : '')
          : c.title;
        updatedConversation = { ...c, title, messages: [...c.messages, userMessage] };
        return updatedConversation;
      }
      return c;
    }));

    if (!updatedConversation) {
      const c = conversations.find(x => x.id === convId) || {
        id: convId!,
        title: content.substring(0, 40) + (content.length > 40 ? '...' : ''),
        createdAt: new Date().toISOString(),
        messages: [],
      };
      updatedConversation = { ...c, messages: [...c.messages, userMessage] };
    }

    // Appends an ARIA reply, saves to state + localStorage + server
    const pushAriaMessage = (msg: Message) => {
      const withReply: Conversation = {
        ...updatedConversation!,
        messages: [...updatedConversation!.messages, msg],
      };
      setConversations(prev => {
        const updated = prev.map(c => c.id === convId ? withReply : c);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
      });
      if (address) saveToServer(address, withReply);
    };

    try {
      const history = updatedConversation.messages.map(m => ({
        role: m.role === 'aria' ? 'assistant' : 'user',
        content: m.content,
      }));

      const riskProfile = (localStorage.getItem('aria-risk-profile') as 'Conservative' | 'Balanced' | 'Aggressive') || 'Balanced';

      const agentSystemPrompt =
        `You are ARIA, an autonomous RWA intelligence agent managing the user's USDY and mETH positions on Mantle. ` +
        `You have memory of past conversations. You can: answer questions about their portfolio, explain past agent actions, ` +
        `set reminders, and monitor conditions. ` +
        `When setting a reminder respond with your message AND a JSON block wrapped in <action> tags: ` +
        `<action>{"type":"reminder","text":"...","time":"..."}</action>. Keep responses concise and intelligent.\n\n` +
        buildSystemPrompt({ riskProfile, portfolioString: portfolioContext });

      const response = await callProxy({
        model:         env.ANTHROPIC_MODEL,
        max_tokens:    500,
        walletAddress: address ?? '',
        system:        agentSystemPrompt,
        messages:      history,
      });

      if (response.status === 429) {
        const data = await response.json();
        const resetTime = new Date(data.resetsAt).toLocaleTimeString();
        pushAriaMessage({
          role: 'aria',
          content: `Daily message limit reached. Resets at ${resetTime}.`,
          timestamp: ts(),
          error: 'rate_limit',
        });
        return;
      }
      if (response.status === 503) {
        pushAriaMessage({
          role: 'aria',
          content: 'ARIA chat is at capacity today. Try again tomorrow.',
          timestamp: ts(),
          error: 'capacity',
        });
        return;
      }

      if (!response.ok) throw new Error(`API Error: ${response.status}`);

      const data = await response.json();
      const rawText: string = data.content[0].text;

      let cleanText = rawText;
      let parsedAction = undefined;
      const actionMatch = rawText.match(/<action>([\s\S]*?)<\/action>/);

      if (actionMatch) {
        try {
          const actionJson = JSON.parse(actionMatch[1]);
          parsedAction = actionJson;
          if (actionJson.type === 'reminder') {
            const savedStr = localStorage.getItem(REMINDERS_KEY);
            const saved: Reminder[] = savedStr ? JSON.parse(savedStr) : [];
            const newReminder: Reminder = {
              id: `rem-${Date.now()}`,
              text: actionJson.text,
              time: actionJson.time,
              timestamp: parseReminderTime(actionJson.time ?? ''),
            };
            localStorage.setItem(REMINDERS_KEY, JSON.stringify([...saved, newReminder]));
          }
          cleanText = rawText.replace(/<action>[\s\S]*?<\/action>/, '').trim();
        } catch { /* malformed action JSON — skip */ }
      }

      pushAriaMessage({
        role: 'aria',
        content: cleanText,
        timestamp: ts(),
        action: parsedAction,
      });

    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      const safeMsg =
        raw.startsWith('You have reached') ||
        raw.startsWith('ARIA chat is at capacity') ||
        raw.startsWith('Please connect your wallet') ||
        raw.startsWith('ARIA is unavailable')
          ? raw
          : 'Something went wrong. Please try again.';
      pushAriaMessage({ role: 'aria', content: safeMsg, timestamp: ts() });
    }
  };

  return {
    conversations,
    currentConversation,
    sendMessage,
    startNewConversation,
    loadConversation,
    clearAll,
  };
};
