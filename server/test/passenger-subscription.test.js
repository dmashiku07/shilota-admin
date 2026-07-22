const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Subscription = require("../schema/subscriptions");
const service = require("../services/passengerSubscriptionService");

const apiRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "apiroutes", "api.js"),
  "utf8"
);

test("deactivated passenger plan purchase attempt is rejected", function () {
  assert.equal(
    service.validatePassengerPlanForPurchase({
      customer_type: "PASSENGER",
      is_active: false
    }),
    "Subscription plan is not active"
  );
});

test("successful passenger payment activates subscription and stores feature snapshots", async function () {
  const subscription = {
    duration_unit_snapshot: "MONTH",
    duration_value_snapshot: 1,
    payment_status: "PENDING",
    status: "PENDING_PAYMENT",
    payment_reference: "",
    plan_features_snapshot: [
      { feature_code: "CAN_SET_RIDE_PRICE", feature_value: true }
    ],
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
      return this;
    }
  };

  const now = new Date("2026-07-22T08:00:00.000Z");
  const result = await service.activatePassengerSubscriptionPayment({
    subscription,
    paymentReference: "PASS-TXN-1",
    now
  });

  assert.equal(result.activated, true);
  assert.equal(subscription.status, "ACTIVE");
  assert.equal(subscription.payment_status, "PAID");
  assert.equal(subscription.payment_reference, "PASS-TXN-1");
  assert.ok(subscription.starts_at instanceof Date);
  assert.ok(subscription.expires_at instanceof Date);
  assert.equal(subscription.saveCalls, 1);
});

test("duplicate passenger callback leaves an already active subscription unchanged", async function () {
  const originalFindById = Subscription.findById;

  const subscription = {
    _id: "507f1f77bcf86cd799439111",
    user_id: "507f1f77bcf86cd799439112",
    status: "ACTIVE",
    payment_status: "PAID"
  };

  Subscription.findById = function () {
    return {
      exec: async function () {
        return subscription;
      }
    };
  };

  try {
    const result = await service.finalizePassengerSubscriptionSession({
      subscription_id: "507f1f77bcf86cd799439111",
      status: "completed",
      verified_at: new Date(),
      reference: "PASS-TXN-2"
    }, new Date("2026-07-22T09:00:00.000Z"));

    assert.equal(result.activated, false);
    assert.equal(result.reason, "already_active");
  } finally {
    Subscription.findById = originalFindById;
  }
});

test("passenger feature lookup returns truthy and numeric flags from snapshots", function () {
  const subscription = {
    plan_features_snapshot: [
      { feature_code: "CAN_SET_RIDE_PRICE", feature_value: true },
      { feature_code: "MAX_PRICE_BROADCASTS_PER_DAY", feature_value: 5 }
    ]
  };

  assert.equal(service.featureValueFromSnapshot(subscription, "CAN_SET_RIDE_PRICE"), true);
  assert.equal(service.featureValueFromSnapshot(subscription, "MAX_PRICE_BROADCASTS_PER_DAY"), 5);
  assert.equal(service.featureValueFromSnapshot(subscription, "PRIORITY_MATCHING"), null);
});

test("passenger subscription routes expose plan listing, current, history, initiate, and verification endpoints", function () {
  assert.match(apiRouteSource, /router\.get\("\/passenger\/subscriptionplans\/:userid"/);
  assert.match(apiRouteSource, /router\.get\("\/passenger\/subscriptions\/current\/:userid"/);
  assert.match(apiRouteSource, /router\.get\("\/passenger\/subscriptions\/history\/:userid"/);
  assert.match(apiRouteSource, /router\.post\("\/passenger\/subscriptions\/initiate"/);
  assert.match(apiRouteSource, /router\.get\("\/passenger\/subscriptions\/verifyselcom\/:transid"/);
});

test("selcom callback finalizes passenger subscriptions server-side", function () {
  assert.match(apiRouteSource, /PASSENGER_SUBSCRIPTION_ACTOR_TYPE/);
  assert.match(apiRouteSource, /finalizePassengerSubscriptionSession/);
});
