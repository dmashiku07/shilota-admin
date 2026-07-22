const cron = require("node-cron");
const timezone = require("../utils/timezone");
const Subscription = require("../schema/subscriptions");
const SubscriptionPlan = require("../schema/subscriptionplans");
const SubscriptionPlanFeature = require("../schema/subscriptionplanfeatures");
const { logAuditEvent } = require("./auditLogService");

const {
  calculateSubscriptionWindow,
  applyExpiredState,
  formatDateKey,
  takePlanSnapshot
} = require("./driverSubscriptionService");

const PASSENGER_SUBSCRIPTION_ACTOR_TYPE = "passenger_subscription";
const PASSENGER_CUSTOMER_TYPE = "PASSENGER";

function normalizeFeatureCode(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeFeatureValue(value) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    if (trimmed === "true") {
      return true;
    }
    if (trimmed === "false") {
      return false;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric) && trimmed === String(numeric)) {
      return numeric;
    }
    return trimmed;
  }
  return value;
}

function formatFeature(feature) {
  return {
    feature_code: normalizeFeatureCode(feature && feature.feature_code),
    feature_value: normalizeFeatureValue(feature && feature.feature_value)
  };
}

async function loadPlanFeatures(planIds) {
  const ids = Array.isArray(planIds)
    ? planIds.map(function (id) { return String(id || "").trim(); }).filter(Boolean)
    : [];
  if (ids.length === 0) {
    return {};
  }

  const features = await SubscriptionPlanFeature.find({
    plan_id: {
      $in: ids
    }
  }).sort({ feature_code: 1 }).exec();

  return (features || []).reduce(function (result, feature) {
    const key = String(feature.plan_id);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(formatFeature(feature));
    return result;
  }, {});
}

function buildPassengerFeatureSnapshot(planFeatures) {
  return (planFeatures || []).map(function (feature) {
    return {
      feature_code: normalizeFeatureCode(feature.feature_code),
      feature_value: normalizeFeatureValue(feature.feature_value)
    };
  });
}

function buildPendingPassengerSubscriptionRecord(userId, plan, planFeatures, now) {
  const snapshot = takePlanSnapshot(plan);
  return {
    customer_type: PASSENGER_CUSTOMER_TYPE,
    user_id: userId,
    plan_id: plan._id,
    status: "PENDING_PAYMENT",
    payment_status: "PENDING",
    payment_reference: "",
    starts_at: null,
    expires_at: null,
    rides_used_today: 0,
    ride_count_date: formatDateKey(now),
    broadcasts_used_today: 0,
    broadcast_count_date: formatDateKey(now),
    plan_name_snapshot: snapshot.plan_name_snapshot,
    price_snapshot: snapshot.price_snapshot,
    currency_snapshot: snapshot.currency_snapshot,
    duration_unit_snapshot: snapshot.duration_unit_snapshot,
    duration_value_snapshot: snapshot.duration_value_snapshot,
    daily_limit_snapshot: null,
    is_unlimited_snapshot: false,
    plan_features_snapshot: buildPassengerFeatureSnapshot(planFeatures)
  };
}

function validatePassengerPlanForPurchase(plan) {
  if (!plan) {
    return "Subscription plan not found";
  }
  if (String(plan.customer_type || "").toUpperCase() !== PASSENGER_CUSTOMER_TYPE) {
    return "Subscription plan is not available for passengers";
  }
  if (plan.is_active !== true) {
    return "Subscription plan is not active";
  }
  return "";
}

