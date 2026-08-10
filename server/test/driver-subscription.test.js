const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const Subscription = require("../schema/subscriptions");
const service = require("../services/driverSubscriptionService");

const driverRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "apiroutes", "driverapi.js"),
  "utf8"
);

const apiRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "apiroutes", "api.js"),
  "utf8"
);

const adminSubscriptionRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "routes", "subscriptionRoutes.js"),
  "utf8"
);

test("deactivated plan purchase attempt is rejected", function () {
  assert.equal(
    service.validatePlanForPurchase({
      customer_type: "DRIVER",
      is_active: false
    }),
    "Subscription plan is not active"
  );
});

test("successful payment activates subscription and stores snapshots", async function () {
  const subscription = {
    duration_unit_snapshot: "DAY",
    duration_value_snapshot: 1,
    payment_status: "PENDING",
    status: "PENDING_PAYMENT",
    payment_reference: "",
    rides_used_today: 4,
    ride_count_date: "2000-01-01",
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
      return this;
    }
  };

  const now = new Date("2026-07-22T08:00:00.000Z");
  const result = await service.activateDriverSubscriptionPayment({
    subscription,
    paymentReference: "TXN-1",
    now
  });

  assert.equal(result.activated, true);
  assert.equal(subscription.status, "ACTIVE");
  assert.equal(subscription.payment_status, "PAID");
  assert.equal(subscription.payment_reference, "TXN-1");
  assert.equal(subscription.rides_used_today, 0);
  assert.ok(subscription.starts_at instanceof Date);
  assert.ok(subscription.expires_at instanceof Date);
  assert.equal(subscription.saveCalls, 1);
});

test("failed payment marks subscription as payment failed", async function () {
  const subscription = {
    status: "PENDING_PAYMENT",
    payment_status: "PENDING",
    async save() {
      return this;
    }
  };

  const result = await service.markDriverSubscriptionPaymentFailed(subscription, "FAILED-REF");
  assert.equal(result.updated, true);
  assert.equal(subscription.status, "PAYMENT_FAILED");
  assert.equal(subscription.payment_status, "FAILED");
  assert.equal(subscription.payment_reference, "FAILED-REF");
});

test("duplicate callback leaves an already active subscription unchanged", async function () {
  const originalFindById = Subscription.findById;
  const originalFindOne = Subscription.findOne;

  const subscription = {
    _id: "507f1f77bcf86cd799439011",
    driver_id: "507f1f77bcf86cd799439012",
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
  Subscription.findOne = function () {
    return {
      sort: function () {
        return {
          exec: async function () {
            return null;
          }
        };
      }
    };
  };

  try {
    const result = await service.finalizeSubscriptionSession({
      subscription_id: "507f1f77bcf86cd799439011",
      status: "completed",
      verified_at: new Date(),
      reference: "TXN-2"
    }, new Date("2026-07-22T09:00:00.000Z"));

    assert.equal(result.activated, false);
    assert.equal(result.reason, "already_active");
  } finally {
    Subscription.findById = originalFindById;
    Subscription.findOne = originalFindOne;
  }
});

test("early renewal starts from the current expiry without expiring the current subscription immediately", async function () {
  const currentActiveSubscription = {
    _id: "current-sub",
    status: "ACTIVE",
    expires_at: new Date("2026-07-25T10:00:00.000Z"),
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
      return this;
    }
  };

  const renewalSubscription = {
    _id: "renewal-sub",
    duration_unit_snapshot: "MONTH",
    duration_value_snapshot: 1,
    payment_status: "PENDING",
    status: "PENDING_PAYMENT",
    ride_count_date: "2000-01-01",
    rides_used_today: 2,
    async save() {
      return this;
    }
  };

  await service.activateDriverSubscriptionPayment({
    subscription: renewalSubscription,
    paymentReference: "TXN-3",
    currentActiveSubscription,
    now: new Date("2026-07-22T10:00:00.000Z")
  });

  assert.equal(renewalSubscription.starts_at.toISOString(), "2026-07-25T10:00:00.000Z");
  assert.equal(currentActiveSubscription.status, "ACTIVE");
  assert.equal(currentActiveSubscription.saveCalls, 0);
});

test("expired subscription state is applied when expiry is in the past", function () {
  const subscription = {
    status: "ACTIVE",
    expires_at: new Date("2026-07-20T10:00:00.000Z")
  };

  const changed = service.applyExpiredState(subscription, new Date("2026-07-22T10:00:00.000Z"));
  assert.equal(changed, true);
  assert.equal(subscription.status, "EXPIRED");
});

test("renewal window begins immediately when there is no active subscription to extend", function () {
  const now = new Date("2026-07-22T10:00:00.000Z");
  const result = service.calculateSubscriptionWindow({
    duration_unit_snapshot: "WEEK",
    duration_value_snapshot: 1
  }, now, null);

  assert.equal(result.starts_at.toISOString(), now.toISOString());
  assert.equal(result.expires_at.toISOString(), "2026-07-29T10:00:00.000Z");
});

test("driver subscription routes expose purchase, current, history, and verification endpoints", function () {
  assert.match(driverRouteSource, /router\.get\('\/subscriptions\/current\/:userid'/);
  assert.match(driverRouteSource, /router\.get\('\/subscriptions\/history\/:userid'/);
  assert.match(driverRouteSource, /router\.post\('\/subscriptions\/initiate'/);
  assert.match(driverRouteSource, /router\.get\('\/subscriptions\/verifyselcom\/:transid'/);
});

test("selcom callback finalizes driver subscriptions server-side", function () {
  assert.match(apiRouteSource, /finalizeSubscriptionSession/);
  assert.match(apiRouteSource, /DRIVER_SUBSCRIPTION_ACTOR_TYPE/);
  assert.match(apiRouteSource, /session\.consumed_at = new Date\(\)/);
});

test("admin can grant and revoke non-payment driver access with an audit trail", function () {
  assert.match(adminSubscriptionRouteSource, /router\.post\("\/grant"/);
  assert.match(adminSubscriptionRouteSource, /router\.post\("\/grant", requireAdmin/);
  assert.match(adminSubscriptionRouteSource, /activation_source: "ADMIN_GRANT"/);
  assert.match(adminSubscriptionRouteSource, /payment_status: "PENDING"/);
  assert.match(adminSubscriptionRouteSource, /driver_subscription\.admin_granted/);
  assert.match(adminSubscriptionRouteSource, /router\.post\("\/:id\/revoke"/);
  assert.match(adminSubscriptionRouteSource, /driver_subscription\.admin_revoked/);
});

test("subscription schema distinguishes admin grants from Selcom payments", function () {
  const source = fs.readFileSync(
    path.join(__dirname, "..", "schema", "subscriptions.js"),
    "utf8"
  );
  assert.match(source, /enum: \["SELCOM", "ADMIN_GRANT"\]/);
  assert.match(source, /grant_reason/);
  assert.match(source, /granted_by/);
  assert.match(source, /revoked_at/);
});
