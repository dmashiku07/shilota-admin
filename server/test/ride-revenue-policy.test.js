const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const config = require("../config");
const {
  applyRideCompletionFinancials,
  buildPaymentDocument,
  getRideFinalAmount,
  isLegacyCommissionRide,
  markRidePaymentComplete
} = require("../services/rideRevenuePolicy");

const driverApiRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "apiroutes", "driverapi.js"),
  "utf8"
);
const paymentRoutesSource = fs.readFileSync(
  path.join(__dirname, "..", "routes", "paymentRoutes.js"),
  "utf8"
);
const settlementRoutesSource = fs.readFileSync(
  path.join(__dirname, "..", "routes", "settlementRoutes.js"),
  "utf8"
);

function withCommissionFlag(value, callback) {
  const previous = config.featureFlags.commission_enabled;
  config.featureFlags.commission_enabled = value;
  try {
    callback();
  } finally {
    config.featureFlags.commission_enabled = previous;
  }
}

test("completed paid ride treats the quoted fare as tax-inclusive", function () {
  withCommissionFlag(false, function () {
    const ride = {};
    applyRideCompletionFinancials({
      ride,
      baseFare: 10000,
      taxRate: 10,
      commissionBands: [{ price_from: 0, price_to: 50000, percentage: 20 }],
      commissionEnabled: false,
      roundCustomerPayableAmount: function (value) {
        return value;
      }
    });

    markRidePaymentComplete(ride, "cash", new Date("2026-07-22T09:00:00Z"));

    const payment = buildPaymentDocument({
      ride: { ...ride, _id: "ride-1", driver_id: "driver-1" },
      userId: "user-1",
      driverId: "driver-1",
      paymentType: "cash",
      paidAt: new Date("2026-07-22T09:00:00Z"),
      roundCustomerPayableAmount: function (value) {
        return value;
      }
    });

    assert.equal(ride.commissionamount, 0);
    assert.equal(ride.baseprice, 10000);
    assert.equal(ride.tax, 1000);
    assert.equal(ride.final_ride_amount, 10000);
    assert.equal(ride.payment_status, "paid");
    assert.equal(ride.payment_direct_to_driver, 1);
    assert.equal(payment.ride_fare, 10000);
    assert.equal(payment.baseprice, 10000);
    assert.equal(payment.commissionamount, 0);
    assert.equal(payment.direct_to_driver, 1);
    assert.equal(payment.paid, 1);
  });
});

test("completed unpaid ride remains unpaid until a payment record is created", function () {
  const ride = {};
  applyRideCompletionFinancials({
    ride,
    baseFare: 12000,
    taxRate: 5,
    commissionBands: [],
    commissionEnabled: false,
    roundCustomerPayableAmount: function (value) {
      return value;
    }
  });

  assert.equal(ride.payment_status, "unpaid");
  assert.equal(ride.payment_direct_to_driver, 1);
  assert.equal(getRideFinalAmount(ride), 12000);
});

test("tax is reported without increasing what the passenger pays", function () {
  const ride = {};
  const result = applyRideCompletionFinancials({
    ride,
    baseFare: 30000,
    taxRate: 10,
    commissionBands: [],
    commissionEnabled: false,
    roundCustomerPayableAmount: function (value) {
      return value;
    }
  });

  assert.equal(result.quotedFare, 30000);
  assert.equal(result.taxAmount, 3000);
  assert.equal(result.finalRideAmount, 30000);
  assert.equal(ride.baseprice, 30000);
  assert.equal(ride.tax, 3000);
  assert.equal(getRideFinalAmount(ride), 30000);
});

test("cancelled ride branch remains protected from completion recalculation", function () {
  assert.match(driverApiRouteSource, /if \(rides\.ridestatus !== "cancelled"\)/);
});

test("historical commission ride remains recognizable and readable", function () {
  const legacyRide = {
    baseprice: 12000,
    tax: 1000,
    commissionamount: 2000
  };

  assert.equal(isLegacyCommissionRide(legacyRide), true);
  assert.equal(getRideFinalAmount(legacyRide), 13000);
});

test("duplicate ride-completion request stays idempotent", function () {
  assert.match(driverApiRouteSource, /if \(rides\.ridestatus === "completed"\)/);
  assert.match(driverApiRouteSource, /message: 'Your Ride has been marked as completed'/);
});

test("legacy settlement flows are blocked for new direct-to-driver rides", function () {
  assert.match(paymentRoutesSource, /direct_to_driver:\s*\{\s*\$ne: 1\s*\}/);
  assert.match(settlementRoutesSource, /Legacy settlement approvals are disabled while commission is turned off/);
});
