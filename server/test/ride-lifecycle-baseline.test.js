const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Rides = require("../schema/rides");
const Payments = require("../schema/payments");
const Wallet = require("../schema/wallets");
const Settlement = require("../schema/settlement");
const CallLogs = require("../schema/calllogs");

const apiRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "apiroutes", "api.js"),
  "utf8"
);
const driverApiRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "apiroutes", "driverapi.js"),
  "utf8"
);
const chatRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "apiroutes", "chat.js"),
  "utf8"
);

test("driver push notifications use Shilota Driver branding", function () {
  assert.match(apiRouteSource, /const DRIVER_NOTIFICATION_TITLE = "Shilota Driver"/);
  assert.match(apiRouteSource, /fireBaseDriver[\s\S]*?title: DRIVER_NOTIFICATION_TITLE/);
  assert.match(apiRouteSource, /fireBaseAndroidDriver[\s\S]*?title: DRIVER_NOTIFICATION_TITLE/);
  assert.match(driverApiRouteSource, /title: DRIVER_NOTIFICATION_TITLE/);
});

test("passenger profile updates and image uploads target the authenticated user", function () {
  assert.match(apiRouteSource, /router\.post\("\/uploadprofileimage"[\s\S]*?_id: user\._id/);
  assert.match(apiRouteSource, /"\/updateprofile"[\s\S]*?_id: user\._id/);
  assert.match(apiRouteSource, /\["full_name", "country_code", "phone_number"\]/);
  assert.match(apiRouteSource, /profileUser\.profile_image_updated_at = new Date\(\)/);
  assert.match(apiRouteSource, /profileUser\.profile_image !== "user\.png"/);
  assert.match(apiRouteSource, /user_image: base_url \+ "\/api\/gallery\/users\/" \+ res\.req\.file\.filename/);
  assert.doesNotMatch(apiRouteSource, /user_image: base_url \+ "\/gallery\/users\/"/);
});

test("rides schema keeps lifecycle, fare, and payment fields", function () {
  const ridePaths = Rides.schema.paths;

  [
    "ridestatus",
    "ridestatusat",
    "ride_started_at",
    "ride_completed_at",
    "ride_cancelled_at",
    "cancelled_by",
    "cancellation_reason",
    "payment_type",
    "driver_id",
    "baseprice",
    "commissionamount",
    "tax",
    "total",
    "payment_id",
    "notify"
  ].forEach(function (fieldName) {
    assert.ok(ridePaths[fieldName], `expected rides schema to include ${fieldName}`);
  });
});

test("payments, wallets, settlements, and call logs keep settlement-critical fields", function () {
  const paymentPaths = Payments.schema.paths;
  const walletPaths = Wallet.schema.paths;
  const settlementPaths = Settlement.schema.paths;
  const callLogPaths = CallLogs.schema.paths;

  ["payment_type", "ride_fare", "baseprice", "commissionamount", "tax", "driver_id", "settlement_id"].forEach(
    function (fieldName) {
      assert.ok(paymentPaths[fieldName], `expected payments schema to include ${fieldName}`);
    }
  );

  ["wallet_for", "transaction", "type", "onride_id"].forEach(function (fieldName) {
    assert.ok(walletPaths[fieldName], `expected wallets schema to include ${fieldName}`);
  });
  assert.equal(walletPaths.wallet_for.defaultValue, "user");

  ["driver_id", "total_ridefare", "total_commissionAmt", "total_tax", "total_earning", "payment_status"].forEach(
    function (fieldName) {
      assert.ok(settlementPaths[fieldName], `expected settlement schema to include ${fieldName}`);
    }
  );

  assert.ok(callLogPaths.created_at, "expected call logs schema to include created_at");
  assert.equal(callLogPaths.created_at.options.expires, 604800);
});

test("passenger routes keep request and confirm ride lifecycle branches", function () {
  assert.match(apiRouteSource, /router\.post\("\/routepath"/);
  assert.match(apiRouteSource, /router\.post\("\/ridestatus"/);
  assert.match(apiRouteSource, /ride_status: ride\.ridestatus/);
  assert.match(apiRouteSource, /getRoadRoute\(req\.body \|\| \{\}\)/);
  assert.match(driverApiRouteSource, /router\.post\('\/routepath'/);
  assert.match(apiRouteSource, /router\.post\(\s*"\/requestride"/);
  assert.match(apiRouteSource, /req\.body\.ridestatus = "scheduled"/);
  assert.match(apiRouteSource, /req\.body\.ridestatus = "requested"/);
  assert.match(apiRouteSource, /const ACTIVE_RIDE_STATUSES = \["requested", "accepted", "ontheway", "onride"\]/);
  assert.match(apiRouteSource, /async function cancelSupersededRequestedRides/);
  assert.match(apiRouteSource, /await cancelSupersededRequestedRides\(req\.body\.user_id\)/);
  assert.match(apiRouteSource, /Payments\.count\(\{ onride_id: ride\._id \}\)/);
  assert.match(apiRouteSource, /ride_request_id: String\(ride\._id\)/);
  assert.match(apiRouteSource, /status: "EXPIRED"/);
  assert.match(apiRouteSource, /attemptMatchPoolRide/);
  assert.match(apiRouteSource, /router\.post\(\s*"\/confirmride"/);
  assert.match(apiRouteSource, /router\.post\("\/activeride"/);
  assert.match(apiRouteSource, /rides\.ridestatus == "ontheway" \|\| rides\.ridestatus == "accepted" \|\| rides\.ridestatus == "onride"/);
  assert.match(apiRouteSource, /nearBy\(availdrivers, rides\._id\)/);
});

test("active ride blocker returns details for non-stale rides", function () {
  assert.match(apiRouteSource, /message: "You already have an active ride"/);
  assert.match(apiRouteSource, /error_code: "ACTIVE_RIDE_EXISTS"/);
  assert.match(apiRouteSource, /onride_id: activeRide\._id/);
  assert.match(apiRouteSource, /ridestatus: activeRide\.ridestatus/);
  assert.match(apiRouteSource, /driver_id: activeRide\.driver_id \|\| ""/);
  assert.match(apiRouteSource, /created_at: activeRide\.created_at \|\| null/);
});

test("driver routes keep accept, start, complete, and payment lifecycle branches", function () {
  assert.match(driverApiRouteSource, /router\.post\('\/goride'/);
  assert.match(driverApiRouteSource, /rides\.ridestatus = "accepted"/);
  assert.match(driverApiRouteSource, /router\.post\('\/whereiam'/);
  assert.match(driverApiRouteSource, /rides\.ridestatus = req\.body\.status/);
  assert.match(driverApiRouteSource, /ride_started_at = new Date\(\)/);
  assert.match(driverApiRouteSource, /router\.post\('\/completeride'/);
  assert.match(driverApiRouteSource, /rides\.ridestatus = "completed"/);
  assert.match(driverApiRouteSource, /applyRideCompletionFinancials\(/);
  assert.match(driverApiRouteSource, /router\.post\('\/paybycash'/);
  assert.match(driverApiRouteSource, /buildPaymentDocument\(/);
  assert.match(driverApiRouteSource, /router\.post\('\/cancelride'/);
  assert.match(driverApiRouteSource, /driver_id: String\(driver\._id\)/);
  assert.match(driverApiRouteSource, /cancelled_by: "driver"/);
});

test("ride list responses do not add tax above the tax-inclusive total", function () {
  assert.doesNotMatch(apiRouteSource, /parseFloat\(c\.baseprice\) \+ parseFloat\(taxprice\)/);
  assert.doesNotMatch(driverApiRouteSource, /parseFloat\(c\.baseprice \|\| 0\) \+ parseFloat\(taxprice \|\| 0\)/);
  assert.match(apiRouteSource, /total_price: rideTotal/);
  assert.match(driverApiRouteSource, /total_price: rideTotal/);
});

test("call routes deliver visible incoming-call notifications and socket events", function () {
  assert.match(apiRouteSource, /driverNotify\(userids, "Incoming call from "/);
  assert.match(driverApiRouteSource, /userNotific\(\[receiverId\], "Incoming call from "/);
  assert.match(driverApiRouteSource, /emitToUser\(String\(req\.body\.receiver_id\), "end-call"/);
  assert.match(chatRouteSource, /socket\.on\("ready-call"/);
  assert.match(chatRouteSource, /socket\.to\(roomId\)\.emit\("rtcmessage"/);
  assert.doesNotMatch(chatRouteSource, /adapter\.rooms\.get/);
  assert.match(apiRouteSource, /call\/ice-servers\/\:userid/);
  assert.match(driverApiRouteSource, /call\/ice-servers\/\:userid/);
});

test("Emergency Alert and Lost Items routes retain their safety safeguards", function () {
  assert.match(apiRouteSource, /title: "Rider Emergency Alert"/);
  assert.match(driverApiRouteSource, /title: "Driver Emergency Alert"/);
  assert.match(apiRouteSource, /router\.post\("\/lostitem\/report"/);
  assert.match(apiRouteSource, /ridestatus: "completed"/);
  assert.match(apiRouteSource, /type: "lost_item"/);
});
