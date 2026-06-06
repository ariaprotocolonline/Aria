import fs   from 'fs';
import path from 'path';
import crypto from 'crypto';

const DATA_DIR    = path.join(__dirname, '../data');
const USERS_FILE  = path.join(DATA_DIR, 'telegram-users.json');
const PENDING_FILE = path.join(DATA_DIR, 'telegram-pending.json');
const PENDING_TTL  = 10 * 60_000; // 10 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Public API ───────────────────────────────────────────────────────────────

export function linkWallet(walletAddress: string, chatId: number, username?: string): void {
  const users = readUsers();
  users[walletAddress.toLowerCase()] = {
    walletAddress: walletAddress.toLowerCase(),
    chatId,
    username,
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
  const users = readUsers();
  return users[walletAddress.toLowerCase()]?.chatId ?? null;
}

export function getWalletByChatId(chatId: number): string | null {
  const users = readUsers();
  const entry = Object.values(users).find(u => u.chatId === chatId);
  return entry?.walletAddress ?? null;
}

export function isConnected(walletAddress: string): boolean {
  const users = readUsers();
  return !!users[walletAddress.toLowerCase()];
}

export function getUser(walletAddress: string): TelegramUser | null {
  return readUsers()[walletAddress.toLowerCase()] ?? null;
}

// ─── Pending link codes ───────────────────────────────────────────────────────

export function savePendingLink(code: string, walletAddress: string): void {
  // Prune expired entries first
  const pending = readPending();
  const now = Date.now();
  for (const k of Object.keys(pending)) {
    if (now - pending[k]!.createdAt > PENDING_TTL) delete pending[k];
  }
  pending[code] = { walletAddress: walletAddress.toLowerCase(), createdAt: now };
  writePending(pending);
}

export function consumePendingLink(code: string): string | null {
  const pending = readPending();
  const entry   = pending[code];
  if (!entry) return null;
  if (Date.now() - entry.createdAt > PENDING_TTL) {
    delete pending[code];
    writePending(pending);
    return null;
  }
  delete pending[code];
  writePending(pending);
  return entry.walletAddress;
}

export function generateCode(): string {
  return crypto.randomBytes(6).toString('hex'); // 12-char hex
}