async function expirePassengerSubscriptions(now) {
  const comparisonDate = now instanceof Date ? now : new Date();
  const activeSubscriptions = await Subscription.find({
    customer_type: PASSENGER_CUSTOMER_TYPE,
    status: "ACTIVE",
    expires_at: {
      $lte: comparisonDate
    }
  }).select("_id user_id plan_id plan_name_snapshot expires_at").exec();

  await Subscription.updateMany(
    {
      customer_type: PASSENGER_CUSTOMER_TYPE,
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
      action: "passenger_subscription.expired",
      target_type: "passenger_subscription",
      target_id: subscription._id,
      metadata: {
        user_id: subscription.user_id,
        plan_id: subscription.plan_id,
        plan_name_snapshot: subscription.plan_name_snapshot,
        expires_at: subscription.expires_at
      }
    });
  }));
}

async function getCurrentPassengerSubscription(userId, now) {
  const comparisonDate = now instanceof Date ? now : new Date();
  await expirePassengerSubscriptions(comparisonDate);
  return Subscription.findOne({
    customer_type: PASSENGER_CUSTOMER_TYPE,
    user_id: userId,
    status: "ACTIVE",
    starts_at: {
      $lte: comparisonDate
    },
    expires_at: {
      $gt: comparisonDate
    }
  }).sort({ expires_at: -1, created_at: -1 }).exec();
}

function resetPassengerBroadcastUsageIfNeeded(subscription, now) {
  const todayKey = formatDateKey(now);
  if (String(subscription.broadcast_count_date || "") !== todayKey) {
    subscription.broadcast_count_date = todayKey;
    subscription.broadcasts_used_today = 0;
  }
  return subscription;
}

function formatPassengerSubscription(subscription) {
  if (!subscription) {
    return null;
  }

  return {
    _id: subscription._id,
    customer_type: subscription.customer_type,
    user_id: subscription.user_id,
    plan_id: subscription.plan_id,
    status: subscription.status,
    payment_status: subscription.payment_status,
    payment_reference: subscription.payment_reference,
    starts_at: subscription.starts_at,
    expires_at: subscription.expires_at,
    plan_name_snapshot: subscription.plan_name_snapshot,
    price_snapshot: subscription.price_snapshot,
    currency_snapshot: subscription.currency_snapshot,
    duration_unit_snapshot: subscription.duration_unit_snapshot,
    duration_value_snapshot: subscription.duration_value_snapshot,
    plan_features_snapshot: Array.isArray(subscription.plan_features_snapshot)
      ? subscription.plan_features_snapshot.map(formatFeature)
      : [],
    created_at: subscription.created_at,
    updated_at: subscription.updated_at
  };
}

async function activatePassengerSubscriptionPayment(options) {
  const subscription = options && options.subscription;
  const paymentReference = options && options.paymentReference;
  const now = options && options.now instanceof Date ? options.now : new Date();
  const currentActiveSubscription = options && options.currentActiveSubscription;
  if (!subscription) {
    return {
      activated: false,
      reason: "missing_subscription"
    };
  }

  const window = calculateSubscriptionWindow(
    subscription,
    now,
    currentActiveSubscription && currentActiveSubscription.expires_at instanceof Date
      ? currentActiveSubscription.expires_at
      : null
  );

  subscription.status = "ACTIVE";
  subscription.payment_status = "PAID";
  subscription.payment_reference = String(paymentReference || "");
  subscription.starts_at = window.starts_at;
  subscription.expires_at = window.expires_at;
  await subscription.save();
  await logAuditEvent({
    actor_type: "system",
    actor_id: "",
    actor_label: "payment_verifier",
    action: "passenger_subscription.activated",
    target_type: "passenger_subscription",
    target_id: subscription._id,
    metadata: {
      user_id: subscription.user_id,
      plan_id: subscription.plan_id,
      payment_reference: subscription.payment_reference,
      starts_at: subscription.starts_at,
      expires_at: subscription.expires_at
    }
  });

  return {
    activated: true,
    reason: "activated",
    subscription: subscription
  };
}

