const test = require("node:test");
const assert = require("node:assert/strict");

const config = require("../config");

test("feature flags preserve current production behavior by default", function () {
  assert.deepStrictEqual(config.featureFlags, {
    commission_enabled: true,
    driver_subscriptions_enabled: false,
    driver_pricing_enabled: false,
    passenger_price_broadcast_enabled: false,
    driver_destination_broadcast_enabled: false
  });
});
