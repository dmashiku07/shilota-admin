# Phase 0 Architecture Audit

## Scope

This audit covers the Shilota codebases present on July 22, 2026:

- `shilota`: Angular admin application plus the primary Node.js/Express backend
- `shilota-driver-app-android`: native Android driver application
- `shilota_flutter`: Flutter passenger application

This phase does not change the business model. It establishes a baseline for the existing ride lifecycle, money movement, and extension points needed for the subscription-marketplace refinement work.

## Repository Architecture

### `shilota`

- Frontend framework: Angular `21.2.x`
- Backend runtime: Node.js `>=22.12.0`
- HTTP server: Express `4.18.2`
- Primary data access layer: Mongoose `5.1.4`
- Additional DB dependency present: `monk 6.0.5` is installed, but the current backend patterns are Mongoose-centric
- Realtime: Socket.IO `2.1.1`
- Push notifications:
  - Firebase Admin `13.8.0` in `server/services/pushService.js`
  - legacy APNs/manual push helpers still exist in `server/apiroutes/api.js`
- Payments:
  - Braintree `2.9.0`
  - Selcom via `selcom-apigw-client`
- Auth:
  - Passport JWT in `server/passport.js`
  - separate driver JWT handling in `server/driverpassport.js`

Backend entry point:

- `app.js`

Main backend route groups mounted from `app.js`:

- Public/passenger APIs: `/api`
- Driver APIs: `/driverapi`
- Chat/signalling: `/chat`
- Admin resource APIs:
  - `/admin`
  - `/page`
  - `/home`
  - `/banner`
  - `/faqroutes`
  - `/bodytype`
  - `/amenities`
  - `/category`
  - `/user`
  - `/driverRoutes`
  - `/vehicleRoutes`
  - `/rides`
  - `/tax`
  - `/payment`
  - `/settlement`
  - `/safety`
  - `/cets`

### `shilota-driver-app-android`

- Framework: native Android app
- Build system: Gradle / Android plugin
- Language mix: Java + Kotlin plugin enabled
- Networking: Retrofit `2.9.0` + Gson
- Realtime: `io.socket:socket.io-client:1.0.0`
- Maps/location:
  - Google Maps / Places SDK
  - Play Services Location
- Push:
  - Firebase Messaging `23.1.0`

Key client config:

- Base URL: `https://shilota.tz/`
- Socket URL: `https://shilota.tz/`
- AppRTC URL: `https://shilota.tz`

### `shilota_flutter`

- Framework: Flutter
- Dart SDK constraint: `^3.5.3`
- State management: `flutter_riverpod 2.6.1`
- Navigation: `go_router 14.8.1`
- Networking: `dio 5.7.0`
- Maps/location:
  - `google_maps_flutter 2.10.1`
  - `geocoding 3.0.0`
  - `geolocator 13.0.4`
- Realtime:
  - `socket_io_client 3.0.2`
  - `flutter_webrtc` via vendored path dependency
- Notifications:
  - `flutter_local_notifications 17.2.3`
  - `timezone 0.9.4`

Key client config:

- Base URL: `http://shilota.tz/`
- Socket URL: `http://shilota.tz/`
- AppRTC URL: `http://shilota.tz`

## Backend Location

Primary backend:

- `shilota/app.js`
- `shilota/server/**`

There is no separate backend repository in the current workspace. The backend is embedded in `shilota`.

## Database Technology

- Database: MongoDB
- Confirmed runtime default:
  - `mongodb://127.0.0.1:27017/shilota_db` in local config defaults
  - Docker Compose uses MongoDB 7 and points the app to `shilota_db`
- Data layer: Mongoose schemas under `shilota/server/schema`

No migration framework was found in the current workspace. The codebase currently relies on schema evolution at the application layer rather than explicit database migrations.

## Authentication Mechanism

- Passenger/admin-side JWT auth uses Passport JWT in `server/passport.js`
- Driver JWT auth uses `server/driverpassport.js`
- Tokens are read from `Authorization` headers using the `jwt`/`JWT` auth scheme depending on route group
- Password hashing uses `bcrypt-nodejs` in the `User` and `Driver` schemas

## Payment Integration

