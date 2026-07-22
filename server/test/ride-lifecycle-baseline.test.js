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

test("rides schema keeps lifecycle, fare, and payment fields", function () {
  const ridePaths = Rides.schema.paths;

  [
    "ridestatus",
    "ridestatusat",
    "ride_started_at",
    "ride_completed_at",
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
  assert.match(apiRouteSource, /router\.post\(\s*"\/requestride"/);
  assert.match(apiRouteSource, /req\.body\.ridestatus = "scheduled"/);
  assert.match(apiRouteSource, /req\.body\.ridestatus = "requested"/);
  assert.match(apiRouteSource, /attemptMatchPoolRide/);
  assert.match(apiRouteSource, /router\.post\(\s*"\/confirmride"/);
  assert.match(apiRouteSource, /rides\.ridestatus == "ontheway" \|\| rides\.ridestatus == "accepted" \|\| rides\.ridestatus == "onride"/);
  assert.match(apiRouteSource, /nearBy\(availdrivers, rides\._id\)/);
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
});
