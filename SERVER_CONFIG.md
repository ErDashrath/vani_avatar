# EchoAI Avatar — Server Configuration

## Server
- **Provider**: DigitalOcean  
- **IP**: `64.227.137.11`  
- **OS**: Ubuntu 24.04 LTS  
- **CPU/RAM**: 2 vCPU / 8 GB  
- **SSH**: `ssh -i ~/voiceai root@64.227.137.11`

## Domain
- **URL**: https://avatar.nomineelife.com  
- **SSL**: Auto-managed by Caddy (Let's Encrypt)

## Existing Services (DO NOT TOUCH)
| Service | Port | Domain |
|---|---|---|
| Caddy (web server) | 80, 443 | all domains |
| llama.cpp / AI API | 8000 (docker) | ai.nomineelife.com |
| Other Python service | 8001 | — |

## EchoAI Services
| Service | Port | Type |
|---|---|---|
| FastAPI backend | **8765** (localhost only) | systemd service |
| React frontend | `/var/www/avatar/dist` | static files via Caddy |

---

## File Structure on Server
```
/var/www/avatar/
├── dist/          ← built React frontend (rsync'd from local)
└── backend/
    ├── main.py    ← FastAPI app
    ├── requirements.txt
    └── venv/      ← Python virtualenv (created on server)
```

## Caddy Config
**File**: `/etc/caddy/Caddyfile`

The `avatar.nomineelife.com` block was already present. Two lines were updated:
- `localhost:8000` → `localhost:8765` (avoids collision with docker service)
- `/var/www/voice-avatar/frontend/dist` → `/var/www/avatar/dist`

```caddy
avatar.nomineelife.com {
    handle /api/* {
        reverse_proxy localhost:8765 {
            flush_interval -1    # SSE streaming support
        }
    }
    handle {
        root * /var/www/avatar/dist
        try_files {path} /index.html
        file_server
    }
    encode gzip
}
```

**Reload command** (zero downtime):
```bash
systemctl reload caddy
```

## Backend Systemd Service
**File**: `/etc/systemd/system/echoai-backend.service`

```ini
[Unit]
Description=EchoAI FastAPI Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/avatar/backend
ExecStart=/var/www/avatar/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8765 --workers 2
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

**Service commands**:
```bash
systemctl status echoai-backend    # check status
systemctl restart echoai-backend   # restart after code change
systemctl stop echoai-backend      # stop
journalctl -fu echoai-backend      # live logs
```

## LLM API
- **Endpoint**: `https://ai.nomineelife.com/v1/chat/completions`
- **Model**: `Qwen2.5-1.5B-Instruct-Q5_K_M`
- **Type**: OpenAI-compatible (llama.cpp backend)
- **Backend proxies**: user message → nomineelife API → SSE stream → frontend

---

## Re-deploy After Code Changes (run from local machine)

```bash
# 1. Rebuild frontend
cd /home/dashrath/Desktop/dumb_workspace/wquar_avatar/EchoAI-Avatar
npm run build

# 2. Upload frontend
rsync -az --delete -e "ssh -i ~/voiceai" \
  dist/ root@64.227.137.11:/var/www/avatar/dist/

# 3. Upload backend (if changed)
rsync -az --exclude='venv' --exclude='__pycache__' -e "ssh -i ~/voiceai" \
  backend/ root@64.227.137.11:/var/www/avatar/backend/

# 4. Restart backend (if backend changed)
ssh -i ~/voiceai root@64.227.137.11 "systemctl restart echoai-backend"
```

## Health Check
```bash
curl https://avatar.nomineelife.com/api/health
# Expected: {"status":"healthy","version":"1.0.0","timestamp":"..."}
```
