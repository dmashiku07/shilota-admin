const config = require("../config");
const Driver = require("../schema/driver");
const Rides = require("../schema/rides");
const Subscription = require("../schema/subscriptions");
const {
  getCurrentDriverSubscription,
  expireDriverSubscriptions,
  getSubscriptionUsageSnapshot
} = require("./driverSubscriptionService");

const SUBSCRIPTION_REQUIRED_CODE = "DRIVER_SUBSCRIPTION_REQUIRED";
const SUBSCRIPTION_EXPIRED_CODE = "DRIVER_SUBSCRIPTION_EXPIRED";
const SUBSCRIPTION_SUSPENDED_CODE = "DRIVER_SUBSCRIPTION_SUSPENDED";
const SUBSCRIPTION_LIMIT_REACHED_CODE = "DRIVER_SUBSCRIPTION_LIMIT_REACHED";
const DRIVER_ACCOUNT_INACTIVE_CODE = "DRIVER_ACCOUNT_INACTIVE";

const ACTIVE_RIDE_STATUSES = ["accepted", "ontheway", "onride"];

function isDriverSubscriptionEnforcementEnabled() {
  return Boolean(config.featureFlags && config.featureFlags.driver_subscriptions_enabled);
}

function isDriverAccountActive(driver) {
  if (!driver) {
    return false;
  }
  return String(driver.approval || "") === "1" && Number(driver.deletion_status || 0) === 0;
}

function buildIneligibleResult(code, message, subscription) {
  return {
    eligible: false,
    code: code,
    message: message,
    subscription: subscription || null,
    usage: subscription ? getSubscriptionUsageSnapshot(subscription, new Date()) : null
  };
}

function buildEligibleResult(subscription) {
  return {
    eligible: true,
    code: "",
    message: "",
    subscription: subscription || null,
    usage: subscription ? getSubscriptionUsageSnapshot(subscription, new Date()) : null
  };
}

function normalizeSubscriptionStatus(subscription) {
  return String(subscription && subscription.status || "").trim().toUpperCase();
}

async function resolveDriver(driverOrId) {
  if (!driverOrId) {
    return null;
  }
  if (typeof driverOrId === "object" && driverOrId._id) {
    return driverOrId;
  }
  return Driver.findById(driverOrId).exec();
}

async function findLatestDriverSubscription(driverId) {
  return Subscription.findOne({
    customer_type: "DRIVER",
    driver_id: driverId
  }).sort({ updated_at: -1, created_at: -1 }).exec();
}

async function hasInProgressRide(driverId, rideId) {
  let match = {
    driver_id: String(driverId),
    ridestatus: {
      $in: ACTIVE_RIDE_STATUSES
    }
  };
  if (rideId) {
    match._id = String(rideId);
  }
  return Rides.countDocuments(match).exec().then(function (count) {
    return Number(count || 0) > 0;
  });
}

async function evaluateDriverEligibility(driverOrId, options) {
  const now = options && options.now instanceof Date ? options.now : new Date();
  const enforcementEnabled = isDriverSubscriptionEnforcementEnabled();
  const driver = await resolveDriver(driverOrId);

  if (!driver || !isDriverAccountActive(driver)) {
    return buildIneligibleResult(
      DRIVER_ACCOUNT_INACTIVE_CODE,
      "Driver account is not active"
    );
  }

  if (!enforcementEnabled) {
    return buildEligibleResult(null);
  }

  await expireDriverSubscriptions(now);

  const currentSubscription = await getCurrentDriverSubscription(driver._id, now);
  if (currentSubscription) {
    const usage = getSubscriptionUsageSnapshot(currentSubscription, now);
    if (usage.reached_daily_limit) {
      return {
        eligible: false,
        code: SUBSCRIPTION_LIMIT_REACHED_CODE,
        message: "You have reached your daily completed-ride limit for this subscription",
        subscription: currentSubscription,
        usage: usage
      };
    }
    return buildEligibleResult(currentSubscription);
  }

  const latestSubscription = await findLatestDriverSubscription(driver._id);
  if (!latestSubscription) {
    return buildIneligibleResult(
      SUBSCRIPTION_REQUIRED_CODE,
      "An active driver subscription is required before going online or accepting rides"
    );
  }

  const subscriptionStatus = normalizeSubscriptionStatus(latestSubscription);
  if (subscriptionStatus === "SUSPENDED") {
    return buildIneligibleResult(
      SUBSCRIPTION_SUSPENDED_CODE,
      "Your driver subscription is suspended",
      latestSubscription
    );
  }

  if (
    subscriptionStatus === "EXPIRED" ||
    (subscriptionStatus === "ACTIVE" &&
      latestSubscription.expires_at instanceof Date &&
      latestSubscription.expires_at.getTime() <= now.getTime())
  ) {
    if (subscriptionStatus === "ACTIVE") {
      latestSubscription.status = "EXPIRED";
      await latestSubscription.save();
    }
    return buildIneligibleResult(
      SUBSCRIPTION_EXPIRED_CODE,
      "Your driver subscription has expired",
      latestSubscription
    );
  }

  return buildIneligibleResult(
    SUBSCRIPTION_REQUIRED_CODE,
    "An active driver subscription is required before going online or accepting rides",
    latestSubscription
  );
}

