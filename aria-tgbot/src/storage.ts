import fs   from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR     = path.join(__dirname, '../data');
const USERS_FILE   = path.join(DATA_DIR, 'telegram-users.json');
const PENDING_FILE = path.join(DATA_DIR, 'telegram-pending.json');
const PENDING_TTL  = 30 * 60_000; // 30 minutes

interface TelegramUser {
  walletAddress: string;
  chatId:        number;
  username?:     string;
  linkedAt:      string;
}

interface PendingLink {
  walletAddress: string;
  createdAt:     number;
}

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readUsers(): Record<string, TelegramUser> {
  ensureDir();
  try {
    if (!fs.existsSync(USERS_FILE)) return {};
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch { return {}; }
}

function writeUsers(data: Record<string, TelegramUser>): void {
  ensureDir();
  const tmp = USERS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, USERS_FILE);
}

function readPending(): Record<string, PendingLink> {
  ensureDir();
  try {
    if (!fs.existsSync(PENDING_FILE)) return {};
    return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
  } catch { return {}; }
}

function writePending(data: Record<string, PendingLink>): void {
  ensureDir();
  const tmp = PENDING_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, PENDING_FILE);
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function linkWallet(walletAddress: string, chatId: number, username?: string): void {
  const users = readUsers();
  users[walletAddress.toLowerCase()] = {
    walletAddress: walletAddress.toLowerCase(),
    chatId, username,
    linkedAt: new Date().toISOString(),
  };
  writeUsers(users);
}

export function unlinkWallet(walletAddress: string): void {
  const users = readUsers();
  delete users[walletAddress.toLowerCase()];
  writeUsers(users);
}

export function getChatId(walletAddress: string): number | null {
  return readUsers()[walletAddress.toLowerCase()]?.chatId ?? null;
}

export function getWalletByChatId(chatId: number): string | null {
  return Object.values(readUsers()).find(u => u.chatId === chatId)?.walletAddress ?? null;
}

export function isConnected(walletAddress: string): boolean {
  return !!readUsers()[walletAddress.toLowerCase()];
}

export function getUser(walletAddress: string) {
  return readUsers()[walletAddress.toLowerCase()] ?? null;
}

// ─── Pending link codes ───────────────────────────────────────────────────────

export function generateCode(): string {
  return crypto.randomBytes(6).toString('hex');
}

export function savePendingLink(code: string, walletAddress: string): void {
  const pending = readPending();
  const now = Date.now();
  // Prune expired
  for (const k of Object.keys(pending)) {
    if (now - pending[k]!.createdAt > PENDING_TTL) delete pending[k];
  }
  pending[code] = { walletAddress: walletAddress.toLowerCase(), createdAt: now };
  writePending(pending);
}

export function consumePendingLink(code: string): string | null {
  const pending = readPending();
  const entry   = pending[code];
  if (!entry || Date.now() - entry.createdAt > PENDING_TTL) {
    if (entry) { delete pending[code]; writePending(pending); }
    return null;
  }
  delete pending[code];
  writePending(pending);
  return entry.walletAddress;
}
