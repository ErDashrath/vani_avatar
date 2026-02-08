#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# add-domain.sh – Add domain to existing Voice Avatar deployment
# ═══════════════════════════════════════════════════════════════════════════════
#
# USAGE:
#   sudo ./scripts/add-domain.sh yourdomain.com
#
# Run this AFTER:
#   1. Initial deployment with IP-only mode: sudo ./scripts/deploy.sh
#   2. Your boss has pointed the domain to your server IP
#
# This script will:
#   1. Update Caddy to use the domain (with auto-SSL)
#   2. Update backend CORS settings
#   3. Restart services
#   4. Caddy automatically gets SSL from Let's Encrypt
#
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ─── Colors ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── Configuration ───
DOMAIN="${1:-}"
APP_DIR="/var/www/voice-avatar"

# ─── Helper Functions ───
log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[✓]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[!]${NC} $1"; }
log_error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (use sudo)"
    fi
}

check_domain() {
    if [[ -z "$DOMAIN" ]]; then
        echo ""
        echo "═══════════════════════════════════════════════════════════════"
        echo "  Add Domain to Voice Avatar App"
        echo "═══════════════════════════════════════════════════════════════"
        echo ""
        echo "Usage: sudo ./scripts/add-domain.sh <domain>"
        echo ""
        echo "Example:"
        echo "  sudo ./scripts/add-domain.sh myapp.example.com"
        echo ""
        echo "Prerequisites:"
        echo "  1. App already deployed (run deploy.sh first)"
        echo "  2. Domain DNS points to this server's IP"
        echo ""
        echo "═══════════════════════════════════════════════════════════════"
        exit 1
    fi
}

check_deployment() {
    if [[ ! -d "$APP_DIR" ]]; then
        log_error "Voice Avatar not deployed. Run deploy.sh first."
    fi
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    check_root
    check_domain
    check_deployment
    
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  🔗 Adding Domain: $DOMAIN"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    
    # ─── Step 1: Update Caddy Configuration ───
    log_info "Updating Caddy configuration..."
    cat > /etc/caddy/Caddyfile << EOF
# Voice Avatar App - Caddy Configuration
# Domain: $DOMAIN
# Updated on $(date)

$DOMAIN {
    # Serve frontend
    root * $APP_DIR/frontend/dist
    file_server
    try_files {path} /index.html
    
    # Static asset caching
    @static {
        path *.js *.css *.png *.jpg *.jpeg *.gif *.ico *.svg *.woff *.woff2 *.ttf *.eot
    }
    header @static Cache-Control "public, max-age=31536000, immutable"
    
    # Security headers
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options "nosniff"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
    }
    
    # API reverse proxy
    handle /api/* {
        reverse_proxy localhost:8000 {
            flush_interval -1
        }
    }
    
    encode gzip
    
    log {
        output file /var/log/caddy/access.log
        format json
    }
}

www.$DOMAIN {
    redir https://$DOMAIN{uri} permanent
}
EOF
    log_success "Caddy configuration updated"
    
    # ─── Step 2: Update Backend CORS ───
    log_info "Updating backend CORS settings..."
    
    # Get existing API key from .env
    API_KEY=$(grep "^API_KEY=" "$APP_DIR/backend/.env" | cut -d'=' -f2)
    
    cat > "$APP_DIR/backend/.env" << EOF
# Voice Avatar Backend - Production Configuration
# Updated on $(date)
# Domain: $DOMAIN

LLM_API_URL=\${LLM_API_URL:-your_llm_api_url_here}
LLM_MODEL=Qwen2.5-1.5B-Instruct
LLM_MAX_TOKENS=150
LLM_TEMPERATURE=0.7

HOST=127.0.0.1
PORT=8000

CORS_ORIGINS=https://$DOMAIN,https://www.$DOMAIN

API_KEY=$API_KEY
RATE_LIMIT=30/minute
EOF
    log_success "Backend CORS updated"
    
    # ─── Step 3: Restart Services ───
    log_info "Restarting services..."
    systemctl restart voice-avatar
    systemctl reload caddy
    log_success "Services restarted"
    
    # ─── Wait for SSL ───
    log_info "Waiting for SSL certificate (this may take 30-60 seconds)..."
    sleep 5
    
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo -e "  ${GREEN}✓ Domain Added Successfully!${NC}"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    echo "  🌐 Your app is now live at: https://$DOMAIN"
    echo ""
    echo "  🔒 SSL certificate will be automatically obtained by Caddy"
    echo "     from Let's Encrypt. This happens on first HTTPS request."
    echo ""
    echo "  📋 Test your site:"
    echo "     curl -I https://$DOMAIN"
    echo ""
    echo "  ⚠️  If SSL fails, check:"
    echo "     1. DNS is pointing to this server (dig $DOMAIN)"
    echo "     2. Ports 80/443 are open (sudo ufw status)"
    echo "     3. Caddy logs (sudo journalctl -u caddy -f)"
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
}

main "$@"
