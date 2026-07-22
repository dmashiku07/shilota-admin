# Phase 11 Deployment Guide

## Order
1. Deploy backend code.
2. Run `npm run migrate:phase11:reporting-hardening:up`.
3. Restart the API process.
4. Build and deploy the Angular admin.
5. Verify `/reporting/overview` and `/reporting/audit-logs`.

## Required Environment
- Existing MongoDB connection via `MONGO_URL`
- Existing feature flags from `server/config.js`
- No new production flags are required for Phase 11

## Post-Deploy Checks
- Open `/admin/reports`
- Confirm legacy commission cards still show historical values
- Trigger an admin action such as subscription-plan activation and confirm an audit log entry appears
- Run:
  - `npm run reconcile:subscription-statuses`
  - `npm run reconcile:expired-offers`
  - `npm run reconcile:expired-broadcasts`

## Zero-Downtime Notes
- Phase 11 is additive
- Historical commission data remains untouched
- Existing ride flows do not depend on the new reporting endpoints
