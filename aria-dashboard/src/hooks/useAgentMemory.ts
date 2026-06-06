import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { env } from '../config/env';
import { buildSystemPrompt } from '../services/claude';
import { callServer, isSafeError, isSiweRequired, setConvToken, getConvToken } from '../services/api';
import { useSiweAuth, loadSession } from './useSiweAuth';

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
const PROXY_URL = env.API_URL ?? '';

// ── Server persistence ─────────────────────────────────────────────────────

function convAuthHeaders(wallet: string): Record<string, string> {
  const token = getConvToken(wallet);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function loadFromServer(wallet: string): Promise<Conversation[]> {
  try {
    const res = await fetch(`${PROXY_URL}/conversations/${wallet}`, {
      headers: convAuthHeaders(wallet),
    });
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
      headers: { 'Content-Type': 'application/json', ...convAuthHeaders(wallet) },
      body: JSON.stringify({ ...conversation, updatedAt: new Date().toISOString() }),
    });
  } catch { /* server unreachable — localStorage only */ }
}

// ── Helpers ────────────────────────────────────────────────────────────────

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
  const { signIn, signing: siweSigningIn } = useSiweAuth();
  const [siweRequired, setSiweRequired] = useState(false);

  const getSession = () => address ? loadSession(address) : null;

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

      // The server prepends SECURITY_SYSTEM_PREFIX ("You are ARIA...") so we only
      // send capability hints and portfolio data that the server doesn't have.
      const portfolioContextStr =
        `You have memory of past conversations. You can: answer questions about their portfolio, ` +
        `explain past agent actions, set reminders, and monitor conditions. ` +
        `When setting a reminder respond with your message AND a JSON block wrapped in <action> tags: ` +
        `<action>{"type":"reminder","text":"...","time":"..."}</action>. Keep responses concise and intelligent.\n\n` +
        buildSystemPrompt({ riskProfile, portfolioString: portfolioContext });

      const session   = getSession();
      // Prefer SIWE session; fall back to rolling conv token (survives server restarts).
      const convTok   = address ? getConvToken(address) : null;
      const authToken = session?.token ?? convTok;
      const response  = await callServer({
        model:            env.ANTHROPIC_MODEL,
        max_tokens:       500,
        walletAddress:    address ?? '',
        portfolioContext: portfolioContextStr,
        messages:         history,
      }, authToken);

      // Server requires SIWE sign-in — prompt the user
      if (await isSiweRequired(response)) {
        setSiweRequired(true);
        if (address) {
          const newSession = await signIn(address);
          if (!newSession) {
            pushAriaMessage({ role: 'aria', content: 'Sign in with your wallet to continue.', timestamp: ts() });
            return;
          }
          setSiweRequired(false);
          // Retry with the new session token
          const retry = await callServer({
            model:            env.ANTHROPIC_MODEL,
            max_tokens:       500,
            walletAddress:    address,
            portfolioContext: portfolioContextStr,
            messages:         history,
          }, newSession.token);
          if (retry.status === 503) {
            pushAriaMessage({ role: 'aria', content: 'ARIA is temporarily unavailable. Try again in a moment.', timestamp: ts() });
            return;
          }
          if (!retry.ok) throw new Error(`API Error: ${retry.status}`);
          const convToken2 = retry.headers.get('X-ARIA-Token');
          if (convToken2) setConvToken(address, convToken2);
          const retryData = await retry.json();
          const rawText2: string = retryData.content[0].text;
          pushAriaMessage({ role: 'aria', content: rawText2, timestamp: ts() });
          return;
        }
        return;
      }

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

      // Capture the HMAC token issued by the server — required for conversation CRUD
      const convToken = response.headers.get('X-ARIA-Token');
      if (convToken && address) setConvToken(address, convToken);

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
      const safeMsg = isSafeError(raw) ? raw : 'Something went wrong. Please try again.';
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
    siweRequired,
    siweSigningIn,
  };
};
