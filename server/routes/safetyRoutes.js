var express = require("express");
var router = express.Router();
var async = require("async");
var SosAlerts = require("../schema/sosalerts");
var LostItems = require("../schema/lostitems");
var LostItemMessages = require("../schema/lostitemmessages");
var RiderBlocks = require("../schema/riderblocks");
var CallLogs = require("../schema/calllogs");
var PoolSettings = require("../schema/poolsettings");
var PriceBroadcastSettings = require("../schema/pricebroadcastsettings");
var DestinationBroadcastSettings = require("../schema/destinationbroadcastsettings");
var Rides = require("../schema/rides");
var DriverDestinationBroadcast = require("../schema/driverdestinationbroadcasts");
var DriverDestinationJoinRequest = require("../schema/driverdestinationjoinrequests");
var Driver = require("../schema/driver");
var User = require("../schema/user");
var DriverDevices = require("../schema/driverdevices");
var pushService = require("../services/pushService");
var { logAuditFromRequest } = require("../services/auditLogService");

function toNumber(value) {
  var parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  var radius = 6371;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function intensityFromCount(count) {
  if (count >= 8) {
    return "high";
  }
  if (count >= 4) {
    return "medium";
  }
  return "low";
}

function normalizeZoneOverrides(value) {
  var items = value;
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch (_error) {
      items = [];
    }
  }

  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map(function (item) {
      return {
        zone_key: String(item && (item.zone_key || item.zoneKey) || "").trim(),
        label: String(item && item.label || "").trim(),
        enabled: !(item && (item.enabled === false || item.enabled === "false" || item.enabled === 0 || item.enabled === "0"))
      };
    })
    .filter(function (item) {
      return item.zone_key;
    });
}

function resolveCase(Model, req, res) {
  Model.findOneAndUpdate(
    {
      _id: req.params.id
    },
    {
      $set: {
        status: req.body.status || "resolved",
        admin_notes: req.body.admin_notes || req.body.notes || "",
        resolved_by: req.body.resolved_by || "admin",
        resolved_at: new Date(),
        callback_status: req.body.callback_status || "completed"
      }
    },
    {
      new: true
    }
  ).exec(function (err, record) {
    if (err || !record) {
      return res.json({
        status: "false",
        message: "Unable to update case"
      });
    }
    logAuditFromRequest(req, {
      action: String(Model.modelName || "case").toLowerCase() + ".resolved",
      target_type: String(Model.modelName || "case").toLowerCase(),
      target_id: record._id,
      metadata: {
        status: record.status,
        callback_status: record.callback_status
      }
    });
    return res.json({
      status: "true",
      data: record
    });
  });
}

router.get("/sosalerts", function (_req, res) {
  SosAlerts.find({})
    .sort({ created_at: -1 })
    .limit(100)
    .populate("ride_id")
    .populate("actor_id")
    .exec(function (err, alerts) {
      if (err) {
        return res.json({ status: "false", data: [] });
      }
      return res.json({ status: "true", data: alerts });
    });
});

router.post("/sosalerts/:id/resolve", function (req, res) {
  resolveCase(SosAlerts, req, res);
});

router.get("/lostitems", function (_req, res) {
  LostItems.updateMany(
    {
      status: { $nin: ["resolved", "returned"] },
      response_due_at: { $lte: new Date() },
      escalation_status: { $ne: "escalated" }
    },
    {
      $set: {
        escalation_status: "escalated",
        escalated_at: new Date()
      }
    }
  ).exec(function () {});

  LostItems.find({})
    .sort({ created_at: -1 })
    .limit(100)
    .populate("ride_id")
    .populate("user_id")
    .populate("driver_id")
    .exec(function (err, cases) {
      if (err) {
        return res.json({ status: "false", data: [] });
      }
      return res.json({ status: "true", data: cases });
    });
});

router.post("/lostitems/:id/resolve", function (req, res) {
  resolveCase(LostItems, req, res);
});

router.get("/lostitems/:id/messages", function (req, res) {
  LostItemMessages.find({
    lost_item_id: req.params.id
  }).sort({ created_at: 1 }).exec(function (err, messages) {
    if (err) {
      return res.json({ status: "false", data: [] });
    }
    LostItems.updateOne(
      {
        _id: req.params.id
      },
      {
        $set: {
          unread_admin_count: 0
        }
      }
    ).exec(function () {});
    return res.json({ status: "true", data: messages });
  });
});

