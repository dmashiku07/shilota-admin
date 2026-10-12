const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const config = require("../config");
const Rides = require("../schema/rides");
const Driver = require("../schema/driver");
const Subscription = require("../schema/subscriptions");
const subscriptionService = require("../services/driverSubscriptionService");

const driverApiRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "apiroutes", "driverapi.js"),
  "utf8"
);
const rideSchemaSource = fs.readFileSync(
  path.join(__dirname, "..", "schema", "rides.js"),
  "utf8"
);

function withSubscriptionFlag(value, callback) {
  const previous = config.featureFlags.driver_subscriptions_enabled;
  config.featureFlags.driver_subscriptions_enabled = value;
  try {
    return callback();
  } finally {
    config.featureFlags.driver_subscriptions_enabled = previous;
  }
}

function loadEligibilityService(overrides) {
  const servicePath = require.resolve("../services/driverEligibilityService");
  const subscriptionServicePath = require.resolve("../services/driverSubscriptionService");
  const previousEligibilityModule = require.cache[servicePath];
  const previousSubscriptionModule = require.cache[subscriptionServicePath];

  delete require.cache[servicePath];
  require.cache[subscriptionServicePath] = {
    id: subscriptionServicePath,
    filename: subscriptionServicePath,
    loaded: true,
    exports: {
      ...subscriptionService,
      getCurrentDriverSubscription: overrides.getCurrentDriverSubscription || subscriptionService.getCurrentDriverSubscription,
      expireDriverSubscriptions: overrides.expireDriverSubscriptions || async function () {}
    }
  };

  const service = require("../services/driverEligibilityService");
  return {
    service,
    restore: function () {
      delete require.cache[servicePath];
      if (previousEligibilityModule) {
        require.cache[servicePath] = previousEligibilityModule;
      }
      if (previousSubscriptionModule) {
        require.cache[subscriptionServicePath] = previousSubscriptionModule;
      } else {
        delete require.cache[subscriptionServicePath];
      }
    }
  };
}

function createRideStore(rides) {
  const byId = {};
  rides.forEach(function (ride) {
    byId[String(ride._id)] = ride;
  });
  return byId;
}

