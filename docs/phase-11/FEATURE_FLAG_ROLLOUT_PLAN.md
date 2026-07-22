# Phase 11 Feature-Flag Rollout Plan

## Production Defaults
- `commission_enabled`: preserve current configured behavior
- `driver_subscriptions_enabled`: preserve current configured behavior
- `driver_pricing_enabled`: preserve current configured behavior
- `passenger_price_broadcast_enabled`: preserve current configured behavior
- `driver_destination_broadcast_enabled`: preserve current configured behavior

## Phase 11 Impact
- Phase 11 does not require enabling any new flag
- Reporting and reconciliation operate on existing data
- Legacy commission data stays read-only

## Recommended Rollout
1. Deploy backend and admin.
2. Verify reports in staging.
3. Run reconciliation commands in staging.
4. Deploy to production.
5. Run reconciliation commands in production during a low-traffic window.
