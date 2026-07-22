const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const config = require("../config");
const DriverDestinationBroadcast = require("../schema/driverdestinationbroadcasts");
const DriverDestinationJoinRequest = require("../schema/driverdestinationjoinrequests");
const SelcomPaymentSession = require("../schema/selcompaymentsession");
const User = require("../schema/user");
const service = require("../services/driverDestinationBroadcastService");

const apiRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "apiroutes", "api.js"),
  "utf8"
);
const driverApiRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "apiroutes", "driverapi.js"),
  "utf8"
);
const safetyRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "routes", "safetyRoutes.js"),
  "utf8"
);

function swapMethod(target, methodName, replacement) {
  const original = target[methodName];
  target[methodName] = replacement;
  return function restore() {
    target[methodName] = original;
  };
}

test("driver destination broadcast schemas expose broadcast and join-request fields", function () {
  const broadcastPaths = DriverDestinationBroadcast.schema.paths;
  const joinPaths = DriverDestinationJoinRequest.schema.paths;
  const userPaths = User.schema.paths;

  [
    "driver_id",
    "origin_label",
    "origin_lat",
    "origin_lng",
    "destination_label",
    "destination_lat",
    "destination_lng",
    "departure_time",
    "price_per_passenger",
    "available_seats",
    "remaining_seats",
    "notification_radius",
    "broadcast_fee",
    "currency",
    "payment_status",
    "payment_reference",
    "paid_at",
    "starts_at",
    "expires_at",
    "status"
  ].forEach(function (fieldName) {
    assert.ok(broadcastPaths[fieldName], `expected destination broadcast schema to include ${fieldName}`);
  });

  [
    "broadcast_id",
    "passenger_id",
    "pickup_label",
    "pickup_lat",
    "pickup_lng",
    "requested_seats",
    "status"
  ].forEach(function (fieldName) {
    assert.ok(joinPaths[fieldName], `expected join request schema to include ${fieldName}`);
  });

  ["current_lat", "current_lng", "current_location", "loc"].forEach(function (fieldName) {
    assert.ok(userPaths[fieldName], `expected user schema to include ${fieldName}`);
  });
});

test("driver destination broadcast feature stays disabled by default", function () {
  assert.equal(config.featureFlags.driver_destination_broadcast_enabled, false);
  assert.equal(service.isDriverDestinationBroadcastEnabled(), false);
});

test("expiry job marks open broadcasts and pending join requests as expired", async function () {
  const updates = [];
  const restores = [
    swapMethod(DriverDestinationBroadcast, "updateMany", function (query, update) {
      updates.push({ model: "broadcast", query, update });
      return { exec: () => Promise.resolve() };
    }),
    swapMethod(DriverDestinationBroadcast, "find", function () {
      return {
        select: function () {
          return { exec: () => Promise.resolve([{ _id: "broadcast-1" }]) };
        }
      };
    }),
    swapMethod(DriverDestinationJoinRequest, "updateMany", function (query, update) {
      updates.push({ model: "join", query, update });
      return { exec: () => Promise.resolve() };
    })
  ];

  try {
    await service.expireDriverDestinationBroadcasts(
      new Date("2026-07-22T09:00:00.000Z")
    );
  } finally {
    restores.reverse().forEach(function (restore) { restore(); });
  }

  assert.equal(updates.length, 3);
  assert.equal(updates[0].model, "broadcast");
  assert.equal(updates[1].model, "broadcast");
  assert.equal(updates[2].model, "join");
  assert.equal(updates[2].update.$set.status, "EXPIRED");
});

test("driver join decision prevents overselling the final seat", async function () {
  const joinRequest = {
    _id: "join-1",
    broadcast_id: "broadcast-1",
    passenger_id: "passenger-1",
    requested_seats: 1,
    status: "PENDING",
    save: async function () {}
  };
  const broadcast = {
    _id: "broadcast-1",
    driver_id: "driver-1",
    status: "ACTIVE",
    remaining_seats: 0
  };

  const restores = [
    swapMethod(DriverDestinationJoinRequest, "findById", function () {
      return { exec: () => Promise.resolve(joinRequest) };
    }),
    swapMethod(DriverDestinationBroadcast, "findById", function () {
      return { exec: () => Promise.resolve(broadcast) };
    }),
    swapMethod(DriverDestinationBroadcast, "findOneAndUpdate", function () {
      return { exec: () => Promise.resolve(null) };
    })
  ];

  try {
    const result = await service.decideJoinRequest({
      driverId: "driver-1",
      joinRequestId: "join-1",
      decision: "ACCEPT",
      now: new Date("2026-07-22T09:00:00.000Z")
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "DESTINATION_BROADCAST_NOT_ENOUGH_SEATS");
  } finally {
    restores.reverse().forEach(function (restore) { restore(); });
  }
});

test("accepting the final available seat moves the broadcast to FULL", async function () {
  const joinRequest = {
    _id: "join-2",
    broadcast_id: "broadcast-2",
    passenger_id: "passenger-2",
    requested_seats: 1,
    status: "PENDING",
    save: async function () {
      this.saved = true;
    }
  };
  const acceptedBroadcast = {
    _id: "broadcast-2",
    driver_id: "driver-2",
    status: "ACTIVE",
    remaining_seats: 0,
    destination_label: "Mbezi",
    save: async function () {
      this.saved = true;
    }
  };

  const restores = [
    swapMethod(DriverDestinationJoinRequest, "findById", function () {
      return { exec: () => Promise.resolve(joinRequest) };
    }),
    swapMethod(DriverDestinationBroadcast, "findById", function () {
      return { exec: () => Promise.resolve({ _id: "broadcast-2", driver_id: "driver-2", status: "ACTIVE" }) };
    }),
    swapMethod(DriverDestinationBroadcast, "findOneAndUpdate", function () {
      return { exec: () => Promise.resolve(acceptedBroadcast) };
    })
  ];

  try {
    const result = await service.decideJoinRequest({
      driverId: "driver-2",
      joinRequestId: "join-2",
      decision: "ACCEPT",
      now: new Date("2026-07-22T09:00:00.000Z")
    });
    assert.equal(result.ok, true);
  assert.equal(result.broadcast.status, "FULL");
  assert.equal(result.joinRequest.status, "ACCEPTED");
  } finally {
    restores.reverse().forEach(function (restore) { restore(); });
  }
});

test("successful payment activates a pending destination broadcast", async function () {
  const broadcast = {
    status: "PENDING_PAYMENT",
    payment_status: "PENDING",
    payment_reference: "",
    expires_at: new Date("2026-07-22T12:00:00.000Z"),
    departure_time: new Date("2026-07-22T13:00:00.000Z"),
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
      return this;
    }
  };

  const result = await service.activateDestinationBroadcastPayment({
    broadcast,
    paymentReference: "BROADCAST-TXN-1",
    now: new Date("2026-07-22T10:00:00.000Z")
  });

  assert.equal(result.activated, true);
  assert.equal(broadcast.status, "ACTIVE");
  assert.equal(broadcast.payment_status, "PAID");
  assert.equal(broadcast.payment_reference, "BROADCAST-TXN-1");
  assert.ok(broadcast.paid_at instanceof Date);
  assert.equal(broadcast.saveCalls, 1);
});

