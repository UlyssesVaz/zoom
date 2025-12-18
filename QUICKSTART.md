# Quick Start Guide - Docker Setup

## 🚀 Get Started in 3 Steps

### 1. Create Environment File
```bash
# Create .env file from template
cat > .env << EOF
CDN_PORT=9999
AUTH_PORT=4000
ZOOM_MEETING_SDK_KEY=your_zoom_meeting_sdk_key_here
ZOOM_MEETING_SDK_SECRET=your_zoom_meeting_sdk_secret_here
EOF
```

**Important:** Replace `your_zoom_meeting_sdk_key_here` and `your_zoom_meeting_sdk_secret_here` with your actual Zoom credentials from [Zoom Developer Portal](https://developers.zoom.us/docs/meeting-sdk/developer-accounts/).

### 2. Build and Start
```bash
docker-compose up --build
```

### 3. Access Your Application
- **Frontend Dashboard**: http://localhost:9999/dashboard.html (or http://localhost:9999/ - auto-redirects)
- **Backend API**: http://localhost:4000

## 📋 What Was Set Up

### ✅ Best Practices Implemented

1. **Multi-Stage Builds** - Optimized image sizes with separate dependency and runtime stages
2. **Non-Root User** - Containers run as user `nodejs` (UID 1001) for security
3. **Health Checks** - Both services have health endpoints for monitoring
4. **Layer Caching** - Dependencies installed separately for better cache utilization
5. **Alpine Linux** - Minimal base images for smaller footprint
6. **Production Dependencies Only** - Final images contain only runtime dependencies
7. **Proper Networking** - Services communicate via Docker bridge network
8. **Auto-Restart** - Services restart automatically unless stopped

### 📁 Files Created

- `CDN/Dockerfile` - Frontend service container definition
- `CDN/.dockerignore` - Excludes unnecessary files from build
- `meetingsdk-auth-endpoint-sample/Dockerfile` - Backend service container definition
- `meetingsdk-auth-endpoint-sample/.dockerignore` - Excludes unnecessary files from build
- `docker-compose.yml` - Orchestrates both services
- `.dockerignore` - Root-level ignore file
- `DOCKER.md` - Comprehensive Docker documentation

### 🔧 Configuration Changes

- **CDN/server.js** - Updated to redirect root (`/`) to `/dashboard.html` as requested

## 🛠️ Common Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose stop

# Rebuild after code changes
docker-compose up -d --build

# Remove everything
docker-compose down -v
```

## 📚 Full Documentation

See [DOCKER.md](./DOCKER.md) for complete documentation including:
- Production deployment guide
- Troubleshooting
- Security best practices
- Environment variable reference

