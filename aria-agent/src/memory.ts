import fs from 'fs';
import path from 'path';

export interface AgentMemoryEntry {
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
  outcome: {
    executed: boolean;
    txHash?: string;
    actualApyAfter?: number;
    explanation: string;
  };
  marketContext: {
    riskProfile: string;
    vaultBalanceUsdy: string;
    vaultBalanceMeth: string;
    topOpportunityApy: number;
    poolsScanned: number;
  };
}

const MEMORY_FILE = path.join(__dirname, '../data/agent-memory.json');
const MAX_ENTRIES = 200;

function ensureDataDir() {
  const dir = path.join(__dirname, '../data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function loadMemory(): AgentMemoryEntry[] {
  ensureDataDir();
  try {
    if (!fs.existsSync(MEMORY_FILE)) return [];
    return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export function saveMemory(entries: AgentMemoryEntry[]): void {
  ensureDataDir();
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(entries, null, 2));
}

export function addMemoryEntry(entry: Omit<AgentMemoryEntry, 'id'>): void {
  const entries = loadMemory();
  const full: AgentMemoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  entries.unshift(full);
  if (entries.length > MAX_ENTRIES) entries.splice(MAX_ENTRIES);
  saveMemory(entries);
}

export function getRecentMemory(n = 10): AgentMemoryEntry[] {
  return loadMemory().slice(0, n);
}

export function getMemorySummary(): string {
  const entries = loadMemory();
  if (entries.length === 0) return 'No previous decisions recorded.';

  const executed = entries.filter(e => e.outcome.executed);
  const held = entries.filter(e => !e.outcome.executed);
  const protocols = executed.map(e => e.decision.toProtocol).filter(Boolean);
  const mostUsed =
    protocols.length > 0
      ? Object.entries(
          protocols.reduce((acc, p) => {
            acc[p!] = (acc[p!] ?? 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).sort((a, b) => b[1] - a[1])[0][0]
      : 'none';

  const avgImprovement =
    executed.length > 0
      ? Math.round(
          executed.reduce((s, e) => s + e.decision.apyImprovementBps, 0) / executed.length
        )
      : 0;

  return `Agent memory summary (last ${entries.length} cycles):
- Total cycles run: ${entries.length}
- Reallocations executed: ${executed.length}
- Times held position: ${held.length}
- Most used protocol: ${mostUsed}
- Average APY improvement when reallocating: ${avgImprovement}bps
- Last action: ${entries[0]?.decision.reason ?? 'none'}
- Last reallocation: ${executed[0]?.timestamp ?? 'never'}`.trim();
}
