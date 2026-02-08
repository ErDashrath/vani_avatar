#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# deploy.sh – Complete Production Deployment Script for Voice Avatar App
# ═══════════════════════════════════════════════════════════════════════════════
#
# USAGE:
#   # For IP-only deployment (no domain yet):
#   chmod +x scripts/deploy.sh
#   sudo ./scripts/deploy.sh
#
#   # For domain deployment (with auto-SSL):
#   sudo ./scripts/deploy.sh yourdomain.com
#
# This script will:
#   1. Install system dependencies (Caddy, Python, Node.js)
#   2. Create application directory structure
#   3. Build frontend
#   4. Set up Python virtual environment and install dependencies
#   5. Generate secure API key
#   6. Configure environment files
#   7. Configure Caddy reverse proxy
#   8. Create systemd service for backend
#   9. Configure firewall (UFW)
#   10. Start all services
#
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ─── Colors ───
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ─── Configuration ───
DOMAIN="${1:-}"
APP_DIR="/var/www/voice-avatar"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

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

get_server_ip() {
    # Try to get public IP
    curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null || hostname -I | awk '{print $1}'
}

# ═══════════════════════════════════════════════════════════════════════════════
# MAIN DEPLOYMENT
# ═══════════════════════════════════════════════════════════════════════════════

