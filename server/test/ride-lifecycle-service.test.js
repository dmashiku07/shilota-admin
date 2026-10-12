const test = require("node:test");
const assert = require("node:assert/strict");

const {
  canDriverTransition,
  requiredCurrentStatusForDriverTransition
} = require("../services/rideLifecycleService");

test("driver lifecycle only permits accepted to ontheway to onride to completed", function () {
  assert.equal(canDriverTransition("accepted", "ontheway"), true);
  assert.equal(canDriverTransition("ontheway", "onride"), true);
  assert.equal(canDriverTransition("onride", "completed"), true);
  assert.equal(canDriverTransition("accepted", "onride"), false);
  assert.equal(canDriverTransition("requested", "ontheway"), false);
  assert.equal(canDriverTransition("completed", "onride"), false);
});

test("driver status targets resolve to their required current status", function () {
  assert.equal(requiredCurrentStatusForDriverTransition("ontheway"), "accepted");
  assert.equal(requiredCurrentStatusForDriverTransition("onride"), "ontheway");
  assert.equal(requiredCurrentStatusForDriverTransition("completed"), "onride");
  assert.equal(requiredCurrentStatusForDriverTransition("cancelled"), null);
});
