var express = require("express");
var router = express.Router();
var Subscription = require("../schema/subscriptions");
var Driver = require("../schema/driver");
var {
  buildPaginationResult,
  buildSort,
  getPaginationParams
} = require("../utils/pagination");
var {
  formatDateKey,
  formatDriverSubscription,
  expireDriverSubscriptions,
  getSubscriptionUsageSnapshot
} = require("../services/driverSubscriptionService");
var {
  expirePassengerSubscriptions,
  formatPassengerSubscription
} = require("../services/passengerSubscriptionService");

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
      match.is_unlimited_snapshot = {
        $ne: true
      };
      match.ride_count_date = todayKey;
      match.$expr = {
        $gte: ["$rides_used_today", "$daily_limit_snapshot"]
      };
    } else if (req.query.reached_limit === "false") {
      match.$or = [
        {
          is_unlimited_snapshot: true
        },
        {
          ride_count_date: {
            $ne: todayKey
          }
        },
        {
          $expr: {
            $lt: ["$rides_used_today", "$daily_limit_snapshot"]
          }
        }
      ];
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
