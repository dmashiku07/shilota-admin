# Phase 11 Manual QA Checklist

## Reporting
- Open `/admin/reports`
- Confirm driver subscription revenue loads
- Confirm passenger subscription revenue loads
- Confirm driver broadcast revenue loads
- Confirm legacy commission revenue still appears
- Confirm subscription-by-plan table renders
- Confirm completed-rides-by-plan table renders
- Confirm drivers-at-limit table renders or shows the empty state

## Audit Logs
- Create a subscription plan
- Edit a subscription plan
- Deactivate a subscription plan
- Update destination broadcast settings
- Update pool settings
- Confirm each action appears in recent audit logs

## Legacy Commission Read-Only
- Open legacy settlement history
- Confirm historical data is still visible
- Confirm obsolete commission controls are no longer in the active payment navigation when `commission_enabled` is false

## Reconciliation
- Run each `reconcile:*` command
- Confirm each command exits successfully
- Confirm `/admin/reports` still loads after reconciliation