function createSubscriptionMocks(subscriptionState, rideStore) {
  const originalRideFindOneAndUpdate = Rides.findOneAndUpdate;
  const originalSubscriptionFind = Subscription.find;
  const originalSubscriptionFindOne = Subscription.findOne;
  const originalSubscriptionUpdateOne = Subscription.updateOne;
  const originalSubscriptionUpdateMany = Subscription.updateMany;
  const originalSubscriptionFindOneAndUpdate = Subscription.findOneAndUpdate;

  Rides.findOneAndUpdate = function (query, update) {
    return {
      exec: async function () {
        const ride = rideStore[String(query._id)];
        if (!ride) {
          return null;
        }
        if (
          String(ride.driver_id) !== String(query.driver_id) ||
          String(ride.ridestatus) !== String(query.ridestatus) ||
          ride.subscription_usage_counted_at
        ) {
          return null;
        }
        ride.subscription_usage_counted_at = update.$set.subscription_usage_counted_at;
        return ride;
      }
    };
  };

  Subscription.find = function () {
    return {
      select: function () {
        return {
          exec: async function () {
            return [];
          }
        };
      }
    };
  };

  Subscription.findOne = function (query) {
    return {
      sort: function () {
        return {
          exec: async function () {
            if (!subscriptionState) {
              return null;
            }
            if (query.status === "ACTIVE") {
              const startsAt = subscriptionState.starts_at instanceof Date ? subscriptionState.starts_at : new Date(subscriptionState.starts_at);
              const expiresAt = subscriptionState.expires_at instanceof Date ? subscriptionState.expires_at : new Date(subscriptionState.expires_at);
              const comparisonDate = query.starts_at && query.starts_at.$lte ? query.starts_at.$lte : new Date();
              if (subscriptionState.status === "ACTIVE" && startsAt <= comparisonDate && expiresAt > comparisonDate) {
                return subscriptionState;
              }
              return null;
            }
            return subscriptionState;
          }
        };
      }
    };
  };

  Subscription.updateOne = function (query, update) {
    return {
      exec: async function () {
        if (!subscriptionState || String(subscriptionState._id) !== String(query._id)) {
          return { matchedCount: 0 };
        }
        if (query.ride_count_date && query.ride_count_date.$ne === subscriptionState.ride_count_date) {
          return { matchedCount: 0 };
        }
        if (update.$set) {
          Object.assign(subscriptionState, update.$set);
        }
        return { matchedCount: 1 };
      }
    };
  };

  Subscription.updateMany = function () {
    return {
      exec: async function () {
        return { matchedCount: 0 };
      }
    };
  };

  Subscription.findOneAndUpdate = function (query, update) {
    return {
      exec: async function () {
        if (!subscriptionState || String(subscriptionState._id) !== String(query._id)) {
          return null;
        }
        if (update.$inc) {
          Object.keys(update.$inc).forEach(function (key) {
            subscriptionState[key] = Number(subscriptionState[key] || 0) + Number(update.$inc[key] || 0);
          });
        }
        if (update.$set) {
          Object.assign(subscriptionState, update.$set);
        }
        return subscriptionState;
      }
    };
  };

  return function restore() {
    Rides.findOneAndUpdate = originalRideFindOneAndUpdate;
    Subscription.find = originalSubscriptionFind;
    Subscription.findOne = originalSubscriptionFindOne;
    Subscription.updateOne = originalSubscriptionUpdateOne;
    Subscription.updateMany = originalSubscriptionUpdateMany;
    Subscription.findOneAndUpdate = originalSubscriptionFindOneAndUpdate;
  };
}

test("first completed ride consumes one package credit", async function () {
  const subscriptionState = {
    _id: "sub-1",
    driver_id: "driver-1",
    status: "ACTIVE",
    starts_at: new Date("2026-07-22T00:00:00.000Z"),
    expires_at: new Date("2026-07-23T00:00:00.000Z"),
    rides_used_today: 0,
    ride_count_date: "2026-07-22",
    daily_limit_snapshot: null,
    is_unlimited_snapshot: false,
    payment_status: "PAID",
    ride_credit_total_snapshot: 10,
    ride_credits_remaining: 10,
    ride_credits_consumed: 0
  };
  const restore = createSubscriptionMocks(subscriptionState, createRideStore([
    { _id: "ride-1", driver_id: "driver-1", ridestatus: "completed", subscription_usage_counted_at: null }
  ]));

  try {
    const result = await subscriptionService.consumeCompletedRideUsage({
      rideId: "ride-1",
      driverId: "driver-1",
      now: new Date("2026-07-22T09:00:00.000Z")
    });
    assert.equal(result.counted, true);
    assert.equal(subscriptionState.rides_used_today, 1);
    assert.equal(subscriptionState.ride_credits_remaining, 9);
    assert.equal(subscriptionState.ride_credits_consumed, 1);
    assert.equal(result.usage.remaining_rides, 9);
  } finally {
    restore();
  }
});

test("final allowed ride consumes the last remaining slot", async function () {
  const subscriptionState = {
    _id: "sub-2",
    driver_id: "driver-1",
    status: "ACTIVE",
    starts_at: new Date("2026-07-22T00:00:00.000Z"),
    expires_at: new Date("2026-07-23T00:00:00.000Z"),
    rides_used_today: 2,
    ride_count_date: "2026-07-22",
    daily_limit_snapshot: 3,
    is_unlimited_snapshot: false
  };
  const restore = createSubscriptionMocks(subscriptionState, createRideStore([
    { _id: "ride-2", driver_id: "driver-1", ridestatus: "completed", subscription_usage_counted_at: null }
  ]));

  try {
    const result = await subscriptionService.consumeCompletedRideUsage({
      rideId: "ride-2",
      driverId: "driver-1",
      now: new Date("2026-07-22T10:00:00.000Z")
    });
    assert.equal(result.counted, true);
    assert.equal(subscriptionState.rides_used_today, 3);
    assert.equal(result.usage.remaining_rides, 0);
    assert.equal(result.usage.reached_daily_limit, true);
  } finally {
    restore();
  }
});