async function markPassengerSubscriptionPaymentFailed(subscription, paymentReference) {
  if (!subscription) {
    return {
      updated: false,
      reason: "missing_subscription"
    };
  }

  if (String(subscription.payment_status || "").toUpperCase() === "FAILED") {
    return {
      updated: false,
      reason: "already_failed",
      subscription: subscription
    };
  }

  subscription.status = "PAYMENT_FAILED";
  subscription.payment_status = "FAILED";
  subscription.payment_reference = String(paymentReference || subscription.payment_reference || "");
  await subscription.save();
  await logAuditEvent({
    actor_type: "system",
    actor_id: "",
    actor_label: "payment_verifier",
    action: "passenger_subscription.payment_failed",
    target_type: "passenger_subscription",
    target_id: subscription._id,
    metadata: {
      user_id: subscription.user_id,
      plan_id: subscription.plan_id,
      payment_reference: subscription.payment_reference
    }
  });

  return {
    updated: true,
    reason: "payment_failed",
    subscription: subscription
  };
}

async function finalizePassengerSubscriptionSession(session, now) {
  if (!session || !session.subscription_id) {
    return {
      activated: false,
      reason: "missing_subscription"
    };
  }

  const subscription = await Subscription.findById(session.subscription_id).exec();
  if (!subscription) {
    return {
      activated: false,
      reason: "subscription_not_found"
    };
  }

  if (String(subscription.status || "").toUpperCase() === "ACTIVE" && String(subscription.payment_status || "").toUpperCase() === "PAID") {
    return {
      activated: false,
      reason: "already_active",
      subscription: subscription
    };
  }

  const failedStatuses = ["failed", "cancelled", "declined"];
  if (failedStatuses.indexOf(String(session.status || "").toLowerCase()) >= 0 || String(session.payment_status || "").toLowerCase() === "failed") {
    return markPassengerSubscriptionPaymentFailed(subscription, session.reference || session.transid || "");
  }

  if (session.status !== "verified" && session.status !== "completed" && !session.verified_at) {
    return {
      activated: false,
      reason: "not_verified",
      subscription: subscription
    };
  }

  const currentActiveSubscription = await Subscription.findOne({
    customer_type: PASSENGER_CUSTOMER_TYPE,
    user_id: subscription.user_id,
    status: "ACTIVE",
    expires_at: {
      $gt: now instanceof Date ? now : new Date()
    }
  }).sort({ expires_at: -1, created_at: -1 }).exec();

  return activatePassengerSubscriptionPayment({
    subscription: subscription,
    paymentReference: session.reference || session.transid || "",
    currentActiveSubscription: currentActiveSubscription && String(currentActiveSubscription._id) !== String(subscription._id)
      ? currentActiveSubscription
      : null,
    now: now
  });
}

function featureValueFromSnapshot(subscription, featureCode) {
  const normalizedCode = normalizeFeatureCode(featureCode);
  const features = Array.isArray(subscription && subscription.plan_features_snapshot)
    ? subscription.plan_features_snapshot
    : [];
  const match = features.find(function (feature) {
    return normalizeFeatureCode(feature && feature.feature_code) === normalizedCode;
  });
  return match ? normalizeFeatureValue(match.feature_value) : null;
}

async function passengerHasFeature(passengerId, featureCode) {
  const subscription = await getCurrentPassengerSubscription(passengerId, new Date());
  if (!subscription) {
    return false;
  }
  const value = featureValueFromSnapshot(subscription, featureCode);
  if (value === null || typeof value === "undefined") {
    return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value > 0;
  }
  return String(value || "").trim().length > 0;
}

async function getPassengerFeatureMap(passengerId) {
  const subscription = await getCurrentPassengerSubscription(passengerId, new Date());
  const features = Array.isArray(subscription && subscription.plan_features_snapshot)
    ? subscription.plan_features_snapshot
    : [];
  return features.reduce(function (result, feature) {
    result[normalizeFeatureCode(feature.feature_code)] = normalizeFeatureValue(feature.feature_value);
    return result;
  }, {});
}

