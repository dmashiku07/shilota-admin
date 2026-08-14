const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const config = require("../config");
const Driver = require("../schema/driver");
const Rides = require("../schema/rides");
const Subscription = require("../schema/subscriptions");
const subscriptionService = require("../services/driverSubscriptionService");

const driverApiRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "apiroutes", "driverapi.js"),
  "utf8"
);
const apiRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "apiroutes", "api.js"),
  "utf8"
);

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
      getCurrentDriverSubscription: overrides.getCurrentDriverSubscription || async function () {
        return null;
      },
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

async function withSubscriptionFlag(value, callback) {
  const previous = config.featureFlags.driver_subscriptions_enabled;
  config.featureFlags.driver_subscriptions_enabled = value;
  try {
    return await callback();
  } finally {
    config.featureFlags.driver_subscriptions_enabled = previous;
  }
}

function buildActiveDriver() {
  return {
    _id: "driver-1",
    approval: "1",
    deletion_status: 0,
    live_status: "1"
  };
}

test("driver without subscription is blocked from subscription-gated actions", async function () {
  const driver = buildActiveDriver();
  const originalFindById = Driver.findById;
  const originalFindOne = Subscription.findOne;

  const loaded = loadEligibilityService({});
  Driver.findById = function () {
    return {
      exec: async function () {
        return driver;
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
    await withSubscriptionFlag(true, async function () {
      const eligibility = await loaded.service.evaluateDriverEligibility("driver-1", {
        now: new Date("2026-07-22T09:00:00.000Z")
      });
      assert.equal(eligibility.eligible, false);
      assert.equal(eligibility.code, loaded.service.SUBSCRIPTION_REQUIRED_CODE);
    });
  } finally {
    Driver.findById = originalFindById;
    Subscription.findOne = originalFindOne;
    loaded.restore();
  }
});

test("driver with active subscription remains eligible", async function () {
  const driver = buildActiveDriver();
  const originalFindById = Driver.findById;

  const loaded = loadEligibilityService({
    getCurrentDriverSubscription: async function () {
      return {
        _id: "sub-1",
        status: "ACTIVE",
        rides_used_today: 0,
        ride_count_date: "2026-07-22",
        daily_limit_snapshot: 5,
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
      const eligibility = await loaded.service.evaluateDriverEligibility("driver-1", {
        now: new Date("2026-07-22T09:00:00.000Z")
      });
      assert.equal(eligibility.eligible, true);
      assert.equal(eligibility.code, "");
    });
  } finally {
    Driver.findById = originalFindById;
    loaded.restore();
  }
});

test("expired subscription is marked expired and blocks new actions", async function () {
  const driver = buildActiveDriver();
  const originalFindById = Driver.findById;
  const originalFindOne = Subscription.findOne;
  const expiredSubscription = {
    _id: "sub-expired",
    status: "ACTIVE",
    expires_at: new Date("2026-07-21T09:00:00.000Z"),
    saveCalls: 0,
    async save() {
      this.saveCalls += 1;
      return this;
    }
  };

  const loaded = loadEligibilityService({});
  Driver.findById = function () {
    return {
      exec: async function () {
        return driver;
      }
    };
  };
  Subscription.findOne = function () {
    return {
      sort: function () {
        return {
          exec: async function () {
            return expiredSubscription;
          }
        };
      }
    };
  };

  try {
    await withSubscriptionFlag(true, async function () {
      const eligibility = await loaded.service.evaluateDriverEligibility("driver-1", {
        now: new Date("2026-07-22T09:00:00.000Z")
      });
      assert.equal(eligibility.eligible, false);
      assert.equal(eligibility.code, loaded.service.SUBSCRIPTION_EXPIRED_CODE);
      assert.equal(expiredSubscription.status, "EXPIRED");
      assert.equal(expiredSubscription.saveCalls, 1);
    });
  } finally {
    Driver.findById = originalFindById;
    Subscription.findOne = originalFindOne;
    loaded.restore();
  }
});

test("suspended subscription returns the suspended error code", async function () {
  const driver = buildActiveDriver();
  const originalFindById = Driver.findById;
  const originalFindOne = Subscription.findOne;

  const loaded = loadEligibilityService({});
  Driver.findById = function () {
    return {
      exec: async function () {
        return driver;
      }
    };
  };
  Subscription.findOne = function () {
    return {
      sort: function () {
        return {
          exec: async function () {
            return {
              _id: "sub-suspended",
              status: "SUSPENDED"
            };
          }
        };
      }
    };
  };

  try {
    await withSubscriptionFlag(true, async function () {
      const eligibility = await loaded.service.evaluateDriverEligibility("driver-1", {
        now: new Date("2026-07-22T09:00:00.000Z")
      });
      assert.equal(eligibility.eligible, false);
      assert.equal(eligibility.code, loaded.service.SUBSCRIPTION_SUSPENDED_CODE);
    });
  } finally {
    Driver.findById = originalFindById;
    Subscription.findOne = originalFindOne;
    loaded.restore();
  }
});

test("driver can finish an in-progress ride even if the subscription expired during the trip", async function () {
  const driver = buildActiveDriver();
  const originalFindById = Driver.findById;
  const originalFindOne = Subscription.findOne;
  const originalCountDocuments = Rides.countDocuments;

  const loaded = loadEligibilityService({});
  Driver.findById = function () {
    return {
      exec: async function () {
        return driver;
      }
    };
  };
  Subscription.findOne = function () {
    return {
      sort: function () {
        return {
          exec: async function () {
            return {
              _id: "sub-expired",
              status: "EXPIRED",
              expires_at: new Date("2026-07-21T09:00:00.000Z")
            };
          }
        };
      }
    };
  };
  Rides.countDocuments = function () {
    return {
      exec: async function () {
        return 1;
      }
    };
  };

  try {
    await withSubscriptionFlag(true, async function () {
      const eligibility = await loaded.service.evaluateDriverActionEligibility("driver-1", {
        now: new Date("2026-07-22T09:00:00.000Z"),
        allowActiveRideContinuation: true,
        rideId: "ride-1"
      });
      assert.equal(eligibility.eligible, true);
      assert.equal(eligibility.activeRideContinuation, true);
      assert.equal(eligibility.code, loaded.service.SUBSCRIPTION_EXPIRED_CODE);
    });
  } finally {
    Driver.findById = originalFindById;
    Subscription.findOne = originalFindOne;
    Rides.countDocuments = originalCountDocuments;
    loaded.restore();
  }
});

test("phase 4 routes are guarded by the centralized eligibility policy", function () {
  assert.match(driverApiRouteSource, /router\.post\('\/liveme'/);
  assert.match(driverApiRouteSource, /router\.post\('\/goride'/);
  assert.match(driverApiRouteSource, /router\.post\((['"])\/preacceptschedule\1/);
  assert.match(driverApiRouteSource, /evaluateDriverActionEligibility\(/);
  assert.match(driverApiRouteSource, /buildEligibilityErrorPayload\(/);
  assert.match(apiRouteSource, /filterEligibleDrivers\(/);
});

test("ride availability filters real drivers before grouping them by category", function () {
  const routeStart = apiRouteSource.indexOf('router.post("/grabrides"');
  const routeEnd = apiRouteSource.indexOf('router.post(', routeStart + 1);
  const routeSource = apiRouteSource.slice(routeStart, routeEnd);

  assert.notEqual(routeStart, -1, "expected the grabrides route");
  assert.match(routeSource, /buildDriverAvailabilityQuery/);
  assert.match(routeSource, /filterEligibleDrivers\(driver/);
  assert.match(routeSource, /groupEligibleDriversByCategory\(eligibleDriverSets\[0\]\)/);
  assert.doesNotMatch(routeSource, /\$group/);
});

test("passenger ride notification paths filter subscription-ineligible drivers before push", function () {
  const driverOfferNotifyIndex = apiRouteSource.indexOf("nearBy(availdrivers, rides._id);");
  assert.notEqual(driverOfferNotifyIndex, -1, "expected driver-offer notification dispatch");
  const driverOfferFilterIndex = apiRouteSource.lastIndexOf("filterEligibleDrivers(driver", driverOfferNotifyIndex);
  assert.notEqual(driverOfferFilterIndex, -1, "expected driver-offer path to filter eligible drivers before notification");
  assert.ok(driverOfferFilterIndex < driverOfferNotifyIndex);

  const standardNotifyIndex = apiRouteSource.indexOf("nearBy(availdrivers, rides._id);", driverOfferNotifyIndex + 1);
  assert.notEqual(standardNotifyIndex, -1, "expected standard ride notification dispatch");
  const standardFilterIndex = apiRouteSource.lastIndexOf("filterEligibleDrivers(driver", standardNotifyIndex);
  assert.notEqual(standardFilterIndex, -1, "expected standard path to filter eligible drivers before notification");
  assert.ok(standardFilterIndex < standardNotifyIndex);

  const scheduleNotifyIndex = apiRouteSource.indexOf("schedulenearBy(availdrivers, rides);");
  assert.notEqual(scheduleNotifyIndex, -1, "expected scheduled ride notification dispatch");
  const scheduleFilterIndex = apiRouteSource.lastIndexOf("filterEligibleDrivers(driver", scheduleNotifyIndex);
  assert.notEqual(scheduleFilterIndex, -1, "expected scheduled path to filter eligible drivers before notification");
  assert.ok(scheduleFilterIndex < scheduleNotifyIndex);
});
