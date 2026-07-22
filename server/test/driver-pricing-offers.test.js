const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const config = require("../config");
const Rides = require("../schema/rides");
const RideOffer = require("../schema/rideoffers");
const PriceBroadcastSettings = require("../schema/pricebroadcastsettings");
const {
  buildOfferExpiry,
  getPassengerBroadcastAuthorization,
  prepareDriverPricedRidePayload,
  preparePassengerPriceBroadcastPayload
} = require("../services/rideOfferService");

const apiRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "apiroutes", "api.js"),
  "utf8"
);
const driverApiRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "apiroutes", "driverapi.js"),
  "utf8"
);

function withDriverPricingFlag(value, callback) {
  const previous = config.featureFlags.driver_pricing_enabled;
  config.featureFlags.driver_pricing_enabled = value;
  try {
    return callback();
  } finally {
    config.featureFlags.driver_pricing_enabled = previous;
  }
}

test("ride schemas expose driver-pricing request and offer fields", function () {
  const ridePaths = Rides.schema.paths;
  const offerPaths = RideOffer.schema.paths;
  const settingsPaths = PriceBroadcastSettings.schema.paths;

  ["pricing_mode", "accepted_offer_id", "final_agreed_price", "final_agreed_currency", "offer_expires_at", "request_type", "passenger_offered_price", "broadcast_radius", "broadcast_expires_at"].forEach(
    function (fieldName) {
      assert.ok(ridePaths[fieldName], `expected rides schema to include ${fieldName}`);
    }
  );

  [
    "ride_request_id",
    "driver_id",
    "offered_price",
    "currency",
    "offer_type",
    "estimated_arrival_minutes",
    "message",
    "status",
    "expires_at"
  ].forEach(function (fieldName) {
    assert.ok(offerPaths[fieldName], `expected ride offers schema to include ${fieldName}`);
  });

  ["enabled", "default_radius_km", "max_radius_km", "default_expiry_minutes", "max_expiry_minutes", "max_broadcasts_per_day"].forEach(function (fieldName) {
    assert.ok(settingsPaths[fieldName], `expected price broadcast settings schema to include ${fieldName}`);
  });
});

test("driver-priced request preparation keeps legacy rides untouched when the flag is off", function () {
  withDriverPricingFlag(false, function () {
    const ride = {
      type: "now"
    };
    prepareDriverPricedRidePayload(ride, new Date("2026-07-22T09:00:00.000Z"));
    assert.equal(ride.pricing_mode, undefined);
    assert.equal(ride.accepted_offer_id, undefined);
  });
});

test("driver-priced request preparation sets offer lifecycle defaults when the flag is on", function () {
  withDriverPricingFlag(true, function () {
    const ride = {
      type: "now"
    };
    prepareDriverPricedRidePayload(ride, new Date("2026-07-22T09:00:00.000Z"));
    assert.equal(ride.pricing_mode, "driver_offer");
    assert.equal(ride.accepted_offer_id, "");
    assert.equal(ride.final_agreed_currency, "TZS");
    assert.ok(ride.offer_expires_at instanceof Date);
  });
});

test("offer expiry helper adds a five-minute window by default", function () {
  const expiry = buildOfferExpiry(new Date("2026-07-22T09:00:00.000Z"));
  assert.equal(expiry.toISOString(), "2026-07-22T09:05:00.000Z");
});

test("passenger price broadcast request preparation sets broadcast-specific defaults", async function () {
  const ride = {};
  await preparePassengerPriceBroadcastPayload(ride, {
    enabled: true,
    passengerOfferedPrice: 5000,
    broadcastRadius: 12,
    expiryMinutes: 7,
    currency: "tzs",
    now: new Date("2026-07-22T09:00:00.000Z")
  });
  assert.equal(ride.request_type, "PASSENGER_PRICE_BROADCAST");
  assert.equal(ride.pricing_mode, "passenger_broadcast");
  assert.equal(ride.passenger_offered_price, 5000);
  assert.equal(ride.broadcast_radius, 12);
  assert.equal(ride.final_agreed_currency, "TZS");
  assert.equal(ride.broadcast_expires_at.toISOString(), "2026-07-22T09:07:00.000Z");
});

test("passenger price broadcast authorization blocks requests when the feature flag is off", async function () {
  const previous = config.featureFlags.passenger_price_broadcast_enabled;
  config.featureFlags.passenger_price_broadcast_enabled = false;
  try {
    const result = await getPassengerBroadcastAuthorization("passenger-id", new Date("2026-07-22T09:00:00.000Z"), {
      enabled: true
    });
    assert.equal(result.allowed, false);
    assert.equal(result.code, "PASSENGER_PRICE_BROADCAST_DISABLED");
  } finally {
    config.featureFlags.passenger_price_broadcast_enabled = previous;
  }
});

test("ride offer routes are wired into passenger and driver APIs", function () {
  assert.match(apiRouteSource, /router\.post\(\"\/rideoffers\"/);
  assert.match(apiRouteSource, /router\.post\(\"\/rideoffers\/accept\"/);
  assert.match(apiRouteSource, /status:\s*\"searching_offers\"/);
  assert.match(apiRouteSource, /passenger\/subscriptions\/broadcastcontext/);
  assert.match(apiRouteSource, /PASSENGER_PRICE_BROADCAST/);
  assert.match(driverApiRouteSource, /router\.post\(\"\/rideoffers\/submit\"/);
  assert.match(driverApiRouteSource, /router\.post\(\"\/rideoffers\/withdraw\"/);
  assert.match(driverApiRouteSource, /offer_type/);
});
