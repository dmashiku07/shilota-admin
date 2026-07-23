const test = require("node:test");
const assert = require("node:assert/strict");

const config = require("../config");

test("feature flags default to subscription marketplace behavior", function () {
  assert.deepStrictEqual(config.featureFlags, {
    commission_enabled: false,
    driver_subscriptions_enabled: true,
    driver_pricing_enabled: true,
    passenger_price_broadcast_enabled: true,
    driver_destination_broadcast_enabled: true
  });
});
