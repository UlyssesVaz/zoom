# Multi-stage Dockerfile for Celera Sales Intelligence Platform
# Following Docker best practices for production

# Stage 1: Dependencies and build
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY CDN/package*.json ./CDN/

# Install dependencies
RUN cd CDN && npm ci --only=production --ignore-scripts

# Stage 2: Production image
FROM node:18-alpine AS production

# Create app user (non-root for security)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S celera -u 1001

# Set working directory
WORKDIR /app

# Copy dependencies from builder
COPY --from=builder --chown=celera:nodejs /app/CDN/node_modules ./CDN/node_modules

# Copy application files
COPY --chown=celera:nodejs CDN/ ./CDN/

# Set environment variables
ENV NODE_ENV=production
ENV PORT=9999
ENV WEBHOOK_PORT=4001

# Expose ports
EXPOSE 9999 4001

# Switch to non-root user
USER celera

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9999/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "CDN/server.js"]

