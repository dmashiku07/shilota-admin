# Shilota staging UAT test matrix

Run against Railway staging only. Use distinct staging test accounts and record the account identifiers, timestamp, result, and evidence link or screenshot for every case. Do not use production accounts, credentials, or payment details.

| ID | Actor and setup | Action | Expected result | Evidence |
| --- | --- | --- | --- | --- |
| ADM-01 | Super Admin | Create/update a local area | Only 1 km, 2 km, and 3 km choices are saved | API response and admin screen |
| ADM-02 | Super Admin + Ops Admin + assigned driver | Assign the driver to Ops Admin, then update that driver’s documents, package, and radius as Ops Admin | Allowed for assigned driver | Admin audit entry |
| ADM-03 | Ops Admin + unassigned driver | Attempt the same changes for an unassigned driver and attempt admin management | Denied; no data changes | Denial response and before/after record |
| ADM-04 | Super Admin | Attempt the reserved staff controls | Allowed | Admin audit entry |
| DRV-01 | Approved driver with an active 10-ride/7-day package | View a request, accept, start, complete | One credit is consumed only after completion | Subscription before/after and ride record |
| DRV-02 | Driver with zero package balance | View a request, then accept it | Request remains visible; acceptance is blocked | Driver screen and API error code |
| DRV-03 | Driver with pending admin grant | Attempt acceptance | Blocked; a pending grant is not access | API error code |
| PAX-01 | Passenger with paid fare-offer entitlement + eligible driver | Request using passenger price; driver accepts exact amount | First exact acceptance assigns the ride; no counteroffer/renegotiation | Ride/offer records and both app screens |
| PAX-02 | Passenger without entitlement + two eligible drivers | Request a ride; drivers submit quotes; passenger chooses one | Passenger sees quotes and selects one; no direct passenger price broadcast | Ride/offer records and both app screens |
| PAX-03 | Passenger | Try accepting another passenger’s offer or changing price after acceptance | Denied; accepted price is unchanged | API denial and ride record |
| RAD-01 | Drivers in same local area at 1 km, 2 km, 3 km, and outside selected radius | Dispatch a request at controlled distances | Matching includes only drivers within each selected active radius; legacy driver defaults to 1 km | Dispatch logs/API responses |
| OTP-01 | Accepted ride and driver | Begin ride with valid 4-digit trip OTP inside five minutes | Status changes from `ontheway` to `onride` | Ride record and app screen |
| OTP-02 | Accepted ride and driver | Enter an invalid OTP three times | Terminal failure; passenger must create a new request | API responses and ride record |
| OTP-03 | Accepted ride and driver | Attempt OTP resend for the same trip | No resend is available | API response |
| LIFE-01 | Accepted driver ride | Attempt completion before `onride`; then run `accepted → ontheway → onride → completed` | Early completion denied; ordered lifecycle succeeds | API responses and ride timestamps |
| LIFE-02 | Passenger with requested/accepted/ontheway/onride rides | Cancel at each state | Requested, accepted, and on-the-way can cancel; on-ride cannot | API responses and final status |
| MAIL-01 | New driver, Super Admin/Ops Admin, Mailtrap configured | Admin approves driver | Account remains pending; Mailtrap Sandbox receives a 4-digit code | Mailtrap message and driver record |
| MAIL-02 | Pending driver | Verify correct code within 10 minutes | Driver becomes active | API response and driver record |
| MAIL-03 | Pending driver | Enter wrong code three times; separately request resends | Verification stops after third wrong attempt; only user-initiated resend, maximum three | API responses and activation record |
| HEALTH-01 | UAT operator | Request `/healthz` | HTTP 200 with JSON `{"status":"ok"}` | Timestamped response |

## Exit criteria

- Every applicable row passes with recorded evidence.
- Railway serves the intended `dev` revision and `/healthz` returns JSON readiness.
- Driver and Passenger debug APKs install on representative UAT devices and complete their assigned cases.
- Mail cases remain blocked until the Railway SMTP variables are configured; do not mark them passed from source checks alone.