async function getCurrentPassengerSubscriptionWithFeatures(passengerId, now) {
  const subscription = await getCurrentPassengerSubscription(passengerId, now);
  const features = Array.isArray(subscription && subscription.plan_features_snapshot)
    ? subscription.plan_features_snapshot
    : [];
  const featureMap = features.reduce(function (result, feature) {
    result[normalizeFeatureCode(feature.feature_code)] = normalizeFeatureValue(feature.feature_value);
    return result;
  }, {});
  return {
    subscription: subscription,
    featureMap: featureMap
  };
}

async function consumePassengerBroadcastUsage(options) {
  const now = options && options.now instanceof Date ? options.now : new Date();
  const subscription = options && options.subscription;
  const configuredLimit = Number(options && options.configuredLimit);

  if (!subscription) {
    return {
      ok: false,
      code: "PASSENGER_SUBSCRIPTION_REQUIRED",
      message: "An active passenger subscription is required",
      remaining: 0
    };
  }

  resetPassengerBroadcastUsageIfNeeded(subscription, now);
  const features = Array.isArray(subscription.plan_features_snapshot)
    ? subscription.plan_features_snapshot
    : [];
  const featureMap = features.reduce(function (result, feature) {
    result[normalizeFeatureCode(feature.feature_code)] = normalizeFeatureValue(feature.feature_value);
    return result;
  }, {});
  const subscriptionLimit = Number(featureMap.MAX_PRICE_BROADCASTS_PER_DAY);
  let effectiveLimit = null;
  if (Number.isFinite(subscriptionLimit) && subscriptionLimit >= 0) {
    effectiveLimit = subscriptionLimit;
  }
  if (Number.isFinite(configuredLimit) && configuredLimit >= 0) {
    effectiveLimit = effectiveLimit === null ? configuredLimit : Math.min(effectiveLimit, configuredLimit);
  }

  if (effectiveLimit !== null && Number(subscription.broadcasts_used_today || 0) >= effectiveLimit) {
    return {
      ok: false,
      code: "PASSENGER_BROADCAST_LIMIT_REACHED",
      message: "You have reached your daily price broadcast limit",
      remaining: 0,
      limit: effectiveLimit
    };
  }

  subscription.broadcast_count_date = formatDateKey(now);
  subscription.broadcasts_used_today = Number(subscription.broadcasts_used_today || 0) + 1;
  await subscription.save();

  return {
    ok: true,
    remaining: effectiveLimit === null ? null : Math.max(effectiveLimit - Number(subscription.broadcasts_used_today || 0), 0),
    limit: effectiveLimit
  };
}

let passengerSubscriptionCronInitialized = false;

function initializeSchedulers() {
  if (passengerSubscriptionCronInitialized) {
    return;
  }
  passengerSubscriptionCronInitialized = true;

  cron.schedule("*/20 * * * *", function () {
    expirePassengerSubscriptions(new Date()).catch(function (error) {
      console.error("Passenger subscription expiration task failed:", error);
    });
  }, {
    timezone: timezone.DEFAULT_TIMEZONE
  });
}

module.exports = {
  PASSENGER_CUSTOMER_TYPE,
  PASSENGER_SUBSCRIPTION_ACTOR_TYPE,
  activatePassengerSubscriptionPayment,
  buildPendingPassengerSubscriptionRecord,
  buildPassengerFeatureSnapshot,
  expirePassengerSubscriptions,
  featureValueFromSnapshot,
  finalizePassengerSubscriptionSession,
  formatPassengerSubscription,
  getCurrentPassengerSubscription,
  getCurrentPassengerSubscriptionWithFeatures,
  getPassengerFeatureMap,
  initializeSchedulers,
  loadPlanFeatures,
  markPassengerSubscriptionPaymentFailed,
  consumePassengerBroadcastUsage,
  passengerHasFeature,
  resetPassengerBroadcastUsageIfNeeded,
  validatePassengerPlanForPurchase
};
