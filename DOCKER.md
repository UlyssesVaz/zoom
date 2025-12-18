# Docker Setup for Celera

This document describes how to build and run Celera using Docker.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+ (optional, for docker-compose)

## Quick Start

### Using Docker Compose (Recommended)

1. **Set up environment variables:**

   Create a `.env` file in the root directory:
   ```env
   ZOOM_MEETING_SDK_KEY=your_sdk_key_here
   ZOOM_MEETING_SDK_SECRET=your_sdk_secret_here
   # or
   CLIENT_SECRET=your_client_secret_here
   ```

2. **Build and start services:**

   ```bash
   docker-compose up -d
   ```

3. **Access the application:**

   - Main app: http://localhost:9999
   - Auth endpoint: http://localhost:4000
   - Webhook endpoint: http://localhost:9999/webhook/recording

4. **View logs:**

   ```bash
   docker-compose logs -f
   ```

5. **Stop services:**

   ```bash
   docker-compose down
   ```

### Using Docker Directly

1. **Build the image:**

   ```bash
   docker build -t celera:latest .
   ```

2. **Run the container:**

   ```bash
   docker run -d \
     --name celera-app \
     -p 9999:9999 \
     -p 4001:4001 \
     -e NODE_ENV=production \
     celera:latest
   ```

3. **Access the application:**

   - Main app: http://localhost:9999

## Architecture

The Docker setup includes:

1. **celera-app**: Main application server
   - Serves static files (HTML, CSS, JS)
   - Handles webhook endpoints
   - Handles telemetry endpoints
   - Port: 9999

2. **celera-auth**: Zoom Meeting SDK Auth Endpoint
   - Generates JWT tokens for meeting authentication
   - Port: 4000
   - Requires: `ZOOM_MEETING_SDK_KEY` and `ZOOM_MEETING_SDK_SECRET`

## Environment Variables

### Main Application (celera-app)

- `PORT`: Main server port (default: 9999)
- `WEBHOOK_PORT`: Webhook server port (default: 4001)
- `NODE_ENV`: Environment (production/development)

### Auth Endpoint (celera-auth)

- `PORT`: Auth server port (default: 4000)
- `ZOOM_MEETING_SDK_KEY`: Your Zoom Meeting SDK Key
- `ZOOM_MEETING_SDK_SECRET`: Your Zoom Meeting SDK Secret
- `CLIENT_SECRET`: Alternative to SDK Secret (legacy)

## Production Considerations

### Security

- The containers run as non-root users (UID 1001)
- Health checks are configured for all services
- Environment variables should be managed securely (use secrets management)

### Performance

- Uses Alpine Linux for smaller image size
- Multi-stage build reduces final image size
- Static files are served efficiently via Express

### Scaling

For production scaling, consider:

1. **Load Balancing**: Use nginx or Traefik in front of the containers
2. **Database**: Replace in-memory webhook storage with a database
3. **Caching**: Add Redis for session/cache management
4. **Monitoring**: Add Prometheus/Grafana for metrics

### Example Production Setup

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  celera-app:
    build: .
    deploy:
      replicas: 3
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
```

## Troubleshooting

### Container won't start

1. Check logs: `docker-compose logs celera-app`
2. Verify ports aren't in use: `netstat -an | grep 9999`
3. Check environment variables: `docker-compose config`

### Health check failing

1. Check if the service is responding: `curl http://localhost:9999/health`
2. Review container logs for errors
3. Verify all dependencies are installed

### Webhook not receiving events

1. Ensure webhook endpoint is accessible: `curl -X POST http://localhost:9999/webhook/recording`
2. Check firewall/network settings
3. Verify webhook URL is correctly configured in Zoom

## Development

For local development, you can still use:

```bash
cd CDN
npm start
```

Docker is primarily for production deployments and CI/CD pipelines.

## Building for Different Platforms

To build for ARM64 (Apple Silicon, Raspberry Pi):

```bash
docker buildx build --platform linux/arm64 -t celera:latest .
```

For multi-platform builds:

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t celera:latest .
```



