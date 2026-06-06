import fs from 'fs'
import path from 'path'

export type SecurityEventType =
  | 'INJECTION_ATTEMPT'
  | 'BLOCKED_RESPONSE'
  | 'BLOCKED_ACTION'
  | 'RATE_LIMITED'
  | 'INVALID_WALLET'
  | 'SIWE_SIG_MISMATCH'
  | 'MISSING_SESSION'

interface SecurityEvent {
  timestamp: string
  type: SecurityEventType
  wallet: string
  detail: string
}

const securityEvents: SecurityEvent[] = []
const MAX_EVENTS   = 500   // rotate when in-memory list hits this
const ROTATE_KEEP  = 250   // entries to retain after rotation

const LOG_FILE     = path.resolve(__dirname, '../../data/security-events.log')
const ARCHIVE_FILE = path.resolve(__dirname, '../../data/security-archive.json')

function ensureLogDir(): void {
  const dir = path.dirname(LOG_FILE)
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  } catch { /* best-effort */ }
}

ensureLogDir()

function rotateEvents(): void {
  try {
    const toArchive = securityEvents.splice(0, securityEvents.length - ROTATE_KEEP)
    // Append oldest entries to the archive file.
    let existing: SecurityEvent[] = []
    if (fs.existsSync(ARCHIVE_FILE)) {
      try { existing = JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf-8')) } catch { /* ignore */ }
    }
    const tmp = ARCHIVE_FILE + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify([...existing, ...toArchive], null, 2), 'utf-8')
    fs.renameSync(tmp, ARCHIVE_FILE)
    console.warn(`[securityLog] Rotated ${toArchive.length} events to archive`)
  } catch (err) {
    console.error('[securityLog] Rotation failed:', err)
  }
}

export function logSecurityEvent(
  type: SecurityEventType,
  wallet: string,
  detail: string
): void {
  const event: SecurityEvent = {
    timestamp: new Date().toISOString(),
    type,
    wallet,
    detail,
  }

  securityEvents.push(event)
  if (securityEvents.length >= MAX_EVENTS) rotateEvents()

  console.warn(
    `[SECURITY] ${event.timestamp} | ${type} | ${wallet.slice(0, 10)}... | ${detail}`
  )

  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(event) + '\n', 'utf-8')
  } catch { /* never crash on log write */ }
}

export function getSecurityEvents(): SecurityEvent[] {
  return securityEvents
}
