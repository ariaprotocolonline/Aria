#!/bin/bash
set -euo pipefail

echo "=== ARIA Deployment ==="

# ── 1. Pre-flight: validate required environment variables ────────────────────
echo "[0/6] Validating environment..."

REQUIRED_VARS=(
  ANTHROPIC_API_KEY
  AGENT_PRIVATE_KEY
  VAULT_ADDRESS
  FACTORY_ADDRESS
  VITE_VAULT_ADDRESS_MAINNET
  VITE_FACTORY_ADDRESS_MAINNET
  ALLOWED_ORIGINS
  AUTH_SECRET
  TELEGRAM_BOT_TOKEN
  TELEGRAM_WEBHOOK_URL
  INTERNAL_SECRET
  ARIA_SERVER_URL
  VAULT_OWNER_ADDRESS
)

# Load .env
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

MISSING=()
for VAR in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!VAR:-}" ]; then
    MISSING+=("$VAR")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo ""
  echo "❌ DEPLOY ABORTED — missing required environment variables:"
  for VAR in "${MISSING[@]}"; do
    echo "   • $VAR"
  done
  echo ""
  echo "Fill these in .env before deploying. See .env.example for documentation."
  exit 1
fi

# Guard: ensure mainnet vault address is not a zero/placeholder address
if [[ "$VAULT_ADDRESS" == "0x0000000000000000000000000000000000000000" ]] || \
   [[ "$VAULT_ADDRESS" == "0x0000000000000000000000000000000000000001" ]]; then
  echo ""
  echo "❌ VAULT_ADDRESS is a placeholder ($VAULT_ADDRESS)."
  echo "   Deploy contracts first:"
  echo "   cd aria-contracts && npx hardhat run scripts/deployMainnet.ts --network mantleMainnet"
  exit 1
fi

echo "   ✅ All required variables present"
echo ""

# ── 2. NOTE: Contracts must be deployed BEFORE running this script ────────────
# Run this once before the first deploy (or after upgrading contracts):
#
#   cd aria-contracts
#   npx hardhat run scripts/deployMainnet.ts --network mantleMainnet
#
# That script auto-patches .env with VAULT_ADDRESS and FACTORY_ADDRESS.
# ─────────────────────────────────────────────────────────────────────────────

echo "[1/5] Building aria-server..."
cd aria-server && npm ci && npm run build && cd ..

echo "[2/5] Building aria-agent..."
cd aria-agent && npm ci && npm run build && cd ..

echo "[3/5] Building aria-tgbot..."
cd aria-tgbot && npm ci && npm run build && cd ..

echo "[4/5] Building aria-dashboard..."
cd aria-dashboard && npm ci && npm run build && cd ..

echo "[5/5] Deploying dashboard & restarting services..."
sudo mkdir -p /var/www/aria-dashboard
sudo cp -r aria-dashboard/dist/. /var/www/aria-dashboard/

mkdir -p logs

if pm2 list | grep -q "aria-server"; then
  pm2 reload ecosystem.config.js --update-env
else
  pm2 start ecosystem.config.js
fi

pm2 save

if command -v nginx &> /dev/null; then
  sudo nginx -t && sudo systemctl reload nginx
fi

echo ""
echo "=== Done ==="
pm2 status