test("extra ride attempt is blocked once the daily limit is reached", async function () {
  const driver = {
    _id: "driver-limit",
    approval: "1",
    deletion_status: 0
  };
  const originalFindById = Driver.findById;
  const loaded = loadEligibilityService({
    getCurrentDriverSubscription: async function () {
      return {
        _id: "sub-limit",
        driver_id: "driver-limit",
        status: "ACTIVE",
        starts_at: new Date("2026-07-22T00:00:00.000Z"),
        expires_at: new Date("2026-07-23T00:00:00.000Z"),
        rides_used_today: 3,
        ride_count_date: "2026-07-22",
        daily_limit_snapshot: 3,
        is_unlimited_snapshot: false
      };
    }
  });

  Driver.findById = function () {
    return {
      exec: async function () {
        return driver;
      }
    };
  };

  try {
    await withSubscriptionFlag(true, async function () {
      const eligibility = await loaded.service.evaluateDriverEligibility("driver-limit", {
        now: new Date("2026-07-22T11:00:00.000Z")
      });
      assert.equal(eligibility.eligible, false);
      assert.equal(eligibility.code, loaded.service.SUBSCRIPTION_LIMIT_REACHED_CODE);
    });
  } finally {
    Driver.findById = originalFindById;
    loaded.restore();
  }
});

test("cancelled ride does not consume the daily allowance", async function () {
  const subscriptionState = {
    _id: "sub-3",
    driver_id: "driver-1",
    status: "ACTIVE",
    starts_at: new Date("2026-07-22T00:00:00.000Z"),
    expires_at: new Date("2026-07-23T00:00:00.000Z"),
    rides_used_today: 1,
    ride_count_date: "2026-07-22",
    daily_limit_snapshot: 3,
    is_unlimited_snapshot: false
  };
  const restore = createSubscriptionMocks(subscriptionState, createRideStore([
    { _id: "ride-3", driver_id: "driver-1", ridestatus: "cancelled", subscription_usage_counted_at: null }
  ]));

  try {
    const result = await subscriptionService.consumeCompletedRideUsage({
      rideId: "ride-3",
      driverId: "driver-1",
      now: new Date("2026-07-22T12:00:00.000Z")
    });
    assert.equal(result.counted, false);
    assert.equal(result.reason, "already_counted");
    assert.equal(subscriptionState.rides_used_today, 1);
  } finally {
    restore();
  }
});

test("duplicate completion keeps the ride counter idempotent", async function () {
  const subscriptionState = {
    _id: "sub-4",
    driver_id: "driver-1",
    status: "ACTIVE",
    starts_at: new Date("2026-07-22T00:00:00.000Z"),
    expires_at: new Date("2026-07-23T00:00:00.000Z"),
    rides_used_today: 0,
    ride_count_date: "2026-07-22",
    daily_limit_snapshot: 3,
    is_unlimited_snapshot: false
  };
  const restore = createSubscriptionMocks(subscriptionState, createRideStore([
    { _id: "ride-4", driver_id: "driver-1", ridestatus: "completed", subscription_usage_counted_at: null }
  ]));

  try {
    const first = await subscriptionService.consumeCompletedRideUsage({
      rideId: "ride-4",
      driverId: "driver-1",
      now: new Date("2026-07-22T13:00:00.000Z")
    });
    const second = await subscriptionService.consumeCompletedRideUsage({
      rideId: "ride-4",
      driverId: "driver-1",
      now: new Date("2026-07-22T13:01:00.000Z")
    });
    assert.equal(first.counted, true);
    assert.equal(second.counted, false);
    assert.equal(subscriptionState.rides_used_today, 1);
  } finally {
    restore();
  }
});

