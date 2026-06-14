# Security Model

ARIA's security is built in layers. Each layer addresses a different threat surface: the smart contract enforces what the agent can do on-chain, the application layer filters what reaches the AI, and the infrastructure layer controls what reaches the application. No single layer is relied upon alone.

---

## Layer 1: Smart Contract Constraints

The vault contract is the root of ARIA's security model. It enforces agent permissions at the EVM level. There is no configuration, environment variable, or runtime setting that can override what the contract allows.

**The agent can only:**
* Call `reallocate()` on the vault
* Move funds between addresses in `approvedProtocols`
* Use function selectors listed in `approvedSelectors`
* Produce output tokens listed in `approvedTokens`

**The agent can never:**
* Transfer funds to any external wallet address
* Withdraw funds to the vault owner
* Modify the approved protocols list
* Modify the approved tokens list
* Modify the approved selectors list
* Pause or unpause the vault
* Change the fee recipient
* Transfer vault ownership

**The owner can always:**
* Withdraw funds (even when paused)
* Change the agent address
* Update whitelist entries
* Configure fee settings within the hard caps

**Hard caps enforced in the contract (not configurable):**
* Performance fee maximum: 20% (2000 basis points)
* Management fee maximum: 2% per year (200 basis points)
* APY delta cap: 5000 basis points (prevents fee extraction via inflated APY claims)

---

## Layer 2: Prompt Injection Protection

Every message that reaches Claude, whether from the user's chat or from agent-constructed prompts, is scanned for prompt injection patterns before being sent.

ARIA scans for 36 distinct injection patterns including:

* Instruction override attempts ("ignore previous instructions", "forget your rules")
* Identity replacement ("pretend you are", "act as an unrestricted AI", "DAN mode")
* Financial action triggers ("transfer funds", "send tokens", "execute transaction", "call contract")
* Security bypass attempts ("override risk", "bypass security", "ignore safety gates")
* Key extraction attempts ("reveal keys", "show private", "display mnemonic")
* System prompt disclosure ("show system prompt", "print your instructions")
* ChatML injection tokens (`<|system|>`, `<|user|>`)

Messages that trigger any of these patterns are rejected before Claude sees them. The user receives an error response. No AI call is made.

All agent memory strings are also scanned and redacted before being injected into prompts.

---

## Layer 3: Response Validation

Claude's responses are validated before being returned to users or acted upon by the agent.

**Sensitive data blocking.** Responses are scanned for private key patterns (64-character hex strings prefixed with 0x), mnemonic phrases, seed phrases, and secret key markers. Any response containing these patterns is blocked and replaced with a safe error message.

**Action type restriction.** Chat responses can only contain action types of `reminder`, `alert`, or `info`. The chat interface cannot return a response that triggers a financial action. Transaction-triggering action types are blocked at the parser level.

**Decision validation.** Agent decision blocks are validated field by field: confidence must be a number between 0 and 1, urgency must be one of three allowed string values, liquidity score must be a positive number, and the protocol name must exist in the known protocol list.

---

## Layer 4: Rate Limiting and Abuse Prevention

**Per-wallet daily limit:** 20 AI requests per day. The remaining count is returned in response headers.

**Global daily limit:** 1000 AI requests per day across all users.

**IP rate limit:** 30 requests per minute with a burst allowance of 10.

**Brute force protection:** 10 failed authentication attempts from a single IP triggers a 1-hour block on that IP.

**Anthropic circuit breaker:** 5 consecutive Claude API errors within 60 seconds triggers a 30-second cooldown before the next attempt.

**Per-wallet agent rate limit:** 5 requests per minute from the agent side. The agent processes vaults sequentially and never floods the server with parallel requests.

---

## Layer 5: Infrastructure Security

**Binding to loopback only.** All three backend services (aria-server, aria-agent feed, aria-tgbot) bind to `127.0.0.1` only. They are never directly reachable from the public internet. All public traffic goes through nginx.

**`/tg/notify` hard blocked.** The internal notification endpoint used by the agent to push Telegram messages is blocked at the nginx level with `deny all`. It is unreachable from outside the server regardless of any application-level behavior.

**Feed endpoint read-only.** The `/feed/*` path only allows GET and OPTIONS methods at the nginx level. Write requests are rejected before they reach the agent.

**TLS enforcement.** All HTTP traffic is redirected to HTTPS. TLS 1.2 and 1.3 only. HSTS with a one-year max-age, subDomains, and preload is enforced.

**Security headers.** The nginx configuration sets HSTS, X-Frame-Options (SAMEORIGIN), X-Content-Type-Options (nosniff), Referrer-Policy (strict-origin-when-cross-origin), and Permissions-Policy (camera, microphone, geolocation all disabled).

**COOP header.** `Cross-Origin-Opener-Policy: same-origin-allow-popups` is required for wallet browser extensions to communicate with the page. This is the minimum COOP setting that allows wallet popups while blocking cross-origin opener attacks.

---

## What This Means for Users

The trust model is: trust the code, not the team. Every security guarantee listed above is enforced either in the smart contract bytecode (which cannot be changed once deployed without a new deployment that you would have to deliberately opt into), in the application code (open source and auditable), or in the infrastructure configuration (documented in this repository).

ARIA's agent is deliberately designed to be powerful enough to be useful and provably too constrained to cause harm. The gap between what it can do and what it cannot do is enforced at the EVM level, not through policy.