router.get("/calllogs", function (req, res) {
  var abuseStatus = String(req.query.abuse_status || "").trim().toLowerCase();
  var status = String(req.query.status || "").trim().toLowerCase();
  var query = {
    created_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
  };

  if (abuseStatus) {
    query.abuse_flag_status = abuseStatus;
  }
  if (status) {
    query.status = status;
  }

  CallLogs.find(query)
    .sort({ created_at: -1 })
    .limit(200)
    .populate("onride_id")
    .exec(function (err, logs) {
      if (err) {
        return res.json({ status: "false", data: [] });
      }
      return res.json({ status: "true", data: logs || [] });
    });
});

router.post("/calllogs/:id/review", function (req, res) {
  CallLogs.findOneAndUpdate(
    { _id: req.params.id },
    {
      $set: {
        abuse_flag_status: req.body.abuse_flag_status || "reviewed",
        abuse_notes: String(req.body.abuse_notes || "").trim(),
        reviewed_by: String(req.body.reviewed_by || "admin").trim(),
        reviewed_at: new Date()
      }
    },
    { new: true }
  ).exec(function (err, log) {
    if (err || !log) {
      return res.json({ status: "false", message: "Unable to review call log" });
    }
    logAuditFromRequest(req, {
      action: "call_log.reviewed",
      target_type: "call_log",
      target_id: log._id,
      metadata: {
        abuse_flag_status: log.abuse_flag_status
      }
    });
    return res.json({ status: "true", data: log });
  });
});

router.get("/poolsettings", function (_req, res) {
  PoolSettings.findOne().sort({ updated_at: -1 }).exec(function (err, settings) {
    if (err) {
      return res.json({ status: "false", message: "Unable to load pooling settings" });
    }
    return res.json({
      status: "true",
      data: settings || {
        enabled: true,
        discount_percent: 15,
        max_passengers: 3,
        max_detour_km: 3,
        max_pickup_gap_km: 2,
        max_drop_gap_km: 3,
        zone_overrides: []
      }
    });
  });
});