main() {
    check_root
    
    # Determine deployment mode
    SERVER_IP=$(get_server_ip)
    
    if [[ -z "$DOMAIN" ]]; then
        DEPLOY_MODE="ip"
        log_warning "No domain provided - deploying in IP-only mode (HTTP only)"
        log_info "After your boss maps a domain, run: sudo ./scripts/add-domain.sh yourdomain.com"
    else
        DEPLOY_MODE="domain"
    fi
    
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "  🚀 Deploying Voice Avatar App"
    echo "═══════════════════════════════════════════════════════════════"
    if [[ "$DEPLOY_MODE" == "ip" ]]; then
        echo "  Mode:   IP-only (HTTP)"
        echo "  Access: http://$SERVER_IP"
    else
        echo "  Mode:   Domain (HTTPS)"
        echo "  Domain: $DOMAIN"
    fi
    echo "  Source: $ROOT_DIR"
    echo "  Target: $APP_DIR"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    
    # ─── Step 1: Update System ───
    log_info "Updating system packages..."
    apt-get update -qq
    apt-get upgrade -y -qq
    log_success "System updated"
    
    # ─── Step 2: Install Dependencies ───
    log_info "Installing system dependencies..."
    apt-get install -y -qq \
        curl \
        wget \
        git \
        python3 \
        python3-pip \
        python3-venv \
        ufw \
        debian-keyring \
        debian-archive-keyring \
        apt-transport-https
    log_success "System dependencies installed"
    
    # ─── Step 3: Install Node.js (if not present) ───
    if ! command -v node &> /dev/null; then
        log_info "Installing Node.js 20.x..."
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs
        log_success "Node.js $(node --version) installed"
    else
        log_success "Node.js $(node --version) already installed"
    fi
    
    # ─── Step 4: Install Caddy ───
    if ! command -v caddy &> /dev/null; then
        log_info "Installing Caddy web server..."
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
        curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
        apt-get update -qq
        apt-get install -y -qq caddy
        log_success "Caddy installed"
    else
        log_success "Caddy already installed"
    fi
    
    # ─── Step 5: Create App Directory ───
    log_info "Creating application directory..."
    mkdir -p "$APP_DIR"
    mkdir -p /var/log/caddy
    log_success "Created $APP_DIR"
    
    # ─── Step 6: Copy Application Files ───
    log_info "Copying application files..."
    cp -r "$ROOT_DIR/backend" "$APP_DIR/"
    cp -r "$ROOT_DIR/frontend" "$APP_DIR/"
    log_success "Application files copied"
    
    # ─── Step 7: Configure Backend ───
    log_info "Setting up backend..."
    cd "$APP_DIR/backend"
    
    # Create virtual environment
    python3 -m venv venv
    source venv/bin/activate
    
    # Install dependencies
    pip install -q --upgrade pip
    pip install -q -r requirements.txt
    
    # Create .env file based on deployment mode
    if [[ "$DEPLOY_MODE" == "ip" ]]; then
        CORS_VALUE="http://$SERVER_IP"
    else
        CORS_VALUE="https://$DOMAIN,https://www.$DOMAIN"
    fi
    
    cat > .env << EOF
# Voice Avatar Backend - Production Configuration
# Generated on $(date)
# Mode: $DEPLOY_MODE

LLM_API_URL=\${LLM_API_URL:-your_llm_api_url_here}
LLM_MODEL=Qwen2.5-1.5B-Instruct
LLM_MAX_TOKENS=150
LLM_TEMPERATURE=0.7

HOST=127.0.0.1
PORT=8000

CORS_ORIGINS=$CORS_VALUE

RATE_LIMIT=30/minute
EOF
    
    deactivate
    log_success "Backend configured"
    
    # ─── Step 8: Build Frontend ───
    log_info "Building frontend..."
    cd "$APP_DIR/frontend"
    
    # Create .env file (empty - Caddy proxies /api/*)
    cat > .env << EOF
# Voice Avatar Frontend - Production Configuration
# Generated on $(date)

VITE_API_URL=
EOF
    
    # Install dependencies and build
    npm ci --silent
    npm run build
    log_success "Frontend built"
    
    # ─── Step 9: Configure Caddy ───
    log_info "Configuring Caddy..."
    
    if [[ "$DEPLOY_MODE" == "ip" ]]; then
        # IP-only mode: HTTP on port 80, no SSL
        cat > /etc/caddy/Caddyfile << EOF
# Voice Avatar App - Caddy Configuration (IP-only mode)
# Server IP: $SERVER_IP
# Generated on $(date)
#
# ⚠️  This is HTTP-only mode for initial deployment.
# Once you have a domain, run: sudo ./scripts/add-domain.sh yourdomain.com

:80 {
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
EOF
    else
        # Domain mode: HTTPS with auto-SSL
        cat > /etc/caddy/Caddyfile << EOF
# Voice Avatar App - Caddy Configuration
# Domain: $DOMAIN
# Generated on $(date)

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
    fi
    log_success "Caddy configured"
    
    # ─── Step 10: Create Systemd Service ───
    log_info "Creating systemd service..."
    cat > /etc/systemd/system/voice-avatar.service << EOF
[Unit]
Description=Voice Avatar FastAPI Backend
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$APP_DIR/backend
Environment="PATH=$APP_DIR/backend/venv/bin"
ExecStart=$APP_DIR/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    
    # Set permissions
    chown -R www-data:www-data "$APP_DIR"
    
    # Reload systemd
    systemctl daemon-reload
    log_success "Systemd service created"
    
    # ─── Step 11: Configure Firewall ───
    log_info "Configuring firewall..."
    ufw --force reset > /dev/null 2>&1
    ufw default deny incoming > /dev/null 2>&1
    ufw default allow outgoing > /dev/null 2>&1
    ufw allow ssh > /dev/null 2>&1
    ufw allow 80/tcp > /dev/null 2>&1
    ufw allow 443/tcp > /dev/null 2>&1
    ufw --force enable > /dev/null 2>&1
    log_success "Firewall configured (SSH, HTTP, HTTPS allowed)"
    
    # ─── Step 12: Start Services ───
    log_info "Starting services..."
    systemctl enable voice-avatar
    systemctl start voice-avatar
    systemctl restart caddy
    log_success "Services started"
    
    # ─── Done ───
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo -e "  ${GREEN}✓ Deployment Complete!${NC}"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    
    if [[ "$DEPLOY_MODE" == "ip" ]]; then
        echo "  🌐 Your app is live at: http://$SERVER_IP"
        echo ""
        echo "  ⚠️  HTTP-only mode (no SSL) - for testing only!"
        echo ""
        echo "  📋 NEXT STEPS:"
        echo "     1. Give this IP to your boss: $SERVER_IP"
        echo "     2. Boss maps domain to this IP (DNS A record)"
        echo "     3. Run: sudo $ROOT_DIR/scripts/add-domain.sh yourdomain.com"
        echo "     4. Caddy auto-gets SSL certificate"
    else
        echo "  🌐 Your app is live at: https://$DOMAIN"
    fi
    
    echo ""
    echo "  � Protection: Rate limiting (30 req/min per IP)"
    echo ""
    echo "  📁 Files:"
    echo "     Backend:  $APP_DIR/backend"
    echo "     Frontend: $APP_DIR/frontend/dist"
    echo "     Logs:     /var/log/caddy/"
    echo ""
    echo "  🔧 Management Commands:"
    echo "     sudo systemctl status voice-avatar    # Check backend status"
    echo "     sudo systemctl restart voice-avatar   # Restart backend"
    echo "     sudo journalctl -u voice-avatar -f    # View backend logs"
    echo "     sudo systemctl reload caddy           # Reload Caddy config"
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
}

# Run main function
main "$@"