- Passenger wallet top-up:
  - Braintree via `/api/addmoney`
  - Selcom via `/api/getselcomurl`, `/api/verifyselcom/:transid`, `/api/paybyselcom`
- Passenger ride payment:
  - cash / wallet hybrid / Selcom
  - key passenger route: `/api/paybycash`
- Driver wallet top-up:
  - Braintree via `/driverapi/addmoney`
  - Selcom via `/driverapi/getselcomurl`, `/driverapi/verifyselcom/:transid`, `/driverapi/paybyselcom`
- Driver settlement/admin payment views:
  - Angular admin consumes `/payment` and `/settlement`

## Notification Mechanism

- Push:
  - Firebase Admin multicast service in `server/services/pushService.js`
  - legacy notification helpers in route files
- Device registration:
  - Passenger: `/api/pushsignin`, `/api/pushsignout`
  - Driver: `/driverapi/pushsignin`, `/driverapi/pushsignout`
- Realtime/socket:
  - user-specific socket registry in `server/socketRegistry.js`
  - signalling and chat events in `server/apiroutes/chat.js`
  - ride chat and call notification emits in `/api` and `/driverapi`

## Ride Status Model

Observed ride statuses in the backend:

- `requested`
- `scheduled`
- `accepted`
- `ontheway`
- `onride`
- `completed`
- `cancelled`
- `ridenotaccepted`
- `scheduleridenotaccepted`
- pooling-related state stored separately in `pool_status`

Observed pool status values:

- `solo`
- `pool_requested`
- matched/group states are stored in `pool_status`, `pool_group_id`, `pool_group_size`, `matched_pool_ride_ids`

## Existing Tests

### `shilota`

- Angular unit tests via Karma/Jasmine
- Protractor e2e configuration still present
- New Phase 0 backend baseline tests added in:
  - `server/test/feature-flags.test.js`
  - `server/test/ride-lifecycle-baseline.test.js`

### `shilota_flutter`

- Default Flutter widget test exists in `test/widget_test.dart`

### `shilota-driver-app-android`

- JUnit and Android instrumentation dependencies are configured
- No substantial automated business-flow coverage was identified during this audit

## Existing Commission, Wallet, and Settlement Implementation

### Commission

- Commission bands are stored in `Commissions` (`server/schema/commissions.js`)
- Angular admin manages them through `/tax`
- Fare quoting path:
  - `/api/grabrides`
  - computes `fareamount`
  - finds a matching commission band
  - adds commission to build the rider-facing `baseprice`
- Ride completion path:
  - `/driverapi/completeride`
  - recalculates final base fare from distance
  - computes tax and commission
  - stores:
    - `rides.total` as the pre-commission base fare
    - `rides.baseprice` as base fare plus commission
    - `rides.commissionamount`
    - `rides.tax`

### Wallets

- User wallet stored on `User.walletmoney`
- Driver wallet stored on `Driver.walletmoney`
- Ledger collection: `Wallet`
- Key wallet transaction types:
  - `addmoney`
  - `payride`
- Wallet ownership distinguished by `wallet_for`
  - default `"user"`
  - driver routes explicitly use `"driver"`

### Settlements

- Settlement collection: `settlement`
- Key fields:
  - `driver_id`
  - `total_ridefare`
  - `total_commissionAmt`
  - `total_tax`
  - `total_earning`
  - `payment_type`
  - `ride_count`
  - `payment_status`
- Admin settlement UI uses `/settlement`
- Driver reports aggregate completed rides and settlement totals in `/driverapi/dashboard`-related flows

## End-to-End Ride Lifecycle

### 1. Passenger creates request

Passenger apps call:

- Flutter:
  - `POST /api/requestride`
  - optional quote fetch via `POST /api/grabrides`
- Web client/admin-side client pages also rely on `/api/*` routes

Backend behavior in `/api/requestride`:

- validates rider identity and ride payload
- normalizes:
  - `service_type`
  - `ride_stops`
  - `pooling_opt_in`
  - `seats_requested`
  - `delivery_details`
- assigns `onride_otp`
- sets:
  - `ridestatus = "scheduled"` for scheduled rides
  - `ridestatus = "requested"` for immediate rides