test("simultaneous ride completions are both counted without losing updates", async function () {
  const subscriptionState = {
    _id: "sub-5",
    driver_id: "driver-1",
    status: "ACTIVE",
    starts_at: new Date("2026-07-22T00:00:00.000Z"),
    expires_at: new Date("2026-07-23T00:00:00.000Z"),
    rides_used_today: 0,
    ride_count_date: "2026-07-22",
    daily_limit_snapshot: 5,
    is_unlimited_snapshot: false
  };
  const restore = createSubscriptionMocks(subscriptionState, createRideStore([
    { _id: "ride-5a", driver_id: "driver-1", ridestatus: "completed", subscription_usage_counted_at: null },
    { _id: "ride-5b", driver_id: "driver-1", ridestatus: "completed", subscription_usage_counted_at: null }
  ]));

  try {
    const results = await Promise.all([
      subscriptionService.consumeCompletedRideUsage({
        rideId: "ride-5a",
        driverId: "driver-1",
        now: new Date("2026-07-22T14:00:00.000Z")
      }),
      subscriptionService.consumeCompletedRideUsage({
        rideId: "ride-5b",
        driverId: "driver-1",
        now: new Date("2026-07-22T14:00:00.000Z")
      })
    ]);
    assert.equal(results[0].counted, true);
    assert.equal(results[1].counted, true);
    assert.equal(subscriptionState.rides_used_today, 2);
  } finally {
    restore();
  }
});

test("next-day reset happens lazily before counting the next completed ride", async function () {
  const subscriptionState = {
    _id: "sub-6",
    driver_id: "driver-1",
    status: "ACTIVE",
    starts_at: new Date("2026-07-22T00:00:00.000Z"),
    expires_at: new Date("2026-07-24T00:00:00.000Z"),
    rides_used_today: 3,
    ride_count_date: "2026-07-22",
    daily_limit_snapshot: 3,
    is_unlimited_snapshot: false
  };
  const restore = createSubscriptionMocks(subscriptionState, createRideStore([
    { _id: "ride-6", driver_id: "driver-1", ridestatus: "completed", subscription_usage_counted_at: null }
  ]));

  try {
    const result = await subscriptionService.consumeCompletedRideUsage({
      rideId: "ride-6",
      driverId: "driver-1",
      now: new Date("2026-07-23T09:00:00.000Z")
    });
    assert.equal(result.counted, true);
    assert.equal(subscriptionState.ride_count_date, "2026-07-23");
    assert.equal(subscriptionState.rides_used_today, 1);
    assert.equal(result.usage.remaining_rides, 2);
  } finally {
    restore();
  }
});

test("unlimited plans never report a reached daily limit", function () {
  const usage = subscriptionService.getSubscriptionUsageSnapshot({
    rides_used_today: 99,
    ride_count_date: "2026-07-22",
    daily_limit_snapshot: null,
    is_unlimited_snapshot: true
  }, new Date("2026-07-22T15:00:00.000Z"));

  assert.equal(usage.is_unlimited, true);
  assert.equal(usage.remaining_rides, null);
  assert.equal(usage.reached_daily_limit, false);
});

test("driver daily limit endpoints and ride usage marker are exposed in the source", function () {
  assert.match(driverApiRouteSource, /router\.get\('\/subscriptions\/usage\/:userid'/);
  assert.match(driverApiRouteSource, /router\.get\('\/subscriptions\/remainingrides\/:userid'/);
  assert.match(driverApiRouteSource, /consumeCompletedRideUsage/);
  assert.match(rideSchemaSource, /subscription_usage_counted_at/);
});
