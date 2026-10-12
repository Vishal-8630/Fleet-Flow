# OPS-001: Docker Containerization & Multi-Environment Compose Architecture

**Operational Requirement ID:** `OPS-001`  
**Title:** Standardized Docker Containerization and Multi-Environment Compose Architecture  
**Category:** Deployment & Infrastructure Engineering  
**Priority:** `P1` (High Operational Requirement)  
**Implementation Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#5-operations--production-register-ops-)

---

## 1. Operational Problem Statement
The Fleet Flow repository currently contains no `Dockerfile`, `.dockerignore`, or `docker-compose.yml`. Developer onboarding, staging test deployments, and production server provisioning require manual installation of specific Node versions, environment variables, MongoDB setups, and build tooling. This causes configuration drift ("works on my machine"), dependency version mismatches, and deployment errors.

---

## 2. Infrastructure Architecture & Scope
1. **Multi-Stage Containerization:**
   - `backend/Dockerfile`: Multi-stage build (Builder stage compiles TypeScript with `tsc`; Runtime stage runs lean Alpine Node.js 20/22 with production dependencies only).
   - `frontend/Dockerfile`: Multi-stage build (Vite build produces optimized static bundle; Nginx Alpine serves static assets with gzip/brotli and SPA fallback).
2. **Docker Compose Environments:**
   - `docker-compose.yml`: Production-like topology with Backend, Frontend, MongoDB Replica Set, and Redis.
   - `docker-compose.dev.yml`: Development topology with hot-reloading volume mounts.

---

## 3. Configuration Blueprints
### Backend Dockerfile Pattern:
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
USER node
EXPOSE 5000
CMD ["node", "dist/app.js"]
```

---

## 4. Acceptance Criteria
- [ ] Running `docker compose up --build` spins up complete working system (frontend, backend, database, redis) with zero manual host configuration.
- [ ] Production container images adhere to non-root security execution (`USER node`).
- [ ] Total production image size for backend is under 180MB; frontend Nginx image is under 40MB.

---

## 5. Definition of Done
1. Dockerfiles and Compose files created and verified.
2. Verified in clean containerized environment.
