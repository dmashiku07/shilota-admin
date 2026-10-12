var express = require("express");
var router = express.Router();
var Subscription = require("../schema/subscriptions");
var Driver = require("../schema/driver");
var User = require("../schema/user");
var SubscriptionPlan = require("../schema/subscriptionplans");
var SubscriptionPlanFeature = require("../schema/subscriptionplanfeatures");
var { buildActor, logAuditFromRequest } = require("../services/auditLogService");
var { canManageDriver, requireAdmin } = require("../services/adminAccessService");
var {
  buildPaginationResult,
  buildSort,
  getPaginationParams
} = require("../utils/pagination");
var {
  calculateSubscriptionWindow,
  formatDateKey,
  formatDriverSubscription,
  expireDriverSubscriptions,
  getSubscriptionUsageSnapshot,
  validatePlanForPurchase
} = require("../services/driverSubscriptionService");
var {
  expirePassengerSubscriptions,
  formatPassengerSubscription
} = require("../services/passengerSubscriptionService");

function sendValidationError(res, message) {
  return res.status(400).json({ status: "false", message: message });
}

router.post("/grant", requireAdmin, async function (req, res) {
  try {
    var driverId = String(req.body.driver_id || "").trim();
    var planId = String(req.body.plan_id || "").trim();
    var reason = String(req.body.reason || "").trim();
    var startsAt = req.body.starts_at ? new Date(req.body.starts_at) : new Date();

    if (!driverId || !planId) {
      return sendValidationError(res, "Driver and subscription plan are required");
    }
    if (reason.length < 5) {
      return sendValidationError(res, "A grant reason of at least 5 characters is required");
    }
    if (Number.isNaN(startsAt.getTime())) {
      return sendValidationError(res, "Start date is invalid");
    }

    var driver = await Driver.findById(driverId).exec();
    var plan = await SubscriptionPlan.findById(planId).exec();
    if (!driver) {
      return sendValidationError(res, "Driver not found");
    }
    if (!canManageDriver(req, driver._id)) {
      return res.status(403).json({ status: "false", message: "You are not assigned to this driver" });
    }
    if (!plan || plan.customer_type !== "DRIVER" || plan.is_active !== true) {
      return sendValidationError(res, "An active driver subscription plan is required");
    }
    var planValidationError = validatePlanForPurchase(plan);
    if (planValidationError) {
      return sendValidationError(res, planValidationError);
    }

    await expireDriverSubscriptions(new Date());
    var existing = await Subscription.findOne({
      customer_type: "DRIVER",
      driver_id: driver._id,
      status: "ACTIVE",
      expires_at: { $gt: new Date() }
    }).exec();
    if (existing) {
      return res.status(409).json({
        status: "false",
        message: "Driver already has an active subscription"
      });
    }

    var snapshot = {
      duration_unit_snapshot: plan.duration_unit,
      duration_value_snapshot: plan.duration_value
    };
    var window = calculateSubscriptionWindow(snapshot, startsAt, null);
    if (req.body.expires_at) {
      var requestedExpiry = new Date(req.body.expires_at);
      if (Number.isNaN(requestedExpiry.getTime()) || requestedExpiry <= startsAt) {
        return sendValidationError(res, "Expiry date must be after the start date");
      }
      window.expires_at = requestedExpiry;
    }

    var actor = buildActor(req);
    var features = await SubscriptionPlanFeature.find({ plan_id: plan._id }).exec();
    var subscription = await Subscription.create({
      plan_id: plan._id,
      customer_type: "DRIVER",
      driver_id: driver._id,
      status: "ACTIVE",
      payment_status: "PENDING",
      payment_reference: "",
      activation_source: "ADMIN_GRANT",
      grant_reason: reason,
      granted_by: actor.actor_id,
      granted_by_label: actor.actor_label,
      granted_at: new Date(),
      starts_at: window.starts_at,
      started_at: window.starts_at,
      expires_at: window.expires_at,
      rides_used_today: 0,
      ride_count_date: formatDateKey(startsAt),
      plan_name_snapshot: plan.name,
      price_snapshot: plan.price,
      currency_snapshot: plan.currency,
      duration_unit_snapshot: plan.duration_unit,
      duration_value_snapshot: plan.duration_value,
      daily_limit_snapshot: plan.daily_ride_limit,
      is_unlimited_snapshot: plan.is_unlimited,
      ride_credit_total_snapshot: plan.ride_credit_count,
      ride_credits_remaining: plan.ride_credit_count,
      ride_credits_consumed: 0,
      plan_features_snapshot: (features || []).map(function (feature) {
        return { feature_code: feature.feature_code, feature_value: feature.feature_value };
      })
    });

    await logAuditFromRequest(req, {
      action: "driver_subscription.admin_granted",
      target_type: "driver_subscription",
      target_id: subscription._id,
      metadata: {
        driver_id: driver._id,
        driver_name: driver.full_name,
        plan_id: plan._id,
        plan_name: plan.name,
        reason: reason,
        starts_at: window.starts_at,
        expires_at: window.expires_at,
        represents_payment: false,
        ride_credit_total: plan.ride_credit_count
      }
    });

    return res.status(201).json({
      status: "true",
      message: "Driver subscription granted successfully",
      result: formatDriverSubscription(subscription)
    });
  } catch (error) {
    return res.status(500).json({
      status: "false",
      message: error && error.message ? error.message : "Unable to grant driver subscription"
    });
  }
});

