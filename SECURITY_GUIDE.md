# 🔒 Security & Deployment Guide

Complete guide for securing and deploying the Voice Avatar App to production.

---

## 🚀 Quick Deploy

### Option A: You DON'T have a domain yet (most common)

```bash
# On your server, after cloning the repo:
chmod +x scripts/deploy.sh
sudo ./scripts/deploy.sh
```

This deploys with **IP-only mode (HTTP)**. Then:
1. Script outputs your server IP
2. Give IP to your boss
3. Boss maps domain to IP (DNS A record)
4. Run step 2 below

### Option B: Add domain later (after boss sets up DNS)

```bash
sudo ./scripts/add-domain.sh yourdomain.com
```

Caddy will automatically get SSL certificate from Let's Encrypt!

### Option C: You already have a domain

```bash
sudo ./scripts/deploy.sh yourdomain.com
```

---

## 📋 Deployment Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Deploy on Server (IP-only)                             │
│  $ sudo ./scripts/deploy.sh                                     │
│  → App runs on http://YOUR_SERVER_IP                            │
│  → Get IP address from output                                   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Give IP to Boss                                        │
│  "Hey boss, here's the IP: 203.0.113.50"                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Boss Maps Domain (DNS A Record)                        │
│  myapp.example.com → 203.0.113.50                               │
│  (Takes 5 mins to 24 hours to propagate)                        │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 4: Add Domain to Your Deployment                          │
│  $ sudo ./scripts/add-domain.sh myapp.example.com               │
│  → Caddy auto-gets SSL certificate                              │
│  → App now runs on https://myapp.example.com                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🌐 How Caddy Works

We chose **Caddy** over Nginx because:

| Feature | Caddy | Nginx |
|---------|-------|-------|
| Auto HTTPS | ✅ Automatic | ❌ Manual certbot |
| Config syntax | Simple | Complex |
| Certificate renewal | ✅ Automatic | ❌ Cron job needed |
| Hot reload | ✅ Zero downtime | ⚠️ Requires restart |
| HTTP/2 | ✅ Default | ❌ Manual config |

### Caddy Architecture

```
Internet                    Your Server
   │                            │
   │  HTTPS (443)               │
   ▼                            │
┌─────────────────────────────────────────┐
│                 CADDY                    │
│  • Auto SSL from Let's Encrypt          │
│  • HTTP → HTTPS redirect                │
│  • Static file serving                  │
│  • Reverse proxy to backend             │
└─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        │                       │
        ▼                       ▼
   /api/* requests         Other requests
        │                       │
        ▼                       ▼
┌───────────────┐      ┌───────────────┐
│   FastAPI     │      │   Static      │
│   Backend     │      │   Files       │
│  (port 8000)  │      │  (frontend)   │
└───────────────┘      └───────────────┘
```

### How Caddy Handles Requests

1. **User visits `https://yourdomain.com`**
   - Caddy serves `frontend/dist/index.html`
   - Static assets (JS, CSS) served from `frontend/dist/`

2. **Frontend calls `/api/chat`**
   - Caddy matches `/api/*` pattern
   - Proxies request to `localhost:8000`
   - FastAPI processes and returns response
   - Caddy forwards response to browser

3. **SSL/HTTPS**
   - First request: Caddy contacts Let's Encrypt
   - Proves domain ownership via ACME challenge
   - Gets certificate automatically
   - Renews before expiry (automatic)

### Caddyfile Explained

```caddyfile
yourdomain.com {
    # Serve frontend from this directory
    root * /var/www/voice-avatar/frontend/dist
    file_server
    
    # SPA routing: return index.html for unknown paths
    try_files {path} /index.html
    
    # API requests go to FastAPI backend
    handle /api/* {
        reverse_proxy localhost:8000 {
            # Enable Server-Sent Events (streaming)
            flush_interval -1
        }
    }
    
    # Compress responses
    encode gzip
}
```

---

## 🔐 Security Features Implemented

### 1. API Key Authentication

```
Frontend → X-API-Key header → Backend validates → Process request
```

- **Where**: [backend/app/core/auth.py](backend/app/core/auth.py)
- **How**: Middleware checks `X-API-Key` header on `/api/chat` endpoints
- **Dev mode**: If `API_KEY` env var is empty, auth is bypassed

### 2. Rate Limiting

- **Default**: 30 requests per minute per IP
- **Configurable**: Set `RATE_LIMIT=60/minute` in `.env`
- **Library**: SlowAPI (wraps limits)

### 3. CORS Protection

- Only configured origins can call the API
- Prevents other websites from using your backend
- Set in `CORS_ORIGINS` env var

### 4. Firewall Rules

```
Port 22  (SSH)   → ✅ Allowed
Port 80  (HTTP)  → ✅ Allowed (redirects to 443)
Port 443 (HTTPS) → ✅ Allowed
Port 8000        → ❌ Blocked (internal only)
```

### 5. Backend Not Exposed

