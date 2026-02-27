#!/bin/bash
# deploy.sh — Build locally and push to production server
# Usage: ./deploy.sh 64.227.137.11 [ssh-user]

set -e

SERVER_IP="${1:-64.227.137.11}"
SSH_USER="${2:-root}"
DEPLOY_DIR="/var/www/echoai"
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "🔨 Building frontend..."
cd "$ROOT"
npm run build

echo "📦 Uploading to $SSH_USER@$SERVER_IP:$DEPLOY_DIR ..."

# Create remote dirs
ssh "$SSH_USER@$SERVER_IP" "mkdir -p $DEPLOY_DIR/dist $DEPLOY_DIR/backend"

# Upload built frontend
rsync -az --delete "$ROOT/dist/"         "$SSH_USER@$SERVER_IP:$DEPLOY_DIR/dist/"

# Upload backend (exclude venv — will be rebuilt on server)
rsync -az --exclude='venv' --exclude='__pycache__' \
    "$ROOT/backend/"  "$SSH_USER@$SERVER_IP:$DEPLOY_DIR/backend/"

# Upload nginx config and systemd service
scp "$ROOT/nginx.conf"            "$SSH_USER@$SERVER_IP:/tmp/echoai-nginx.conf"
scp "$ROOT/echoai-backend.service" "$SSH_USER@$SERVER_IP:/tmp/echoai-backend.service"

echo "⚙️  Configuring server..."
ssh "$SSH_USER@$SERVER_IP" bash << 'REMOTE'
set -e

DEPLOY_DIR="/var/www/echoai"

# Install nginx if missing
if ! command -v nginx &>/dev/null; then
    apt-get update -q && apt-get install -y -q nginx python3-venv python3-pip
fi

# Setup Python venv on server
cd "$DEPLOY_DIR/backend"
[ -d venv ] || python3 -m venv venv
source venv/bin/activate
pip install -q -r requirements.txt

# Install nginx site
cp /tmp/echoai-nginx.conf /etc/nginx/sites-available/echoai
ln -sf /etc/nginx/sites-available/echoai /etc/nginx/sites-enabled/echoai
rm -f /etc/nginx/sites-enabled/default   # remove nginx default page
nginx -t && systemctl reload nginx

# Install and start systemd service
cp /tmp/echoai-backend.service /etc/systemd/system/echoai-backend.service
systemctl daemon-reload
systemctl enable echoai-backend
systemctl restart echoai-backend

echo "✅ Done!"
systemctl status echoai-backend --no-pager
REMOTE

echo ""
echo "🚀 Deployed!  http://$SERVER_IP"