router.post("/poolsettings", function (req, res) {
  PoolSettings.findOneAndUpdate(
    {},
    {
      $set: {
        enabled: !(req.body.enabled === false || req.body.enabled === "false" || req.body.enabled === 0 || req.body.enabled === "0"),
        discount_percent: Math.max(Number(req.body.discount_percent || 15), 0),
        max_passengers: Math.max(Number(req.body.max_passengers || 3), 1),
        max_detour_km: Math.max(Number(req.body.max_detour_km || 3), 0),
        max_pickup_gap_km: Math.max(Number(req.body.max_pickup_gap_km || 2), 0),
        max_drop_gap_km: Math.max(Number(req.body.max_drop_gap_km || 3), 0),
        zone_overrides: normalizeZoneOverrides(req.body.zone_overrides),
        updated_at: new Date()
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  ).exec(function (err, settings) {
    if (err || !settings) {
      return res.json({ status: "false", message: "Unable to save pooling settings" });
    }
    logAuditFromRequest(req, {
      action: "pool_settings.updated",
      target_type: "pool_settings",
      target_id: settings._id,
      metadata: {
        enabled: settings.enabled,
        discount_percent: settings.discount_percent,
        max_passengers: settings.max_passengers
      }
    });
    return res.json({ status: "true", data: settings });
  });
});

router.get("/pricebroadcastsettings", function (_req, res) {
  PriceBroadcastSettings.findOne().sort({ updated_at: -1 }).exec(function (err, settings) {
    if (err) {
      return res.json({ status: "false", message: "Unable to load price broadcast settings" });
    }
    return res.json({
      status: "true",
      data: settings || {
        enabled: true,
        default_radius_km: 8,
        max_radius_km: 20,
        default_expiry_minutes: 5,
        max_expiry_minutes: 15,
        max_broadcasts_per_day: null
      }
    });
  });
});

router.post("/pricebroadcastsettings", function (req, res) {
  PriceBroadcastSettings.findOneAndUpdate(
    {},
    {
      $set: {
        enabled: !(req.body.enabled === false || req.body.enabled === "false" || req.body.enabled === 0 || req.body.enabled === "0"),
        default_radius_km: Math.max(Number(req.body.default_radius_km || 8), 1),
        max_radius_km: Math.max(Number(req.body.max_radius_km || req.body.default_radius_km || 20), 1),
        default_expiry_minutes: Math.max(Number(req.body.default_expiry_minutes || 5), 1),
        max_expiry_minutes: Math.max(Number(req.body.max_expiry_minutes || req.body.default_expiry_minutes || 15), 1),
        max_broadcasts_per_day:
          req.body.max_broadcasts_per_day === null ||
          typeof req.body.max_broadcasts_per_day === "undefined" ||
          req.body.max_broadcasts_per_day === ""
            ? null
            : Math.max(Number(req.body.max_broadcasts_per_day || 0), 0),
        updated_at: new Date()
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  ).exec(function (err, settings) {
    if (err || !settings) {
      return res.json({ status: "false", message: "Unable to save price broadcast settings" });
    }
    if (Number(settings.max_radius_km || 0) < Number(settings.default_radius_km || 0)) {
      settings.max_radius_km = Number(settings.default_radius_km || 0);
    }
    if (Number(settings.max_expiry_minutes || 0) < Number(settings.default_expiry_minutes || 0)) {
      settings.max_expiry_minutes = Number(settings.default_expiry_minutes || 0);
    }
    settings.save(function (_saveErr) {
      logAuditFromRequest(req, {
        action: "price_broadcast_settings.updated",
        target_type: "price_broadcast_settings",
        target_id: settings._id,
        metadata: {
          enabled: settings.enabled,
          default_radius_km: settings.default_radius_km,
          max_radius_km: settings.max_radius_km,
          default_expiry_minutes: settings.default_expiry_minutes,
          max_expiry_minutes: settings.max_expiry_minutes,
          max_broadcasts_per_day: settings.max_broadcasts_per_day
        }
      });
      return res.json({ status: "true", data: settings });
    });
  });
});

router.get("/pricebroadcasts", function (req, res) {
  var limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
  Rides.find({
    request_type: "PASSENGER_PRICE_BROADCAST"
  })
    .sort({ created_at: -1 })
    .limit(limit)
    .populate("driver_id")
    .exec(function (err, rides) {
      if (err) {
        return res.json({ status: "false", data: [] });
      }
      return res.json({ status: "true", data: rides || [] });
    });
});

router.get("/destinationbroadcasts", function (req, res) {
  var limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 200);
  var paymentStatus = String(req.query.payment_status || "").trim().toUpperCase();
  var query = {};
  if (paymentStatus) {
    query.payment_status = paymentStatus;
  }
  DriverDestinationBroadcast.find(query)
    .sort({ created_at: -1 })
    .limit(limit)
    .populate("driver_id")
    .exec(function (err, items) {
      if (err) {
        return res.json({ status: "false", data: [] });
      }
      return res.json({ status: "true", data: items || [] });
    });
});

router.get("/destinationbroadcastsettings", function (_req, res) {
  DestinationBroadcastSettings.findOne().sort({ updated_at: -1 }).exec(function (err, settings) {
    if (err) {
      return res.json({ status: "false", message: "Unable to load destination broadcast settings" });
    }
    return res.json({
      status: "true",
      data: settings || {
        enabled: true,
        broadcast_fee: 1000,
        currency: "TZS",
        default_radius_km: 8,
        max_radius_km: 20,
        expiry_duration_minutes: 30,
        maximum_active_broadcasts_per_driver: 1,
        cancellation_refund_policy: "NO_REFUND"
      }
    });
  });
});

router.post("/destinationbroadcastsettings", function (req, res) {
  DestinationBroadcastSettings.findOneAndUpdate(
    {},
    {
      $set: {
        enabled: !(req.body.enabled === false || req.body.enabled === "false" || req.body.enabled === 0 || req.body.enabled === "0"),
        broadcast_fee: Math.max(Number(req.body.broadcast_fee || 0), 0),
        currency: String(req.body.currency || "TZS").trim().toUpperCase(),
        default_radius_km: Math.max(Number(req.body.default_radius_km || 8), 1),
        max_radius_km: Math.max(Number(req.body.max_radius_km || req.body.default_radius_km || 20), 1),
        expiry_duration_minutes: Math.max(Number(req.body.expiry_duration_minutes || 30), 1),
        maximum_active_broadcasts_per_driver: Math.max(Number(req.body.maximum_active_broadcasts_per_driver || 1), 1),
        cancellation_refund_policy: "NO_REFUND",
        updated_at: new Date()
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  ).exec(function (err, settings) {
    if (err || !settings) {
      return res.json({ status: "false", message: "Unable to save destination broadcast settings" });
    }
    if (Number(settings.max_radius_km || 0) < Number(settings.default_radius_km || 0)) {
      settings.max_radius_km = Number(settings.default_radius_km || 0);
    }
    settings.save(function () {
      logAuditFromRequest(req, {
        action: "destination_broadcast_settings.updated",
        target_type: "destination_broadcast_settings",
        target_id: settings._id,
        metadata: {
          enabled: settings.enabled,
          broadcast_fee: settings.broadcast_fee,
          currency: settings.currency,
          default_radius_km: settings.default_radius_km,
          max_radius_km: settings.max_radius_km,
          expiry_duration_minutes: settings.expiry_duration_minutes,
          maximum_active_broadcasts_per_driver: settings.maximum_active_broadcasts_per_driver
        }
      });
      return res.json({ status: "true", data: settings });
    });
  });
});

router.get("/destinationbroadcastrevenues", function (_req, res) {
  DriverDestinationBroadcast.aggregate([
    {
      $group: {
        _id: null,
        total_broadcasts: { $sum: 1 },
        paid_broadcasts: {
          $sum: {
            $cond: [{ $eq: ["$payment_status", "PAID"] }, 1, 0]
          }
        },
        pending_payment_broadcasts: {
          $sum: {
            $cond: [{ $eq: ["$payment_status", "PENDING"] }, 1, 0]
          }
        },
        failed_payment_broadcasts: {
          $sum: {
            $cond: [{ $eq: ["$payment_status", "FAILED"] }, 1, 0]
          }
        },
        total_revenue: {
          $sum: {
            $cond: [{ $eq: ["$payment_status", "PAID"] }, "$broadcast_fee", 0]
          }
        }
      }
    }
  ]).exec(function (err, rows) {
    if (err) {
      return res.json({ status: "false", data: null });
    }
    return res.json({
      status: "true",
      data: rows && rows[0] ? rows[0] : {
        total_broadcasts: 0,
        paid_broadcasts: 0,
        pending_payment_broadcasts: 0,
        failed_payment_broadcasts: 0,
        total_revenue: 0
      }
    });
  });
});

router.get("/destinationbroadcasts/:id/requests", function (req, res) {
  DriverDestinationJoinRequest.find({
    broadcast_id: req.params.id
  }).sort({ created_at: -1 }).limit(100).exec(function (err, items) {
    if (err) {
      return res.json({ status: "false", data: [] });
    }
    User.find({
      _id: { $in: (items || []).map(function (item) { return String(item.passenger_id); }) }
    }).select("_id full_name profile_image").exec(function (_userErr, users) {
      return res.json({
        status: "true",
        data: (items || []).map(function (item) {
          var user = (users || []).find(function (entry) {
            return String(entry._id) === String(item.passenger_id);
          });
          return {
            _id: String(item._id),
            passenger_id: String(item.passenger_id),
            passenger_name: user ? String(user.full_name || "") : "",
            passenger_image: user ? String(user.profile_image || "") : "",
            pickup_label: item.pickup_label,
            pickup_lat: item.pickup_lat,
            pickup_lng: item.pickup_lng,
            requested_seats: item.requested_seats,
            status: item.status,
            created_at: item.created_at,
            updated_at: item.updated_at
          };
        })
      });
    });
  });
});

router.get("/riderblocks", function (req, res) {
  var reviewStatus = String(req.query.review_status || "").trim().toLowerCase();
  var query = {};
  if (reviewStatus) {
    query.admin_review_status = reviewStatus;
  }

  RiderBlocks.find(query)
    .sort({ created_at: -1 })
    .limit(200)
    .exec(function (err, items) {
      if (err) {
        return res.json({ status: "false", data: [] });
      }
      return res.json({ status: "true", data: items || [] });
    });
});

router.post("/riderblocks/:id/review", function (req, res) {
  var nextStatus = String(req.body.admin_review_status || "resolved").trim();
  var nextAction = String(req.body.escalation_action || "").trim();
  RiderBlocks.findOneAndUpdate(
    { _id: req.params.id },
    {
      $set: {
        admin_review_status: nextStatus,
        escalation_action: nextAction,
        review_notes: String(req.body.review_notes || "").trim(),
        reviewed_at: new Date()
      }
    },
    { new: true }
  ).exec(function (err, item) {
    if (err || !item) {
      return res.json({ status: "false", message: "Unable to review rider block" });
    }
    return res.json({ status: "true", data: item });
  });
});

router.post("/lostitems/:id/messages", function (req, res) {
  var message = String(req.body.message || "").trim();
  if (!message) {
    return res.json({
      status: "false",
      message: "Message is required"
    });
  }

  LostItems.findOne({
    _id: req.params.id
  }).exec(function (err, item) {
    if (err || !item) {
      return res.json({
        status: "false",
        message: "Lost item case not found"
      });
    }

    var newMessage = new LostItemMessages({
      lost_item_id: String(item._id),
      ride_id: item.ride_id || "",
      user_id: item.user_id || "",
      driver_id: item.driver_id || "",
      sender_type: "admin",
      sender_id: String(req.body.sender_id || "admin"),
      message: message
    });

    newMessage.save(function (saveErr, savedMessage) {
      if (saveErr) {
        return res.json({
          status: "false",
          message: "Unable to save message"
        });
      }

      LostItems.updateOne(
        {
          _id: item._id
        },
        {
          $set: {
            last_message_at: savedMessage.created_at,
            last_message_preview: message.length > 160 ? message.substr(0, 157) + "..." : message,
            last_message_sender: "admin",
            unread_user_count: Number(item.user_id ? 1 : 0),
            unread_driver_count: Number(item.driver_id ? 1 : 0),
            unread_admin_count: 0
          }
        }
      ).exec(function () {});

      return res.json({
        status: "true",
        data: savedMessage
      });
    });
  });
});

router.get("/riderblocks", function (_req, res) {
  RiderBlocks.find({})
    .sort({ created_at: -1 })
    .limit(20)
    .populate("user_id")
    .populate("driver_id")
    .populate("ride_id")
    .exec(function (err, blocks) {
      if (err) {
        return res.json({ status: "false", data: [] });
      }
      return res.json({ status: "true", data: blocks });
    });
});

router.get("/demandheatmap", function (req, res) {
  var hours = Math.max(Number(req.query.hours || 24), 1);
  var since = new Date(Date.now() - hours * 60 * 60 * 1000);
  var projectionSince = new Date(Date.now() - 15 * 60 * 1000);
  Rides.aggregate([
    {
      $match: {
        created_at: { $gte: since },
        pickup_lat: { $nin: ["", null] },
        pickup_lng: { $nin: ["", null] }
      }
    },
    {
      $project: {
        pickup_location: 1,
        pickup_lat: 1,
        pickup_lng: 1,
        ridestatus: 1,
        pickup_lat_bucket: { $substr: ["$pickup_lat", 0, 6] },
        pickup_lng_bucket: { $substr: ["$pickup_lng", 0, 6] }
      }
    },
    {
      $group: {
        _id: {
          lat: "$pickup_lat_bucket",
          lng: "$pickup_lng_bucket"
        },
        count: { $sum: 1 },
        latest_location: { $last: "$pickup_location" },
        latest_lat: { $last: "$pickup_lat" },
        latest_lng: { $last: "$pickup_lng" }
      }
    },
    {
      $sort: {
        count: -1
      }
    },
    {
      $limit: 20
    }
  ]).exec(function (err, hotspots) {
    if (err) {
      return res.json({ status: "false", data: [] });
    }

    Rides.aggregate([
      {
        $match: {
          created_at: { $gte: projectionSince },
          pickup_lat: { $nin: ["", null] },
          pickup_lng: { $nin: ["", null] }
        }
      },
      {
        $project: {
          pickup_lat_bucket: { $substr: ["$pickup_lat", 0, 6] },
          pickup_lng_bucket: { $substr: ["$pickup_lng", 0, 6] }
        }
      },
      {
        $group: {
          _id: {
            lat: "$pickup_lat_bucket",
            lng: "$pickup_lng_bucket"
          },
          recent_count: { $sum: 1 }
        }
      }
    ]).exec(function (projectionErr, projectedHotspots) {
      var projectedByBucket = {};
      if (!projectionErr && Array.isArray(projectedHotspots)) {
        projectedHotspots.forEach(function (hotspot) {
          projectedByBucket[hotspot._id.lat + "," + hotspot._id.lng] = hotspot.recent_count || 0;
        });
      }

      Driver.find({
        live_status: { $in: ["1", "2"] },
        instant_lat: { $nin: ["", null] },
        instant_lng: { $nin: ["", null] }
      }).select("instant_lat instant_lng lat lon full_name live_status").exec(function (_driverErr, drivers) {
        var formatted = (hotspots || []).map(function (hotspot) {
          var key = hotspot._id.lat + "," + hotspot._id.lng;
          var recentCount = projectedByBucket[key] || 0;
          var lat = toNumber(hotspot.latest_lat);
          var lng = toNumber(hotspot.latest_lng);
          var driverCount = 0;

          (drivers || []).forEach(function (driver) {
            var driverLat = toNumber(driver.instant_lat || driver.lat);
            var driverLng = toNumber(driver.instant_lng || driver.lon);
            if (driverLat && driverLng && distanceKm(lat, lng, driverLat, driverLng) <= 2) {
              driverCount += 1;
            }
          });

          return {
            _id: hotspot._id,
            count: hotspot.count,
            latest_location: hotspot.latest_location,
            latest_lat: hotspot.latest_lat,
            latest_lng: hotspot.latest_lng,
            driver_count: driverCount,
            projected_15_min_count: hotspot.count + recentCount,
            projected_surge: recentCount >= 2 || hotspot.count >= 6,
            intensity: intensityFromCount(hotspot.count + recentCount)
          };
        });

        return res.json({ status: "true", data: formatted });
      });
    });
  });
});

router.post("/demandheatmap/incentives", function (req, res) {
  var lat = toNumber(req.body.lat);
  var lng = toNumber(req.body.lng);
  var radiusKm = Math.max(toNumber(req.body.radius_km || req.body.radius || 2), 0.5);
  var message = String(req.body.message || "High demand nearby. Move toward this zone for more ride requests.").trim();

  if (!lat || !lng) {
    return res.json({ status: "false", message: "A target zone latitude and longitude are required" });
  }

  Driver.find({
    live_status: { $in: ["1", "2"] },
    instant_lat: { $nin: ["", null] },
    instant_lng: { $nin: ["", null] }
  }).select("_id instant_lat instant_lng lat lon").exec(function (driverErr, drivers) {
    if (driverErr) {
      return res.json({ status: "false", message: "Unable to load drivers" });
    }

    var targetDriverIds = (drivers || [])
      .filter(function (driver) {
        var driverLat = toNumber(driver.instant_lat || driver.lat);
        var driverLng = toNumber(driver.instant_lng || driver.lon);
        return driverLat && driverLng && distanceKm(lat, lng, driverLat, driverLng) <= radiusKm;
      })
      .map(function (driver) {
        return String(driver._id);
      });

    if (!targetDriverIds.length) {
      return res.json({ status: "true", message: "No nearby online drivers found", notified: 0 });
    }

    DriverDevices.find({ user_id: { $in: targetDriverIds } }).exec(function (deviceErr, devices) {
      if (deviceErr) {
        return res.json({ status: "false", message: "Unable to load driver devices" });
      }

      var tokens = (devices || []).map(function (device) {
        return device.device_token;
      }).filter(Boolean);

      pushService.sendNotification({
        tokens: tokens,
        message: message,
        data: {
          type: "zone_incentive",
          message: message,
          lat: String(lat),
          lng: String(lng),
          radius_km: String(radiusKm)
        },
        mobile: true,
        siteName: "CABi"
      }).catch(function (_error) {});

      return res.json({
        status: "true",
        message: "Zone incentive pushed",
        notified: tokens.length
      });
    });
  });
});

router.get("/acceptancesettings", function (_req, res) {
  Driver.find({})
    .select("_id full_name email acceptance_settings rating live_status")
    .sort({ full_name: 1 })
    .limit(200)
    .exec(function (err, drivers) {
      if (err) {
        return res.json({ status: "false", data: [] });
      }

      async.map(
        drivers || [],
        function (driver, done) {
          Rides.count({ driver_id: String(driver._id) }).exec(function (_totalErr, totalCount) {
            Rides.count({
              driver_id: String(driver._id),
              ridestatus: { $in: ["accepted", "ontheway", "onride", "completed"] }
            }).exec(function (_acceptedErr, acceptedCount) {
              var total = Number(totalCount || 0);
              var accepted = Number(acceptedCount || 0);
              done(null, {
                _id: driver._id,
                full_name: driver.full_name,
                email: driver.email,
                rating: driver.rating,
                live_status: driver.live_status,
                acceptance_settings: driver.acceptance_settings || {},
                acceptance_rate: total > 0 ? Math.round((accepted / total) * 100) : 0,
                total_requests: total,
                accepted_requests: accepted,
                coaching_flag: total >= 10 && accepted / total < 0.45
              });
            });
          });
        },
        function (_mapErr, rows) {
          return res.json({ status: "true", data: rows || [] });
        }
      );
    });
});

module.exports = router;
