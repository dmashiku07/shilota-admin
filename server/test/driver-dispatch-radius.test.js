const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const radiusService = require("../services/driverDispatchRadiusService");

test("only approved UAT radius choices are accepted", function () {
  assert.deepEqual(radiusService.UAT_RADIUS_OPTIONS_KM, [1, 2, 3]);
  assert.equal(radiusService.normalizeActiveRadiusKm("2"), 2);
  assert.equal(radiusService.normalizeActiveRadiusKm(4), null);
});

test("dispatch enforces the selected radius with a one-kilometre legacy default", function () {
  assert.equal(radiusService.driverMatchesActiveRadius({ active_radius_km: 3, distance: 3000 }), true);
  assert.equal(radiusService.driverMatchesActiveRadius({ active_radius_km: 3, distance: 3001 }), false);
  assert.equal(radiusService.driverMatchesActiveRadius({ distance: 1000 }), true);
  assert.equal(radiusService.driverMatchesActiveRadius({ distance: 1001 }), false);
});

test("passenger dispatch and driver acceptance both invoke server radius enforcement", function () {
  const passengerApi = fs.readFileSync(path.join(__dirname, "..", "apiroutes", "api.js"), "utf8");
  const driverApi = fs.readFileSync(path.join(__dirname, "..", "apiroutes", "driverapi.js"), "utf8");
  assert.match(passengerApi, /driverMatchesActiveRadius\(driver\)/);
  assert.match(driverApi, /driverMatchesActiveRadius\(driver\)/);
  assert.match(driverApi, /active-radius\/:userid/);
});
