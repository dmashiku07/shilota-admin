# Shilota Feature Parity Plan

This document tracks what is required for the rider Flutter app, backend, admin, and driver app to be considered fully complete for the currently requested feature set.

## Scope

- SOS
- Masked call/chat
- Delivery mode
- Pooling
- Scheduled ride reminders
- Scheduled ride modify flow
- Multi-stop reorder
- Lost item follow-up chat
- Home-screen widget shortcuts

## Completion Rule

A feature is only done when all of the following are true:

- Rider Flutter flow works
- Backend request/response and persistence work
- Driver app supports the corresponding flow where applicable
- Admin can monitor or manage the case where applicable
- Native or realtime dependencies are wired where needed
- The data survives a real database round-trip

## Current Audit Findings

### Backend gaps found

1. `Rides` API logic already uses these fields, but the schema did not define them:
   - `service_type`
   - `ride_stops`
   - `pooling_opt_in`
   - `seats_requested`
   - `pool_status`
   - `schedule_reminder_notify`
   - `schedule_reassign_count`

2. Driver capability logic already uses these fields, but the schemas did not define them:
   - `Driver.service_types`
   - `Driver.acceptance_settings`
   - `Vehicles.service_types`

3. Scheduled reminder and redispatch cron logic exists in the rider API, but it depends on the missing ride persistence fields above.

4. SOS admin monitoring exists:
   - backend route: `server/routes/safetyRoutes.js`
   - admin views: `src/app/views/admin/safety/*`

5. Lost item reporting exists and includes escalation fields, but follow-up conversation is not yet a dedicated threaded backend chat system.

6. Rider/driver audio call support exists in the legacy Android apps through push + socket/WebRTC, but Flutter does not yet implement that realtime stack.

## Work Order

### Phase 1

- Fix backend persistence for ride mode, pooling, stops, reminders, and driver service capability.
- Verify reminder cron and driver matching now operate on persisted data.

### Phase 2

- Add a scheduled ride modify endpoint or explicit server-backed reschedule flow.
- Add a real backend conversation model for lost item follow-up.
- Decide whether masked chat is support-routed or true rider/driver chat.

### Phase 3

- Port or rebuild realtime masked call/chat for Flutter if true parity is required.
- Wire any missing driver/admin screens that consume the new backend fields.

### Phase 4

- Regression pass across rider Flutter, backend, admin, and driver Android.

## Started

The first backend persistence patch has been started by adding the missing schema fields used by the current APIs and schedulers.
