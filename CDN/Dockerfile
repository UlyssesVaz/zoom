# Multi-stage build for CDN frontend service
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies with npm ci for reproducible builds
#RUN npm ci --only=production && npm cache clean --force
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Stage 2: Production build
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install all dependencies (including devDependencies for build)
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy source files
COPY . .

# Note: For production, you might want to build assets here
# Since this is a static site served by Express, we'll just copy everything

# Stage 3: Production runtime
FROM node:20-alpine AS runner
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy package files
COPY package*.json ./

# Copy production dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application files
COPY --from=builder /app ./

# Change ownership to non-root user
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 9999

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9999/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "server.js"]

