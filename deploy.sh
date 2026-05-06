#!/bin/bash
set -e

echo "=== ARIA Deployment ==="

echo "[1/4] Building aria-server..."
cd aria-server && npm ci && npm run build && cd ..

echo "[2/4] Building aria-agent..."
cd aria-agent && npm ci && npm run build && cd ..

echo "[3/4] Building aria-dashboard..."
cd aria-dashboard && npm ci && npm run build && cd ..

echo "[4/4] Deploying dashboard & restarting services..."
sudo mkdir -p /var/www/aria-dashboard
sudo cp -r aria-dashboard/dist/. /var/www/aria-dashboard/

pm2 start ecosystem.config.js --update-env

echo "=== Done ==="
pm2 status
