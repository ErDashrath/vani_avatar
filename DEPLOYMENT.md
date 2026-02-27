# EchoAI-Avatar Deployment Guide

## Quick Start (Development)

### 1. Start Backend Server

```bash
chmod +x start-backend.sh
./start-backend.sh
```

The backend will be available at http://localhost:8000

### 2. Start Frontend (in another terminal)

```bash
npm install  # if not already done
npm run dev
```

The frontend will be available at http://localhost:5173

---

## DigitalOcean Deployment

### Prerequisites

- DigitalOcean account
- Domain name (optional but recommended)
- SSH access to your droplet

### Step 1: Create Droplet

1. Log in to DigitalOcean
2. Create a new Droplet:
   - **Image**: Ubuntu 22.04 LTS
   - **Plan**: Basic ($6/month minimum)
   - **Datacenter**: Choose closest to your users
   - **Authentication**: SSH keys (recommended)
3. Note your droplet's IP address

### Step 2: Initial Server Setup

SSH into your droplet:

```bash
ssh root@your_droplet_ip
```

Update system and install dependencies:

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install Python 3 and pip
apt install -y python3 python3-pip python3-venv

# Install Nginx
apt install -y nginx

# Install PM2 (process manager)
npm install -g pm2

# Install Certbot for SSL (optional)
apt install -y certbot python3-certbot-nginx
```

### Step 3: Deploy Application

Clone or upload your code:

```bash
# Create app directory
mkdir -p /var/www/echoai
cd /var/www/echoai

# Upload your code (from local machine)
# Option 1: Using SCP
scp -r /path/to/EchoAI-Avatar/* root@your_droplet_ip:/var/www/echoai/

# Option 2: Using Git
git clone your_repo_url .
```

### Step 4: Setup Backend

```bash
cd /var/www/echoai/backend

# Create virtual environment
python3 -m venv venv

# Activate and install dependencies
source venv/bin/activate
pip install -r requirements.txt
```

Create systemd service for backend:

```bash
nano /etc/systemd/system/echoai-backend.service
```

Add the following content:

```ini
[Unit]
Description=EchoAI Backend API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/echoai/backend
Environment="PATH=/var/www/echoai/backend/venv/bin"
ExecStart=/var/www/echoai/backend/venv/bin/python main.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
systemctl daemon-reload
systemctl enable echoai-backend
systemctl start echoai-backend
systemctl status echoai-backend
```

### Step 5: Build Frontend

```bash
cd /var/www/echoai

# Install dependencies
npm install

# Build for production
npm run build
```

### Step 6: Configure Nginx

Create Nginx configuration:

```bash
nano /etc/nginx/sites-available/echoai
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your_domain.com;  # or your_droplet_ip

    # Frontend (static files)
    location / {
        root /var/www/echoai/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # For SSE streaming
        proxy_buffering off;
        proxy_read_timeout 300s;
    }

    # WebSocket support (if needed)
    location /ws {
        proxy_pass http://localhost:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable the site and restart Nginx:

```bash
ln -s /etc/nginx/sites-available/echoai /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 7: Setup SSL (Optional but Recommended)

```bash
certbot --nginx -d your_domain.com
```

Follow the prompts to set up SSL.

### Step 8: Setup Firewall

```bash
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw enable
```

---

## Environment Variables

### Backend (.env)

Create `/var/www/echoai/backend/.env`:

```env
PORT=8000
# Add your LLM API keys here when ready
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
```

### Frontend

Update `/var/www/echoai/.env`:

```env
VITE_API_URL=
```

Leave empty - Nginx will proxy `/api/*` to the backend.

---

## Monitoring & Maintenance

### Check Backend Status

```bash
systemctl status echoai-backend
journalctl -u echoai-backend -f  # View logs
```

### Check Nginx Status

```bash
systemctl status nginx
tail -f /var/log/nginx/error.log
tail -f /var/log/nginx/access.log
```

### Restart Services

```bash
systemctl restart echoai-backend
systemctl restart nginx
```

### Update Application

```bash
cd /var/www/echoai

# Pull latest changes (if using Git)
git pull

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
systemctl restart echoai-backend

# Update frontend
cd /var/www/echoai
npm install
npm run build
systemctl restart nginx
```

---

## Troubleshooting

### Backend not starting

```bash
# Check logs
journalctl -u echoai-backend -n 50
# Check if port 8000 is already in use
netstat -tulpn | grep 8000
```

### Frontend not loading

```bash
# Check Nginx config
nginx -t
# Check Nginx logs
tail -f /var/log/nginx/error.log
```

### API calls failing

```bash
# Check if backend is running
curl http://localhost:8000/api/health
# Check Nginx proxy
curl http://localhost/api/health
```

---

## Cost Optimization

- **Basic Droplet**: $6/month (1GB RAM, 1 vCPU)
- **Recommended**: $12/month (2GB RAM, 1 vCPU) for better performance
- **Storage**: Use DigitalOcean Spaces for avatar GIF files if needed ($5/month)

---

## Scaling

For production with many users:

1. **Use separate droplets** for frontend and backend
2. **Add load balancer** ($10/month)
3. **Add managed database** if storing user data
4. **Enable CDN** for static assets
5. **Use Redis** for caching

---

## Security Checklist

- ✅ Enable UFW firewall
- ✅ Setup SSL with Let's Encrypt
- ✅ Use SSH keys (disable password auth)
- ✅ Keep system updated (`apt update && apt upgrade`)
- ✅ Configure fail2ban for SSH protection
- ✅ Use environment variables for secrets
- ✅ Enable CORS only for your domain
- ✅ Setup backup strategy

---

## Quick Commands

```bash
# Start everything
systemctl start echoai-backend && systemctl start nginx

# Stop everything
systemctl stop echoai-backend && systemctl stop nginx

# View all logs
journalctl -u echoai-backend -u nginx -f

# Check service status
systemctl status echoai-backend nginx
```
