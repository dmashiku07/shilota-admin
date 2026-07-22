# Phase 11 Rollback Guide

## Code Rollback
1. Re-deploy the previous backend release.
2. Re-deploy the previous Angular admin build.

## Database Rollback
- Run `npm run migrate:phase11:reporting-hardening:down` to remove Phase 11 reporting indexes.
- The `auditlogs` collection may be retained safely as historical operational data.
- No historical commission, ride, payment, subscription, or broadcast records are dropped in Phase 11.

## Operational Rollback
- Stop using `/admin/reports`
- Stop running the reconciliation commands added in Phase 11

## Safe Persistence
- Audit logs are append-only and safe to keep during rollback
- Legacy commission reports remain available through the pre-existing admin routes
