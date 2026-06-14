# API Reference

ARIA exposes three backend services through the nginx reverse proxy. All services are accessible via `ariaprotocol.online`.

---

## Authentication

Most chat and conversation endpoints require authentication. ARIA supports two auth methods:

### Sign-In With Ethereum (SIWE)

1. `GET /auth/nonce?wallet=0x...` Returns a nonce and a pre-formatted SIWE message
2. Sign the message with your wallet
3. `POST /auth/verify` with `{ wallet, nonce, signature }` Returns a session token
4. Include `Authorization: Bearer <token>` on subsequent requests

Session tokens are valid for 24 hours.

### Rolling HMAC Token

After your first authenticated response, the server returns an `X-ARIA-Token` header containing a rolling HMAC token. This token is accepted for one hour (two-hour window: current slot and previous slot). You can use it instead of the Bearer token for lighter-weight authentication in subsequent requests.

---

## aria-server (Port 3002, proxied at `/api`)

### Auth Endpoints

**`GET /auth/nonce?wallet=0x...`**
Returns a nonce and SIWE message for the specified wallet. Nonce expires after 5 minutes.

Response:
```json
{
  "nonce": "abc123",
  "message": "ariaprotocol.online wants you to sign in..."
}
```

**`POST /auth/verify`**
Verifies a signed SIWE message and returns a session token.

Body:
```json
{
  "wallet": "0x...",
  "nonce": "abc123",
  "signature": "0x..."
}
```

Response:
```json
{
  "token": "eyJ..."
}
```

### Chat Endpoint

**`POST /api/chat`**
Send a message to Claude and receive a response. Requires authentication.

Body:
```json
{
  "walletAddress": "0x...",
  "messages": [
    { "role": "user", "content": "What pools am I in?" }
  ],
  "max_tokens": 1000,
  "portfolioContext": "LIVE VAULT STATE: WETH balance: 0.5 WETH..."
}
```

Response:
```json
{
  "content": [
    { "type": "text", "text": "Your current position is..." }
  ],
  "model": "claude-sonnet-4-6",
  "usage": { "input_tokens": 450, "output_tokens": 120 }
}
```

Rate limits: 20 requests per wallet per day. 30 requests per IP per minute.

### Conversation Endpoints

**`GET /conversations/:wallet`**
Returns all conversation IDs for the specified wallet.

**`GET /conversations/:wallet/:id`**
Returns the full message history for a specific conversation.

**`POST /conversations/:wallet/:id`**
Saves or updates a conversation (maximum 200 messages, 500 KB).

**`DELETE /conversations/:wallet/:id`**
Deletes a specific conversation.

### Pool Management Endpoints

**`GET /api/pools`**
Returns the current list of pools including built-in and user-defined custom pools.

**`POST /api/pools`**
Adds a custom pool. Body must include: protocol, tokenSymbol, tokenAddress, tokenIn, poolAddress, routerAddress, feeTier, apyEstimate.

**`DELETE /api/pools/:id`**
Removes a custom pool by ID.

### Health Endpoint

**`GET /health`**
Returns server status and timestamp. No authentication required.

---

## aria-agent Feed Server (Port 3001, proxied at `/feed`)

The feed server is public and read-only. No authentication is required. Rate limit: 60 requests per minute.

**`GET /feed`**
Returns the latest activity feed items from the agent. Each item includes:

```json
{
  "id": "uuid",
  "type": "ACTION",
  "timestamp": "2026-06-13T10:00:00Z",
  "body": "Moved 0.5 WETH from Agni WETH/USDC to FusionX WETH/USDC",
  "reason": "APY improved from 7.8% to 9.2% (140 bps gain)",
  "tag": "exec",
  "txHash": "0x..."
}
```

Item types: `ACTION` (reallocation executed), `OPPORTUNITY` (pools scanned), `ALERT` (liquidity warning), `SUMMARY` (daily report).

**`GET /feed/pools`**
Returns the current pool snapshot from the last agent scan. Includes APY, liquidity score, and protocol details for each active pool.

---

## aria-tgbot (Port 3003, proxied at `/tg`)

### Link Generation

**`POST /tg/link`**
Generates a one-time Telegram deeplink for wallet linking.

Body:
```json
{
  "walletAddress": "0x..."
}
```

Response:
```json
{
  "code": "a1b2c3d4e5f6",
  "deepLink": "https://t.me/AriaRWAbot?start=a1b2c3d4e5f6"
}
```

### Status

**`GET /tg/status/:wallet`**
Returns the Telegram connection status for a wallet address.

Response:
```json
{
  "connected": true,
  "username": "telegram_username",
  "linkedAt": "2026-06-13T09:00:00Z"
}
```

### Disconnect

**`DELETE /tg/unlink`**
Unlinks a wallet from Telegram.

Body:
```json
{
  "walletAddress": "0x..."
}
```

---

## Rate Limit Headers

All API responses include rate limit information:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed (20 per day per wallet) |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix timestamp when the limit resets (midnight UTC) |
| `X-ARIA-Token` | Rolling HMAC token for lightweight auth on subsequent requests |
