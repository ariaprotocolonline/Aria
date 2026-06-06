import fs from 'fs';
import path from 'path';

export interface Message {
  role: 'user' | 'assistant' | 'aria';
  content: string;
  timestamp: string;
  [key: string]: unknown;
}

export interface Conversation {
  id: string;
  walletAddress: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

const DATA_DIR = path.join(__dirname, '../data');
const WALLET_RE = /^0x[0-9a-fA-F]{40}$/;

function safeFilePath(wallet: string): string {
  const lower = wallet.toLowerCase();
  if (!WALLET_RE.test(lower)) throw new Error(`Invalid wallet address: ${wallet}`);
  return path.join(DATA_DIR, `${lower}.json`);
}

const getFilePath = safeFilePath;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

export function loadConversations(wallet: string): Conversation[] {
  ensureDataDir();
  try {
    const file = getFilePath(wallet);
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return [];
  }
}

export function saveConversations(wallet: string, conversations: Conversation[]): void {
  ensureDataDir();
  const target = getFilePath(wallet);
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(conversations, null, 2));
  fs.renameSync(tmp, target);
}

export function upsertConversation(wallet: string, conversation: Conversation): void {
  const conversations = loadConversations(wallet);
  const index = conversations.findIndex(c => c.id === conversation.id);
  if (index >= 0) {
    conversations[index] = conversation;
  } else {
    conversations.unshift(conversation);
  }
  if (conversations.length > 50) conversations.splice(50);
  saveConversations(wallet, conversations);
}

export function deleteConversation(wallet: string, conversationId: string): void {
  const conversations = loadConversations(wallet);
  const filtered = conversations.filter(c => c.id !== conversationId);
  saveConversations(wallet, filtered);
}