async function evaluateDriverActionEligibility(driverOrId, options) {
  const now = options && options.now instanceof Date ? options.now : new Date();
  const eligibility = await evaluateDriverEligibility(driverOrId, {
    now: now
  });

  if (eligibility.eligible) {
    return eligibility;
  }

  if (options && options.allowActiveRideContinuation) {
    const activeRide = await hasInProgressRide(
      typeof driverOrId === "object" && driverOrId._id ? driverOrId._id : driverOrId,
      options.rideId
    );
    if (activeRide) {
      return {
        eligible: true,
        code: eligibility.code,
        message: eligibility.message,
        subscription: eligibility.subscription || null,
        usage: eligibility.usage || null,
        activeRideContinuation: true
      };
    }
  }

  return eligibility;
}

function buildEligibilityErrorPayload(eligibility) {
  return {
    status: "false",
    message: eligibility && eligibility.message
      ? eligibility.message
      : "Driver is not eligible for this action",
    error_code: eligibility && eligibility.code ? eligibility.code : SUBSCRIPTION_REQUIRED_CODE
  };
}

async function filterEligibleDrivers(drivers, options) {
  if (!Array.isArray(drivers) || drivers.length === 0) {
    return [];
  }

  if (!isDriverSubscriptionEnforcementEnabled()) {
    return drivers.filter(function (driver) {
      return isDriverAccountActive(driver);
    });
  }

  const now = options && options.now instanceof Date ? options.now : new Date();
  await expireDriverSubscriptions(now);

  const activeSubscriptions = await Subscription.find({
    customer_type: "DRIVER",
    driver_id: {
      $in: drivers.map(function (driver) { return String(driver._id); })
    },
    status: "ACTIVE",
    starts_at: {
      $lte: now
    },
    expires_at: {
      $gt: now
    }
  }).select("driver_id rides_used_today ride_count_date daily_limit_snapshot is_unlimited_snapshot").exec();

  const eligibleDriverIds = activeSubscriptions.reduce(function (result, subscription) {
    const usage = getSubscriptionUsageSnapshot(subscription, now);
    if (!usage.reached_daily_limit) {
      result[String(subscription.driver_id)] = true;
    }
    return result;
  }, {});

  return drivers.filter(function (driver) {
    return isDriverAccountActive(driver) && eligibleDriverIds[String(driver._id)] === true;
  });
}

async function applyPostRideAvailability(driverId, options) {
  const now = options && options.now instanceof Date ? options.now : new Date();
  const activeRide = await hasInProgressRide(driverId);
  let nextStatus = "0";

  if (activeRide) {
    nextStatus = "2";
  } else {
    const eligibility = await evaluateDriverEligibility(driverId, { now: now });
    nextStatus = eligibility.eligible ? "1" : "0";
  }

  await Driver.updateOne({
    _id: driverId
  }, {
    $set: {
      live_status: nextStatus
    }
  }).exec();

  return nextStatus;
}

module.exports = {
  ACTIVE_RIDE_STATUSES,
  DRIVER_ACCOUNT_INACTIVE_CODE,
  SUBSCRIPTION_EXPIRED_CODE,
  SUBSCRIPTION_LIMIT_REACHED_CODE,
  SUBSCRIPTION_REQUIRED_CODE,
  SUBSCRIPTION_SUSPENDED_CODE,
  applyPostRideAvailability,
  buildEligibilityErrorPayload,
  evaluateDriverActionEligibility,
  evaluateDriverEligibility,
  filterEligibleDrivers,
  hasInProgressRide,
  isDriverAccountActive,
  isDriverSubscriptionEnforcementEnabled
};