test("failed payment marks the destination broadcast as payment failed", async function () {
  const broadcast = {
    status: "PENDING_PAYMENT",
    payment_status: "PENDING",
    payment_reference: "",
    async save() {
      return this;
    }
  };

  const result = await service.markDestinationBroadcastPaymentFailed(
    broadcast,
    "FAILED-BROADCAST-REF"
  );

  assert.equal(result.updated, true);
  assert.equal(broadcast.status, "PAYMENT_FAILED");
  assert.equal(broadcast.payment_status, "FAILED");
  assert.equal(broadcast.payment_reference, "FAILED-BROADCAST-REF");
});

test("duplicate callback leaves an already active destination broadcast unchanged", async function () {
  const originalFindById = DriverDestinationBroadcast.findById;
  const broadcast = {
    _id: "broadcast-paid",
    status: "ACTIVE",
    payment_status: "PAID"
  };

  DriverDestinationBroadcast.findById = function () {
    return {
      exec: async function () {
        return broadcast;
      }
    };
  };

  try {
    const result = await service.finalizeDestinationBroadcastSession({
      destination_broadcast_id: "broadcast-paid",
      payment_status: "COMPLETED",
      reference: "TXN-DUPLICATE"
    }, new Date("2026-07-22T10:00:00.000Z"));

    assert.equal(result.activated, false);
    assert.equal(result.reason, "already_active");
  } finally {
    DriverDestinationBroadcast.findById = originalFindById;
  }
});

test("payment callback after draft expiry does not activate a stale broadcast", async function () {
  const originalFindById = DriverDestinationBroadcast.findById;
  const broadcast = {
    _id: "broadcast-expired",
    status: "PENDING_PAYMENT",
    payment_status: "PENDING",
    payment_reference: "",
    expires_at: new Date("2026-07-22T09:00:00.000Z"),
    departure_time: new Date("2026-07-22T12:00:00.000Z"),
    async save() {
      return this;
    }
  };

  DriverDestinationBroadcast.findById = function () {
    return {
      exec: async function () {
        return broadcast;
      }
    };
  };

  try {
    const result = await service.finalizeDestinationBroadcastSession({
      destination_broadcast_id: "broadcast-expired",
      payment_status: "COMPLETED",
      reference: "LATE-TXN"
    }, new Date("2026-07-22T10:00:00.000Z"));

    assert.equal(result.activated, false);
    assert.equal(result.reason, "expired_before_activation");
    assert.equal(broadcast.status, "PAYMENT_FAILED");
  } finally {
    DriverDestinationBroadcast.findById = originalFindById;
  }
});

test("selcom payment session schema exposes destination broadcast linkage", function () {
  const paths = SelcomPaymentSession.schema.paths;
  assert.ok(paths.destination_broadcast_id);
});

test("destination broadcast routes are exposed in passenger, driver, and admin APIs", function () {
  assert.match(apiRouteSource, /router\.post\(\"\/passenger\/location\"/);
  assert.match(apiRouteSource, /router\.get\(\"\/destinationbroadcasts\/nearby\/:userid\"/);
  assert.match(apiRouteSource, /router\.post\(\"\/destinationbroadcasts\/join\"/);
  assert.match(driverApiRouteSource, /router\.post\(\"\/destinationbroadcasts\"/);
  assert.match(driverApiRouteSource, /router\.get\('\/destinationbroadcasts\/verifyselcom\/:transid'/);
  assert.match(driverApiRouteSource, /router\.post\(\"\/destinationbroadcasts\/retrypayment\"/);
  assert.match(driverApiRouteSource, /router\.post\(\"\/destinationbroadcasts\/requests\/decision\"/);
  assert.match(driverApiRouteSource, /router\.post\(\"\/destinationbroadcasts\/status\"/);
  assert.match(safetyRouteSource, /router\.get\(\"\/destinationbroadcasts\"/);
  assert.match(safetyRouteSource, /router\.get\(\"\/destinationbroadcastsettings\"/);
  assert.match(safetyRouteSource, /router\.get\(\"\/destinationbroadcastrevenues\"/);
});
