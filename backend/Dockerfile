# ==============================================================================
# FLEET FLOW BACKEND DOCKERFILE (Multi-Stage Production Build)
# ==============================================================================

# Stage 1: Build TypeScript artifacts
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: Production Runtime
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript output from builder
COPY --from=builder /app/dist ./dist

# Non-root security execution (OPS-001)
RUN chown -R node:node /app
USER node

EXPOSE 5000

# Container liveness healthcheck using alpine built-in wget
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health/live || exit 1

CMD ["node", "dist/server.js"]
