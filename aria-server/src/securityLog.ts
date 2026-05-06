export type SecurityEventType =
  | 'INJECTION_ATTEMPT'
  | 'BLOCKED_RESPONSE'
  | 'BLOCKED_ACTION'
  | 'RATE_LIMITED'
  | 'INVALID_WALLET'

interface SecurityEvent {
  timestamp: string
  type: SecurityEventType
  wallet: string
  detail: string
}

const securityEvents: SecurityEvent[] = []
const MAX_EVENTS = 1000

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
  if (process.env.NODE_ENV !== 'production') {
    console.warn(
      `[SECURITY EVENT] ${event.timestamp} | ${type} | ${wallet.slice(0, 10)}... | ${detail}`
    )
  }
  if (securityEvents.length > MAX_EVENTS) securityEvents.shift()
}

export function getSecurityEvents(): SecurityEvent[] {
  return securityEvents
}
