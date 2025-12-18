# Docker Setup Guide

This project uses Docker and Docker Compose to run the Celera application with best practices.

## Architecture

The application consists of two main services:

1. **CDN Frontend** (`cdn` service)
   - Serves static files and webhook endpoints
   - Runs on port 9999 (configurable via `CDN_PORT`)
   - Automatically redirects root (`/`) to `/dashboard.html`

2. **Auth Endpoint Backend** (`auth-endpoint` service)
   - Generates Meeting SDK JWTs for Zoom integration
   - Runs on port 4000 (configurable via `AUTH_PORT`)
   - Requires Zoom Meeting SDK credentials

## Prerequisites

- Docker Engine 20.10+ 
- Docker Compose 2.0+
- Zoom Meeting SDK credentials (Key and Secret)

## Quick Start

1. **Clone and navigate to the project:**
   ```bash
   cd zoom-sdk-web-5.0.0
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

3. **Edit `.env` file with your credentials:**
   ```env
   ZOOM_MEETING_SDK_KEY=your_actual_key
   ZOOM_MEETING_SDK_SECRET=your_actual_secret
   ```

4. **Build and start services:**
   ```bash
   docker-compose up --build
   ```

5. **Access the application:**
   - Frontend: http://localhost:9999/dashboard.html (or http://localhost:9999/ - auto-redirects)
   - Backend: http://localhost:4000

## Docker Commands

### Build and Start
```bash
# Build and start in foreground
docker-compose up --build

# Build and start in background
docker-compose up -d --build
```

### Stop Services
```bash
# Stop services
docker-compose stop

# Stop and remove containers
docker-compose down

# Stop and remove containers, volumes, and networks
docker-compose down -v
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f cdn
docker-compose logs -f auth-endpoint
```

### Rebuild After Changes
```bash
# Rebuild specific service
docker-compose build cdn
docker-compose build auth-endpoint

# Rebuild and restart
docker-compose up -d --build
```

### Check Service Status
```bash
# List running containers
docker-compose ps

# Check health status
docker-compose ps
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CDN_PORT` | Frontend service port | 9999 |
| `AUTH_PORT` | Backend service port | 4000 |
| `WEBHOOK_PORT` | Webhook server port (if different from CDN_PORT) | 4001 |
| `ZOOM_MEETING_SDK_KEY` | Zoom Meeting SDK Key | **Required** |
| `ZOOM_MEETING_SDK_SECRET` | Zoom Meeting SDK Secret | **Required** |

## Production Deployment

### Security Best Practices

1. **Never commit `.env` file** - It contains sensitive credentials
2. **Use Docker secrets** or environment variables from your hosting platform
3. **Use HTTPS** - Configure reverse proxy (nginx/traefik) in front of containers
4. **Regular updates** - Keep base images and dependencies updated

### Production Docker Compose Override

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  cdn:
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    # Remove volume mounts for production

  auth-endpoint:
    restart: always
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

Run with:
```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Using Environment Variables Directly

Instead of `.env` file, you can set environment variables:

```bash
export ZOOM_MEETING_SDK_KEY=your_key
export ZOOM_MEETING_SDK_SECRET=your_secret
docker-compose up -d
```

## Troubleshooting

### Port Already in Use
```bash
# Change ports in .env file or docker-compose.yml
CDN_PORT=9998
AUTH_PORT=4001
```

### Container Won't Start
```bash
# Check logs
docker-compose logs cdn
docker-compose logs auth-endpoint

# Check health status
docker inspect celera-cdn | grep Health -A 10
docker inspect celera-auth-endpoint | grep Health -A 10
```

### Rebuild from Scratch
```bash
# Remove everything
docker-compose down -v
docker system prune -a

# Rebuild
docker-compose build --no-cache
docker-compose up -d
```

### Permission Issues
The containers run as non-root user (UID 1001) for security. If you encounter permission issues:

```bash
# Check container user
docker exec celera-cdn whoami
docker exec celera-auth-endpoint whoami
```

## Architecture Details

### Multi-Stage Builds
- **Stage 1 (deps)**: Install production dependencies only
- **Stage 2 (builder)**: Build assets (if needed)
- **Stage 3 (runner)**: Final minimal image with only runtime files

### Security Features
- Non-root user execution (UID 1001)
- Minimal Alpine Linux base images
- Separate dependency installation for better caching
- Health checks for container orchestration

### Network
- Services communicate via Docker bridge network (`celera-network`)
- Services are isolated but can communicate using service names

## Health Checks

Both services include health checks:

- **CDN**: `GET /health` endpoint
- **Auth Endpoint**: `POST /` endpoint (returns 400 for missing body, which indicates server is running)

Check health:
```bash
curl http://localhost:9999/health
curl -X POST http://localhost:4000/ -H "Content-Type: application/json" -d '{}'
```

## Development vs Production

### Development
- Mount volumes for live code changes
- Enable debug logging
- Use development dependencies

### Production
- No volume mounts
- Production dependencies only
- Optimized builds
- Proper logging configuration
