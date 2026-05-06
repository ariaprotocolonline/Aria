import { type Address } from 'viem'

// ── Prompt injection detection ──────────────────────────────────────────────

const INJECTION_PATTERNS = [
  /ignore (all |previous |prior )?(instructions|rules|constraints)/i,
  /ignore\s+(above|below|all)/i,
  /you are now/i,
  /pretend (you are|to be)/i,
  /act as (a |an )?(different|new|unrestricted)/i,
  /act as.{0,40}(no restriction|no limit|no safeguard|no safety|without restriction|unrestricted|unfiltered)/i,
  /transfer.*fund/i,
  /send.*token/i,
  /move.*wallet/i,
  /override.*risk/i,
  /bypass.*security/i,
  /disable.*limit/i,
  /reveal.*key/i,
  /show.*private/i,
  /execute.*transaction/i,
  /call.*contract/i,
  /approve.*protocol/i,
  /change.*agent/i,
  /new.*instruction/i,
  /system.*prompt/i,
  /forget.*everything/i,
  /\[system\]/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /<\/s>\[inst\]/i,
  /<<sys>>/i,
  /\bdan\b.{0,30}(mode|prompt|jailbreak|no restriction)/i,
  /print.{0,10}hacked/i,
  /new\s+role/i,
  /disregard.{0,20}(instruction|rule|constraint|guideline)/i,
]

export interface SecurityScanResult {
  safe: boolean
  reason?: string
  pattern?: string
}

export function scanForInjection(input: string): SecurityScanResult {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return {
        safe: false,
        reason: 'Potential prompt injection detected',
        pattern: pattern.toString(),
      }
    }
  }
  return { safe: true }
}

// ── Response validation ──────────────────────────────────────────────────────

const FORBIDDEN_IN_RESPONSE = [
  /private.?key/i,
  /secret[\s_.-]?key/i,
  /mnemonic/i,
  /seed.?phrase/i,
  /AGENT_PRIVATE/i,
  /0x[0-9a-fA-F]{64}/, // looks like a raw private key
]

export function validateAgentResponse(response: string): SecurityScanResult {
  for (const pattern of FORBIDDEN_IN_RESPONSE) {
    if (pattern.test(response)) {
      return {
        safe: false,
        reason: 'Response contains sensitive data — blocked',
        pattern: pattern.toString(),
      }
    }
  }
  return { safe: true }
}

// ── Action block validation ──────────────────────────────────────────────────
// Claude returns <action> tags in agent chat. Only allow safe action types.

const ALLOWED_ACTION_TYPES = ['reminder', 'alert', 'info'] as const
type AllowedActionType = typeof ALLOWED_ACTION_TYPES[number]

interface ActionBlock {
  type: string
  [key: string]: unknown
}

export function validateActionBlock(action: ActionBlock): SecurityScanResult {
  if (!ALLOWED_ACTION_TYPES.includes(action.type as AllowedActionType)) {
    return {
      safe: false,
      reason: `Action type "${action.type}" is not permitted. Claude cannot trigger financial actions.`,
    }
  }
  return { safe: true }
}

// ── Address validation ───────────────────────────────────────────────────────

export function isValidAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address)
}

export function isApprovedProtocol(
  address: Address,
  approvedList: Address[]
): boolean {
  return approvedList
    .map(a => a.toLowerCase())
    .includes(address.toLowerCase())
}

// ── Input sanitization ───────────────────────────────────────────────────────

export function sanitizeUserInput(input: string): string {
  return input
    .slice(0, 2000)
    .replace(/<\|im_start\|>/g, '')
    .replace(/<\|im_end\|>/g, '')
    .replace(/\[system\]/gi, '')
    .replace(/\[assistant\]/gi, '')
    .replace(/\[user\]/gi, '')
    .trim()
}

// ── Per-wallet rate limit (agent-side, 5 req/min) ───────────────────────────

const walletCallCount = new Map<string, { count: number; resetAt: number }>()
const WALLET_MAX_CALLS_PER_MINUTE = 5

export function checkWalletRateLimit(wallet: string): SecurityScanResult {
  const now = Date.now()
  const entry = walletCallCount.get(wallet)

  if (!entry || now > entry.resetAt) {
    walletCallCount.set(wallet, { count: 1, resetAt: now + 60_000 })
    return { safe: true }
  }

  if (entry.count >= WALLET_MAX_CALLS_PER_MINUTE) {
    return {
      safe: false,
      reason: `Too many requests. Max ${WALLET_MAX_CALLS_PER_MINUTE} per minute.`,
    }
  }

  entry.count++
  return { safe: true }
}