- FastAPI listens on `127.0.0.1:8000` (localhost only)
- Cannot be accessed from internet directly
- Only Caddy can reach it

---

## 📝 Environment Variables

### Backend (`backend/.env`)

```bash
# LLM Configuration
LLM_API_URL=your_llm_api_url_here
LLM_MODEL=Qwen2.5-1.5B-Instruct
LLM_MAX_TOKENS=150
LLM_TEMPERATURE=0.7

# Server (keep as localhost for production)
HOST=127.0.0.1
PORT=8000

# CORS (your domain)
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Security
API_KEY=your-generated-api-key
RATE_LIMIT=30/minute
```

### Frontend (`frontend/.env`)

```bash
# API URL (empty = same origin via Caddy proxy)
VITE_API_URL=

# API Key (must match backend)
VITE_API_KEY=your-generated-api-key
```

---

## 🔧 Management Commands

### Service Control

```bash
# Backend service
sudo systemctl status voice-avatar    # Check status
sudo systemctl start voice-avatar     # Start
sudo systemctl stop voice-avatar      # Stop
sudo systemctl restart voice-avatar   # Restart

# Caddy
sudo systemctl status caddy           # Check status
sudo systemctl reload caddy           # Reload config (no downtime)
sudo systemctl restart caddy          # Full restart
```

### View Logs

```bash
# Backend logs
sudo journalctl -u voice-avatar -f         # Follow live
sudo journalctl -u voice-avatar --since today

# Caddy logs
sudo tail -f /var/log/caddy/access.log

# Caddy errors
sudo journalctl -u caddy -f
```

### Validate Configuration

```bash
# Test Caddyfile syntax
sudo caddy validate --config /etc/caddy/Caddyfile

# Test backend manually
cd /var/www/voice-avatar/backend
source venv/bin/activate
python -c "from app.main import app; print('OK')"
```

---

## 🔄 Updating the App

```bash
# On your server
cd /path/to/voice-avatar-app

# Pull latest code
git pull

# Rebuild frontend
cd frontend
npm ci
npm run build
sudo cp -r dist/* /var/www/voice-avatar/frontend/dist/

# Update backend
cd ../backend
source /var/www/voice-avatar/backend/venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart voice-avatar

# Reload Caddy (if Caddyfile changed)
sudo systemctl reload caddy
```

---

## 🛠️ Troubleshooting

### Backend won't start

```bash
# Check logs
sudo journalctl -u voice-avatar -n 50

# Test manually
cd /var/www/voice-avatar/backend
source venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### SSL certificate not working

```bash
# Check Caddy logs
sudo journalctl -u caddy -f

# Common issues:
# 1. DNS not pointing to server
# 2. Port 80/443 blocked by hosting provider
# 3. Domain not verified
```

### API returning 403

```bash
# Check API key matches in both .env files
cat /var/www/voice-avatar/backend/.env | grep API_KEY
cat /var/www/voice-avatar/frontend/.env | grep VITE_API_KEY
```

### Rate limited

```bash
# Increase rate limit
sudo vim /var/www/voice-avatar/backend/.env
# Change: RATE_LIMIT=60/minute
sudo systemctl restart voice-avatar
```

---

## 📊 Monitoring

### Basic Health Check

```bash
# Check if backend responds
curl -s http://localhost:8000/api/health

# Check via Caddy (HTTPS)
curl -s https://yourdomain.com/api/health
```

### Resource Usage

```bash
# Memory/CPU
htop

# Disk space
df -h

# Backend process
ps aux | grep uvicorn
```

---

## 🔒 Security Checklist

Before going live:

- [ ] DNS points to server IP
- [ ] API key generated and set in both `.env` files
- [ ] `CORS_ORIGINS` set to your domain only
- [ ] Firewall enabled (`sudo ufw status`)
- [ ] Backend listening on `127.0.0.1` only
- [ ] SSL certificate active (check `https://yourdomain.com`)
- [ ] Rate limiting configured
- [ ] SSH key authentication (disable password login)

---

## 📚 Files Reference

```
voice-avatar-app/
├── Caddyfile              # Caddy configuration template
├── SECURITY_GUIDE.md      # This file
├── scripts/
│   ├── deploy.sh          # One-command deployment
│   ├── dev.sh             # Local development
│   └── build.sh           # Production build
├── backend/
│   ├── .env.example       # Environment template
│   └── app/
│       ├── core/
│       │   ├── auth.py    # API key authentication
│       │   └── config.py  # Settings with security vars
│       └── api/routes/
│           └── chat.py    # Rate-limited endpoints
└── frontend/
    └── .env.example       # Frontend env template
```

---

## 🆘 Getting Help

1. Check logs first (`journalctl`)
2. Validate configs (`caddy validate`)
3. Test components individually
4. Check firewall (`ufw status`)

For issues with:
- **Caddy**: https://caddyserver.com/docs/
- **FastAPI**: https://fastapi.tiangolo.com/
- **Let's Encrypt**: https://letsencrypt.org/docs/