router.post("/:id/revoke", requireAdmin, async function (req, res) {
  try {
    var reason = String(req.body.reason || "").trim();
    if (reason.length < 5) {
      return sendValidationError(res, "A revoke reason of at least 5 characters is required");
    }
    var subscription = await Subscription.findOne({
      _id: req.params.id,
      customer_type: "DRIVER",
      activation_source: "ADMIN_GRANT",
      status: "ACTIVE"
    }).exec();
    if (!subscription) {
      return res.status(404).json({ status: "false", message: "Active admin grant not found" });
    }
    if (!canManageDriver(req, subscription.driver_id)) {
      return res.status(403).json({ status: "false", message: "You are not assigned to this driver" });
    }
    var actor = buildActor(req);
    subscription.status = "CANCELLED";
    subscription.revoked_by = actor.actor_id;
    subscription.revoked_at = new Date();
    subscription.revoke_reason = reason;
    await subscription.save();
    await logAuditFromRequest(req, {
      action: "driver_subscription.admin_revoked",
      target_type: "driver_subscription",
      target_id: subscription._id,
      metadata: { driver_id: subscription.driver_id, reason: reason }
    });
    return res.json({ status: "true", message: "Driver subscription grant revoked" });
  } catch (_error) {
    return res.status(500).json({ status: "false", message: "Unable to revoke driver subscription grant" });
  }
});

router.get("/", async function (req, res) {
  try {
    await expireDriverSubscriptions(new Date());
    await expirePassengerSubscriptions(new Date());
    var todayKey = formatDateKey(new Date());
    var customerType = String(req.query.customer_type || "DRIVER").trim().toUpperCase();

    var params = getPaginationParams(req, {
      defaultSortBy: "created_at",
      allowedSortFields: ["created_at", "expires_at", "status", "payment_status", "price_snapshot"]
    });

    var match = {
      customer_type: customerType
    };

    if (req.query.status) {
      match.status = String(req.query.status).trim().toUpperCase();
    }
    if (req.query.payment_status) {
      match.payment_status = String(req.query.payment_status).trim().toUpperCase();
    }
    if (req.query.plan_id) {
      match.plan_id = req.query.plan_id;
    }
    if (req.query.expiry_date) {
      var day = new Date(String(req.query.expiry_date) + "T00:00:00.000Z");
      if (!Number.isNaN(day.getTime())) {
        var nextDay = new Date(day.getTime());
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        match.expires_at = {
          $gte: day,
          $lt: nextDay
        };
      }
    }
    if (req.query.reached_limit === "true") {
      match.ride_credits_remaining = { $lte: 0 };
    } else if (req.query.reached_limit === "false") {
      match.ride_credits_remaining = { $gt: 0 };
    }

    if (customerType === "DRIVER" && req.query.driver) {
      var driverRegex = new RegExp(String(req.query.driver).trim(), "i");
      var drivers = await Driver.find({
        $or: [
          { full_name: driverRegex },
          { email: driverRegex },
          { phone_number: driverRegex }
        ]
      }).select("_id").exec();
      match.driver_id = {
        $in: drivers.map(function (driver) { return driver._id; })
      };
    } else if (customerType === "DRIVER" && req.query.driver_id) {
      match.driver_id = req.query.driver_id;
    } else if (customerType === "PASSENGER" && req.query.passenger) {
      var passengerRegex = new RegExp(String(req.query.passenger).trim(), "i");
      var passengers = await User.find({
        $or: [
          { full_name: passengerRegex },
          { email: passengerRegex }
        ]
      }).select("_id").exec();
      match.user_id = {
        $in: passengers.map(function (passenger) { return passenger._id; })
      };
    } else if (customerType === "PASSENGER" && req.query.user_id) {
      match.user_id = req.query.user_id;
    }

    var totalItems = await Subscription.countDocuments(match).exec();
    var subscriptions = await Subscription.find(match)
      .sort(buildSort(params.sortBy, params.sortDir))
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .populate("driver_id")
      .populate("user_id")
      .populate("plan_id")
      .exec();

    var items = (subscriptions || []).map(function (subscription) {
      var item = customerType === "PASSENGER"
        ? formatPassengerSubscription(subscription)
        : formatDriverSubscription(subscription);
      item.plan = subscription.plan_id ? {
        _id: subscription.plan_id._id,
        name: subscription.plan_id.name
      } : null;
      if (customerType === "PASSENGER") {
        item.user = subscription.user_id ? {
          _id: subscription.user_id._id,
          full_name: subscription.user_id.full_name,
          email: subscription.user_id.email,
          phone_number: subscription.user_id.phone_number
        } : null;
      } else {
        var usage = getSubscriptionUsageSnapshot(subscription, new Date());
        item.driver = subscription.driver_id ? {
          _id: subscription.driver_id._id,
          full_name: subscription.driver_id.full_name,
          email: subscription.driver_id.email,
          phone_number: subscription.driver_id.phone_number
        } : null;
        item.rides_used_today = usage.rides_used_today;
        item.remaining_rides = usage.remaining_rides;
        item.reached_daily_limit = usage.reached_daily_limit;
        item.ride_credit_total = usage.ride_credit_total;
        item.ride_credits_remaining = usage.ride_credits_remaining;
        item.package_exhausted = usage.package_exhausted;
      }
      return item;
    });

    return res.json(buildPaginationResult(items, totalItems, params));
  } catch (_error) {
    return res.json({
      error: true,
      msg: "Unable to load subscriptions from database"
    });
  }
});

module.exports = router;
