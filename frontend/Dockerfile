# ==============================================================================
# FLEET FLOW FRONTEND DOCKERFILE (Multi-Stage Production Build)
# ==============================================================================

# Stage 1: Build production bundle
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build

# Stage 2: Serve optimized static assets via Nginx
FROM nginx:alpine AS runner

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built SPA bundle from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration supporting SPA routing and backend proxying
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# Container liveness healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
