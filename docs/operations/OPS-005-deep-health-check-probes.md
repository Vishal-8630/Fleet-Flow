# OPS-005: Deep Readiness & Liveness Probes with Dependency Connectivity

**Operational Requirement ID:** `OPS-005`  
**Title:** Deep Readiness and Liveness Probes with Downstream Dependency Connectivity  
**Category:** Container Orchestration & Monitoring  
**Priority:** `P2` (Moderate Operational Requirement)  
**Implementation Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#5-operations--production-register-ops-)

---

## 1. Operational Problem Statement
The current health check endpoint (`GET /health` in [`backend/src/server.ts`](../../backend/src/server.ts)) simply returns `{ status: 'ok', uptime: process.uptime() }`. It does not perform active ping checks against downstream dependencies (MongoDB, Redis, S3). If the database connection drops or deadlocks, the container continues to report healthy to load balancers, causing user requests to be routed to a dead container and resulting in HTTP 500 errors.

---

## 2. Target Architecture
Implement industry-standard Kubernetes / AWS ALB health probes:
1. **Liveness Probe (`GET /health/live`):**
   - Fast, lightweight probe checking if the Node.js event loop is responsive.
   - Used to restart unresponsive or hung containers.
2. **Readiness Probe (`GET /health/ready`):**
   - Verifies active connectivity to all critical downstream services:
     - MongoDB ping: `mongoose.connection.db.admin().ping()`
     - Redis ping: `redisClient.ping()`
     - Disk write capability
   - If any critical dependency is down, returns HTTP 503 Service Unavailable, signaling the load balancer to stop routing customer traffic to this container.

---

## 3. Response Format
```json
{
  "status": "ready",
  "timestamp": "2026-10-12T14:35:00.000Z",
  "checks": {
    "mongodb": { "status": "connected", "latency_ms": 4 },
    "redis": { "status": "connected", "latency_ms": 1 },
    "memory": { "heap_used_mb": 64, "heap_total_mb": 112 }
  }
}
```

---

## 4. Acceptance Criteria
- [ ] Dropping the MongoDB connection immediately causes `GET /health/ready` to return HTTP 503.
- [ ] Load balancer automatically detaches unhealthy instances during database failovers.

---

## 5. Definition of Done
1. Deep health check probes implemented and tested.