- blocks a second active ride unless the earlier one already has a payment record
- persists the ride in `Rides`
- attempts pool matching before save

Primary data touched:

- `Rides`
- `Payments` only for active-ride conflict resolution
- `Driver` if a stale paid active ride needs to be force-closed

### 2. Driver receives request

Driver notification fanout begins from `/api/confirmride` when a ride is still searching:

- loads nearby approved live drivers with geo query
- filters by:
  - service type support
  - acceptance settings
  - rider block rules
- triggers `nearBy(...)`

`nearBy(...)` sends push payloads containing:

- `ride_id`
- pickup/drop details
- `category_id`
- `service_type`
- `ride_stops`
- `onride_otp`
- quoted `approx_price`

Primary data touched:

- `Driver`
- `Driverdevices`
- `Rides.notify`

### 3. Driver accepts

Driver app calls:

- `POST /driverapi/goride`

Backend behavior:

- verifies the ride is still in an acquirable state:
  - `requested`
  - `scheduled`
  - `ridenotaccepted`
  - `scheduleridenotaccepted`
- validates that the driver can still accept it
- sets:
  - `ridestatus = "accepted"`
  - `driver_id`
  - `vehicle_no`
- moves `Driver.live_status` to `"2"`
- notifies the passenger

Primary data touched:

- `Rides`
- `Vehicles`
- `Driver`
- `NotifyDevices`

### 4. Driver arrives

Driver app calls:

- `POST /driverapi/whereiam` with `status = "ontheway"`

Backend behavior:

- updates:
  - `ridestatus = "ontheway"`
  - `ridestatusat`
- sets driver `live_status = "2"`
- notifies passenger that the driver is arriving

Primary data touched:

- `Rides`
- `Driver`
- `NotifyDevices`

### 5. Ride starts

Driver app calls:

- `POST /driverapi/whereiam` with `status = "onride"` and OTP

Backend behavior:

- validates `onride_otp`
- updates:
  - `ridestatus = "onride"`
  - `ridestatusat`
  - `ride_started_at`
- cancels any other active `ontheway`/`onride` records for the same driver
- notifies the passenger

Primary data touched:

- `Rides`
- `Driver`

### 6. Ride completes

Driver app calls:

- `POST /driverapi/completeride`

Backend behavior:

- sets:
  - `ridestatus = "completed"`
  - `ridestatusat`
  - `ride_completed_at`
  - `ridedistance`
- recalculates final fare from actual distance
- resets driver availability to `live_status = "1"`
- clears other active rides for the same rider
- computes and persists final financial fields
- emits ride-completed notifications

Primary data touched:

- `Rides`
- `Driver`
- `Commissions`
- `Admin`
- CeTS sync queue

### 7. Fare is calculated

Quote-time calculation:

- `totalFare(category, distance, maxDistance)` in `api.js`
- `/api/grabrides`:
  - base fare from category base/unit price + distance
  - commission band lookup via `Commissions`
  - rounded rider payable amount via `roundCustomerPayableAmount`

Completion-time calculation:

- `/driverapi/completeride`
  - recomputes `rides.total` as pre-commission base fare
  - computes `rides.commissionamount`
  - computes `rides.tax`
  - stores `rides.baseprice` as base fare plus commission

### 8. Passenger pays

Payment routes:

- Passenger:
  - `POST /api/paybycash`
  - `POST /api/paybyselcom`
- Driver-initiated cash collection completion:
  - `POST /driverapi/paybycash`

Backend behavior:

- prevents duplicate payment creation by checking existing `Payments`
- records a payment ledger row in `Payments`
- optionally debits rider wallet via `Wallet` + `User.walletmoney`
- sends payment-completed notifications

### 9. Commission is deducted

Commission is not stored as a separate negative driver ledger transaction at completion time. Current behavior is:

- commission is computed into `rides.commissionamount`
- payment records persist `commissionamount`
- reporting/settlement aggregates sum commission later

This is important for future phases:

- current commission behavior is accounting/reporting-oriented
- there is no separate explicit driver-wallet commission debit in the current standard completion path

### 10. Driver wallet or settlement is updated

Current split:

