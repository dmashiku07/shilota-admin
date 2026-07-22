# Phase 11 Migration Guide

## Added Migration
- `scripts/migrations/phase-11-reporting-hardening-up.js`
- `scripts/migrations/phase-11-reporting-hardening-down.js`

## Migration Purpose
- Create audit-log indexes
- Create reporting helper indexes for subscriptions, ride offers, and destination broadcasts

## Commands
```bash
npm run migrate:phase11:reporting-hardening:up
npm run migrate:phase11:reporting-hardening:down
```

## Rollback Scope
- Removes the indexes added by the Phase 11 migration
- Does not delete historical business records
