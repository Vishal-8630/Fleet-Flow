# OPS-003: Automated Database Backup, Retention Policy & Disaster Recovery

**Operational Requirement ID:** `OPS-003`  
**Title:** Automated Database Backup, Retention Policy and Point-In-Time Disaster Recovery  
**Category:** Database Reliability & SRE  
**Priority:** `P1` (High Operational Requirement)  
**Implementation Status:** Proposed  
**Related Master Register Entry:** [`docs/FLEET_FLOW_MASTER_REGISTER.md`](../FLEET_FLOW_MASTER_REGISTER.md#5-operations--production-register-ops-)

---

## 1. Operational Problem Statement
Fleet Flow is a financial and operational multi-tenant transport ERP storing legally binding tax invoices, consignment bills of lading, and party ledgers. Currently, the repository has no automated database backup scripts, no scheduled snapshot cron jobs, and no documented Disaster Recovery (DR) restoration runbooks. In the event of disk corruption, accidental `dropDatabase()` execution, or ransomware attacks, all tenant business data would be permanently lost.

---

## 2. Disaster Recovery Objectives
- **Recovery Point Objective (RPO):** Maximum 1 hour (maximum acceptable data loss window).
- **Recovery Time Objective (RTO):** Maximum 2 hours (system restored and accepting traffic post-disaster).

---

## 3. Backup Strategy & Architecture
1. **Automated Continuous Backups:**
   - For managed MongoDB (MongoDB Atlas): Continuous Cloud Backups with Point-In-Time Restore (PITR) up to 7 days.
   - For self-hosted MongoDB: Automated daily `mongodump` snapshots piped to compressed gzip archives, encrypted with GPG, and uploaded to offsite AWS S3 Glacier storage with S3 Object Lock (WORM compliance).
2. **Retention Policy:**
   - Daily snapshots retained for 30 days.
   - Weekly snapshots retained for 12 weeks.
   - Monthly snapshots retained for 7 years (statutory requirement under Indian GST and Companies Act).
3. **Automated DR Restoration Drill:**
   - Monthly automated script restores the latest backup to a staging container and runs integrity checks verifying collection document counts and ledger balance sums.

---

## 4. Acceptance Criteria
- [ ] Automated backup script runs daily without manual intervention and alerts Slack/email upon failure.
- [ ] Restoration runbook step-by-step tested and verified to restore database within 45 minutes.
- [ ] Backup archives are encrypted at rest and stored across geographically separated regions.

---

## 5. Definition of Done
1. Backup script and restoration runbook documented and verified.
