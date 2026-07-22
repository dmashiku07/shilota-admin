# Phase 11 API Documentation

## New Endpoints

### `GET /reporting/overview`
Returns consolidated reporting data:
- subscription revenue
- broadcast revenue
- legacy commission revenue
- subscription counts
- subscriptions by plan
- completed rides by driver plan
- drivers at daily limits
- offer statistics
- broadcast statistics

Response shape:
```json
{
  "status": "true",
  "data": {
    "generated_at": "2026-07-22T12:00:00.000Z",
    "business_date": "2026-07-22",
    "revenue": {},
    "subscriptions": {},
    "subscriptions_by_plan": [],
    "completed_rides_by_driver_plan": [],
    "drivers_at_daily_limits": [],
    "normal_ride_offers": {},
    "passenger_price_broadcasts": {},
    "driver_destination_broadcasts": {}
  }
}
```

### `GET /reporting/audit-logs?limit=20`
Returns recent audit log records for plan changes, subscription status changes, and manual admin actions.

## Existing Endpoints With New Audit Logging
- `POST /subscription-plans`
- `PUT /subscription-plans/:id`
- `POST /subscription-plans/:id/activate`
- `POST /subscription-plans/:id/deactivate`
- `POST /subscription-plans/reorder`
- `DELETE /subscription-plans/:id`
- `POST /driverRoutes/active/:id`
- `POST /driverRoutes/deactive/:id`
- `POST /safety/sosalerts/:id/resolve`
- `POST /safety/lostitems/:id/resolve`
- `POST /safety/calllogs/:id/review`
- `POST /safety/poolsettings`
- `POST /safety/pricebroadcastsettings`
- `POST /safety/destinationbroadcastsettings`

## Reconciliation Commands
- `npm run reconcile:subscription-statuses`
- `npm run reconcile:daily-ride-usage`
- `npm run reconcile:pending-payments`
- `npm run reconcile:expired-offers`
- `npm run reconcile:expired-broadcasts`