- Driver wallet:
  - top-ups via `/driverapi/addmoney` and Selcom driver wallet routes
  - not automatically credited from completed rides in the inspected completion route
- Settlement:
  - admin settlement records aggregate completed ride earnings/commission/tax
  - reporting queries sum `Payments` and `settlement` data

This means the current operating model appears to be:

- ride payment is recorded in `Payments`
- commission/platform share is inferred from payment and ride fields
- settlement is performed/administered later rather than instantly moving net earnings into `Driver.walletmoney`

## Database Dependencies

Core collections involved in the lifecycle:

- `Rides`
- `Driver`
- `User`
- `Vehicles`
- `Payments`
- `Wallet`
- `settlement`
- `Commissions`
- `Categories`
- `Driverdevices`
- `Userdevices`
- `Notification`
- `Reviews`
- `PoolSettings`
- `RiderBlocks`
- `CallLogs`
- `RideChatMessages`
- `SelcomPaymentSession`

### Key ride lifecycle fields

#### `Rides`

- identity/linkage:
  - `_id`
  - `user_id`
  - `driver_id`
  - `category_id`
  - `payment_id`
  - `review_id`
- request/dispatch:
  - `type`
  - `payment_type`
  - `service_type`
  - `pickup_location`
  - `pickup_lat`
  - `pickup_lng`
  - `drop_location`
  - `drop_lat`
  - `drop_lng`
  - `ride_stops`
  - `notify`
- lifecycle:
  - `ridestatus`
  - `ridestatusat`
  - `ride_started_at`
  - `ride_completed_at`
  - `onride_otp`
- schedule:
  - `schedule_time`
  - `schedule_utc_time`
  - `schedule_dispatched_at`
  - `schedule_reminder_notify`
  - `schedule_reassign_count`
- pooling:
  - `pooling_opt_in`
  - `seats_requested`
  - `pool_status`
  - `pool_group_id`
  - `pool_group_size`
  - `pool_discount_percent`
  - `pool_zone_key`
  - `matched_pool_ride_ids`
- money:
  - `baseprice`
  - `total`
  - `commissionamount`
  - `tax`
  - `ridedistance`

#### `Payments`

- `user_id`
- `driver_id`
- `onride_id`
- `payment_type`
- `ride_fare`
- `transaction_id`
- `baseprice`
- `tax`
- `commissionamount`
- `settlement_id`
- `paidbywallet`
- `paid`

#### `Wallet`

- `user_id`
- `wallet_for`
- `amount`
- `type`
- `transaction`
- `transaction_id`
- `onride_id`

#### `settlement`

- `driver_id`
- `total_ridefare`
- `total_commissionAmt`
- `total_tax`
- `total_earning`
- `payment_type`
- `ride_count`
- `payment_status`

#### `Driver`

- `_id`
- `walletmoney`
- `live_status`
- `approval`
- `category_id`
- `service_types`
- `acceptance_settings`
- `loc`
- `instant_lat`
- `instant_lng`
- `instant_location`

#### `User`

- `_id`
- `walletmoney`
- `phone_verified`
- `deletion_status`
- `emergency_contact`

## APIs Used by Each Application

### Flutter passenger app

Observed repositories call:

- Auth:
  - `POST /api/signup`
  - `POST /api/getotp`
  - `POST /api/signIn`
  - `POST /api/pushsignin`
- Account/profile:
  - `GET /api/profile/:userId`
  - `GET /api/admindatas`
  - `GET /api/notifications/:userId`
  - `GET /api/helppages`
  - `GET /api/wallethistory/:userId`
  - `POST /api/updateprofile`
  - `POST /api/contactus`
  - `POST /api/deleteaccount`
- Places/history/reviews:
  - `POST /api/savedplaces`
  - `POST /api/saveplace`
  - `POST /api/ridehistory`
  - `POST /api/ridedetails`
  - `POST /api/completeridedetails`
  - `POST /api/review`
- Rides:
  - `POST /api/grabrides`
  - `GET /api/poolsettings`
  - `POST /api/requestride`
  - `POST /api/updatescheduledride`
  - `POST /api/confirmride`
  - `POST /api/cancelride`
