const cron = require("node-cron");
const timezone = require("../utils/timezone");
const Subscription = require("../schema/subscriptions");
const SubscriptionPlan = require("../schema/subscriptionplans");
const Rides = require("../schema/rides");
const { logAuditEvent } = require("./auditLogService");

const DRIVER_SUBSCRIPTION_ACTOR_TYPE = "driver_subscription";
const DRIVER_CUSTOMER_TYPE = "DRIVER";
const ACTIVE_SUBSCRIPTION_STATUSES = ["ACTIVE"];
const PENDING_SUBSCRIPTION_STATUSES = ["PENDING_PAYMENT"];

function formatDateKey(date) {
  return timezone.formatInTimezone(date || new Date(), timezone.DEFAULT_TIMEZONE).slice(0, 10);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function cloneDate(value) {
  return value instanceof Date ? new Date(value.getTime()) : new Date(value);
}

function addDuration(date, unit, value) {
  const result = cloneDate(date);
  const durationValue = Math.max(parseInt(value, 10) || 1, 1);
  const normalizedUnit = String(unit || "").toUpperCase();
  if (normalizedUnit === "WEEK") {
    result.setDate(result.getDate() + (durationValue * 7));
    return result;
  }
  if (normalizedUnit === "MONTH") {
    result.setMonth(result.getMonth() + durationValue);
    return result;
  }
  result.setDate(result.getDate() + durationValue);
  return result;
}

function takePlanSnapshot(plan) {
  return {
    plan_name_snapshot: String(plan.name || "").trim(),
    price_snapshot: toNumber(plan.price),
    currency_snapshot: String(plan.currency || "TZS").trim().toUpperCase(),
    duration_unit_snapshot: String(plan.duration_unit || "").trim().toUpperCase(),
    duration_value_snapshot: Math.max(parseInt(plan.duration_value, 10) || 1, 1),
    daily_limit_snapshot:
      typeof plan.daily_ride_limit === "number" && Number.isFinite(plan.daily_ride_limit)
        ? plan.daily_ride_limit
        : null,
    is_unlimited_snapshot: !!plan.is_unlimited
  };
}

function buildPendingDriverSubscriptionRecord(driverId, plan, now) {
  const snapshot = takePlanSnapshot(plan);
  const todayKey = formatDateKey(now);
  return {
    customer_type: DRIVER_CUSTOMER_TYPE,
    driver_id: driverId,
    plan_id: plan._id,
    status: "PENDING_PAYMENT",
    payment_status: "PENDING",
    payment_reference: "",
    starts_at: null,
    expires_at: null,
    rides_used_today: 0,
    ride_count_date: todayKey,
    plan_name_snapshot: snapshot.plan_name_snapshot,
    price_snapshot: snapshot.price_snapshot,
    currency_snapshot: snapshot.currency_snapshot,
    duration_unit_snapshot: snapshot.duration_unit_snapshot,
    duration_value_snapshot: snapshot.duration_value_snapshot,
    daily_limit_snapshot: snapshot.daily_limit_snapshot,
    is_unlimited_snapshot: snapshot.is_unlimited_snapshot
  };
}

function validatePlanForPurchase(plan) {
  if (!plan) {
    return "Subscription plan not found";
  }
  if (String(plan.customer_type || "").toUpperCase() !== DRIVER_CUSTOMER_TYPE) {
    return "Subscription plan is not available for drivers";
  }
  if (plan.is_active !== true) {
    return "Subscription plan is not active";
  }
  return "";
}

function calculateSubscriptionWindow(planSnapshot, now, currentExpiry) {
  const baseStart =
    currentExpiry instanceof Date && currentExpiry.getTime() > now.getTime()
      ? cloneDate(currentExpiry)
      : cloneDate(now);
  const expiresAt = addDuration(
    baseStart,
    planSnapshot.duration_unit_snapshot,
    planSnapshot.duration_value_snapshot
  );
  return {
    starts_at: baseStart,
    expires_at: expiresAt
  };
}

function applyExpiredState(subscription, now) {
  const comparisonDate = now instanceof Date ? now : new Date();
  if (
    subscription &&
    String(subscription.status || "").toUpperCase() === "ACTIVE" &&
    subscription.expires_at instanceof Date &&
    subscription.expires_at.getTime() <= comparisonDate.getTime()
  ) {
    subscription.status = "EXPIRED";
    return true;
  }
  return false;
}

async function expireDriverSubscriptions(now) {
  const comparisonDate = now instanceof Date ? now : new Date();
  const activeSubscriptions = await Subscription.find({
    customer_type: DRIVER_CUSTOMER_TYPE,
    status: "ACTIVE",
    expires_at: {
      $lte: comparisonDate
    }
  }).select("_id driver_id plan_id plan_name_snapshot expires_at").exec();

  await Subscription.updateMany(
    {
      customer_type: DRIVER_CUSTOMER_TYPE,
      status: "ACTIVE",
      expires_at: {
        $lte: comparisonDate
      }
    },
    {
      $set: {
        status: "EXPIRED"
      }
    }
  ).exec();

  await Promise.all((activeSubscriptions || []).map(function (subscription) {
    return logAuditEvent({
      actor_type: "system",
      actor_id: "",
      actor_label: "scheduler",
      action: "driver_subscription.expired",
      target_type: "driver_subscription",
      target_id: subscription._id,
      metadata: {
        driver_id: subscription.driver_id,
        plan_id: subscription.plan_id,
        plan_name_snapshot: subscription.plan_name_snapshot,
        expires_at: subscription.expires_at
      }
    });
  }));
}

async function getCurrentDriverSubscription(driverId, now) {
  const comparisonDate = now instanceof Date ? now : new Date();
  await expireDriverSubscriptions(comparisonDate);
  return Subscription.findOne({
    customer_type: DRIVER_CUSTOMER_TYPE,
    driver_id: driverId,
    status: "ACTIVE",
    starts_at: {
      $lte: comparisonDate
    },
    expires_at: {
      $gt: comparisonDate
    }
  }).sort({ expires_at: -1, created_at: -1 }).exec();
}

function resetDailyUsageIfNeeded(subscription, now) {
  const todayKey = formatDateKey(now);
  if (String(subscription.ride_count_date || "") !== todayKey) {
    subscription.ride_count_date = todayKey;
    subscription.rides_used_today = 0;
  }
  return subscription;
}

function getSubscriptionUsageSnapshot(subscription, now) {
  const todayKey = formatDateKey(now);
  if (!subscription) {
    return {
      rides_used_today: 0,
      ride_count_date: todayKey,
      daily_limit: null,
      remaining_rides: null,
      is_unlimited: false,
      reached_daily_limit: false
    };
  }

  resetDailyUsageIfNeeded(subscription, now);
  const isUnlimited = !!subscription.is_unlimited_snapshot;
  const dailyLimit = isUnlimited ? null : Math.max(parseInt(subscription.daily_limit_snapshot, 10) || 0, 0);
  const ridesUsedToday = Math.max(parseInt(subscription.rides_used_today, 10) || 0, 0);
  const remainingRides = isUnlimited ? null : Math.max(dailyLimit - ridesUsedToday, 0);

  return {
    rides_used_today: ridesUsedToday,
    ride_count_date: String(subscription.ride_count_date || todayKey),
    daily_limit: dailyLimit,
    remaining_rides: remainingRides,
    is_unlimited: isUnlimited,
    reached_daily_limit: isUnlimited ? false : remainingRides <= 0
  };
}

function buildSubscriptionUsageLabel(subscription, now) {
  const usage = getSubscriptionUsageSnapshot(subscription, now);
  if (usage.is_unlimited) {
    return "Unlimited rides";
  }
  return String(usage.rides_used_today) + " / " + String(usage.daily_limit || 0) + " rides used today • " + String(usage.remaining_rides || 0) + " remaining";
}

async function getLatestDriverSubscription(driverId) {
  return Subscription.findOne({
    customer_type: DRIVER_CUSTOMER_TYPE,
    driver_id: driverId
  }).sort({ updated_at: -1, created_at: -1 }).exec();
}

async function resolveSubscriptionForRideUsage(driverId, now) {
  const activeSubscription = await getCurrentDriverSubscription(driverId, now);
  if (activeSubscription) {
    return activeSubscription;
  }
  return getLatestDriverSubscription(driverId);
}

async function resetDailyUsageCounters(now) {
  const comparisonDate = now instanceof Date ? now : new Date();
  const todayKey = formatDateKey(comparisonDate);

  await Subscription.updateMany(
    {
      customer_type: DRIVER_CUSTOMER_TYPE,
      status: {
        $in: ["ACTIVE", "EXPIRED", "SUSPENDED"]
      },
      ride_count_date: {
        $ne: todayKey
      }
    },
    {
      $set: {
        ride_count_date: todayKey,
        rides_used_today: 0
      }
    }
  ).exec();
}

async function consumeCompletedRideUsage(options) {
  const now = options && options.now instanceof Date ? options.now : new Date();
  const rideId = options && options.rideId;
  const driverId = options && options.driverId;

  if (!rideId || !driverId) {
    return {
      counted: false,
      reason: "missing_input",
      subscription: null,
      usage: null
    };
  }

  const countedRide = await Rides.findOneAndUpdate(
    {
      _id: rideId,
      driver_id: String(driverId),
      ridestatus: "completed",
      $or: [
        { subscription_usage_counted_at: { $exists: false } },
        { subscription_usage_counted_at: null }
      ]
    },
    {
      $set: {
        subscription_usage_counted_at: now
      }
    },
    {
      new: true
    }
  ).exec();

  if (!countedRide) {
    const existingSubscription = await resolveSubscriptionForRideUsage(driverId, now);
    return {
      counted: false,
      reason: "already_counted",
      subscription: existingSubscription,
      usage: existingSubscription ? getSubscriptionUsageSnapshot(existingSubscription, now) : null
    };
  }

  const subscription = await resolveSubscriptionForRideUsage(driverId, now);
  if (!subscription) {
    return {
      counted: false,
      reason: "no_subscription",
      subscription: null,
      usage: null
    };
  }

  const todayKey = formatDateKey(now);
  await Subscription.updateOne(
    {
      _id: subscription._id,
      ride_count_date: {
        $ne: todayKey
      }
    },
    {
      $set: {
        ride_count_date: todayKey,
        rides_used_today: 0
      }
    }
  ).exec();

  const updatedSubscription = await Subscription.findOneAndUpdate(
    {
      _id: subscription._id
    },
    {
      $inc: {
        rides_used_today: 1
      },
      $set: {
        ride_count_date: todayKey
      }
    },
    {
      new: true
    }
  ).exec();

  return {
    counted: true,
    reason: "counted",
    subscription: updatedSubscription,
    usage: updatedSubscription ? getSubscriptionUsageSnapshot(updatedSubscription, now) : null
  };
}

async function activateDriverSubscriptionPayment(options) {
  const now = options && options.now instanceof Date ? options.now : new Date();
  const subscription = options && options.subscription;
  const paymentReference = String(options && options.paymentReference || "").trim();
  const currentActiveSubscription = options && options.currentActiveSubscription;

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  if (String(subscription.status || "").toUpperCase() === "ACTIVE" && String(subscription.payment_status || "").toUpperCase() === "PAID") {
    return {
      subscription,
      activated: false,
      reason: "already_active"
    };
  }

  const window = calculateSubscriptionWindow(subscription, now, currentActiveSubscription && currentActiveSubscription.expires_at);
  subscription.starts_at = window.starts_at;
  subscription.expires_at = window.expires_at;
  subscription.status = "ACTIVE";
  subscription.payment_status = "PAID";
  subscription.payment_reference = paymentReference || subscription.payment_reference || "";
  resetDailyUsageIfNeeded(subscription, now);
  await subscription.save();
  await logAuditEvent({
    actor_type: "system",
    actor_id: "",
    actor_label: "payment_verifier",
    action: "driver_subscription.activated",
    target_type: "driver_subscription",
    target_id: subscription._id,
    metadata: {
      driver_id: subscription.driver_id,
      plan_id: subscription.plan_id,
      payment_reference: subscription.payment_reference,
      starts_at: subscription.starts_at,
      expires_at: subscription.expires_at
    }
  });

  return {
    subscription,
    activated: true,
    reason: "activated"
  };
}

async function markDriverSubscriptionPaymentFailed(subscription, paymentReference) {
  if (!subscription) {
    throw new Error("Subscription not found");
  }
  if (
    String(subscription.status || "").toUpperCase() === "ACTIVE" &&
    String(subscription.payment_status || "").toUpperCase() === "PAID"
  ) {
    return {
      subscription,
      updated: false,
      reason: "already_paid"
    };
  }

  subscription.status = "PAYMENT_FAILED";
  subscription.payment_status = "FAILED";
  subscription.payment_reference = String(paymentReference || subscription.payment_reference || "").trim();
  await subscription.save();
  await logAuditEvent({
    actor_type: "system",
    actor_id: "",
    actor_label: "payment_verifier",
    action: "driver_subscription.payment_failed",
    target_type: "driver_subscription",
    target_id: subscription._id,
    metadata: {
      driver_id: subscription.driver_id,
      plan_id: subscription.plan_id,
      payment_reference: subscription.payment_reference
    }
  });
  return {
    subscription,
    updated: true,
    reason: "payment_failed"
  };
}

async function finalizeSubscriptionSession(session, now) {
  if (!session || !session.subscription_id) {
    return null;
  }

  const comparisonDate = now instanceof Date ? now : new Date();
  const subscription = await Subscription.findById(session.subscription_id).exec();
  if (!subscription) {
    return null;
  }

  if (session.status === "verified" || session.status === "completed" || session.verified_at) {
    const currentActiveSubscription = await Subscription.findOne({
      customer_type: DRIVER_CUSTOMER_TYPE,
      driver_id: subscription.driver_id,
      status: "ACTIVE",
      starts_at: {
        $lte: comparisonDate
      },
      expires_at: {
        $gt: comparisonDate
      },
      _id: {
        $ne: subscription._id
      }
    }).sort({ expires_at: -1, created_at: -1 }).exec();

    return activateDriverSubscriptionPayment({
      subscription,
      paymentReference: session.reference || session.transid,
      currentActiveSubscription,
      now: comparisonDate
    });
  }

  if (session.status === "failed") {
    return markDriverSubscriptionPaymentFailed(subscription, session.reference || session.transid);
  }

  return {
    subscription,
    activated: false,
    reason: "pending"
  };
}

function formatDriverSubscription(subscription) {
  if (!subscription) {
    return null;
  }

  const usage = getSubscriptionUsageSnapshot(subscription, new Date());
  return {
    _id: subscription._id,
    driver_id: subscription.driver_id,
    plan_id: subscription.plan_id,
    starts_at: subscription.starts_at,
    expires_at: subscription.expires_at,
    status: subscription.status,
    payment_status: subscription.payment_status,
    payment_reference: subscription.payment_reference,
    activation_source: subscription.activation_source || "SELCOM",
    grant_reason: subscription.grant_reason || "",
    granted_by: subscription.granted_by || "",
    granted_by_label: subscription.granted_by_label || "",
    granted_at: subscription.granted_at || null,
    revoked_at: subscription.revoked_at || null,
    revoke_reason: subscription.revoke_reason || "",
    rides_used_today: subscription.rides_used_today,
    ride_count_date: subscription.ride_count_date,
    plan_name_snapshot: subscription.plan_name_snapshot,
    price_snapshot: subscription.price_snapshot,
    currency_snapshot: subscription.currency_snapshot,
    duration_unit_snapshot: subscription.duration_unit_snapshot,
    duration_value_snapshot: subscription.duration_value_snapshot,
    daily_limit_snapshot: subscription.daily_limit_snapshot,
    is_unlimited_snapshot: subscription.is_unlimited_snapshot,
    remaining_rides: usage.remaining_rides,
    reached_daily_limit: usage.reached_daily_limit,
    created_at: subscription.created_at,
    updated_at: subscription.updated_at
  };
}

function initializeSchedulers() {
  cron.schedule("*/15 * * * *", function () {
    expireDriverSubscriptions(new Date()).catch(function (error) {
      console.error("Unable to expire driver subscriptions:", error);
    });
  });
  cron.schedule("5 0 * * *", function () {
    resetDailyUsageCounters(new Date()).catch(function (error) {
      console.error("Unable to reset driver subscription daily usage:", error);
    });
  }, {
    timezone: timezone.DEFAULT_TIMEZONE
  });
}

module.exports = {
  ACTIVE_SUBSCRIPTION_STATUSES,
  DRIVER_CUSTOMER_TYPE,
  DRIVER_SUBSCRIPTION_ACTOR_TYPE,
  PENDING_SUBSCRIPTION_STATUSES,
  activateDriverSubscriptionPayment,
  applyExpiredState,
  buildSubscriptionUsageLabel,
  buildPendingDriverSubscriptionRecord,
  calculateSubscriptionWindow,
  consumeCompletedRideUsage,
  expireDriverSubscriptions,
  finalizeSubscriptionSession,
  formatDateKey,
  formatDriverSubscription,
  getCurrentDriverSubscription,
  getLatestDriverSubscription,
  getSubscriptionUsageSnapshot,
  initializeSchedulers,
  markDriverSubscriptionPaymentFailed,
  resetDailyUsageCounters,
  resetDailyUsageIfNeeded,
  takePlanSnapshot,
  validatePlanForPurchase
};