- Safety/comms:
  - `POST /api/sosalert`
  - `POST /api/makecall`
  - `POST /api/endcall`
  - `GET /api/ridechat/:onride_id/messages`
  - `POST /api/ridechat/:onride_id/message`
- Lost items:
  - `POST /api/lostitem/report`
  - `GET /api/lostitem/messages/:lostItemId`
  - `POST /api/lostitem/message`
  - `GET /api/lostitem/ride/:rideId`
  - `GET /api/lostitem/:lostItemId`
  - `POST /api/lostitem/:lostItemId/escalate`
  - `POST /api/lostitem/:lostItemId/confirmreturn`
- Rider block visibility:
  - `GET /api/riderblockstatus/:userId`

Realtime channels used by Flutter:

- socket events:
  - `register-user`
  - `incoming-call`
  - `incoming-chat`
  - `end-call`
  - `join-call`
  - `ready-call`
  - `rtcmessage`
  - `bye`

### Driver Android app

Observed Retrofit interface uses:

- `GET /driverapi/admindatas`
- `POST /driverapi/signup`
- `POST /driverapi/getotp`
- `POST /driverapi/resetpasswordbyotp`
- `POST /driverapi/signin`
- `POST /api/getotp`
- `POST /driverapi/uploaddoc`
- `POST /driverapi/postvehicledetails`
- `GET /driverapi/profile/:userid`
- `POST /driverapi/changepassword`
- `POST /driverapi/liveme`
- `POST /driverapi/uploadprofileimage`
- `POST /driverapi/updateprofile`
- `POST /driverapi/paymentinfo`
- `POST /driverapi/goride`
- `GET /driverapi/paymentinfo/:userid`
- `GET /driverapi/getvehicledetails/:userid`
- `GET /driverapi/dashboard/:userid`
- `GET /driverapi/helppages`
- `POST /driverapi/whereiam`
- `POST /driverapi/completeride`
- `POST /driverapi/pushsignin`
- `DELETE /driverapi/pushsignout`
- `POST /driverapi/contactus`
- `POST /driverapi/addmoney`
- `GET /driverapi/wallethistory/:user_id`
- `POST /driverapi/ridehistory`
- `POST /driverapi/ridedetails`
- `POST /driverapi/sosalert`
- `POST /driverapi/blockrider`
- `GET /driverapi/acceptancesettings/:userid`
- `POST /driverapi/acceptancesettings`
- `GET /driverapi/notifications/:user_id`
- `GET /driverapi/lostitems/:user_id`
- `POST /driverapi/lostitems/:lost_item_id/status`
- `GET /driverapi/lostitems/:lost_item_id/messages`
- `POST /driverapi/lostitems/:lost_item_id/messages`
- `GET /safety/demandheatmap?hours=24`
- `GET /driverapi/scheduledupcoming/:user_id`
- `POST /driverapi/preacceptschedule`
- `POST /driverapi/completeridedetails`
- `POST /driverapi/paybycash`
- `POST /driverapi/makecall`
- `POST /driverapi/endcall`
- `POST /driverapi/deleteaccount`
- `POST /driverapi/getselcomurl`
- `POST /driverapi/paybyselcom`
- `GET /driverapi/verifyselcom/:transid`

Realtime channels used by driver app:

- `rtcmessage`
- `bye`
- App-level ride-location socket maintained against `Constants.SOCKET_URL`

### Angular admin app

Observed Angular service wrappers target:

- `/admin`
- `/page`
- `/home`
- `/banner`
- `/faqroutes`
- `/bodytype`
- `/amenities`
- `/category`
- `/user`
- `/driverRoutes`
- `/vehicleRoutes`
- `/rides`
- `/tax`
- `/payment`
- `/settlement`
- `/safety`

Admin services especially relevant to this refinement:

- `src/app/service/commissions.service.ts`
  - `/tax`
- `src/app/service/payment.service.ts`
  - `/payment`
- `src/app/service/settlement.service.ts`
  - `/settlement`
- `src/app/service/rides.service.ts`
  - `/rides`
- `src/app/service/driver.service.ts`
  - `/driverRoutes`
- `src/app/service/user.service.ts`
  - `/user`

## Payment Flow

### Passenger cash / wallet flow

1. Driver completes ride via `/driverapi/completeride`
2. Final ride totals are persisted on `Rides`
3. Passenger or driver submits payment via `/api/paybycash` or `/driverapi/paybycash`
4. `Payments` row is created if one does not already exist
5. If wallet contribution is used:
   - `Wallet` debit row is created
   - `User.walletmoney` is decremented
6. Notifications are sent to passenger and driver

### Passenger Selcom flow

1. App requests hosted checkout via `/api/getselcomurl`
2. `SelcomPaymentSession` is created in pending state
3. Redirect/webhook or polling verifies the payment
4. `/api/paybyselcom` finalizes:
   - wallet top-up, or
   - ride payment record plus optional wallet debit

### Driver wallet top-up flow

1. Driver app uses Braintree or Selcom driver endpoints
2. `Wallet` ledger row is created with `wallet_for = "driver"`
3. `Driver.walletmoney` is incremented

## Risk Areas

1. Fare logic is duplicated and route-local.
   - Quote-time and completion-time calculations live in route handlers instead of a shared pricing domain module.

2. Commission is embedded into ride/payment records, but not represented as a separate explicit driver deduction event.
   - Future subscription or zero-commission work must preserve historical reporting.

3. Active-ride cleanup can force-complete or cancel stale rides.
   - `/api/requestride` and `/driverapi/whereiam` both contain cleanup logic that can affect historical consistency.

4. JWT auth schemes are inconsistent between route groups.
   - `jwt` vs `JWT` header scheme differences can complicate shared middleware changes.

5. Push and realtime logic is partly duplicated.
   - modern Firebase Admin service exists, but route files still contain older notification helpers.

6. There is no formal migration framework in place.
   - any future schema changes need an explicit migration strategy before rollout.

7. Settlement appears admin-driven rather than event-sourced.
   - driver earnings state is derived from aggregates, which raises reconciliation risk during business-model changes.

8. Driver app still contains a placeholder Google Directions API key constant in `MapsActivity`.
   - unrelated to this phase, but operationally risky.

## Proposed Migration Order

This is the safe backend-first order for later phases:

1. Introduce feature-flagged shared pricing and settlement helpers without changing outputs.
2. Add explicit reporting snapshots for historical ride, payment, and commission totals.
3. Add subscription/domain collections and read paths behind disabled flags.
4. Add server-side validation for subscription/pricing rules while flags remain off.
5. Roll out admin configuration surfaces.
6. Roll out driver app read-only surfaces.
7. Enable write paths behind per-feature flags in staging.
8. Backfill analytics/reporting if new ledger or summary documents are introduced.
9. Enable features incrementally in production.

## Feature-Flag Placeholders Added In Phase 0

Default values preserve current behavior:

- `commission_enabled = true`
- `driver_subscriptions_enabled = false`
- `driver_pricing_enabled = false`
- `passenger_price_broadcast_enabled = false`
- `driver_destination_broadcast_enabled = false`

Locations added:

- backend config: `server/config.js`
- admin runtime config generation:
  - `scripts/write-runtime-config.js`
  - `src/assets/runtime-config.example.js`
  - `src/environments/environment.ts`
  - `src/environments/environment.prod.ts`
- Flutter placeholder config:
  - `shilota_flutter/lib/src/core/config/app_config.dart`
- Driver Android placeholder constants:
  - `shilota-driver-app-android/app/src/main/java/com/driver/utils/Constants.java`

## Test Commands

Backend baseline tests:

```bash
cd /Users/goodluckwile/Documents/PERSONAL/Code/shilota_project/shilota
npm run test:backend
```

Existing Angular checks:

```bash
cd /Users/goodluckwile/Documents/PERSONAL/Code/shilota_project/shilota
npm run lint
npm test -- --watch=false
```

Flutter static analysis:

```bash
cd /Users/goodluckwile/Documents/PERSONAL/Code/shilota_project/shilota_flutter
flutter analyze
```

## Phase 0 Notes

- No business rules were changed in this phase.
- No database schema migrations were added because this phase only introduced configuration placeholders and baseline tests.
- The new backend tests are intentionally lightweight and non-invasive; they protect the presence of lifecycle-critical fields and route branches before deeper refactors begin.
