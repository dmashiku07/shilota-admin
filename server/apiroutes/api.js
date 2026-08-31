const passport = require("passport");
const Request = require("request");
const config = require("../config");
require("../userpassport")(passport);
const jwt = require("jsonwebtoken");
const async = require("async");
const crypto = require("crypto");
const randomstring = require("randomstring");
const express = require("express");
const router = express.Router();
const path = require("path");
const moment = require("moment");
const googledistance = require("google-distance");
const timezone = require("../utils/timezone");
const socketRegistry = require("../socketRegistry");
/* image downloader */
const download = require("image-downloader");
/* cron */
const cron = require("node-cron");
/* baseurl */
const base_url = config.baseUrl;
const apn = require("apn");

/** schemas */
let User = require("../schema/user");
let Help = require("../models/helppage");
let Notifications = require("../schema/notification");
let UserDevices = require("../schema/userdevices");
let Rides = require("../schema/rides");
let Commissions = require("../schema/commissions");
let Categories = require("../schema/categories");
let Driver = require("../schema/driver");
let Reviews = require("../schema/reviews");
let Payments = require("../schema/payments");
let Wallet = require("../schema/wallets");
let SelcomPaymentSession = require("../schema/selcompaymentsession");
let DriverDevices = require("../schema/driverdevices");
let Vehicles = require("../schema/vehicles");
let Places = require("../schema/places");
let SosAlerts = require("../schema/sosalerts");
let LostItems = require("../schema/lostitems");
let LostItemMessages = require("../schema/lostitemmessages");
let RideChatMessages = require("../schema/ridechatmessages");
let RiderBlocks = require("../schema/riderblocks");
let CallLogs = require("../schema/calllogs");
let PoolSettings = require("../schema/poolsettings");
let RideOffer = require("../schema/rideoffers");
let DriverDestinationJoinRequest = require("../schema/driverdestinationjoinrequests");
let DriverDestinationBroadcast = require("../schema/driverdestinationbroadcasts");
let SubscriptionPlan = require("../schema/subscriptionplans");
let Subscription = require("../schema/subscriptions");
let Admin = require("../models/admin");
let WebUsers = require("../schema/webusers");
let OtpVerification = require("../schema/otpverification");
let translationServer = require("../translation/translate.js");
/* upload directories */
const userassets = "./src/assets/media/users/";
const categoryassets = "./src/assets/uploads";
/* image upload functionality*/
const fs = require("fs");
const multer = require("multer");
const upload = multer();
/* mailer */
const nodemailer = require("nodemailer");
/* braintree setting */
const braintree = require("braintree");
const smsService = require("../services/smsService");
const selcomService = require("../services/selcomService");
const pushService = require("../services/pushService");
const cetsSyncService = require("../services/cetsSyncService");
const {
  DRIVER_SUBSCRIPTION_ACTOR_TYPE,
  finalizeSubscriptionSession
} = require("../services/driverSubscriptionService");
const {
  DRIVER_DESTINATION_BROADCAST_ACTOR_TYPE,
  finalizeDestinationBroadcastSession
} = require("../services/driverDestinationBroadcastService");
const {
  PASSENGER_SUBSCRIPTION_ACTOR_TYPE,
  buildPendingPassengerSubscriptionRecord,
  finalizePassengerSubscriptionSession,
  formatPassengerSubscription,
  getCurrentPassengerSubscription,
  getCurrentPassengerSubscriptionWithFeatures,
  loadPlanFeatures,
  passengerHasFeature,
  validatePassengerPlanForPurchase
} = require("../services/passengerSubscriptionService");
const { formatValidity: formatPlanValidity } = require("../services/subscriptionPlanService");
const {
  applyPostRideAvailability,
  evaluateDriverEligibility,
  filterEligibleDrivers
} = require("../services/driverEligibilityService");
const {
  createJoinRequest,
  expireDriverDestinationBroadcasts,
  isDriverDestinationBroadcastEnabled,
  listNearbyBroadcasts,
  updatePassengerLocation
} = require("../services/driverDestinationBroadcastService");
const {
  acceptRideOffer,
  expirePassengerPriceBroadcastRequests,
  expireDriverPricedRideRequests,
  expireRideOffers,
  getPassengerBroadcastAuthorization,
  getPriceBroadcastSettings,
  isDriverOfferRide,
  isOfferBasedRide,
  isDriverPricingEnabled,
  isPassengerBroadcastRide,
  listRideOffersForPassenger,
  prepareDriverPricedRidePayload,
  preparePassengerPriceBroadcastPayload,
  REQUEST_TYPE_PASSENGER_PRICE_BROADCAST
} = require("../services/rideOfferService");
const { roundCustomerPayableAmount } = require("../utils/pricing");
const { getRoadRoute } = require("../services/routeGeometryService");
const {
  applyRideCompletionFinancials,
  buildPaymentDocument,
  calculateCommissionAmount,
  getRideFinalAmount,
  isCommissionEnabled,
  isLegacyCommissionRide,
  markRidePaymentComplete
} = require("../services/rideRevenuePolicy");

const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const FORGOT_PASSWORD_OTP_PURPOSE = "forgot_password";
const SCHEDULE_MAX_DAYS = 7;
const SCHEDULE_DISPATCH_LEAD_MINUTES = 30;
const SCHEDULE_REMINDER_LEAD_MINUTES = 60;
const ACTIVE_RIDE_STATUSES = ["requested", "accepted", "ontheway", "onride"];
const DRIVER_NOTIFICATION_TITLE = "Shilota Driver";

function normalizeSavedPlaceType(value) {
  value = String(value || "").trim();
  if (/^home$/i.test(value)) {
    return "Home";
  }
  if (/^(work|office)$/i.test(value)) {
    return "Office";
  }
  return value;
}

function savedPlaceTypeQuery(placeType) {
  const normalizedType = normalizeSavedPlaceType(placeType);
  if (normalizedType === "Home") {
    return ["Home"];
  }
  if (normalizedType === "Office") {
    return ["Office", "Work"];
  }
  return [normalizedType];
}

function buildPassengerSubscriptionResponse(subscription) {
  if (!subscription) {
    return null;
  }

  const result = formatPassengerSubscription(subscription);
  result.validity_label = formatPlanValidity({
    duration_unit: result.duration_unit_snapshot,
    duration_value: result.duration_value_snapshot
  });
  return result;
}

function savedPlaceSortWeight(placeType) {
  const normalizedType = normalizeSavedPlaceType(placeType);
  if (normalizedType === "Home") {
    return 0;
  }
  if (normalizedType === "Office") {
    return 1;
  }
  return 2;
}

function normalizeRideServiceType(value) {
  value = String(value || "ride").trim().toLowerCase();
  if (value === "package" || value === "courier") {
    return "delivery";
  }
  return value === "delivery" ? "delivery" : "ride";
}

function normalizeRequestType(value) {
  return String(value || "STANDARD").trim().toUpperCase();
}

function isPassengerBroadcastRequest(body) {
  return (
    normalizeRequestType(body && body.request_type) === REQUEST_TYPE_PASSENGER_PRICE_BROADCAST ||
    String(body && body.pricing_mode || "").trim().toLowerCase() === "passenger_broadcast" ||
    String(body && body.passenger_price_broadcast || "").trim().toLowerCase() === "true"
  );
}

async function cancelSupersededRequestedRides(userId) {
  if (!userId) {
    return [];
  }

  const candidates = await Rides.find({
    user_id: userId,
    ridestatus: "requested",
    $or: [
      { driver_id: { $exists: false } },
      { driver_id: null },
      { driver_id: "" }
    ]
  }).select("_id").exec();

  const cancelledRideIds = [];
  for (const ride of candidates) {
    const paymentCount = await Payments.count({ onride_id: ride._id }).exec();
    if (paymentCount > 0) {
      continue;
    }

    const updateResult = await Rides.updateOne({
      _id: ride._id,
      ridestatus: "requested",
      $or: [
        { driver_id: { $exists: false } },
        { driver_id: null },
        { driver_id: "" }
      ]
    }, {
      $set: {
        ridestatus: "cancelled",
        ridestatusat: timeZone()
      }
    }).exec();

    if (updateResult && (updateResult.modifiedCount || updateResult.nModified)) {
      cancelledRideIds.push(String(ride._id));
      await RideOffer.updateMany({
        ride_request_id: String(ride._id),
        status: "PENDING"
      }, {
        $set: {
          status: "EXPIRED"
        }
      }).exec();
    }
  }

  return cancelledRideIds;
}

function toPositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseScheduleMoment(scheduleTime) {
  if (!scheduleTime) {
    return null;
  }

  const scheduleTimestamp = Number(scheduleTime);
  if (!Number.isFinite(scheduleTimestamp)) {
    return null;
  }

  const scheduleMoment = moment.unix(scheduleTimestamp);
  return scheduleMoment.isValid() ? scheduleMoment : null;
}

function validateScheduleMoment(scheduleMoment) {
  if (!scheduleMoment || !scheduleMoment.isValid()) {
    return "Please select a valid schedule time";
  }

  const now = moment();
  if (scheduleMoment.isSameOrBefore(now)) {
    return "Schedule time must be in the future";
  }

  if (scheduleMoment.isAfter(now.clone().add(SCHEDULE_MAX_DAYS, "days"))) {
    return "Scheduled rides can be booked up to 7 days in advance";
  }

  return "";
}

function buildNearbyDriverQuery(lon, lat, maxdistcoverage, ride) {
  return Driver.aggregate([
    {
      $geoNear: {
        near: {
          type: "Point",
          coordinates: [lon, lat]
        },
        maxDistance: maxdistcoverage * 1000,
        spherical: true,
        distanceField: "distance",
        query: {
          live_status: "1",
          approval: "1",
          category_id: ride.category_id,
          ...buildDriverServiceTypeMatch(ride.service_type)
        }
      }
    },
    {
      $sort: {
        distance: 1
      }
    }
  ]);
}

function setDriverAvailableIfEligible(driverId, callback) {
  applyPostRideAvailability(driverId, {
    now: new Date()
  }).then(function () {
    if (callback) {
      callback(null);
    }
  }).catch(function (error) {
    if (callback) {
      callback(error);
    }
  });
}

function reachPickupLabel(distanceMeters) {
  let meters = Number(distanceMeters || 0);
  if (!meters || isNaN(meters)) {
    return "";
  }
  let minutes = Math.max(Math.ceil((meters / 1000) / 25 * 60), 1);
  return minutes + " mins";
}

function buildDriverServiceTypeMatch(serviceType) {
  serviceType = normalizeRideServiceType(serviceType);
  if (serviceType === "delivery") {
    return {
      service_types: "delivery"
    };
  }

  return {
    $or: [
      { service_types: "ride" },
      { service_types: { $exists: false } },
      { service_types: { $size: 0 } }
    ]
  };
}

function filterBlockedDriversForRide(drivers, ride, callback) {
  if (!Array.isArray(drivers) || drivers.length === 0 || !ride || !ride.user_id) {
    return callback([]);
  }

  let driverIds = drivers.map(function (driver) {
    return String(driver._id);
  });

  RiderBlocks.find({
    user_id: String(ride.user_id),
    driver_id: {
      $in: driverIds
    },
    status: "active"
  }).exec(function (_err, blocks) {
    if (!Array.isArray(blocks) || blocks.length === 0) {
      return callback(drivers);
    }

    let blockedDriverIds = blocks.reduce(function (result, block) {
      result[String(block.driver_id)] = true;
      return result;
    }, {});

    callback(drivers.filter(function (driver) {
      return !blockedDriverIds[String(driver._id)];
    }));
  });
}

function normalizeRideStops(value) {
  let stops = value;
  if (typeof stops === "string") {
    try {
      stops = JSON.parse(stops);
    } catch (_error) {
      stops = [];
    }
  }
  if (!Array.isArray(stops)) {
    return [];
  }
  return stops
    .slice(0, 4)
    .map(function (stop, index) {
      return {
        location: stop.location || stop.place_full_address || "",
        lat: String(stop.lat || stop.latitude || ""),
        lng: String(stop.lng || stop.lon || stop.longitude || ""),
        sequence: Number(stop.sequence || index + 1),
        fare_increment: Math.max(Number(stop.fare_increment || 0), 0)
      };
    })
    .filter(function (stop) {
      return stop.location;
    });
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function normalizeDeliveryDetails(value) {
  let details = value;
  if (typeof details === "string") {
    try {
      details = JSON.parse(details);
    } catch (_error) {
      details = {};
    }
  }
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    details = {};
  }
  return {
    parcel_type: String(details.parcel_type || details.parcelType || "").trim(),
    parcel_size: String(details.parcel_size || details.parcelSize || "").trim(),
    recipient_name: String(details.recipient_name || details.recipientName || "").trim(),
    recipient_phone: String(details.recipient_phone || details.recipientPhone || "").trim(),
    sender_note: String(details.sender_note || details.senderNote || "").trim(),
    handoff_code: String(details.handoff_code || details.handoffCode || "").trim(),
    proof_required: normalizeBoolean(
      details.proof_required || details.proofRequired,
    ),
  };
}

function trimChatPreview(message) {
  message = String(message || "").trim();
  if (message.length <= 160) {
    return message;
  }
  return message.substr(0, 157) + "...";
}

function saveRideChatMessage(options, callback) {
  let payload = options || {};
  let messageText = String(payload.message || "").trim();
  if (!payload.onride_id || !messageText) {
    return callback(new Error("Invalid ride chat payload"));
  }

  let newMessage = new RideChatMessages({
    onride_id: String(payload.onride_id),
    user_id: payload.user_id ? String(payload.user_id) : "",
    driver_id: payload.driver_id ? String(payload.driver_id) : "",
    sender_type: payload.sender_type || "user",
    sender_id: payload.sender_id ? String(payload.sender_id) : "",
    message: messageText
  });

  newMessage.save(callback);
}

function filterDriversByAcceptanceSettings(drivers, ride) {
  if (!Array.isArray(drivers)) {
    return [];
  }
  if (config.featureFlags.acceptance_settings_enabled !== true) {
    return drivers;
  }
  return drivers.filter(function (driver) {
    let settings = driver.acceptance_settings || {};
    let maxPickupDistance = Number(settings.max_pickup_distance_km || 0);
    let minFare = Number(settings.min_fare || 0);
    let supportedRideTypes = Array.isArray(settings.ride_types) && settings.ride_types.length > 0
      ? settings.ride_types
      : ["ride", "delivery", "pool"];
    let requestedRideType = ride.pooling_opt_in ? "pool" : normalizeRideServiceType(ride.service_type);

    if (maxPickupDistance > 0 && Number(driver.distance || 0) / 1000 > maxPickupDistance) {
      return false;
    }
    if (minFare > 0 && Number(ride.baseprice || 0) < minFare) {
      return false;
    }
    return supportedRideTypes.indexOf(requestedRideType) !== -1;
  });
}

function buildPoolZoneKey(lat, lng) {
  let latNumber = Number(lat || 0);
  let lngNumber = Number(lng || 0);
  if (!Number.isFinite(latNumber) || !Number.isFinite(lngNumber)) {
    return "";
  }
  return latNumber.toFixed(2) + "," + lngNumber.toFixed(2);
}

function findPoolSettings(callback) {
  PoolSettings.findOne().sort({ updated_at: -1 }).exec(function (_err, settings) {
    callback(settings || {
      enabled: true,
      discount_percent: 15,
      max_passengers: 3,
      max_detour_km: 3,
      max_pickup_gap_km: 2,
      max_drop_gap_km: 3,
      zone_overrides: []
    });
  });
}

function isPoolZoneEnabled(settings, ride) {
  if (!settings || settings.enabled === false) {
    return false;
  }
  let zoneKey = buildPoolZoneKey(ride.pickup_lat, ride.pickup_lng);
  let overrides = Array.isArray(settings.zone_overrides) ? settings.zone_overrides : [];
  let matchedOverride = overrides.find(function (item) {
    return String(item && (item.zone_key || item.zoneKey) || "").trim() === zoneKey;
  });
  if (!matchedOverride) {
    return true;
  }
  return !(matchedOverride.enabled === false || matchedOverride.enabled === "false" || matchedOverride.enabled === 0 || matchedOverride.enabled === "0");
}

function discountedPoolFare(basePrice, discountPercent) {
  let base = Number(basePrice || 0);
  let discount = Math.max(Number(discountPercent || 0), 0);
  if (!Number.isFinite(base) || base <= 0 || discount <= 0) {
    return basePrice;
  }
  return roundCustomerPayableAmount(base - (base * discount / 100));
}

function attemptMatchPoolRide(ride, callback) {
  if (!ride || !ride.pooling_opt_in) {
    return callback(ride);
  }

  findPoolSettings(function (settings) {
    if (!isPoolZoneEnabled(settings, ride)) {
      ride.pool_status = "zone_unavailable";
      ride.pool_zone_key = buildPoolZoneKey(ride.pickup_lat, ride.pickup_lng);
      ride.pool_discount_percent = 0;
      return callback(ride);
    }

    ride.pool_zone_key = buildPoolZoneKey(ride.pickup_lat, ride.pickup_lng);
    ride.pool_discount_percent = Number(settings.discount_percent || 0);
    ride.baseprice = discountedPoolFare(ride.baseprice, ride.pool_discount_percent);

    Rides.find({
      _id: { $ne: ride._id },
      ridestatus: "requested",
      pooling_opt_in: true,
      category_id: ride.category_id,
      service_type: ride.service_type,
      pool_zone_key: ride.pool_zone_key,
      type: { $ne: "schedule" }
    })
      .sort({ created_at: 1 })
      .limit(10)
      .exec(function (_err, candidates) {
        let match = (candidates || []).find(function (candidate) {
          let totalSeats = Number(candidate.seats_requested || 1) + Number(ride.seats_requested || 1);
          let pickupGap = getDistance(
            Number(candidate.pickup_lat || 0),
            Number(candidate.pickup_lng || 0),
            Number(ride.pickup_lat || 0),
            Number(ride.pickup_lng || 0),
            "K"
          );
          let dropGap = getDistance(
            Number(candidate.drop_lat || 0),
            Number(candidate.drop_lng || 0),
            Number(ride.drop_lat || 0),
            Number(ride.drop_lng || 0),
            "K"
          );
          return totalSeats <= Number(settings.max_passengers || 3) &&
            pickupGap <= Number(settings.max_pickup_gap_km || 2) &&
            dropGap <= Number(settings.max_drop_gap_km || 3);
        });

        if (!match) {
          ride.pool_group_id = "pool_" + String(ride._id);
          ride.pool_group_size = 1;
          ride.matched_pool_ride_ids = [];
          ride.pool_status = "pool_requested";
          return callback(ride);
        }

        let groupId = match.pool_group_id || ("pool_" + String(match._id));
        let matchedIds = [String(match._id), String(ride._id)];
        ride.pool_group_id = groupId;
        ride.pool_group_size = matchedIds.length;
        ride.matched_pool_ride_ids = [String(match._id)];
        ride.pool_status = "matched";

        Rides.updateOne(
          { _id: match._id },
          {
            $set: {
              pool_group_id: groupId,
              pool_group_size: matchedIds.length,
              pool_status: "matched",
              pool_discount_percent: Number(settings.discount_percent || 0),
              matched_pool_ride_ids: [String(ride._id)],
              baseprice: discountedPoolFare(match.baseprice, settings.discount_percent)
            }
          }
        ).exec(function () {});

        return callback(ride);
      });
  });
}

function resolveCallReceiverType(receiverId, callback) {
  Driver.findById(receiverId).select("_id").exec(function (_driverErr, driver) {
    if (driver) {
      return callback("driver");
    }
    User.findById(receiverId).select("_id").exec(function (_userErr, user) {
      if (user) {
        return callback("user");
      }
      return callback("unknown");
    });
  });
}

function saveOrUpdateCallLog(payload, callback) {
  let roomId = String(payload.room_id || "").trim();
  if (!roomId) {
    return callback && callback();
  }

  if (payload.ended_at) {
    return CallLogs.findOne({ room_id: roomId })
      .sort({ created_at: -1 })
      .exec(function (_err, log) {
        if (!log) {
          return callback && callback();
        }
        let endedAt = payload.ended_at;
        let durationSeconds = Math.max(
          0,
          Math.round((endedAt.getTime() - new Date(log.started_at || log.created_at || endedAt).getTime()) / 1000)
        );
        CallLogs.updateOne(
          { _id: log._id },
          {
            $set: {
              status: payload.status || "ended",
              ended_at: endedAt,
              duration_seconds: durationSeconds
            }
          }
        ).exec(function () {
          if (callback) {
            callback();
          }
        });
      });
  }

  resolveCallReceiverType(payload.receiver_id, function (receiverType) {
    let log = new CallLogs({
      room_id: roomId,
      sender_id: String(payload.sender_id || ""),
      sender_type: String(payload.user_type || payload.sender_type || "user"),
      receiver_id: String(payload.receiver_id || ""),
      receiver_type: receiverType,
      onride_id: String(payload.onride_id || ""),
      call_type: String(payload.type || "audio"),
      platform: String(payload.platform || ""),
      status: payload.status || "started",
      started_at: payload.started_at || new Date()
    });
    log.save(function () {
      if (callback) {
        callback();
      }
    });
  });
}

function emergencyContactsFromProfile(profile) {
  let contacts = profile && profile.emergency_contact;
  if (!contacts) {
    return [];
  }
  if (!Array.isArray(contacts)) {
    contacts = [contacts];
  }
  return contacts
    .map(function (contact) {
      return contact && (contact.phone_no || contact.phone_number || contact.phone);
    })
    .filter(Boolean);
}

function sendEmergencySmsToContacts(contacts, message, callback) {
  contacts = Array.isArray(contacts) ? contacts : [];
  if (contacts.length === 0) {
    return callback(0);
  }

  let completed = 0;
  let sent = 0;
  contacts.forEach(function (phoneNumber) {
    smsService.sendSms(phoneNumber, message).then(function (result) {
      if (result && result.success) {
        sent += 1;
      }
    }).catch(function () {}).then(function () {
      completed += 1;
      if (completed === contacts.length) {
        callback(sent);
      }
    });
  });
}

function trimPreview(message) {
  message = String(message || "").trim();
  if (message.length <= 160) {
    return message;
  }
  return message.substr(0, 157) + "...";
}

function saveLostItemMessage(options, callback) {
  let payload = options || {};
  let messageText = String(payload.message || "").trim();
  if (!payload.lost_item_id || !messageText) {
    return callback(new Error("Invalid lost item message payload"));
  }

  let newMessage = new LostItemMessages({
    lost_item_id: String(payload.lost_item_id),
    ride_id: payload.ride_id ? String(payload.ride_id) : "",
    user_id: payload.user_id ? String(payload.user_id) : "",
    driver_id: payload.driver_id ? String(payload.driver_id) : "",
    sender_type: payload.sender_type || "user",
    sender_id: payload.sender_id ? String(payload.sender_id) : "",
    message: messageText
  });

  newMessage.save(function (messageErr, savedMessage) {
    if (messageErr) {
      return callback(messageErr);
    }

    let counterUpdate = {
      last_message_at: savedMessage.created_at,
      last_message_preview: trimPreview(savedMessage.message),
      last_message_sender: payload.sender_type || "user"
    };

    if (payload.sender_type === "user") {
      counterUpdate.unread_admin_count = Number(payload.increment_admin_unread || 1);
      counterUpdate.unread_driver_count = Number(payload.increment_driver_unread || 1);
      counterUpdate.unread_user_count = 0;
    } else if (payload.sender_type === "admin") {
      counterUpdate.unread_user_count = Number(payload.increment_user_unread || 1);
      counterUpdate.unread_driver_count = Number(payload.increment_driver_unread || 0);
      counterUpdate.unread_admin_count = 0;
    } else if (payload.sender_type === "driver") {
      counterUpdate.unread_user_count = Number(payload.increment_user_unread || 1);
      counterUpdate.unread_admin_count = Number(payload.increment_admin_unread || 1);
      counterUpdate.unread_driver_count = 0;
    } else {
      counterUpdate.unread_admin_count = 0;
      counterUpdate.unread_driver_count = 0;
      counterUpdate.unread_user_count = 0;
    }

    LostItems.updateOne(
      {
        _id: payload.lost_item_id
      },
      {
        $set: counterUpdate
      }
    ).exec(function () {
      callback(null, savedMessage);
    });
  });
}

function mapSelcomSessionStatus(payload) {
  const paymentStatus = String(payload && payload.payment_status || "").trim().toUpperCase();
  const resultcode = String(payload && payload.resultcode || "").trim();

  if (resultcode === "000" && paymentStatus === "COMPLETED") {
    return "verified";
  }

  if (paymentStatus === "CANCELLED" || paymentStatus === "USERCANCELED" || String(payload && payload.result || "").trim().toUpperCase() === "FAIL") {
    return "failed";
  }

  return "pending";
}

async function applySelcomProviderUpdate(session, payload) {
  const nextStatus = mapSelcomSessionStatus(payload);
  session.status = nextStatus;
  session.order_id = payload && payload.order_id ? String(payload.order_id) : session.order_id;
  session.reference = payload && payload.reference ? String(payload.reference) : session.reference;
  session.channel = payload && payload.channel ? String(payload.channel) : session.channel;
  session.phone = payload && payload.phone ? String(payload.phone) : session.phone;
  session.payment_status = payload && payload.payment_status ? String(payload.payment_status) : session.payment_status;
  session.provider_result = payload && payload.result ? String(payload.result) : session.provider_result;
  session.provider_resultcode = payload && payload.resultcode ? String(payload.resultcode) : session.provider_resultcode;
  session.provider_message = payload && payload.message ? String(payload.message) : session.provider_message;
  session.paid_amount = payload && selcomService.normalizeAmount(payload.amount) ? selcomService.normalizeAmount(payload.amount) : session.paid_amount;
  session.provider_payload = payload || null;
  session.callback_received_at = new Date();
  if (nextStatus === "verified" && !session.verified_at) {
    session.verified_at = new Date();
  }
  await session.save();
  return session;
}

async function ensureSelcomPaymentVerified(session, transid) {
  if (session.status === "verified" || session.status === "completed" || session.verified_at) {
    return session;
  }

  const result = await selcomService.queryTransaction(transid);
  if (String(result.resultcode) === "000") {
    return applySelcomProviderUpdate(session, {
      transid: transid,
      result: result.result,
      resultcode: result.resultcode,
      message: result.message,
      reference: result.reference,
      payment_status: "COMPLETED",
      amount: session.amount
    });
  }

  if (String(result.resultcode) !== "111") {
    await applySelcomProviderUpdate(session, {
      transid: transid,
      result: result.result,
      resultcode: result.resultcode,
      message: result.message,
      reference: result.reference,
      payment_status: result.result || "FAILED",
      amount: session.amount
    });
  }

  throw new Error(result.message || "Payment has not been verified yet");
}

function hasSelcomSignatureHeaders(headers) {
  return Boolean(
    headers &&
      headers.authorization &&
      headers["digest-method"] &&
      headers.digest &&
      headers.timestamp &&
      headers["signed-fields"]
  );
}

async function findSelcomSessionFromPayload(payload) {
  const orderId = String(payload && payload.order_id || "").trim();
  const providerTransId = String(payload && payload.transid || "").trim();

  if (orderId) {
    let session = await SelcomPaymentSession.findOne({
      $or: [
        { transid: orderId },
        { order_id: orderId }
      ]
    }).exec();
    if (session) {
      return session;
    }
  }

  if (providerTransId) {
    return SelcomPaymentSession.findOne({
      $or: [
        { transid: providerTransId },
        { order_id: providerTransId }
      ]
    }).exec();
  }

  return null;
}

function doesCallbackAmountMatchSession(session, payload) {
  const callbackAmount = selcomService.normalizeAmount(payload && payload.amount);
  if (!callbackAmount) {
    return true;
  }

  return Math.abs(Number(session.amount || 0) - Number(callbackAmount)) <= 0.01;
}

function getOtpPurpose(req) {
  return req.body.purpose || "signup";
}

function buildPhoneParts(rawPhoneNumber) {
  const normalizedPhoneNumber = smsService.normalizePhoneNumber(rawPhoneNumber);
  if (!normalizedPhoneNumber) {
    return null;
  }

  let countryCode = 255;
  let nationalNumber = normalizedPhoneNumber;
  if (normalizedPhoneNumber.startsWith("255") && normalizedPhoneNumber.length > 3) {
    nationalNumber = normalizedPhoneNumber.slice(3);
  }

  if (!nationalNumber || Number.isNaN(Number(nationalNumber))) {
    return null;
  }

  return {
    normalizedPhoneNumber: normalizedPhoneNumber,
    countryCode: countryCode,
    nationalNumber: Number(nationalNumber)
  };
}

function hashOtp(phoneNumber, purpose, otp) {
  return crypto
    .createHash("sha256")
    .update(`${config.secret}|${purpose}|${phoneNumber}|${otp}`)
    .digest("hex");
}

async function verifyOtpForPurpose(phoneNumber, purpose, otp) {
  const otpVerification = await OtpVerification.findOne({
    phone_number: phoneNumber,
    purpose: purpose,
    consumed: false
  })
    .sort({
      createdAt: -1
    })
    .exec();

  if (!otpVerification) {
    return {
      ok: false,
      message: "OTP not found. Please request a new OTP"
    };
  }

  if (otpVerification.expires_at <= new Date()) {
    return {
      ok: false,
      message: "OTP has expired. Please request a new OTP"
    };
  }

  if (otpVerification.attempt_count >= OTP_MAX_ATTEMPTS) {
    return {
      ok: false,
      message: "Maximum OTP attempts exceeded. Please request a new OTP"
    };
  }

  const hashedOtp = hashOtp(phoneNumber, purpose, otp);
  if (hashedOtp !== otpVerification.otp_hash) {
    await OtpVerification.updateOne(
      {
        _id: otpVerification._id
      },
      {
        $inc: {
          attempt_count: 1
        }
      }
    ).exec();

    return {
      ok: false,
      message: "Invalid OTP"
    };
  }

  return {
    ok: true,
    otpVerification: otpVerification
  };
}

/* signup as user */
router.post("/signup", async function (req, res) {
  if (!req.body.email || !req.body.password) {
    senderr(res);
  } else {
    req.body.email = req.body.email.toLowerCase();
    User.count(
      {
        email: req.body.email
      },
      function (err, count) {
        if (count > 0) {
          res.json({
            status: "false",
            message: "Email already exists"
          });
        } else {
          let imagename = crypto.randomBytes(6).toString("hex") + ".jpeg";
          if (typeof req.body.imageurl != "undefined") {
            req.body.profile_image = imagename;
          }
          let newUser = new User(req.body);
          newUser.save(function (err) {
            if (err) {
              senderr(res);
            } else {
              if (typeof req.body.imageurl != "undefined") {
                let options = {
                  url: req.body.imageurl,
                  dest: userassets + imagename
                };
                download
                  .image(options)
                  .then(({ filename, image }) => {
                    res.json({
                      status: "true",
                      message: "Your account has been created, please login to your account."
                    });
                  })
                  .catch(err => {
                    res.json({
                      status: "true",
                      message: "Your account has been created, please login to your account."
                    });
                  });
              } else {
                res.json({
                  status: "true",
                  message: "Your account has been created, please login to your account."
                });
              }
            }
          });
        }
      }
    );
  }
});

/* signin as user */
router.post("/signin", function (req, res) {
  console.log("signin api is calling");
  req.body.email = req.body.email.toLowerCase();
  User.findOne(
    {
      email: req.body.email
    },
   
    function (err, user) {
      console.log(err);
      if (!user) {
        //console.log(err);
        res.json({
          status: "false",
          message: "Email not registered"
        });
      } else {
        if (user.deletion_status === 1) {
          res.json({
            status: "error",
            message: 'Account has been deleted successfully'
          });
        }else{
          user.comparePassword(req.body.password, function (err, isMatch) {
            if (isMatch && !err) {
              /* authenticate with token */
              let userObj = user.toObject();
              userObj.role = "user";
              let signintoken = jwt.sign(userObj, config.secret);
              if (typeof req.body.country_code != "undefined" && typeof req.body.phone_number != "undefined") {
                /* save the otp details */
                user.country_code = req.body.country_code;
                user.phone_number = req.body.phone_number;
                user.save();
              }
              let profile_image = user.profile_image;
              if (typeof user.profile_image == "undefined") {
                let profile_image = "user.png";
              }
              let walletamount = Math.round(user.walletmoney * 100) / 100;
              let result = {
                status: "true",
                role: user.role,
                user_id: user._id,
                full_name: user.full_name,
                email: user.email,
                password: req.body.password,
                country_code: user.country_code,
                phone_number: user.phone_number,
                user_image: base_url + "/gallery/users/" + profile_image,
                token: "JWT " + signintoken,
                emergency_contact: user.emergency_contact,
                walletmoney: walletamount
              };
              res.json(result);
              console.log("result");
        console.log(result);
            } else {
              res.json({
                status: "false",
                message: "Incorrect username or password"
              });
            }
          });
        }
        
      }
    }
  );
});

/* user profile */
router.get("/profile/:userid", function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!user) {
      res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else {
      User.findOne(
        {
          _id: req.params.userid
        },
        function (err, user) {
          if (err) {
            return res.json({
              status: "false",
              message: "Unable to load profile"
            });
          }
          if (!user) {
            res.json({
              status: "false",
              message: "No users found."
            });
          } else {
            let profile_image = user.profile_image;
            if (!profile_image) {
              profile_image = "user.png";
            }
            let result = {};
            result.status = "true";
            result.user_id = user._id;
            result.full_name = user.full_name;
            result.email = user.email;
            result.user_image = base_url + "/gallery/users/" + profile_image;
            result.country_code = user.country_code;
            result.phone_number = user.phone_number;
            result.invite_url = "URL";
            result.walletmoney = 0;
            if (typeof user.walletmoney != "undefined" && user.walletmoney != null) {
              result.walletmoney = Math.round(user.walletmoney * 100) / 100;
            }
            result.emergency_contact = Array.isArray(user.emergency_contact) ? user.emergency_contact : [];
            res.json(result);
          }
        }
      );
    }
  })(req, res);
});

/* help pages */
router.get("/helppages", function (req, res) {
  Help.count(function (err, count) {
    if (err) senderr(res);
    else {
      Help.find(
        {
          type: "user"
        },
        function (err, helps) {
          if (!err) {
            res.json({
              status: "true",
              result: helps
            });
          } else {
            senderr(res);
          }
        }
      );
    }
  });
});

/* notifications */
router.get("/notifications/:userid", function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!user) {
      res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else {
      Notifications.count(
        {
          notify_to: req.params.userid
        },
        function (err, count) {
          if (count > 0) {
            Notifications.find({
              notify_to: req.params.userid
            }).sort({
              _id: -1
            })
              .exec(function (err, notifications) {
                if (!err) {
                  res.json({
                    status: "true",
                    result: notifications
                  });
                } else {
                  senderr(res);
                }
              });
          } else {
            res.json({
              status: "false",
              message: "No notifications found"
            });
          }
        }
      );
    }
  })(req, res);
});

/* reset password */
router.post("/resetpassword", function (req, res, next) {
  async.waterfall(
    [
      function (done) {
        crypto.randomBytes(8, function (err, buf) {
          let token = buf.toString("hex");
          done(err, token);
        });
      },
      function (token, done) {
        User.findOne(
          {
            email: req.body.email
          },
          function (err, user) {
            if (!user) {
              res.json({
                status: "false",
                message: "No account with that email address exists."
              });
            } else{
              if(user.deletion_status===1){
                res.json({
                  status: "error",
                  message: "Account Deleted."
                });
              }else {
                user.password = token;
                user.save(function (err) {
                  let mailOptions = {
                    to: req.body.email, // list of receivers
                    subject: "Password Changed !", // Subject line
                    html: "Your new password : " + token // html body
                  };
                  Admin.findOne(function (err, admin) {
                    let transporter = nodemailer.createTransport({
                      host: admin.smptHost,
                      port: admin.smtpPort,
                      secure: false,
                      auth: {
                        user: admin.smtpUsername,
                        pass: admin.smtpPassword
                      }
                    });
                    // send mail with defined transport object
                    transporter.sendMail(mailOptions, (error, info) => {
                      if (error) {
                        senderr(res);
                      } else {
                        res.json({
                          status: "true",
                          message: "Your Password has been reset successfully. Kindly check your registered mail now"
                        });
                      }
                    });
                  });
                });
              }
            }            
          }
        );
      }
    ],
    function (err) {
      if (err) {
        senderr(res);
      }
    }
  );
});

/* phone OTP */
router.post("/getotp", async function (req, res) {
  const rawPhoneNumber = req.body.phone_number;
  const purpose = getOtpPurpose(req);
  if (!rawPhoneNumber) {
    return res.json({
      status: "false",
      message: "Phone number is required"
    });
  }

  const normalizedPhoneNumber = smsService.normalizePhoneNumber(rawPhoneNumber);
  if (!normalizedPhoneNumber) {
    return res.json({
      status: "false",
      message: "Invalid phone number"
    });
  }

  const phoneParts = buildPhoneParts(rawPhoneNumber);
  if (!phoneParts) {
    return res.json({
      status: "false",
      message: "Invalid phone number"
    });
  }

  if (purpose === FORGOT_PASSWORD_OTP_PURPOSE) {
    const existingUser = await User.findOne({
      country_code: phoneParts.countryCode,
      phone_number: phoneParts.nationalNumber,
      deletion_status: 0
    }).exec();

    if (!existingUser) {
      return res.json({
        status: "false",
        message: "Phone number not registered"
      });
    }
  }

  const otp = randomstring.generate({
    length: 6,
    charset: "numeric"
  });
  const message = `Your Shilota verification code is ${otp}`;

  const smsResult = await smsService.sendSms(normalizedPhoneNumber, message);
  if (!smsResult.success && !smsResult.skipped) {
    return res.json({
      status: "false",
      message: "Failed to send OTP",
      error: smsResult.error || smsResult.response || null
    });
  }

  try {
    await OtpVerification.deleteMany({
      phone_number: phoneParts.normalizedPhoneNumber,
      purpose: purpose,
      verified: false,
      consumed: false
    }).exec();

    let otpVerification = new OtpVerification({
      phone_number: phoneParts.normalizedPhoneNumber,
      country_code: phoneParts.countryCode,
      purpose: purpose,
      otp_hash: hashOtp(phoneParts.normalizedPhoneNumber, purpose, otp),
      expires_at: moment()
        .add(OTP_EXPIRY_MINUTES, "minutes")
        .toDate(),
      sms_enabled: !smsResult.skipped
    });
    await otpVerification.save();
  } catch (error) {
    return senderr(res);
  }

  return res.json({
    status: "true",
    message: smsResult.skipped ? "OTP generated successfully" : "OTP sent successfully",
    otp: otp,
    phone_number: phoneParts.normalizedPhoneNumber,
    sms_enabled: !smsResult.skipped,
    expires_in: OTP_EXPIRY_MINUTES * 60
  });
});

router.post("/verifyotp", async function (req, res) {
  const rawPhoneNumber = req.body.phone_number;
  const otp = String(req.body.otp || "");
  const purpose = getOtpPurpose(req);

  if (!rawPhoneNumber || !otp) {
    return res.json({
      status: "false",
      message: "Phone number and OTP are required"
    });
  }

  const phoneParts = buildPhoneParts(rawPhoneNumber);
  if (!phoneParts) {
    return res.json({
      status: "false",
      message: "Invalid phone number"
    });
  }

  try {
    const verificationResult = await verifyOtpForPurpose(
      phoneParts.normalizedPhoneNumber,
      purpose,
      otp
    );

    if (!verificationResult.ok) {
      return res.json({
        status: "false",
        message: verificationResult.message
      });
    }

    const otpVerification = verificationResult.otpVerification;

    if (otpVerification.verified) {
      return res.json({
        status: "true",
        message: "OTP already verified",
        phone_number: phoneParts.normalizedPhoneNumber
      });
    }

    await OtpVerification.updateOne(
      {
        _id: otpVerification._id
      },
      {
        $set: {
          verified: true,
          verified_at: new Date()
        }
      }
    ).exec();

    return res.json({
      status: "true",
      message: "OTP verified successfully",
      phone_number: phoneParts.normalizedPhoneNumber
    });
  } catch (error) {
    return senderr(res);
  }
});

router.post("/resetpasswordbyotp", async function (req, res) {
  const rawPhoneNumber = req.body.phone_number;
  const otp = String(req.body.otp || "");
  const newPassword = String(req.body.new_password || "");

  if (!rawPhoneNumber || !otp || !newPassword) {
    return res.json({
      status: "false",
      message: "Phone number, OTP and new password are required"
    });
  }

  const phoneParts = buildPhoneParts(rawPhoneNumber);
  if (!phoneParts) {
    return res.json({
      status: "false",
      message: "Invalid phone number"
    });
  }

  try {
    const user = await User.findOne({
      country_code: phoneParts.countryCode,
      phone_number: phoneParts.nationalNumber
    }).exec();

    if (!user) {
      return res.json({
        status: "false",
        message: "Phone number not registered"
      });
    }

    if (user.deletion_status === 1) {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }

    const verificationResult = await verifyOtpForPurpose(
      phoneParts.normalizedPhoneNumber,
      FORGOT_PASSWORD_OTP_PURPOSE,
      otp
    );

    if (!verificationResult.ok) {
      return res.json({
        status: "false",
        message: verificationResult.message
      });
    }

    user.password = newPassword;
    await user.save();

    await OtpVerification.updateOne(
      {
        _id: verificationResult.otpVerification._id
      },
      {
        $set: {
          verified: true,
          verified_at: new Date(),
          consumed: true,
          consumed_at: new Date()
        }
      }
    ).exec();

    return res.json({
      status: "true",
      message: "Password changed successfully"
    });
  } catch (_error) {
    return senderr(res);
  }
});

/* upload user profile image */
let storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, userassets);
  },
  filename: function (req, file, callback) {
    crypto.pseudoRandomBytes(16, function (err, raw) {
      if (err) return callback(err);
      callback(null, raw.toString("hex") + path.extname(file.originalname));
    });
  }
});

router.post("/uploadprofileimage", function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!user) {
      res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else {
      let upload = multer({
        storage: storage,
        fileFilter: function (req, file, callback) {
          let ext = path.extname(file.originalname);
          if (ext !== ".png" && ext !== ".jpg" && ext !== ".jpeg") {
            return callback(res.end("Only images are allowed"), null);
          }
          callback(null, true);
        }
      }).single("userImage");
      upload(req, res, function (err) {
        if (err || !res.req.file) {
          return res.json({
            status: "false",
            message: err && err.message ? err.message : "Select a valid profile image"
          });
        }
        User.findOne(
          {
            _id: user._id
          },
          function (findErr, profileUser) {
            if (findErr || !profileUser) {
              return senderr(res);
            }
            if (profileUser.profile_image) {
              fs.unlink(userassets + profileUser.profile_image, function (error) {
                if (error) {
                  //console.log(err);
                  // senderr(res);
                }
              });
            }
            profileUser.profile_image = res.req.file.filename;
            profileUser.save(function (saveErr) {
              if (saveErr) {
                return senderr(res);
              }
              res.json({
                status: "true",
                user_image: base_url + "/gallery/users/" + res.req.file.filename,
                message: "Image uploaded successfully"
              });
            });
          }
        );
      });
    }
  })(req, res);
});

/* change password */
router.post("/changepassword", function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!user) {
      res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else {
      if (!req.body.user_id || !req.body.newpassword) {
        senderr(res);
      } else {
        User.findOne(
          {
            _id: req.body.user_id
          },
          function (err, user) {
            if (!user) {
              senderr(res);
            }
            user.password = req.body.newpassword;
            user.save(function (err) {
              res.json({
                status: "true",
                message: "Password changed successfully"
              });
            });
          }
        );
      }
    }
  })(req, res);
}
);

/* update password */
router.post(
  "/updatepassword",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.old_password || !req.body.new_password || !req.body.user_id) {
          senderr(res);
        } else {
          User.findOne(
            {
              _id: req.body.user_id
            },
            function (err, user) {
              if (!user) {
                senderr(res);
              }
              user.comparePassword(req.body.old_password, function (err, isMatch) {
                if (isMatch && !err) {
                  user.password = req.body.new_password;
                  user.save(function (err) {
                    if (!err) {
                      res.json({
                        status: "true",
                        message: "Password changed successfully"
                      });
                    } else {
                      res.json({
                        status: "false",
                        message: "Something went wrong"
                      });
                    }
                  });
                } else {
                  res.json({
                    status: "false",
                    message: "Old password is incorrect"
                  });
                }
              });
            }
          );
        }
      }
    })(req, res);
  }
);

/* register a user device for notifications*/
router.post(
  "/pushsignin",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.device_token || !req.body.device_type || !req.body.device_id) {
          senderr(res);
        } else {
          UserDevices.count(
            {
              device_id: req.body.device_id
            },
            function (err, count) {
              if (count > 0) {
                UserDevices.findOneAndUpdate(
                  {
                    device_id: req.body.device_id
                  },
                  {
                    $set: req.body
                  }
                ).exec(function (err, userdevices) {
                  if (err) {
                    senderr(res);
                  } else {
                    res.json({
                      status: "true",
                      message: "Registered successfully"
                    });
                  }
                });
              } else {
                let newDevices = new UserDevices(req.body);
                newDevices.save();
                res.json({
                  status: "true",
                  message: "Registered successfully"
                });
              }
            }
          );
        }
      }
    })(req, res);
  }
);

router.get("/passenger/subscriptionplans/:userid", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    } else if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    } else if (String(user._id) !== String(req.params.userid)) {
      return res.json({
        status: "false",
        message: "Unauthorized access"
      });
    }

    try {
      var plans = await SubscriptionPlan.find({
        customer_type: "PASSENGER",
        is_active: true
      }).sort({
        display_order: 1,
        created_at: 1
      }).exec();
      var featureMap = await loadPlanFeatures((plans || []).map(function (plan) { return plan._id; }));

      return res.json({
        status: "true",
        result: (plans || []).map(function (plan) {
          return {
            _id: plan._id,
            name: plan.name,
            description: plan.description,
            price: plan.price,
            currency: plan.currency,
            duration_unit: plan.duration_unit,
            duration_value: plan.duration_value,
            validity_label: formatPlanValidity(plan),
            features: featureMap[String(plan._id)] || []
          };
        })
      });
    } catch (_error) {
      return res.json({
        status: "false",
        result: []
      });
    }
  })(req, res);
});

router.get("/passenger/subscriptions/current/:userid", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    } else if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    } else if (String(user._id) !== String(req.params.userid)) {
      return res.json({
        status: "false",
        message: "Unauthorized access"
      });
    }

    try {
      var activeSubscription = await getCurrentPassengerSubscription(user._id, new Date());
      var pendingSubscription = await Subscription.findOne({
        customer_type: "PASSENGER",
        user_id: user._id,
        status: "PENDING_PAYMENT"
      }).sort({ created_at: -1 }).exec();

      return res.json({
        status: "true",
        current_subscription: buildPassengerSubscriptionResponse(activeSubscription),
        pending_subscription: buildPassengerSubscriptionResponse(pendingSubscription)
      });
    } catch (_error) {
      return res.json({
        status: "false",
        message: "Unable to load subscription details"
      });
    }
  })(req, res);
});

router.get("/passenger/subscriptions/history/:userid", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    } else if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    } else if (String(user._id) !== String(req.params.userid)) {
      return res.json({
        status: "false",
        message: "Unauthorized access"
      });
    }

    try {
      var subscriptions = await Subscription.find({
        customer_type: "PASSENGER",
        user_id: user._id
      }).sort({ created_at: -1 }).limit(20).exec();

      return res.json({
        status: "true",
        result: (subscriptions || []).map(buildPassengerSubscriptionResponse)
      });
    } catch (_error) {
      return res.json({
        status: "false",
        result: []
      });
    }
  })(req, res);
});

router.get("/passenger/subscriptions/features/:userid", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    } else if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    } else if (String(user._id) !== String(req.params.userid)) {
      return res.json({
        status: "false",
        message: "Unauthorized access"
      });
    }

    try {
      const featureCodes = [
        "CAN_SET_RIDE_PRICE",
        "CAN_BROADCAST_RIDE_REQUEST",
        "PRIORITY_MATCHING",
        "MAX_PRICE_BROADCASTS_PER_DAY",
        "PASSENGER_BROADCAST_RADIUS_KM"
      ];
      const values = {};
      for (const featureCode of featureCodes) {
        values[featureCode] = await passengerHasFeature(user._id, featureCode);
      }
      return res.json({
        status: "true",
        result: values
      });
    } catch (_error) {
      return res.json({
        status: "false",
        result: {}
      });
    }
  })(req, res);
});

router.get("/passenger/subscriptions/broadcastcontext/:userid", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    } else if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    } else if (String(user._id) !== String(req.params.userid)) {
      return res.json({
        status: "false",
        message: "Unauthorized access"
      });
    }

    try {
      const settings = await getPriceBroadcastSettings();
      const authorization = await getPassengerBroadcastAuthorization(
        user._id,
        new Date(),
        settings
      );
      const current = await getCurrentPassengerSubscriptionWithFeatures(
        user._id,
        new Date()
      );
      const featureMap = current && current.featureMap ? current.featureMap : {};

      return res.json({
        status: "true",
        result: {
          enabled: authorization.enabled,
          allowed: authorization.allowed,
          reason_code: authorization.code || "",
          message: authorization.message || "",
          default_radius_km: Number(settings.default_radius_km || 8),
          max_radius_km: Number(settings.max_radius_km || 20),
          default_expiry_minutes: Number(settings.default_expiry_minutes || 5),
          max_expiry_minutes: Number(settings.max_expiry_minutes || 15),
          max_broadcasts_per_day: featureMap.MAX_PRICE_BROADCASTS_PER_DAY ?? settings.max_broadcasts_per_day ?? null,
          passenger_broadcast_radius_km: featureMap.PASSENGER_BROADCAST_RADIUS_KM ?? settings.default_radius_km ?? 8,
          current_subscription: buildPassengerSubscriptionResponse(current.subscription)
        }
      });
    } catch (error) {
      return res.json({
        status: "false",
        message: error && error.message ? error.message : "Unable to load price broadcast settings"
      });
    }
  })(req, res);
});

router.post("/passenger/location", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    } else if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    } else if (!req.body.user_id || String(user._id) !== String(req.body.user_id)) {
      return res.json({
        status: "false",
        message: "Unauthorized access"
      });
    }

    try {
      const updatedUser = await updatePassengerLocation(user._id, req.body);
      if (!updatedUser) {
        return res.json({
          status: "false",
          message: "A valid passenger location is required"
        });
      }
      return res.json({
        status: "true",
        message: "Passenger location updated"
      });
    } catch (_error) {
      return senderr(res);
    }
  })(req, res);
});

router.get("/destinationbroadcasts/nearby/:userid", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    } else if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    } else if (String(user._id) !== String(req.params.userid)) {
      return res.json({
        status: "false",
        message: "Unauthorized access"
      });
    }

    if (!isDriverDestinationBroadcastEnabled()) {
      return res.json({
        status: "true",
        result: [],
        message: "Driver destination broadcast is disabled"
      });
    }

    try {
      const lat = req.query.lat || user.current_lat;
      const lng = req.query.lng || user.current_lng;
      const broadcasts = await listNearbyBroadcasts({
        userId: user._id,
        lat: lat,
        lng: lng,
        now: new Date()
      });
      const driverIds = broadcasts.map(function (item) {
        return String(item.driver_id);
      });
      const drivers = await Driver.find({
        _id: { $in: driverIds }
      }).exec();
      const vehicles = await Vehicles.find({
        user_id: { $in: driverIds }
      }).exec();

      return res.json({
        status: "true",
        result: broadcasts.map(function (broadcast) {
          const driver = drivers.find(function (item) {
            return String(item._id) === String(broadcast.driver_id);
          });
          const vehicle = vehicles.find(function (item) {
            return String(item.user_id) === String(broadcast.driver_id);
          });
          return {
            _id: String(broadcast._id),
            driver_id: String(broadcast.driver_id),
            driver_name: driver ? String(driver.full_name || "") : "",
            driver_image: driver ? String(driver.profile_image || "") : "",
            vehicle_name: vehicle ? String(vehicle.vehicle_name || "") : "",
            vehicle_number: vehicle ? String(vehicle.vehicle_number || "") : "",
            origin_label: broadcast.origin_label,
            origin_lat: broadcast.origin_lat,
            origin_lng: broadcast.origin_lng,
            destination_label: broadcast.destination_label,
            destination_lat: broadcast.destination_lat,
            destination_lng: broadcast.destination_lng,
            departure_time: broadcast.departure_time,
            price_per_passenger: broadcast.price_per_passenger,
            available_seats: broadcast.available_seats,
            remaining_seats: broadcast.remaining_seats,
            notification_radius: broadcast.notification_radius,
            expires_at: broadcast.expires_at,
            status: broadcast.status
          };
        })
      });
    } catch (_error) {
      return senderr(res);
    }
  })(req, res);
});

router.post("/destinationbroadcasts/join", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    } else if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    } else if (!req.body.user_id || String(user._id) !== String(req.body.user_id)) {
      return res.json({
        status: "false",
        message: "Unauthorized access"
      });
    } else if (!req.body.broadcast_id || !req.body.pickup_label) {
      return senderr(res);
    }

    try {
      const result = await createJoinRequest({
        broadcastId: req.body.broadcast_id,
        passengerId: user._id,
        pickupLabel: req.body.pickup_label,
        pickupLat: req.body.pickup_lat,
        pickupLng: req.body.pickup_lng,
        requestedSeats: req.body.requested_seats,
        now: new Date()
      });

      if (!result.ok) {
        return res.json({
          status: "false",
          message: result.message,
          error_code: result.code
        });
      }

      driverNotify([result.broadcast.driver_id], "A passenger wants to join your destination trip", {
        type: "destination_join_request",
        broadcast_id: String(result.broadcast._id),
        join_request_id: String(result.joinRequest._id),
        passenger_id: String(user._id),
        passenger_name: String(user.full_name || ""),
        pickup_label: result.joinRequest.pickup_label,
        requested_seats: String(result.joinRequest.requested_seats),
        message: "A passenger wants to join your destination trip"
      });

      return res.json({
        status: "true",
        message: "Join request submitted",
        result: {
          _id: String(result.joinRequest._id),
          broadcast_id: String(result.joinRequest.broadcast_id),
          status: result.joinRequest.status,
          requested_seats: result.joinRequest.requested_seats
        }
      });
    } catch (_error) {
      return senderr(res);
    }
  })(req, res);
});

router.get("/destinationbroadcasts/requests/:userid", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    } else if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    } else if (String(user._id) !== String(req.params.userid)) {
      return res.json({
        status: "false",
        message: "Unauthorized access"
      });
    }

    try {
      const requests = await DriverDestinationJoinRequest.find({
        passenger_id: String(user._id)
      }).sort({ created_at: -1 }).limit(30).exec();
      const broadcasts = await DriverDestinationBroadcast.find({
        _id: { $in: requests.map(function (item) { return String(item.broadcast_id); }) }
      }).exec();
      return res.json({
        status: "true",
        result: requests.map(function (item) {
          const broadcast = broadcasts.find(function (entry) {
            return String(entry._id) === String(item.broadcast_id);
          });
          return {
            _id: String(item._id),
            broadcast_id: String(item.broadcast_id),
            pickup_label: item.pickup_label,
            requested_seats: item.requested_seats,
            status: item.status,
            destination_label: broadcast ? broadcast.destination_label : "",
            departure_time: broadcast ? broadcast.departure_time : null,
            price_per_passenger: broadcast ? broadcast.price_per_passenger : null
          };
        })
      });
    } catch (_error) {
      return senderr(res);
    }
  })(req, res);
});

router.post("/passenger/subscriptions/initiate", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    } else if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    } else if (!req.body.user_id || !req.body.plan_id) {
      return senderr(res);
    } else if (String(user._id) !== String(req.body.user_id)) {
      return res.json({
        status: "false",
        message: "Unauthorized access"
      });
    } else if (!selcomService.isConfigured()) {
      return res.json({
        status: "false",
        message: "Selcom payment is not configured"
      });
    }

    try {
      const plan = await SubscriptionPlan.findById(req.body.plan_id).exec();
      const validationMessage = validatePassengerPlanForPurchase(plan);
      if (validationMessage) {
        return res.json({
          status: "false",
          message: validationMessage
        });
      }

      const planFeaturesById = await loadPlanFeatures([plan._id]);
      const planFeatures = planFeaturesById[String(plan._id)] || [];
      const existingPendingSubscription = await Subscription.findOne({
        customer_type: "PASSENGER",
        user_id: user._id,
        plan_id: plan._id,
        status: "PENDING_PAYMENT",
        payment_status: "PENDING"
      }).sort({ created_at: -1 }).exec();

      let subscription = existingPendingSubscription;
      if (!subscription) {
        subscription = new Subscription(buildPendingPassengerSubscriptionRecord(user._id, plan, planFeatures, new Date()));
        await subscription.save();
      }

      const transid = selcomService.generateTransId();
      const returnUrl = selcomService.buildReturnUrl(transid);
      const checkout = await selcomService.createOrder({
        transid: transid,
        amount: subscription.price_snapshot,
        user: user,
        userId: req.body.user_id,
        returnUrl: returnUrl,
        remarks: "Shilota passenger subscription payment"
      });

      const session = await SelcomPaymentSession.findOneAndUpdate(
        { transid: transid },
        {
          transid: transid,
          order_id: checkout.orderId,
          user_id: String(req.body.user_id),
          actor_type: PASSENGER_SUBSCRIPTION_ACTOR_TYPE,
          amount: subscription.price_snapshot,
          status: "pending",
          purpose: "passenger_subscription",
          subscription_id: subscription._id,
          plan_id: plan._id,
          verified_at: null,
          consumed_at: null,
          expires_at: new Date(Date.now() + 30 * 60 * 1000)
        },
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      ).exec();

      subscription.selcom_session_id = session._id;
      await subscription.save();

      return res.json({
        status: "true",
        message: "Payment URL generated successfully",
        payment_url: checkout.paymentUrl,
        return_url: returnUrl,
        transid: transid,
        subscription_id: String(subscription._id),
        result: buildPassengerSubscriptionResponse(subscription)
      });
    } catch (error) {
      return res.json({
        status: "false",
        message: error && error.message ? error.message : "Unable to create subscription payment"
      });
    }
  })(req, res);
});

router.get("/passenger/subscriptions/verifyselcom/:transid", async function (req, res) {
  const transid = String(req.params.transid || "").trim();
  if (!transid) {
    return senderr(res);
  }

  try {
    const session = await SelcomPaymentSession.findOne({
      transid: transid,
      actor_type: PASSENGER_SUBSCRIPTION_ACTOR_TYPE
    }).exec();

    if (!session) {
      return res.json({
        status: "false",
        message: "Payment session not found"
      });
    }

    if (session.expires_at && session.expires_at.getTime() < Date.now() && !session.verified_at) {
      return res.json({
        status: "false",
        message: "Payment session has expired"
      });
    }

    if (session.status !== "verified" && session.status !== "completed" && !session.verified_at) {
      try {
        await ensureSelcomPaymentVerified(session, transid);
      } catch (verifyError) {
        if (session.status === "failed") {
          await finalizePassengerSubscriptionSession(session, new Date());
        }
        return res.json({
          status: "false",
          message: verifyError && verifyError.message ? verifyError.message : "Payment is still pending"
        });
      }
    }

    const finalized = await finalizePassengerSubscriptionSession(session, new Date());
    if (finalized && finalized.subscription) {
      if (!session.consumed_at && (session.status === "verified" || session.status === "completed" || session.verified_at)) {
        session.status = "completed";
        session.consumed_at = new Date();
        await session.save();
      }

      const success = finalized.reason === "activated" || finalized.reason === "already_active";
      return res.json({
        status: success ? "true" : "false",
        message: success ? "Subscription activated successfully" : "Payment is still pending",
        transid: transid,
        paidamount: String(session.paid_amount || session.amount || ""),
        result: buildPassengerSubscriptionResponse(finalized.subscription)
      });
    }

    return res.json({
      status: "false",
      message: "Payment is still pending"
    });
  } catch (error) {
    return res.json({
      status: "false",
      message: error && error.message ? error.message : "Unable to verify Selcom payment"
    });
  }
});

/* register a webapp device for notifications */
router.post("/appsignin", function (req, res) {
  if (!req.body.user_id || !req.body.device_token) {
    senderr(res);
  } else {
    WebUsers.count(
      {
        user_id: req.body.user_id
      },
      function (err, count) {
        if (count > 0) {
          WebUsers.findOneAndUpdate(
            {
              user_id: req.body.user_id
            },
            {
              $set: req.body
            }
          ).exec(function (err, userdevices) {
            if (err) {
              senderr(res);
            } else {
              res.json({
                status: "true",
                message: "Registered successfully"
              });
            }
          });
        } else {
          let newDevices = new WebUsers(req.body);
          newDevices.save();
          res.json({
            status: "true",
            message: "Registered successfully"
          });
        }
      }
    );
  }
});

/* unregister a webapp device for notifications */
router.post("/appsignout", function (req, res) {
  if (!req.body.user_id) {
    senderr(res);
  } else {
    WebUsers.count(
      {
        user_id: req.body.user_id
      },
      function (err, count) {
        if (count > 0) {
          WebUsers.findOneAndRemove(
            {
              user_id: req.body.user_id
            },
            function (err, count) {
              res.json({
                status: "true",
                message: "Unregistered successfully"
              });
            }
          );
        } else {
          senderr(res);
        }
      }
    );
  }
});

/* send a test push to the authenticated user's registered devices */
router.post("/testpush", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    } else if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    try {
      const targetUserId = String(user._id);
      const message = String(req.body.message || "Test push notification from Shilota API").trim();
      const admin = await Admin.findOne({}).sort({ _id: -1 }).exec();
      const mobileDevices = await UserDevices.find({ user_id: targetUserId }).exec();
      const webDevices = await WebUsers.find({ user_id: targetUserId }).exec();
      const mobileTokens = mobileDevices.map(rec => rec.device_token).filter(Boolean);
      const webTokens = webDevices.map(rec => rec.device_token).filter(Boolean);

      if (!mobileTokens.length && !webTokens.length) {
        return res.json({
          status: "false",
          message: "No registered device tokens found for this user"
        });
      }

      const data = {
        type: "testpush",
        message: message,
        user_id: targetUserId
      };

      const tasks = [];
      if (mobileTokens.length) {
        tasks.push(
          pushService.sendNotification({
            tokens: mobileTokens,
            message: message,
            data: data,
            mobile: true,
            siteName: admin && admin.siteName
          })
        );
      }

      if (webTokens.length) {
        tasks.push(
          pushService.sendNotification({
            tokens: webTokens,
            title: admin && admin.siteName ? admin.siteName : "Shilota",
            message: message,
            data: data,
            web: true,
            siteName: admin && admin.siteName,
            icon: config.baseUrl + "/favicon.png"
          })
        );
      }

      await Promise.all(tasks);

      notifyTo({
        user_id: "0",
        notify_to: targetUserId,
        title: admin && admin.siteName ? admin.siteName : "Shilota",
        message: message
      });

      return res.json({
        status: "true",
        message: "Test push notification queued successfully",
        mobile_tokens: mobileTokens.length,
        web_tokens: webTokens.length
      });
    } catch (error) {
      return res.json({
        status: "false",
        message: error && error.message ? error.message : "Unable to send test push notification"
      });
    }
  })(req, res);
});

/* unregister a user device for notifications*/
router.delete(
  "/pushsignout",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully',
          deleted_type:"user"
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.device_id) {
          senderr(res);
        } else {
          UserDevices.count(
            {
              device_id: req.body.device_id
            },
            function (err, count) {
              if (count > 0) {
                UserDevices.findOneAndRemove(
                  {
                    device_id: req.body.device_id
                  },
                  function (err, count) {
                    res.json({
                      status: "true",
                      message: "Unregistered successfully"
                    });
                  }
                );
              } else {
                senderr(res);
              }
            }
          );
        }
      }
    })(req, res);
  }
);

/* Available rides */
router.post("/grabrides" /* , passport.authenticate('jwt', {
  session: false
}), */, function (req, res) {
    //if (!req.body.user_id || !req.body.pickup_location || !req.body.pickup_lat || !req.body.pickup_lng || !req.body.drop_location || !req.body.drop_lat || !req.body.drop_lng || !req.body.distance) {
    if (!req.body.pickup_location ||!req.body.pickup_lat ||!req.body.pickup_lng || !req.body.drop_location ||
      !req.body.drop_lat ||
      !req.body.drop_lng ||
      !req.body.distance
    ) {
      senderr(res);
    } else {
      Admin.findOne(function (err, admin) {
        /* maximum distance coverage */
        let distance = parseFloat(req.body.distance).toFixed(2);
        let maxdistcoverage = parseInt(admin.distancePerCab);
        let maxdisperride = parseInt(admin.maxdisperride);
        if (distance > maxdisperride) {
          res.json({
            status: "false",
            message: "Sorry! Service not available in this location"
          });
        } else {
          let lon = parseFloat(req.body.pickup_lng);
          let lat = parseFloat(req.body.pickup_lat);
          /* mongo geonear api */
          let buildDriverAvailabilityQuery = function (serviceType) {
            return Driver.aggregate([
            {
              $geoNear: {
                near: {
                  type: "Point",
                  coordinates: [lon, lat]
                },
                maxDistance: maxdistcoverage * 1000,
                spherical: true,
                distanceField: "distance",
                query: {
                  live_status: "1",
                  approval: "1",
                  ...buildDriverServiceTypeMatch(serviceType)
                }
              }
            },
            {
              $sort: {
                distance: 1
              }
            }
            ]);
          };
          let groupEligibleDriversByCategory = function (drivers) {
            let nearestByCategory = {};
            (drivers || []).forEach(function (eligibleDriver) {
              let categoryId = String(eligibleDriver.category_id || "").trim();
              if (!categoryId) {
                return;
              }
              let existing = nearestByCategory[categoryId];
              if (!existing || Number(eligibleDriver.distance) < Number(existing.distance)) {
                nearestByCategory[categoryId] = {
                  _id: categoryId,
                  distance: eligibleDriver.distance,
                  email: eligibleDriver.email,
                  instant_location: eligibleDriver.instant_location
                };
              }
            });
            return Object.keys(nearestByCategory).map(function (categoryId) {
              return nearestByCategory[categoryId];
            }).sort(function (left, right) {
              return Number(left.distance) - Number(right.distance);
            });
          };
          let query = buildDriverAvailabilityQuery("ride");
          query.exec(function (err, driver) {
            if (err) {
              senderr(res);
            } else {
              let deliveryQuery = buildDriverAvailabilityQuery("delivery");
              deliveryQuery.exec(function (deliveryErr, deliveryDriver) {
                if (deliveryErr) {
                  senderr(res);
                  return;
                }
                Promise.all([
                  filterEligibleDrivers(driver, { now: new Date() }),
                  filterEligibleDrivers(deliveryDriver, { now: new Date() })
                ]).then(function (eligibleDriverSets) {
                  driver = groupEligibleDriversByCategory(eligibleDriverSets[0]);
                  deliveryDriver = groupEligibleDriversByCategory(eligibleDriverSets[1]);
                  console.log(driver);
                  if (driver.length == 0 && deliveryDriver.length == 0) {
                    res.json({
                      status: "false",
                      message: "Sorry! Service not available in this location"
                    });
                  } else {
                    let availcat = [""];
                    let deliveryAvailcat = [""];
                    let distbycat = [];
                    let reachbycat = [];
                    let instanthere = []; /* drivers instant location array  */
                    for (let k = 0; k < driver.length; k++) {
                      let driverId = driver[k]._id;
                      let instant = driver[k].instant_location;
                      if (driverId != null) {
                        availcat.push(driverId);
                      }
                      distbycat[driverId] = distance;
                      reachbycat[driverId] = reachPickupLabel(driver[k].distance);
                      instanthere.push(instant);
                    }
                    for (let k = 0; k < deliveryDriver.length; k++) {
                      let deliveryCategoryId = deliveryDriver[k]._id;
                      if (deliveryCategoryId != null) {
                        deliveryAvailcat.push(deliveryCategoryId);
                        if (!distbycat[deliveryCategoryId]) {
                          distbycat[deliveryCategoryId] = distance;
                        }
                        if (!reachbycat[deliveryCategoryId]) {
                          reachbycat[deliveryCategoryId] = reachPickupLabel(deliveryDriver[k].distance);
                        }
                      }
                    }

                    if (availcat.length > 0 || deliveryAvailcat.length > 0) {
                      Categories.find()
                        // .where('_id')
                        // .in(availcat)
                        .sort({
                          _id: 1
                        })
                        .exec(function (err, categories) {
                          if (!err) {
                            let available_rides = [];
                            let cat_det = [];
                            let categoryresult = {};
                            let available_rides_count = 0;
                            Commissions.find().exec(function (err, results) {
                              categories.forEach(function (c) {
                                let fareamount = totalFare(c, distbycat, admin.maxDistance);
                                let commissionamount = calculateCommissionAmount(
                                  fareamount,
                                  results,
                                  isCommissionEnabled()
                                );
                                let approxprice = 0;
                                approxprice = parseFloat(fareamount) + parseFloat(commissionamount);
                                let profile_image = c.image;
                                if (typeof profile_image == "undefined") {
                                  let profile_image = "category.png";
                                }
                                let categoryimage = base_url + "/imagegallery/" + profile_image;
                                let basePrice = roundCustomerPayableAmount(approxprice);
                                if (availcat.indexOf(String(c._id)) > 0) {
                                  available_rides.push({
                                    _id: c._id,
                                    category_name: c.category_name,
                                    image: categoryimage,
                                    baseprice: "0",
                                    reach_pickup: reachbycat[c._id] || "",
                                    service_type: "ride",
                                    available: "1"
                                  });
                                  available_rides_count++;
                                } else {
                                  available_rides.push({
                                    _id: c._id,
                                    category_name: c.category_name,
                                    image: categoryimage,
                                    baseprice: "-",
                                    reach_pickup: "",
                                    service_type: "ride",
                                    available: "0"
                                  });
                                }
                                if (deliveryAvailcat.indexOf(String(c._id)) > 0 && available_rides.filter(function (ride) {
                                  return ride.service_type === "delivery";
                                }).length === 0) {
                                  available_rides.push({
                                    _id: c._id,
                                    category_name: "Package Delivery",
                                    image: categoryimage,
                                    baseprice: basePrice,
                                    reach_pickup: reachbycat[c._id] || "",
                                    service_type: "delivery",
                                    available: "1"
                                  });
                                  available_rides_count++;
                                }
                              });
                              findPoolSettings(function (poolSettings) {
                                categoryresult.status = "true";
                                categoryresult.count = available_rides_count;
                                categoryresult.available_ride = available_rides;
                                categoryresult.pooling = {
                                  enabled: isPoolZoneEnabled(poolSettings, {
                                    pickup_lat: req.body.pickup_lat,
                                    pickup_lng: req.body.pickup_lng
                                  }),
                                  discount_percent: Number(poolSettings.discount_percent || 0),
                                  max_passengers: Number(poolSettings.max_passengers || 3),
                                  zone_key: buildPoolZoneKey(req.body.pickup_lat, req.body.pickup_lng)
                                };
                                res.json(categoryresult);
                              });

                            });
                          } else {
                            senderr(res);
                          }
                        });
                    } else {
                      res.json({
                        status: "false",
                        message: "Sorry! Service not available at this moment"
                      });
                    }
                  }
                }).catch(function () {
                  senderr(res);
                });
              });
            }
          });
        }
      });
    }
  });

router.get("/poolsettings", function (req, res) {
  findPoolSettings(function (settings) {
    return res.json({
      status: "true",
      enabled: isPoolZoneEnabled(settings, {
        pickup_lat: req.query.pickup_lat,
        pickup_lng: req.query.pickup_lng
      }),
      discount_percent: Number(settings.discount_percent || 0),
      max_passengers: Number(settings.max_passengers || 3),
      max_detour_km: Number(settings.max_detour_km || 3),
      max_pickup_gap_km: Number(settings.max_pickup_gap_km || 2),
      max_drop_gap_km: Number(settings.max_drop_gap_km || 3),
      zone_key: buildPoolZoneKey(req.query.pickup_lat, req.query.pickup_lng)
    });
  });
});

router.get("/riderblockstatus/:user_id", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!user || String(user._id) !== String(req.params.user_id)) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    RiderBlocks.find({
      user_id: req.params.user_id,
      status: "active"
    }).sort({ created_at: -1 }).exec(function (blockErr, blocks) {
      if (blockErr) {
        return res.json({
          status: "false",
          message: "Unable to load rider block status"
        });
      }

      let pendingReview = (blocks || []).some(function (block) {
        return String(block.admin_review_status || "").toLowerCase() === "pending";
      });
      let activeBlockCount = (blocks || []).length;

      return res.json({
        status: "true",
        active_block_count: activeBlockCount,
        pending_review: pendingReview,
        latest_block: blocks && blocks[0] ? blocks[0] : null
      });
    });
  })(req, res);
});

/* request a ride */
router.post("/routepath", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (_err, user) {
    if (!user || String(user._id) !== String(req.body.user_id || "")) {
      return res.json({ status: "false", message: "Unauthorized access" });
    }

    try {
      const encodedPolyline = await getRoadRoute(req.body || {});
      return res.json({ status: "true", encoded_polyline: encodedPolyline });
    } catch (routeError) {
      return res.json({
        status: "false",
        message: routeError && routeError.message ? routeError.message : "Unable to calculate route"
      });
    }
  })(req, res);
});

router.post("/ridestatus", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (_err, user) {
    if (!user || String(user._id) !== String(req.body.user_id || "")) {
      return res.json({ status: "false", message: "Unauthorized access" });
    }
    if (!req.body.onride_id) {
      return res.json({ status: "false", message: "Ride id is required" });
    }
    Rides.findOne({
      _id: req.body.onride_id,
      user_id: req.body.user_id
    }).select("ridestatus driver_id ride_started_at ride_completed_at").lean().exec(function (rideError, ride) {
      if (rideError || !ride) {
        return res.json({ status: "false", message: "Ride not found" });
      }
      return res.json({
        status: "true",
        ride_status: ride.ridestatus || "",
        driver_id: ride.driver_id || "",
        ride_started_at: ride.ride_started_at || null,
        ride_completed_at: ride.ride_completed_at || null
      });
    });
  })(req, res);
});

router.post(
  "/requestride",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, async function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (
          !req.body.user_id ||
          !req.body.category_id ||
          !req.body.payment_type ||
          !req.body.type ||
          !req.body.pickup_location ||
          !req.body.pickup_lat ||
          !req.body.pickup_lng ||
          !req.body.drop_location ||
          !req.body.drop_lat ||
          !req.body.drop_lng
        ) {
          senderr(res);
        } else {
          const isPassengerBroadcast = isPassengerBroadcastRequest(req.body);
          let timestamp = timeZone();
          let randomnumber = randomstring.generate({
            length: 4,
            charset: "numeric"
          });
          req.body.onride_otp = randomnumber.substr(0, 4);
          req.body.service_type = normalizeRideServiceType(req.body.service_type);
          req.body.ride_stops = normalizeRideStops(req.body.ride_stops);
          req.body.pooling_opt_in = normalizeBoolean(req.body.pooling_opt_in);
          req.body.seats_requested = Math.max(Number(req.body.seats_requested || 1), 1);
          req.body.pool_status = req.body.pooling_opt_in ? "pool_requested" : "solo";
          req.body.delivery_details = normalizeDeliveryDetails(req.body.delivery_details);
          if (req.body.type == "schedule") {
            const scheduleMoment = parseScheduleMoment(req.body.schedule_time);
            const scheduleError = validateScheduleMoment(scheduleMoment);
            if (scheduleError) {
              return res.json({
                status: "false",
                message: scheduleError
              });
            }
            req.body.ridestatus = "scheduled";
            req.body.schedule_utc_time = scheduleMoment.toISOString();
          } else {
            req.body.ridestatus = "requested";
          }
          /* schedule utc time */
          if (req.body.schedule_time && req.body.type != "schedule") {
            const scheduleMoment = parseScheduleMoment(req.body.schedule_time);
            if (scheduleMoment) {
              req.body.schedule_utc_time = scheduleMoment.toISOString();
            }
          }
	          req.body.ridestatusat = timestamp;
	          const saveRide = function () {
	            let newRides = new Rides(req.body);
              if (isPassengerBroadcast) {
                return Promise.resolve(newRides);
              }
	            prepareDriverPricedRidePayload(newRides, new Date());
              return Promise.resolve(newRides);
            };

            const prepareAndSaveRide = function () {
              saveRide()
                .then(function (newRides) {
                  attemptMatchPoolRide(newRides, function (preparedRide) {
                    preparedRide.save(function (err, rides) {
                      if (!err) {
                        res.json({
                          status: "true",
                          onride_id: preparedRide._id,
                          onride_type: preparedRide.type,
                          request_type: preparedRide.request_type || "STANDARD",
                          pricing_mode: preparedRide.pricing_mode || "platform",
                          offer_expires_at: preparedRide.offer_expires_at || null,
                          broadcast_expires_at: preparedRide.broadcast_expires_at || null,
                          passenger_offered_price: preparedRide.passenger_offered_price || null,
                          broadcast_radius: preparedRide.broadcast_radius || null,
                          seats_requested: preparedRide.seats_requested,
                          pool_status: preparedRide.pool_status,
                          pool_group_size: preparedRide.pool_group_size,
                          pool_discount_percent: preparedRide.pool_discount_percent
                        });
                      } else {
                        senderr(res);
                      }
                    });
                  });
                })
                .catch(function (saveError) {
                  return res.json({
                    status: "false",
                    message: saveError && saveError.message ? saveError.message : "Unable to create ride request"
                  });
                });
            };

            if (isPassengerBroadcast) {
              try {
                const settings = await getPriceBroadcastSettings();
                const authorization = await getPassengerBroadcastAuthorization(
                  req.body.user_id,
                  new Date(),
                  settings
                );

                if (!authorization.enabled) {
                  return res.json({
                    status: "false",
                    message: authorization.message || "Passenger price broadcast is not enabled",
                    error_code: authorization.code || "PASSENGER_PRICE_BROADCAST_DISABLED"
                  });
                }

                if (!authorization.allowed) {
                  return res.json({
                    status: "false",
                    message: authorization.message || "An active passenger subscription is required",
                    error_code: authorization.code || "PASSENGER_SUBSCRIPTION_REQUIRED"
                  });
                }

                const passengerOfferPrice = toPositiveNumber(req.body.passenger_offered_price);
                if (passengerOfferPrice === null) {
                  return res.json({
                    status: "false",
                    message: "Please enter a valid passenger price",
                    error_code: "PASSENGER_PRICE_REQUIRED"
                  });
                }

                const context = await getCurrentPassengerSubscriptionWithFeatures(
                  req.body.user_id,
                  new Date()
                );
                const featureMap = context && context.featureMap ? context.featureMap : {};
                const subscriptionRadius = Number(featureMap.PASSENGER_BROADCAST_RADIUS_KM);
                const configuredRadius = toPositiveNumber(req.body.broadcast_radius);
                const requestedRadius =
                  configuredRadius ||
                  (Number.isFinite(subscriptionRadius) && subscriptionRadius > 0
                    ? subscriptionRadius
                    : Number(settings.default_radius_km || 8));
                const maxRadius = Number(settings.max_radius_km || requestedRadius);
                const normalizedRadius = Math.min(requestedRadius, maxRadius);

                const requestedExpiry = toPositiveNumber(req.body.broadcast_expiry_minutes);
                const defaultExpiry = Number(settings.default_expiry_minutes || 5);
                const maxExpiry = Number(settings.max_expiry_minutes || defaultExpiry);
                const normalizedExpiry = Math.min(
                  requestedExpiry || defaultExpiry,
                  maxExpiry
                );

                req.body.request_type = REQUEST_TYPE_PASSENGER_PRICE_BROADCAST;
                req.body.pooling_opt_in = false;
                req.body.seats_requested = 1;
                req.body.pool_status = "solo";
                await preparePassengerPriceBroadcastPayload(req.body, {
                  enabled: true,
                  passengerOfferedPrice: passengerOfferPrice,
                  broadcastRadius: normalizedRadius,
                  defaultRadius: settings.default_radius_km,
                  expiryMinutes: normalizedExpiry,
                  currency: req.body.currency || "TZS",
                  now: new Date()
                });
              } catch (broadcastError) {
                return res.json({
                  status: "false",
                  message: broadcastError && broadcastError.message
                    ? broadcastError.message
                    : "Unable to create price broadcast request"
                });
              }
            }

            if (req.body.type == "schedule") {
              prepareAndSaveRide();
            } else {
              try {
                await cancelSupersededRequestedRides(req.body.user_id);
              } catch (cleanupError) {
                console.error("Unable to replace an unaccepted ride request:", cleanupError);
                return senderr(res);
              }
              Rides.findOne({
                user_id: req.body.user_id,
                ridestatus: { $in: ACTIVE_RIDE_STATUSES }
              }).exec(function (err, activeRide) {
                if (err) {
                  senderr(res);
                } else if (activeRide) {
                  Payments.count({
                    onride_id: activeRide._id
                  }, function (paymentErr, paymentCount) {
                    if (paymentErr) {
                      senderr(res);
                    } else if (paymentCount > 0) {
                      Rides.updateMany({
                        user_id: req.body.user_id,
                        ridestatus: { $in: ACTIVE_RIDE_STATUSES }
                      }, {
                        $set: {
                          ridestatus: "completed",
                          ridestatusat: timeZone(),
                          ride_completed_at: new Date()
                        }
                      }).exec(function (updateErr) {
                        if (updateErr) {
                          senderr(res);
                        } else {
                          if (activeRide.driver_id) {
                            setDriverAvailableIfEligible(activeRide.driver_id, function () {});
                          }
                          prepareAndSaveRide();
                        }
                      });
                    } else {
                      res.json({
                        status: "false",
                        message: "You already have an active ride",
                        error_code: "ACTIVE_RIDE_EXISTS",
                        onride_id: activeRide._id,
                        ridestatus: activeRide.ridestatus,
                        driver_id: activeRide.driver_id || "",
                        created_at: activeRide.created_at || null
                      });
                    }
                  });
                } else {
                  prepareAndSaveRide();
                }
              });
            }
        }
      }
    })(req, res);
  }
);

router.post(
  "/updatescheduledride",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (
          !req.body.user_id ||
          !req.body.onride_id ||
          !req.body.category_id ||
          !req.body.payment_type ||
          !req.body.pickup_location ||
          !req.body.pickup_lat ||
          !req.body.pickup_lng ||
          !req.body.drop_location ||
          !req.body.drop_lat ||
          !req.body.drop_lng ||
          !req.body.schedule_time
        ) {
          senderr(res);
        } else {
          const scheduleMoment = parseScheduleMoment(req.body.schedule_time);
          const scheduleError = validateScheduleMoment(scheduleMoment);
          if (scheduleError) {
            return res.json({
              status: "false",
              message: scheduleError
            });
          }

          const updatePayload = {
            category_id: req.body.category_id,
            payment_type: req.body.payment_type,
            pickup_location: req.body.pickup_location,
            pickup_lat: req.body.pickup_lat,
            pickup_lng: req.body.pickup_lng,
            drop_location: req.body.drop_location,
            drop_lat: req.body.drop_lat,
            drop_lng: req.body.drop_lng,
            baseprice: req.body.baseprice,
            service_type: normalizeRideServiceType(req.body.service_type),
            ride_stops: normalizeRideStops(req.body.ride_stops),
            pooling_opt_in: normalizeBoolean(req.body.pooling_opt_in),
            seats_requested: Math.max(Number(req.body.seats_requested || 1), 1),
            pool_status: normalizeBoolean(req.body.pooling_opt_in) ? "pool_requested" : "solo",
            delivery_details: normalizeDeliveryDetails(req.body.delivery_details),
            type: "schedule",
            schedule_time: req.body.schedule_time,
            schedule_utc_time: scheduleMoment.toISOString(),
            ridestatus: "scheduled",
            ridestatusat: timeZone(),
            notify: 0,
            schedule_reminder_notify: 0
          };

          Rides.findOneAndUpdate(
            {
              _id: req.body.onride_id,
              user_id: req.body.user_id,
              ridestatus: {
                $in: ["scheduled", "scheduleridenotaccepted"]
              }
            },
            {
              $set: updatePayload,
              $unset: {
                driver_id: "",
                vehicle_no: ""
              }
            },
            {
              new: true
            }
          ).exec(function (updateErr, ride) {
            if (updateErr) {
              return senderr(res);
            }
            if (!ride) {
              return res.json({
                status: "false",
                message: "Scheduled ride can no longer be modified"
              });
            }

            return res.json({
              status: "true",
              message: "Scheduled ride updated successfully",
              onride_id: ride._id,
              onride_type: ride.type,
              seats_requested: ride.seats_requested,
              pool_status: ride.pool_status
            });
          });
        }
      }
    })(req, res);
  }
);

/* confirm a ride */
router.post(
  "/confirmride",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        let translatedstring = "";
        if (!req.body.user_id || !req.body.onride_id || !req.body.is_notify) {
          senderr(res);
        } else {
          let querystring = {
            _id: req.body.onride_id,
            user_id: req.body.user_id
          };
          console.log("confirmride api is calling");
          let rideresult = {};
          Rides.findOne(querystring)
            .populate("driver_id")
            .exec(function (err, rides) {
              if (!err) {
	                if (rides.ridestatus == "ontheway" || rides.ridestatus == "accepted" || rides.ridestatus == "onride") {
	                  rideresult.status = "true";
                  rideresult.pickup_location = rides.pickup_location;
                  rideresult.pickup_lat = rides.pickup_lat;
                  rideresult.pickup_lng = rides.pickup_lng;
                  rideresult.drop_location = rides.drop_location;
                  rideresult.drop_lat = rides.drop_lat;
                  rideresult.drop_lng = rides.drop_lng;
                  rideresult.onride_otp = rides.onride_otp;
	                  rideresult.driver_name = rides.driver_id.full_name;
	                  rideresult.final_agreed_price = rides.final_agreed_price;
	                  rideresult.final_agreed_currency = rides.final_agreed_currency || "TZS";
	                  rideresult.pricing_mode = rides.pricing_mode || "platform";
                  if (typeof rides.driver_id.rating == "undefined") {
                    rides.driver_id.rating = "0";
                  }
                  let querystring = {
                    driver_id: rides.driver_id._id
                  };
                  rideresult.driver_mobile = rides.driver_id.phone_number;
                  rideresult.driver_id = rides.driver_id.batch_id;
                  rideresult.driver_userid = rides.driver_id._id;
                  rideresult.driver_image = base_url + "/gallery/drivers/" + rides.driver_id.profile_image;
                  Vehicles.findOne(
                    {
                      user_id: rides.driver_id._id
                    },
                    function (err, vehicles) {
                      if (!err) {
                  rideresult.driver_vehicle = vehicles.vehicle_name;
                      rideresult.driver_vehicleno = vehicles.vehicle_number;
                        rideresult.ride_stops = rides.ride_stops || [];
                        rideresult.pooling_opt_in = rides.pooling_opt_in;
                        rideresult.seats_requested = rides.seats_requested;
                        rideresult.pool_status = rides.pool_status;
                        rideresult.pool_group_size = rides.pool_group_size || 1;
                        rideresult.pool_discount_percent = rides.pool_discount_percent || 0;
                        rideresult.delivery_details = rides.delivery_details || {};
                        let userids = [req.body.user_id];
                        
                        let notifed = req.body.is_notify; // remove notifications
                        if (notifed > 0) {
                          UserDevices.findOne({
                            user_id: req.body.user_id
                          }, function (err, userdevices) {
                            if (userdevices) {
                              let lang = userdevices.lang_type;
                              
                              let message = translationServer.langTranslate("YourridehasbeenacceptedKindlycontactyourdriver", lang);
                              let data = {
                                ride_id: rides._id,
                                type: "acceptride",
                                message: message
                              };
                              translatedstring = translationServer.langTranslate("YourridehasbeenacceptedKindlycontactyourdriver", lang);

                              userNotify(userids, translatedstring, data);


                            }

                          });

                        }
                        Reviews.count(querystring, function (err, count) {
                          if (count > 0) {
                            rideresult.driver_rating = parseFloat(rides.driver_id.rating / count).toFixed(1);
                            res.json(rideresult);
                          } else {
                            rideresult.driver_rating = "0";
                            res.json(rideresult);
                          }
                        });
                      } else {
                        senderr(res);
                      }
                    }
                  );
	                } else if (rides.ridestatus == "scheduled") {
	                  res.json({
	                    status: "true",
	                    message: "Your ride has been successfully scheduled"
	                  });
	                } else if (isOfferBasedRide(rides)) {
	                  listRideOffersForPassenger(rides._id, req.body.user_id, new Date())
	                    .then(function (offerState) {
	                      const offers = offerState.offers || [];
                        const isPassengerBroadcast = isPassengerBroadcastRide(rides);
                        const expiryDate = isPassengerBroadcast
                          ? rides.broadcast_expires_at || rides.offer_expires_at || null
                          : rides.offer_expires_at || null;
	                      if (offers.length > 0) {
	                        return res.json({
	                          status: "offers",
	                          message: isPassengerBroadcast ? "Driver responses available" : "Driver offers available",
	                          pricing_mode: rides.pricing_mode || "driver_offer",
                            request_type: rides.request_type || "STANDARD",
	                          onride_id: rides._id,
	                          offer_expires_at: expiryDate,
                            broadcast_expires_at: rides.broadcast_expires_at || null,
                            passenger_offered_price: rides.passenger_offered_price || null,
	                          offers: offers
	                        });
	                      }

	                      if (expiryDate instanceof Date && expiryDate.getTime() <= Date.now()) {
	                        return res.json({
	                          status: "false",
	                          message: isPassengerBroadcast
                              ? "No driver responded before the passenger broadcast expired"
                              : "No driver offer was received before the request expired",
	                          pricing_mode: rides.pricing_mode || "driver_offer",
                            request_type: rides.request_type || "STANDARD",
	                          offers: []
	                        });
	                      }

	                      let lon = parseFloat(rides.pickup_lng);
	                      let lat = parseFloat(rides.pickup_lat);
	                      Admin.findOne(function (adminErr, admin) {
	                        let maxdistcoverage = parseInt(admin.distancePerCab);
	                        let query = buildNearbyDriverQuery(lon, lat, maxdistcoverage, rides);
	                        query.exec(function (driverErr, driver) {
	                          if (driverErr) {
	                            return senderr(res);
	                          }
	                          filterEligibleDrivers(driver, {
	                            now: new Date()
	                          }).then(function (eligibleDrivers) {
	                            driver = filterDriversByAcceptanceSettings(eligibleDrivers, rides);
	                            filterBlockedDriversForRide(driver, rides, function (availableDrivers) {
	                              if (availableDrivers.length === 0) {
	                                return res.json({
	                                  status: "false",
	                                  message: "Sorry! No Driver found nearby at this moment",
	                                  pricing_mode: rides.pricing_mode || "driver_offer",
                                    request_type: rides.request_type || "STANDARD",
	                                  offers: []
	                                });
	                              }

	                              let availdrivers = [];
	                              availableDrivers.forEach(function (d) {
	                                availdrivers.push(d._id);
	                              });
	                              if (rides.notify == 0) {
	                                nearBy(availdrivers, rides._id);
	                              }
	                              return res.json({
	                                status: "searching_offers",
	                                message: isPassengerBroadcast
                                      ? "Broadcasting your proposed price to nearby drivers"
                                      : "Waiting for driver offers",
	                                pricing_mode: rides.pricing_mode || "driver_offer",
                                    request_type: rides.request_type || "STANDARD",
	                                onride_id: rides._id,
	                                offer_expires_at: expiryDate,
                                    broadcast_expires_at: rides.broadcast_expires_at || null,
                                    passenger_offered_price: rides.passenger_offered_price || null,
	                                offers: []
	                              });
	                            });
	                          }).catch(function () {
	                            senderr(res);
	                          });
	                        });
	                      });
	                    })
	                    .catch(function () {
	                      senderr(res);
	                    });
	                } else {
                  /* notify nearby drivers */
                  let lon = parseFloat(rides.pickup_lng);
                  let lat = parseFloat(rides.pickup_lat);
                  Admin.findOne(function (err, admin) {
                    let maxdistcoverage = parseInt(admin.distancePerCab);
                    /* mongo geonear api */
                    let query = buildNearbyDriverQuery(lon, lat, maxdistcoverage, rides);
                    query.exec(function (err, driver) {
                      if (err) {
                        senderr(res);
                      } else {
                        filterEligibleDrivers(driver, {
                          now: new Date()
                        }).then(function (eligibleDrivers) {
                        driver = filterDriversByAcceptanceSettings(eligibleDrivers, rides);
                        filterBlockedDriversForRide(driver, rides, function (availableDrivers) {
                        console.log(availableDrivers.length);
                        if (availableDrivers.length == "0") {
                          res.json({
                            status: "false",
                            message: "Sorry! No Driver found nearby at this moment"
                          });
                        } else {
                          let availdrivers = [];
                          availableDrivers.forEach(function (d) {
                            availdrivers.push(d._id);
                          });


                          res.json({
                            status: "false",
                            message: "Searching"
                          });
                          /* notify nearby drivers */
                          if (rides.notify == 0) {
                            nearBy(availdrivers, rides._id);
                          }
                        }
                        });
                        }).catch(function () {
                          senderr(res);
                        });
                      }
                    });
                  });
                }
              } else {
                senderr(res);
              }
            });
        }
      }
    })(req, res);
  }
);

router.post("/rideoffers", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (!req.body.user_id || !req.body.onride_id) {
      return senderr(res);
    }

    listRideOffersForPassenger(req.body.onride_id, req.body.user_id, new Date())
      .then(function (result) {
        return res.json({
          status: "true",
          request_type: result.ride && result.ride.request_type ? result.ride.request_type : "STANDARD",
          pricing_mode: result.ride && result.ride.pricing_mode ? result.ride.pricing_mode : "platform",
          offer_expires_at: result.ride ? result.ride.offer_expires_at || null : null,
          broadcast_expires_at: result.ride ? result.ride.broadcast_expires_at || null : null,
          passenger_offered_price: result.ride ? result.ride.passenger_offered_price || null : null,
          offers: result.offers || []
        });
      })
      .catch(function () {
        senderr(res);
      });
  })(req, res);
});

router.post("/rideoffers/accept", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (!req.body.user_id || !req.body.onride_id || !req.body.offer_id) {
      return senderr(res);
    }

    acceptRideOffer({
      rideId: req.body.onride_id,
      userId: req.body.user_id,
      offerId: req.body.offer_id,
      now: new Date()
    }).then(function (result) {
      if (!result.ok) {
        return res.json({
          status: "false",
          message: result.message,
          error_code: result.code
        });
      }

      User.findById(result.ride.user_id).exec(function (_userErr, rideUser) {
        const message = "Your offer was accepted";
        const data = {
          ride_id: String(result.ride._id),
          type: "offer_accepted",
          pickup_location: result.ride.pickup_location,
          pickup_lat: result.ride.pickup_lat,
          pickup_lng: result.ride.pickup_lng,
          drop_location: result.ride.drop_location,
          drop_lat: result.ride.drop_lat,
          drop_lng: result.ride.drop_lng,
          onride_otp: result.ride.onride_otp,
          offered_price: String(result.offer.offered_price),
          final_agreed_price: String(result.offer.offered_price),
          currency: result.offer.currency,
          user_id: result.ride.user_id,
          user_name: rideUser ? String(rideUser.full_name || "") : "",
          message: message
        };

        driverNotification([result.offer.driver_id], message, data);
        socketRegistry.emitToUser(String(result.offer.driver_id), "offer-accepted", data);
      });

      RideOffer.updateMany(
        {
          ride_request_id: String(result.ride._id),
          driver_id: {
            $ne: String(result.offer.driver_id)
          }
        },
        {
          $set: {
            status: "REJECTED"
          }
        }
      ).exec(function () {});

      res.json({
        status: "true",
        message: "Driver selected successfully",
        offer: result.offer,
        onride_id: result.ride._id,
        final_agreed_price: result.offer.offered_price,
        final_agreed_currency: result.offer.currency
      });
    }).catch(function () {
      senderr(res);
    });
  })(req, res);
});

router.post("/sosalert", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    let alert = new SosAlerts({
      actor_type: "user",
      actor_id: req.body.user_id || user._id,
      actor_model: "User",
      ride_id: req.body.ride_id || req.body.onride_id || "",
      location: req.body.location || "",
      lat: req.body.lat || req.body.latitude || "",
      lng: req.body.lng || req.body.lon || req.body.longitude || "",
      message: req.body.message || "Rider emergency alert",
      action_type: req.body.action_type || "",
      contact_target: req.body.contact_target || "",
      status: "active",
      response_due_at: new Date(Date.now() + 2 * 60 * 1000),
      callback_required: true,
      callback_status: "pending"
    });

    alert.save(function (saveErr, savedAlert) {
      if (saveErr) {
        return senderr(res);
      }

      let locationUrl = alert.lat && alert.lng ? " https://www.google.com/maps/?q=" + alert.lat + "," + alert.lng : "";
      let smsMessage = "Emergency alert from " + (user.full_name || "rider") + "." + locationUrl;
      sendEmergencySmsToContacts(emergencyContactsFromProfile(user), smsMessage, function (sentCount) {
        SosAlerts.updateOne(
          { _id: savedAlert._id },
          { $set: { contacts_notified: sentCount } }
        ).exec(function () {});
      });

      notifyTo({
        user_id: String(user._id),
        notify_to: "admin",
        title: "Rider SOS Alert",
        message: alert.message
      });

      return res.json({
        status: "true",
        message: "SOS alert sent",
        sos_id: savedAlert._id
      });
    });
  })(req, res);
});

router.post("/lostitem/report", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (!req.body.ride_id || !req.body.item_description) {
      return senderr(res);
    }

    Rides.findOne({
      _id: req.body.ride_id,
      user_id: String(user._id)
    }).exec(function (rideErr, ride) {
      if (rideErr || !ride) {
        return res.json({
          status: "false",
          message: "Ride not found"
        });
      }

      LostItems.findOneAndUpdate(
        {
          ride_id: String(ride._id),
          user_id: String(user._id),
          status: {
            $ne: "resolved"
          }
        },
        {
          $set: {
            driver_id: ride.driver_id || "",
            item_description: req.body.item_description,
            contact_phone: req.body.contact_phone || user.phone_number || "",
            status: "open",
            response_due_at: new Date(Date.now() + 48 * 60 * 60 * 1000),
            escalation_status: "normal",
            escalated_at: null,
            driver_notified: Boolean(ride.driver_id),
            chat_opened: true,
            return_incentive_status: "eligible"
          },
          $setOnInsert: {
            ride_id: String(ride._id),
            user_id: String(user._id),
            created_at: new Date()
          }
        },
        {
          new: true,
          upsert: true
        }
      ).exec(function (caseErr, lostItem) {
        if (caseErr) {
          return senderr(res);
        }

        LostItems.count({
          driver_id: ride.driver_id || "",
          status: {
            $ne: "resolved"
          }
        }).exec(function (_countErr, repeatCount) {
          let shouldFlagDriver = Number(repeatCount || 0) >= 3;
          LostItems.updateOne(
            { _id: lostItem._id },
            {
              $set: {
                repeat_driver_loss_count: repeatCount || 1,
                driver_flagged: shouldFlagDriver
              }
            }
          ).exec(function () {});

          saveLostItemMessage({
            lost_item_id: lostItem._id,
            ride_id: ride._id,
            user_id: user._id,
            driver_id: ride.driver_id || "",
            sender_type: "user",
            sender_id: user._id,
            message: req.body.item_description,
            increment_admin_unread: 1,
            increment_driver_unread: ride.driver_id ? 1 : 0
          }, function (messageErr) {
            if (messageErr) {
              console.error("Lost item initial message save failed:", messageErr);
            }
          });

          notifyTo({
            user_id: String(user._id),
            notify_to: "admin",
            title: shouldFlagDriver ? "Repeat Lost Item Driver Flagged" : "Lost Item Reported",
            message: req.body.item_description
          });

          if (ride.driver_id) {
            notifyTo({
              user_id: String(ride.driver_id),
              notify_to: "driver",
              title: "Lost Item Reported",
              message: req.body.item_description
            });
            driverNotify([ride.driver_id], "A rider reported a lost item for a completed trip", {
              ride_id: ride._id,
              user_id: String(user._id),
              user_name: user.full_name || "",
              phone_number: user.phone_number || "",
              pickup_location: ride.pickup_location || "",
              drop_location: ride.drop_location || "",
              lost_item_id: lostItem._id,
              type: "lost_item",
              message: "A rider reported a lost item for a completed trip",
              chat_opened: "true",
              return_incentive_status: "eligible"
            });
          }

          return res.json({
            status: "true",
            message: "Lost item report submitted",
            lost_item_id: lostItem._id,
            chat_opened: "true",
            return_incentive_status: "eligible",
            driver_flagged: shouldFlagDriver
          });
        });
      });
    });
  })(req, res);
});

router.get("/lostitem/messages/:lost_item_id", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    LostItems.findOne({
      _id: req.params.lost_item_id,
      user_id: String(user._id)
    }).exec(function (caseErr, lostItem) {
      if (caseErr || !lostItem) {
        return res.json({
          status: "false",
          message: "Lost item case not found"
        });
      }

      LostItemMessages.find({
        lost_item_id: String(lostItem._id)
      }).sort({ created_at: 1 }).exec(function (messageErr, messages) {
        if (messageErr) {
          return senderr(res);
        }

        LostItems.updateOne(
          {
            _id: lostItem._id
          },
          {
            $set: {
              unread_user_count: 0
            }
          }
        ).exec(function () {});

        return res.json({
          status: "true",
          lost_item_id: lostItem._id,
          case_status: lostItem.status,
          result: messages
        });
      });
    });
  })(req, res);
});

router.post("/lostitem/message", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (!req.body.lost_item_id || !req.body.message) {
      return senderr(res);
    }

    LostItems.findOne({
      _id: req.body.lost_item_id,
      user_id: String(user._id)
    }).exec(function (caseErr, lostItem) {
      if (caseErr || !lostItem) {
        return res.json({
          status: "false",
          message: "Lost item case not found"
        });
      }
      if (["resolved", "returned"].indexOf(String(lostItem.status || "").toLowerCase()) !== -1) {
        return res.json({
          status: "false",
          message: "This lost item case is already closed"
        });
      }

      saveLostItemMessage({
        lost_item_id: lostItem._id,
        ride_id: lostItem.ride_id || "",
        user_id: lostItem.user_id || "",
        driver_id: lostItem.driver_id || "",
        sender_type: "user",
        sender_id: user._id,
        message: req.body.message,
        increment_admin_unread: 1,
        increment_driver_unread: lostItem.driver_id ? 1 : 0
      }, function (messageErr, savedMessage) {
        if (messageErr) {
          return senderr(res);
        }

        notifyTo({
          user_id: String(user._id),
          notify_to: "admin",
          title: "Lost Item Follow-up",
          message: req.body.message
        });

        if (lostItem.driver_id) {
          notifyTo({
            user_id: String(lostItem.driver_id),
            notify_to: "driver",
            title: "Lost Item Follow-up",
            message: req.body.message
          });
        }

        return res.json({
          status: "true",
          data: savedMessage
        });
      });
    });
  })(req, res);
});

router.get("/lostitem/ride/:ride_id", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    LostItems.findOne({
      ride_id: req.params.ride_id,
      user_id: String(user._id)
    }).sort({ created_at: -1 }).exec(function (caseErr, lostItem) {
      if (caseErr || !lostItem) {
        return res.json({
          status: "false",
          message: "Lost item case not found"
        });
      }

      return res.json({
        status: "true",
        lost_item_id: lostItem._id,
        case_status: lostItem.status
      });
    });
  })(req, res);
});

router.get("/lostitem/:lost_item_id", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    LostItems.findOne({
      _id: req.params.lost_item_id,
      user_id: String(user._id)
    }).exec(function (caseErr, lostItem) {
      if (caseErr || !lostItem) {
        return res.json({
          status: "false",
          message: "Lost item case not found"
        });
      }

      return res.json({
        status: "true",
        lost_item_id: lostItem._id,
        case_status: lostItem.status,
        escalation_status: lostItem.escalation_status || "normal",
        return_incentive_status: lostItem.return_incentive_status || "eligible",
        rider_confirmed_returned: Boolean(lostItem.rider_confirmed_returned),
        response_due_at: lostItem.response_due_at,
        last_message_at: lostItem.last_message_at
      });
    });
  })(req, res);
});

router.post("/lostitem/:lost_item_id/escalate", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    LostItems.findOne({
      _id: req.params.lost_item_id,
      user_id: String(user._id)
    }).exec(function (caseErr, lostItem) {
      if (caseErr || !lostItem) {
        return res.json({
          status: "false",
          message: "Lost item case not found"
        });
      }

      if (String(lostItem.escalation_status || "").toLowerCase() === "escalated") {
        return res.json({
          status: "true",
          message: "Case already escalated",
          escalation_status: "escalated"
        });
      }

      lostItem.escalation_status = "escalated";
      lostItem.escalated_at = new Date();
      lostItem.admin_notes = String(req.body.reason || "Rider requested escalation").trim();
      lostItem.save(function (saveErr, savedCase) {
        if (saveErr) {
          return senderr(res);
        }

        notifyTo({
          user_id: String(user._id),
          notify_to: "admin",
          title: "Lost Item Escalation Requested",
          message: savedCase.admin_notes || "Rider requested escalation"
        });

        if (savedCase.driver_id) {
          notifyTo({
            user_id: String(savedCase.driver_id),
            notify_to: "driver",
            title: "Lost Item Escalated",
            message: "Rider requested escalation on a lost item case"
          });
        }

        return res.json({
          status: "true",
          message: "Lost item case escalated",
          escalation_status: savedCase.escalation_status
        });
      });
    });
  })(req, res);
});

router.post("/lostitem/:lost_item_id/confirmreturn", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    LostItems.findOne({
      _id: req.params.lost_item_id,
      user_id: String(user._id)
    }).exec(function (caseErr, lostItem) {
      if (caseErr || !lostItem) {
        return res.json({
          status: "false",
          message: "Lost item case not found"
        });
      }

      lostItem.status = "resolved";
      lostItem.resolved_at = new Date();
      lostItem.rider_confirmed_returned = true;
      lostItem.rider_confirmed_returned_at = new Date();
      lostItem.return_incentive_status = "completed";
      lostItem.save(function (saveErr, savedCase) {
        if (saveErr) {
          return senderr(res);
        }

        notifyTo({
          user_id: String(user._id),
          notify_to: "admin",
          title: "Lost Item Return Confirmed",
          message: "Rider confirmed the lost item was returned"
        });

        if (savedCase.driver_id) {
          notifyTo({
            user_id: String(savedCase.driver_id),
            notify_to: "driver",
            title: "Lost Item Return Confirmed",
            message: "Rider confirmed the lost item was returned"
          });
        }

        return res.json({
          status: "true",
          message: "Lost item case closed",
          case_status: savedCase.status,
          rider_confirmed_returned: true
        });
      });
    });
  })(req, res);
});

function sendScheduledRideReminders() {
  const reminderDeadline = moment().add(SCHEDULE_REMINDER_LEAD_MINUTES, "minutes").toISOString();
  Rides.find({
    type: "schedule",
    ridestatus: {
      $in: ["scheduled", "accepted"]
    },
    schedule_reminder_notify: {
      $ne: 1
    },
    schedule_utc_time: {
      $lte: reminderDeadline,
      $gt: moment().toISOString()
    }
  }).exec(function (err, rides) {
    if (err || !Array.isArray(rides)) {
      if (err) {
        console.error("Scheduled reminder lookup failed:", err);
      }
      return;
    }

    rides.forEach(function (ride) {
      const message = "Reminder: your scheduled ride starts in 1 hour";
      const data = {
        ride_id: ride._id,
        type: "scheduledride_reminder",
        message: message
      };
      userNotify([ride.user_id], message, data);
      notifyTo({
        user_id: "0",
        notify_to: ride.user_id,
        title: "Scheduled Ride Reminder",
        message: message
      });
      Rides.updateOne(
        {
          _id: ride._id
        },
        {
          $set: {
            schedule_reminder_notify: 1
          }
        }
      ).exec();
    });
  });
}

function redispatchOfflineScheduledDrivers() {
  const dispatchDeadline = moment().add(SCHEDULE_DISPATCH_LEAD_MINUTES, "minutes").toISOString();
  Rides.find({
    type: "schedule",
    ridestatus: "accepted",
    driver_id: {
      $exists: true,
      $ne: null
    },
    schedule_utc_time: {
      $lte: dispatchDeadline,
      $gt: moment().toISOString()
    }
  }).exec(function (err, rides) {
    if (err || !Array.isArray(rides)) {
      if (err) {
        console.error("Scheduled redispatch lookup failed:", err);
      }
      return;
    }

    rides.forEach(function (ride) {
      Driver.findById(ride.driver_id, function (err, driver) {
        if (err || !driver) {
          return;
        }

        evaluateDriverEligibility(driver, {
          now: new Date()
        }).then(function (eligibility) {
          if (eligibility.eligible && String(driver.live_status) === "1") {
            return;
          }

          setDriverAvailableIfEligible(driver._id, function () {});
          Rides.updateOne(
            {
              _id: ride._id,
              ridestatus: "accepted"
            },
            {
              $set: {
                ridestatus: "scheduled",
                notify: 0
              },
              $unset: {
                driver_id: "",
                vehicle_no: ""
              },
              $inc: {
                schedule_reassign_count: 1
              }
            }
          ).exec(function (updateErr) {
            if (updateErr) {
              console.error("Scheduled redispatch update failed:", updateErr);
            }
          });
        }).catch(function (eligibilityError) {
          console.error("Scheduled redispatch eligibility check failed:", eligibilityError);
        });
      });
    });
  });
}

function dispatchDueScheduledRides() {
  const dispatchDeadline = moment().add(SCHEDULE_DISPATCH_LEAD_MINUTES, "minutes").toISOString();
  Rides.find({
    ridestatus: "scheduled",
    notify: 0,
    schedule_utc_time: {
      $lte: dispatchDeadline,
      $gt: moment().toISOString()
    }
  })
    .populate("driver_id")
    .exec(function (err, schedulerides) {
      if (err) {
        console.error("Scheduled ride lookup failed:", err);
        return;
      }
      if (!Array.isArray(schedulerides) || schedulerides.length === 0) {
        return;
      }
      schedulerides.forEach(function (rides) {
        let lon = parseFloat(rides.pickup_lng);
        let lat = parseFloat(rides.pickup_lat);
        if (isNaN(lon) || isNaN(lat)) {
          return;
        }
        Admin.findOne(function (err, admin) {
          if (err || !admin) {
            if (err) {
              console.error("Admin lookup failed:", err);
            }
            return;
          }
          let maxdistcoverage = parseInt(admin.distancePerCab);
          if (isNaN(maxdistcoverage) || maxdistcoverage <= 0) {
            maxdistcoverage = 1;
          }
          let query = buildNearbyDriverQuery(lon, lat, maxdistcoverage, rides);
          query.exec(function (err, driver) {
            if (err) {
              console.error("Nearby driver query failed:", err);
            } else if (Array.isArray(driver) && driver.length > 0 && rides.notify == 0) {
              filterEligibleDrivers(driver, {
                now: new Date()
              }).then(function (eligibleDrivers) {
              driver = filterDriversByAcceptanceSettings(eligibleDrivers, rides);
              filterBlockedDriversForRide(driver, rides, function (availableDrivers) {
              let availdrivers = [];
              availableDrivers.forEach(function (d) {
                availdrivers.push(d._id);
              });
              if (availdrivers.length > 0) {
                schedulenearBy(availdrivers, rides);
              }
              });
              }).catch(function (eligibilityError) {
                console.error("Scheduled eligible driver filter failed:", eligibilityError);
              });
            }
          });
        });
      });
    });
}

function expireUnacceptedScheduledRides() {
  Rides.updateMany(
    {
      ridestatus: "scheduled",
      schedule_utc_time: {
        $lt: moment().toISOString()
      }
    },
    {
      $set: {
        ridestatus: "scheduleridenotaccepted",
        ridestatusat: timeZone()
      }
    }
  ).exec(function (err) {
    if (err) {
      console.error("Scheduled ride expiry failed:", err);
    }
  });
}

cron.schedule("* * * * *", function () {
  sendScheduledRideReminders();
  redispatchOfflineScheduledDrivers();
  dispatchDueScheduledRides();
  expireUnacceptedScheduledRides();
  expireRideOffers(new Date()).catch(function (error) {
    console.error("Ride offer expiry failed:", error);
  });
  expireDriverPricedRideRequests(new Date()).catch(function (error) {
    console.error("Driver-priced ride request expiry failed:", error);
  });
  expirePassengerPriceBroadcastRequests(new Date()).catch(function (error) {
    console.error("Passenger price broadcast expiry failed:", error);
  });
  expireDriverDestinationBroadcasts(new Date()).catch(function (error) {
    console.error("Driver destination broadcast expiry failed:", error);
  });
});

/* cancel a ride */
router.post(
  "/cancelride",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        let translatedstring = "";
        if (!req.body.user_id || !req.body.onride_id) {
          senderr(res);
        } else {
          let timestamp = timeZone();
          let querystring = {
            _id: req.body.onride_id
          };
          let ridestring = [
            {
              ridestatus: "ontheway"
            },
            {
              ridestatus: "accepted"
            },
            {
              ridestatus: "scheduled"
            }
          ];
          Rides.count(querystring)
            .or(ridestring)
            .exec(function (err, iscancelable) {
              if (iscancelable > 0) {
                Rides.findOneAndUpdate(querystring, {
                  $set: {
                    ridestatus: "cancelled",
                    ridestatusat: timestamp
                  }
                }).exec(function (err, reviews) {
                  if (err) {
                    senderr(res);
                  } else {
                    UserDevices.findOne({
                      user_id: reviews.user_id
                    }, function (err, userdevices) {
                      if (userdevices) {
                        let lang = userdevices.lang_type;
                        
                        let message = translationServer.langTranslate("Yourridehasbeencancelled", lang);
                        /* notify user */
                        let userids = [reviews.user_id];
                        let data = {
                          ride_id: reviews._id,
                          type: "cancelride",
                          message: message
                        };
                        translatedstring = translationServer.langTranslate("Yourridehasbeencancelled", lang);
                        userNotify(userids, translatedstring, data);
                      }
                    });
                    if (typeof reviews.driver_id != "undefined" || reviews.driver_id != null) {
                      let driverids = [reviews.driver_id];
                      setDriverAvailableIfEligible(reviews.driver_id, function () {});
                      DriverDevices.findOne({
                        user_id: reviews.driver_id
                      }, function (err, driverdevices) {
                        if (driverdevices) {
                          let driverlang = driverdevices.lang_type;
                        
                          let message = translationServer.langTranslate("Yourridehasbeencancelled", driverlang);
                          let data = {
                            ride_id: reviews._id,
                            type: "cancelride",
                            message: message
                          };
                          translatedstring = translationServer.langTranslate("Yourridehasbeencancelled", driverlang);
                          driverNotify(driverids, translatedstring, data);
                        }
                      });
                    }
                    /* notify user */
                    res.json({
                      status: "true",
                      message: "Your ride has been cancelled"
                    });
                  }
                });
              } else {
                res.json({
                  status: "false",
                  message: "Your ride is non-cancelable now"
                });
              }
            });
        }
      }
    })(req, res);
  }
);

/* user review a ride */
router.post(
  "/ridedetails",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.onride_id || !req.body.type) {
          senderr(res);
        } else {
          let querystring = {
            _id: req.body.onride_id,
            ridestatus: req.body.type
          };
          let rideresult = {};
          Rides.count(querystring, function (err, count) {
            if (count > 0) {
              Rides.findOne(querystring)
                .populate("category_id")
                .exec(function (err, rides) {
                  if (!err) {
                    rideresult.status = "true";
                    rideresult.category_name = rides.category_id.category_name;
                    let profile_image = rides.category_id.image;
                    if (typeof profile_image == "undefined") {
                      let profile_image = "category.png";
                    }
                    Reviews.findOne({
                      onride_id: req.body.onride_id
                    }).exec(function (err, reviews) {
                      if (reviews) {
                        rideresult.category_image = base_url + "/imagegallery/" + profile_image;
                        rideresult.pickup_location = rides.pickup_location;
                        rideresult.pickup_lat = rides.pickup_lat;
                        rideresult.pickup_lng = rides.pickup_lng;
                        rideresult.drop_location = rides.drop_location;
                        rideresult.drop_lat = rides.drop_lat;
                        rideresult.drop_lng = rides.drop_lng;
                        rideresult.approx_price = rides.baseprice;
                        rideresult.isreview = "true";
                        rideresult.review_message = reviews.review_message;
                        rideresult.rating = reviews.rating;
                        res.json(rideresult);
                      } else {
                        rideresult.category_image = base_url + "/imagegallery/" + profile_image;
                        rideresult.pickup_location = rides.pickup_location;
                        rideresult.pickup_lat = rides.pickup_lat;
                        rideresult.pickup_lng = rides.pickup_lng;
                        rideresult.drop_location = rides.drop_location;
                        rideresult.drop_lat = rides.drop_lat;
                        rideresult.drop_lng = rides.drop_lng;
                        rideresult.approx_price = rides.baseprice;
                        rideresult.isreview = "false";
                        res.json(rideresult);
                      }
                    });
                  } else {
                    senderr(res);
                  }
                });
            } else {
              senderr(res);
            }
          });
        }
      }
    })(req, res);
  }
);

/* ongoing ride */
router.post(
  "/ongoingrideindetail",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.onride_id) {
          senderr(res);
        } else {
          let ridestring = [
            {
              ridestatus: "onride"
            },
            {
              ridestatus: "ontheway"
            },
            {
              ridestatus: "accepted"
            }
          ];
          Rides.count({
            _id: req.body.onride_id
          })
            .or(ridestring)
            .exec(function (err, count) {
              if (count > 0) {
                Rides.findOne({
                  _id: req.body.onride_id
                })
                  .or(ridestring)
                  .populate("category_id")
                  .populate("driver_id")
                  .exec(function (err, rides) {
                    if (!err) {
                      Vehicles.findOne(
                        {
                          user_id: rides.driver_id._id
                        },
                        function (err, vehicles) {
                          if (!err) {
                            let vehicleinfo = {};
                            vehicleinfo.driver_vehicle = vehicles.vehicle_name;
                            vehicleinfo.driver_vehicleno = vehicles.vehicle_number;
                            Reviews.count(
                              {
                                driver_id: rides.driver_id._id
                              },
                              function (err, count) {
                                if (count > 0) {
                                  Admin.findOne(function (err, admin) {
                                    if (!err) {
                                      googledistance.apiKey = admin.googleMapKey;
                                      /* googleapi to calculate distance */
                                      /* let googleapi = googledistance.get(
                                        {
                                          origins: [rides.pickup_location],
                                          destinations: [rides.drop_location]
                                        },
                                        function(err, data) {
                                          if (!err) { */
                                      let ratings = parseFloat(rides.driver_id.rating / count).toFixed(1);
                                      res.json({
                                        status: "true",
                                        driver_ratings: ratings,
                                        vehicleinfo: vehicleinfo,
                                        distanceInfo: 15,//data[0],
                                        result: rides
                                      });
                                      /* } else {
                                        senderr(res);
                                      }
                                    }
                                  ); */
                                    } else {
                                      senderr(res);
                                    }
                                  });
                                } else {
                                  Admin.findOne(function (err, admin) {
                                    if (!err) {
                                      googledistance.apiKey = admin.googleMapKey;
                                      /* googleapi to calculate distance */
                                      /* let googleapi = googledistance.get(
                                        {
                                          origins: [rides.pickup_location],
                                          destinations: [rides.drop_location]
                                        },
                                        function(err, distanceInfo) {
                                          if (!err) { */
                                      res.json({
                                        status: "true",
                                        driver_ratings: "0",
                                        distanceInfo: 15,//distanceInfo[0],
                                        vehicleinfo: vehicleinfo,
                                        result: rides
                                      });
                                      
                                    } else {
                                      console.log("Error2:", err);
                                      senderr(res);
                                    }
                                  });
                                }
                              }
                            );
                          } else {
                            console.log("Error3:", err);
                            senderr(res);
                          }
                        }
                      );
                    } else {
                      console.log("Error4:", err);
                      senderr(res);
                    }
                  });
              } else {
                senderr(res);
              }
            });
        }
      }
    })(req, res);
  }
);

/* ongoing ride */
router.post(
  "/incompleterideindetail",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.onride_id) {
          senderr(res);
        } else {
          let ridestring = [
            {
              ridestatus: "cancelled"
            },
            {
              ridestatus: "scheduled"
            },
            {
              ridestatus: "scheduleridenotaccepted"
            }
          ];
          Rides.count(
            {
              _id: req.body.onride_id
            },
            function (err, count) {
              if (count > 0) {
                Rides.findOne({
                  _id: req.body.onride_id
                })
                  .or(ridestring)
                  .populate("category_id")
                  .populate("driver_id")
                  .exec(function (err, rides) {
                    if (!err) {
                      res.json({
                        status: "true",
                        result: rides
                      });
                    } else {
                      senderr(res);
                    }
                  });
              } else {
                senderr(res);
              }
            }
          );
        }
      }
    })(req, res);
  }
);

/* user's rides (or) booking history */
router.post(
  "/ridehistory",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.type) {
          senderr(res);
        } else {
          let ridestring = [
            {
              ridestatus: "onride"
            },
            {
              ridestatus: "ontheway"
            },
            {
              ridestatus: "scheduled"
            },
            {
              ridestatus: "accepted"
            }
          ];
          let rideresult = [],
            taxprice,
            statustime;
          if (req.body.type == "history") {
            ridestring = [
              {
                ridestatus: "cancelled"
              },
              {
                ridestatus: "completed"
              },
              {
                ridestatus: "scheduleridenotaccepted"
              }
            ];
          }
          Rides.find({
            user_id: req.body.user_id
          })
            .or(ridestring)
            .populate("category_id")
            .sort({
              _id: -1
            })
            .exec(function (err, rides) {
              if (!err) {
                if (rides.length == "0") {
                  res.json({
                    status: "false",
                    message: "No rides found"
                  });
                } else {
                  rides.forEach(function (c) {
                    if (typeof c.tax == "undefined" || c.tax == null) {
                      taxprice = 0;
                    } else {
                      taxprice = c.tax;
                    }
                    if (c.type == "schedule") {
                      statustime = parseInt(c.schedule_time);
                    } else {
                      statustime = c.ridestatusat;
                    }
                    if (typeof c.vehicle_no == "undefined" || c.vehicle_no == null) {
                      vehicle_no = "";
                    } else {
                      vehicle_no = c.vehicle_no;
                    }
                    let profile_image = c.category_id.image; //c.category_id.image;
                    if (typeof profile_image == "undefined") {
                      let profile_image = "category.png";
                    }
                    let categoryimage = base_url + "/imagegallery/" + profile_image;
                    let rideTotal = parseFloat(c.baseprice) + parseFloat(taxprice);
                    rideresult.push({
                      onride_id: c._id,
                      category_image: categoryimage,
                      category_name: c.category_id.category_name,
                      ride_status: c.ridestatus,
                      driver_id: c.driver_id,
                      total_price: roundCustomerPayableAmount(rideTotal),
                      vehicle_no: vehicle_no,
                      pickup_time: statustime
                    });
                  });
                  res.json({
                    status: "true",
                    result: rideresult
                  });
                }
              } else {
                senderr(res);
              }
            });
        }
      }
    })(req, res);
  }
);

/* complete ride details */
router.post(
  "/completeridedetails",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.onride_id) {
          senderr(res);
        } else {
          let querystring = {
            _id: req.body.onride_id
          };
          let ridestring = [
            {
              ridestatus: "completed"
            },
            {
              ridestatus: "onride"
            }
          ];
          let rideresult = {};
          Rides.count(querystring, function (err, count) {
            if (count > 0) {
              Rides.findOne(querystring)
                .or(ridestring)
                .populate("payment_id")
                .populate("driver_id")
                .populate("user_id")
                .populate("category_id")
                .exec(function (err, rides) {
                  if (!err) {
                    rideresult.status = "true";
                    rideresult.ridestatus = rides.ridestatus;
                    let profile_image = rides.category_id.image;
                    if (!profile_image) {
                      profile_image = "category.png";
                    }
                    rideresult.category_image = base_url + "/imagegallery/" + profile_image;
                    rideresult.category_name = rides.category_id.category_name;
                    rideresult.username = rides.user_id.full_name;
                    rideresult.driver_id = rides.driver_id._id;
                    rideresult.pickup_location = rides.pickup_location;
                    rideresult.pickup_lat = rides.pickup_lat;
                    rideresult.pickup_lng = rides.pickup_lng;
                    rideresult.drop_location = rides.drop_location;
                    rideresult.drop_lat = rides.drop_lat;
                    rideresult.drop_lng = rides.drop_lng;
                    rideresult.driver_name = rides.driver_id.full_name;
                    rideresult.driver_image = base_url + "/gallery/drivers/" + rides.driver_id.profile_image;
                    rideresult.ride_fare = rides.baseprice; /* quoted fare before tax */
                    rideresult.basefare = rides.total; /* original base fare */
                    rideresult.commissionamount = rides.commissionamount;
                    rideresult.ride_tax = rides.tax;
                    rideresult.ride_total = getRideFinalAmount(rides, roundCustomerPayableAmount);
                    rideresult.payment_type = rides.payment_type;
                    rideresult.payment_status = rides.payment_status || "unpaid";
                    rideresult.payment_direct_to_driver = String(rides.payment_direct_to_driver || 0);
                    rideresult.payment_recorded_at = rides.payment_recorded_at || "";
                    rideresult.legacy_commission_ride = isLegacyCommissionRide(rides) ? "true" : "false";
                    rideresult.pickup_time = parseInt(rides.ridestatusat);
                    rideresult.walletmoney = 0;
                    rideresult.vehicle_no = rides.vehicle_no;
                    rideresult.distance = rides.ridedistance;
                    rideresult.isreview = "false";
                    rideresult.ispayment = "false";
                    rideresult.drop_time = rides.ridestatusat;
                    rideresult.rideuserid = rides.user_id._id;
                    if (typeof rides.user_id.walletmoney != "undefined" && rides.user_id.walletmoney != null) {
                      rideresult.walletmoney = Math.round(rides.user_id.walletmoney * 100) / 100;
                    }
                    Reviews.findOne({
                      onride_id: req.body.onride_id
                    }).exec(function (err, reviews) {
                      if (!reviews) {
                        Payments.findOne({
                          onride_id: req.body.onride_id
                        }).exec(function (err, payments) {
                          if (!payments) {
                            res.json(rideresult);
                          } else {
                            rideresult.ispayment = "true";
                            rideresult.payment_type = payments.payment_type;
                            rideresult.payment_status = payments.payment_status || "paid";
                            rideresult.payment_direct_to_driver = String(payments.direct_to_driver || 0);
                            rideresult.payment_recorded_at = payments.paid_at || payments.drop_time || "";
                            res.json(rideresult);
                          }
                        });
                      } else {
                        rideresult.isreview = "true";
                        rideresult.review_message = reviews.review_message;
                        rideresult.rating = reviews.rating;
                        Payments.findOne({
                          onride_id: req.body.onride_id
                        }).exec(function (err, payments) {
                        if (!payments) {
                          res.json(rideresult);
                        } else {
                          rideresult.ispayment = "true";
                          rideresult.payment_type = payments.payment_type;
                          rideresult.payment_status = payments.payment_status || "paid";
                          rideresult.payment_direct_to_driver = String(payments.direct_to_driver || 0);
                          rideresult.payment_recorded_at = payments.paid_at || payments.drop_time || "";
                          res.json(rideresult);
                        }
                      });
                      }
                    });
                  } else {
                    senderr(res);
                  }
                });
            } else {
              senderr(res);
            }
          });
        }
      }
    })(req, res);
  }
);

/* get your client token  */
router.post(
  "/getclienttoken",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id) {
          senderr(res);
        } else {
          User.findOne(
            {
              _id: req.body.user_id
            },
            function (err, user) {
              if (typeof user.customer_id != "undefined" && user.customer_id != null) {
                let querystring = {
                  customerId: user.customer_id
                };
                Admin.findOne(function (err, admin) {
                  let gateway = braintree.connect({
                    environment:
                      admin.BraintreeStatus == "1" ? braintree.Environment.Production : braintree.Environment.Sandbox,
                    merchantId: admin.merchandId,
                    publicKey: admin.publicKey,
                    privateKey: admin.privateKey
                  });
                  gateway.clientToken.generate(querystring, function (err, response) {
                    if (response.success) {
                      res.json({
                        status: "true",
                        clientToken: response.clientToken
                      });
                    } else {
                      senderr(res);
                    }
                  });
                });
              } else {
                Admin.findOne(function (err, admin) {
                  let gateway = braintree.connect({
                    environment:
                      admin.BraintreeStatus == "1" ? braintree.Environment.Production : braintree.Environment.Sandbox,
                    merchantId: admin.merchandId,
                    publicKey: admin.publicKey,
                    privateKey: admin.privateKey
                  });
                  gateway.customer.create(
                    {
                      firstName: user.full_name,
                      email: user.email,
                      phone: user.phone_number
                    },
                    function (err, result) {
                      if (result.success) {
                        user.customer_id = result.customer.id;
                        user.save();
                        let querystring = {
                          customerId: result.customer.id
                        };
                        gateway.clientToken.generate(querystring, function (err, response) {
                          if (response.success) {
                            res.json({
                              status: "true",
                              clientToken: response.clientToken
                            });
                          } else {
                            senderr(res);
                          }
                        });
                      } else {
                        senderr(res);
                      }
                    }
                  );
                });
              }
            }
          );
        }
      }
    })(req, res);
  }
);

/* pay by card */
router.post(
  "/paybycard",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        let translatedstring = "";
        if (
          !req.body.user_id ||
          !req.body.amount ||
          !req.body.paynonce ||
          !req.body.onride_id ||
          !req.body.iswallet ||
          !req.body.driver_id
        ) {
          senderr(res);
        } else {
          Payments.count(
            {
              onride_id: req.body.onride_id
            },
            function (err, count) {
              if (count > 0) {
                res.json({
                  status: "true",
                  message: "Payment has been done successfully"
                });
              } else {
                let querystring = {
                  _id: req.body.user_id
                }; /* find user details by userid */
                Admin.findOne(function (err, admin) {
                  User.findOne(querystring)
                    .exec()
                    .then(function (err, user) {
                      let gateway = braintree.connect({
                        environment:
                          admin.BraintreeStatus == "1" ? braintree.Environment.Production : braintree.Environment.Sandbox,
                        merchantId: admin.merchandId,
                        publicKey: admin.publicKey,
                        privateKey: admin.privateKey
                      });
                      gateway.transaction.sale(
                        {
                          amount: req.body.amount,
                          paymentMethodNonce: req.body.paynonce,
                          options: {
                            submitForSettlement: true
                          }
                        },
                        function (err, result) {
                          if (!err) {
                            if (result.success) {
                              Rides.findOne({
                                _id: req.body.onride_id,
                                user_id: req.body.user_id
                              }).exec(function (rideErr, ride) {
                                if (rideErr || !ride) {
                                  return senderr(res);
                                }

                                let paidAt = new Date();
                                let payObject = buildPaymentDocument({
                                  ride: ride,
                                  userId: req.body.user_id,
                                  driverId: req.body.driver_id,
                                  paymentType: "card",
                                  transactionId: result.transaction.id,
                                  paidByWallet: req.body.iswallet == "1" ? req.body.walletamount : 0,
                                  paidAt: paidAt,
                                  roundCustomerPayableAmount: roundCustomerPayableAmount
                                });
                                let newPayment = new Payments(payObject);
                                newPayment.save(function (err) {
                                  if (!err) {
                                    markRidePaymentComplete(ride, "card", paidAt);
                                    ride.save(function (_rideSaveErr) {});
                                    if (req.body.iswallet == "1") {
                                    let paywalletObject = {
                                      user_id: req.body.user_id,
                                      onride_id: req.body.onride_id,
                                      amount: req.body.walletamount,
                                      type: "debit",
                                      transaction: "payride",
                                      updated_at: timeZone()
                                    };
                                    let newWallet = new Wallet(paywalletObject);
                                    newWallet.save(function (err) {
                                      if (!err) {
                                        User.update(
                                          {
                                            _id: req.body.user_id
                                          },
                                          {
                                            $inc: {
                                              walletmoney: -req.body.walletamount
                                            }
                                          },
                                          {
                                            new: true
                                          },
                                          function (err, doc) {
                                            if (!err) {
                                              let walletamount;
                                              if (typeof doc.walletmoney != "undefined") {
                                                walletamount = Math.round(doc.walletmoney * 100) / 100;
                                              } else {
                                                walletamount = 0;
                                              }
                                              let message = "Payment has been done successfully";
                                              let notifications = {
                                                user_id: "0",
                                                notify_to: req.body.user_id,
                                                title: "Payment Completed",
                                                message: message
                                              };
                                              notifyTo(notifications);
                                              Rides.findOne(
                                                {
                                                  _id: req.body.onride_id
                                                },
                                                function (err, rides) {
                                                  if (!rides) {
                                                    senderr(res);
                                                  } else {
                                                    let userids = [req.body.user_id];
                                                    let driverids = [rides.driver_id];

                                                    let drivernotifications = {
                                                      user_id: "0",
                                                      notify_to: rides.driver_id,
                                                      title: "Payment Completed",
                                                      message: message
                                                    };
                                                    notifyTo(drivernotifications);
                                                    UserDevices.findOne({
                                                      user_id: req.body.user_id
                                                    }, function (err, userdevices) {
                                                      if (userdevices) {
                                                        let lang = userdevices.lang_type;
                                                        console.log(lang);
                                                        let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                                                        let data = {
                                                          type: "payment",
                                                          message: message,
                                                          ride_id: rides._id
                                                        };
                                                        translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);


                                                        userNotify(userids, translatedstring, data);




                                                      }

                                                    });


                                                    DriverDevices.findOne({
                                                      user_id: rides.driver_id
                                                    }, function (err, driverdevices) {
                                                      if (driverdevices) {
                                                        let driverlang = driverdevices.lang_type;
                                                        console.log(driverlang);
                                                        let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);
                                                        let data = {
                                                          type: "payment",
                                                          message: message,
                                                          ride_id: rides._id
                                                        };
                                                        translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);


                                                        driverNotify(driverids, translatedstring, data);



                                                      }

                                                    });

                                                    res.json({
                                                      status: "true",
                                                      walletmoney: walletamount,
                                                      message: message
                                                    });
                                                  }
                                                }
                                              );
                                            } else {
                                              senderr(res);
                                            }
                                          }
                                        );
                                      } else {
                                        senderr(res);
                                      }
                                    });
                                  } else {
                                    let message = "Payment has been done successfully";
                                    let notifications = {
                                      user_id: "0",
                                      notify_to: req.body.user_id,
                                      title: "Payment Completed",
                                      message: message
                                    };
                                    notifyTo(notifications);
                                    Rides.findOne(
                                      {
                                        _id: req.body.onride_id
                                      },
                                      function (err, rides) {
                                        if (!rides) {
                                          senderr(res);
                                        } else {
                                          let userids = [req.body.user_id];
                                          let driverids = [rides.driver_id];

                                          let drivernotifications = {
                                            user_id: "0",
                                            notify_to: rides.driver_id,
                                            title: "Payment Completed",
                                            message: message
                                          };
                                          notifyTo(drivernotifications);
                                          UserDevices.findOne({
                                            user_id: req.body.user_id
                                          }, function (err, userdevices) {
                                            if (userdevices) {
                                              let lang = userdevices.lang_type;
                                              console.log(lang);
                                              let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                                              let data = {
                                                type: "payment",
                                                message: message,
                                                ride_id: rides._id
                                              };
                                              translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                                              userNotify(userids, translatedstring, data);
                                            }
                                          });

                                          DriverDevices.findOne({
                                            user_id: rides.driver_id
                                          }, function (err, driverdevices) {
                                            if (driverdevices) {
                                              let driverlang = driverdevices.lang_type;
                                              console.log(driverlang);
                                              let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);
                                              let data = {
                                                type: "payment",
                                                message: message,
                                                ride_id: rides._id
                                              };
                                              translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);
                                              driverNotify(driverids, translatedstring, data);
                                            }
                                          });

                                          res.json({
                                            status: "true",
                                            message: message
                                          });
                                        }
                                      }
                                    );
                                  }
                                } else {
                                  senderr(res);
                                }
                              });
                              });
                            } else {
                              senderr(res);
                            }
                          } else {
                            senderr(res);
                          }
                        }
                      );
                    });
                }).then(undefined, function (err) {
                  senderr(res);
                });
              }
            }
          );
        }
      }
    })(req, res);
  }
);

/* pay by cash or wallet */
router.post(
  "/paybycash",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        let translatedstring = "";
        if (
          !req.body.user_id ||
          !req.body.amount ||
          !req.body.onride_id ||
          !req.body.iswallet ||
          !req.body.driver_id
        ) {
          senderr(res);
        } else {
          let paidby = "cash";
          if (req.body.amount == 0) {
            paidby = "wallet";
          }
          Payments.count(
            {
              onride_id: req.body.onride_id
            },
            function (err, count) {
              if (count > 0) {
                res.json({
                  status: "true",
                  message: "Payment has been done successfully"
                });
              } else {
                Rides.findOne({
                  _id: req.body.onride_id,
                  user_id: req.body.user_id
                }).exec(function (rideErr, ride) {
                  if (rideErr || !ride) {
                    return senderr(res);
                  }

                  let paidAt = new Date();
                  let payObject = buildPaymentDocument({
                    ride: ride,
                    userId: req.body.user_id,
                    driverId: req.body.driver_id,
                    paymentType: paidby,
                    paidByWallet: req.body.iswallet == "1" ? req.body.walletamount : 0,
                    paidAt: paidAt,
                    roundCustomerPayableAmount: roundCustomerPayableAmount
                  });
                  let newPayment = new Payments(payObject);
                  newPayment.save(function (err) {
                    if (!err) {
                      markRidePaymentComplete(ride, paidby, paidAt);
                      ride.save(function (_rideSaveErr) {});
                      if (req.body.iswallet == "1") {
                      let paywalletObject = {
                        user_id: req.body.user_id,
                        onride_id: req.body.onride_id,
                        amount: req.body.walletamount,
                        type: "debit",
                        transaction: "payride",
                        updated_at: timeZone()
                      };
                      let newWallet = new Wallet(paywalletObject);
                      newWallet.save(function (err) {
                        if (!err) {
                          User.findOneAndUpdate(
                            {
                              _id: req.body.user_id
                            },
                            {
                              $inc: {
                                walletmoney: -req.body.walletamount
                              }
                            },
                            {
                              new: true
                            },
                            function (err, doc) {
                              if (!err) {
                                let walletamount;
                                if (typeof doc.walletmoney != "undefined") {
                                  walletamount = Math.round(doc.walletmoney * 100) / 100;
                                } else {
                                  walletamount = 0;
                                }
                                let message = "Payment has been done successfully";
                                let notifications = {
                                  user_id: "0",
                                  notify_to: req.body.user_id,
                                  title: "Payment Completed",
                                  message: message
                                };
                                notifyTo(notifications);
                                Rides.findOne(
                                  {
                                    _id: req.body.onride_id
                                  },
                                  function (err, rides) {
                                    if (!rides) {
                                      senderr(res);
                                    } else {
                                      let userids = [req.body.user_id];
                                      let driverids = [rides.driver_id];
                                      let drivernotifications = {
                                        user_id: "0",
                                        notify_to: rides.driver_id,
                                        title: "Payment Completed",
                                        message: message
                                      };
                                      notifyTo(drivernotifications);
                                      UserDevices.findOne({
                                        user_id: req.body.user_id
                                      }, function (err, userdevices) {
                                        if (userdevices) {
                                          let lang = userdevices.lang_type;
                                          console.log(lang);
                                          let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                                          let data = {
                                            type: "payment",
                                            message: message,
                                            ride_id: rides._id
                                          };
                                          translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                                          userNotify(userids, translatedstring, data);
                                        }
                                      });
                                      DriverDevices.findOne({
                                        user_id: rides.driver_id
                                      }, function (err, driverdevices) {
                                        if (driverdevices) {
                                          let driverlang = driverdevices.lang_type;
                                          console.log(driverlang);
                                          let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);
                                          let data = {
                                            type: "payment",
                                            message: message,
                                            ride_id: rides._id
                                          };
                                          translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);
                                          driverNotify(driverids, translatedstring, data);
                                        }
                                      });
                                      res.json({
                                        status: "true",
                                        walletmoney: walletamount,
                                        message: message
                                      });
                                    }
                                  }
                                );
                              } else {
                                senderr(res);
                              }
                            }
                          );
                        } else {
                          senderr(res);
                        }
                      });
                    } else {
                      let message = "Payment has been done successfully";
                      let notifications = {
                        user_id: "0",
                        notify_to: req.body.user_id,
                        title: "Payment Completed",
                        message: message
                      };
                      notifyTo(notifications);
                      Rides.findOne(
                        {
                          _id: req.body.onride_id
                        },
                        function (err, rides) {
                          if (!rides) {
                            senderr(res);
                          } else {
                            let userids = [req.body.user_id];
                            let driverids = [rides.driver_id];
                            let drivernotifications = {
                              user_id: "0",
                              notify_to: rides.driver_id,
                              title: "Payment Completed",
                              message: message
                            };
                            notifyTo(drivernotifications);
                            UserDevices.findOne({
                              user_id: req.body.user_id
                            }, function (err, userdevices) {
                              if (userdevices) {
                                let lang = userdevices.lang_type;
                                console.log(lang);
                                let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                                let data = {
                                  type: "payment",
                                  message: message,
                                  ride_id: rides._id
                                };
                                translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                                userNotify(userids, translatedstring, data);
                              }
                            });
                            DriverDevices.findOne({
                              user_id: rides.driver_id
                            }, function (err, driverdevices) {
                              if (driverdevices) {
                                let driverlang = driverdevices.lang_type;
                                console.log(driverlang);
                                let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);
                                let data = {
                                  type: "payment",
                                  message: message,
                                  ride_id: rides._id
                                };
                                translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);
                                driverNotify(driverids, translatedstring, data);
                              }
                            });
                            res.json({
                              status: "true",
                              message: message
                            });
                          }
                        }
                      );
                    }
                    } else {
                      senderr(res);
                    }
                  });
                });
              }
            }
          );
        }
      }
    })(req, res);
  }
);

/* add money to wallet */
router.post(
  "/addmoney",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        let translatedstring = "";
        if (!req.body.user_id || !req.body.amount || !req.body.paynonce) {
          senderr(res);
        } else {
          let querystring = {
            _id: req.body.user_id
          }; /* find user details by userid */
          Admin.findOne(function (err, admin) {
            let gateway = braintree.connect({
              environment: admin.BraintreeStatus == "1" ? braintree.Environment.Production : braintree.Environment.Sandbox,
              merchantId: admin.merchandId,
              publicKey: admin.publicKey,
              privateKey: admin.privateKey
            });
            User.findOne(querystring)
              .exec()
              .then(function (err, user) {
                gateway.transaction.sale(
                  {
                    amount: req.body.amount,
                    paymentMethodNonce: req.body.paynonce,
                    options: {
                      submitForSettlement: true
                    }
                  },
                  function (err, result) {
                    if (!err) {
                      if (result.success) {
                        let payObject = {
                          user_id: req.body.user_id,
                          amount: result.transaction.amount,
                          transaction_id: result.transaction.id,
                          type: "credit",
                          transaction: "addmoney",
                          updated_at: timeZone()
                        };
                        let newWallet = new Wallet(payObject);
                        newWallet.save(function (err) {
                          if (!err) {
                            User.findOneAndUpdate(
                              {
                                _id: req.body.user_id
                              },
                              {
                                $inc: {
                                  walletmoney: result.transaction.amount
                                }
                              },
                              {
                                new: true
                              },
                              function (err, doc) {
                                if (!err) {
                                  let message = "Amount credited to your wallet successfully";
                                  let walletamount = Math.round(doc.walletmoney * 100) / 100;
                                  let notifications = {
                                    user_id: "0",
                                    notify_to: req.body.user_id,
                                    title: "Wallet Credited",
                                    message: "Your wallet has been credited & wallet balance is " + walletamount
                                  };
                                  notifyTo(notifications);
                                  let userids = [req.body.user_id];
                                  UserDevices.findOne({
                                    user_id: req.body.user_id
                                  }, function (err, userdevices) {
                                    if (userdevices) {

                                      let lang = userdevices.lang_type;
                                      translatedstring = translationServer.langTranslate("Amountcreditedtoyourwalletsuccessfully", lang);
                                      let data = {
                                        type: "payment",
                                        message: translatedstring
                                      };
                                      userNotify(userids, translatedstring, data);
                                    }

                                  });

                                  res.json({
                                    status: "true",
                                    walletmoney: walletamount,
                                    message: message
                                  });
                                } else {
                                  senderr(res);
                                }
                              }
                            );
                          } else {
                            senderr(res);
                          }
                        });
                      } else {
                        senderr(res);
                      }
                    } else {
                      senderr(res);
                    }
                  }
                );
              });
          }).then(undefined, function (err) {
            senderr(res);
          });
        }
      }
    })(req, res);
  }
);

/* create selcom hosted checkout */
router.post(
  "/getselcomurl",
  function (req, res) {
    passport.authenticate("jwt", { session: false }, async function (err, user) {
      if (err === "AccountDeleted") {
        return res.json({
          status: "error",
          message: "Account has been deleted successfully"
        });
      } else if (!user) {
        return res.json({
          status: "error",
          message: "Unauthorized access"
        });
      } else if (!req.body.user_id || !req.body.amount) {
        return senderr(res);
      } else if (String(user._id) !== String(req.body.user_id)) {
        return res.json({
          status: "false",
          message: "Unauthorized access"
        });
      } else if (!selcomService.isConfigured()) {
        return res.json({
          status: "false",
          message: "Selcom payment is not configured"
        });
      }

      try {
        const amount = selcomService.normalizeAmount(req.body.amount);
        if (!amount) {
          return res.json({
            status: "false",
            message: "Invalid payment amount"
          });
        }

        const transid = selcomService.generateTransId();
        const returnUrl = selcomService.buildReturnUrl(transid);
        const checkout = await selcomService.createOrder({
          transid: transid,
          amount: amount,
          user: user,
          userId: req.body.user_id,
          returnUrl: returnUrl,
          remarks: "Shilota payment"
        });

        await SelcomPaymentSession.findOneAndUpdate(
          { transid: transid },
          {
            transid: transid,
            order_id: checkout.orderId,
            user_id: String(req.body.user_id),
            actor_type: "user",
            amount: amount,
            status: "pending",
            verified_at: null,
            consumed_at: null,
            expires_at: new Date(Date.now() + 30 * 60 * 1000)
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
          }
        ).exec();

        return res.json({
          status: "true",
          message: "Payment URL generated successfully",
          payment_url: checkout.paymentUrl,
          return_url: returnUrl,
          transid: transid
        });
      } catch (error) {
        return res.json({
          status: "false",
          message: error && error.message ? error.message : "Unable to create Selcom payment"
        });
      }
    })(req, res);
  }
);

/* verify selcom transaction from redirect url */
router.post("/selcom/callback", async function (req, res) {
  console.log("Selcom callback received:", JSON.stringify({
    headers: req.headers || {},
    body: req.body || {}
  }));

  const orderId = String(req.body && req.body.order_id || "").trim();
  const providerTransId = String(req.body && req.body.transid || "").trim();
  if (!orderId && !providerTransId) {
    return res.status(400).json({
      status: "false",
      message: "Missing Selcom transaction identifiers"
    });
  }

  try {
    const session = await findSelcomSessionFromPayload(req.body || {});
    if (!session) {
      return res.status(404).json({
        status: "false",
        message: "Payment session not found"
      });
    }

    const callbackHasSignature = hasSelcomSignatureHeaders(req.headers || {});
    if (callbackHasSignature) {
      if (!selcomService.verifyWebhookRequest(req.headers, req.body || {})) {
        return res.status(401).json({
          status: "false",
          message: "Invalid Selcom callback signature"
        });
      }

      await applySelcomProviderUpdate(session, req.body || {});
    } else {
      if (!doesCallbackAmountMatchSession(session, req.body || {})) {
        return res.status(409).json({
          status: "false",
          message: "Selcom callback amount does not match the payment session"
        });
      }

      await applySelcomProviderUpdate(session, Object.assign({}, req.body || {}, {
        order_id: orderId || session.order_id || session.transid,
        transid: providerTransId || session.reference || session.transid,
        amount: req.body && req.body.amount ? req.body.amount : session.amount
      }));
    }

    if (String(session.actor_type || "") === DRIVER_SUBSCRIPTION_ACTOR_TYPE) {
      const finalizeResult = await finalizeSubscriptionSession(session, new Date());
      if (finalizeResult && (finalizeResult.activated || finalizeResult.updated) && !session.consumed_at) {
        session.status = "completed";
        session.consumed_at = new Date();
        await session.save();
      }
    } else if (String(session.actor_type || "") === DRIVER_DESTINATION_BROADCAST_ACTOR_TYPE) {
      const finalizeResult = await finalizeDestinationBroadcastSession(session, new Date());
      if (finalizeResult && (finalizeResult.activated || finalizeResult.updated) && !session.consumed_at) {
        session.status = "completed";
        session.consumed_at = new Date();
        await session.save();
      }
    } else if (String(session.actor_type || "") === PASSENGER_SUBSCRIPTION_ACTOR_TYPE) {
      const finalizeResult = await finalizePassengerSubscriptionSession(session, new Date());
      if (finalizeResult && (finalizeResult.activated || finalizeResult.updated) && !session.consumed_at) {
        session.status = "completed";
        session.consumed_at = new Date();
        await session.save();
      }
    }

    return res.json({
      status: "true",
      message: "Selcom callback processed successfully",
      transid: session.transid,
      order_id: session.order_id,
      provider_transid: providerTransId || null,
      payment_status: session.payment_status,
      session_status: session.status
    });
  } catch (error) {
    return res.status(500).json({
      status: "false",
      message: error && error.message ? error.message : "Unable to process Selcom callback"
    });
  }
});

router.get("/verifyselcom/:transid", async function (req, res) {
  const transid = String(req.params.transid || "").trim();
  if (!transid) {
    return senderr(res);
  }

  try {
    const session = await SelcomPaymentSession.findOne({
      transid: transid,
      actor_type: "user"
    }).exec();

    if (!session) {
      return res.json({
        status: "false",
        message: "Payment session not found"
      });
    }

    if (session.status === "verified" || session.status === "completed") {
      return res.json({
        status: "true",
        message: "Payment verified successfully",
        transid: transid,
        paidamount: String(session.paid_amount || session.amount)
      });
    }

    if (session.expires_at && session.expires_at.getTime() < Date.now()) {
      return res.json({
        status: "false",
        message: "Payment session has expired"
      });
    }

    const result = await selcomService.queryTransaction(transid);
    if (String(result.resultcode) === "000") {
      await applySelcomProviderUpdate(session, {
        transid: transid,
        result: result.result,
        resultcode: result.resultcode,
        message: result.message,
        reference: result.reference,
        payment_status: "COMPLETED",
        amount: session.amount
      });

      return res.json({
        status: "true",
        message: result.message || "Payment verified successfully",
        transid: transid,
        paidamount: String(session.paid_amount || session.amount)
      });
    }

    if (String(result.resultcode) !== "111") {
      await applySelcomProviderUpdate(session, {
        transid: transid,
        result: result.result,
        resultcode: result.resultcode,
        message: result.message,
        reference: result.reference,
        payment_status: result.result || "FAILED",
        amount: session.amount
      });
    }

    return res.json({
      status: "false",
      message: result.message || "Payment is still pending"
    });
  } catch (error) {
    return res.json({
      status: "false",
      message: error && error.message ? error.message : "Unable to verify Selcom payment"
    });
  }
});

/* finalize verified selcom payment */
router.post(
  "/paybyselcom",
  function (req, res) {
    passport.authenticate("jwt", { session: false }, async function (err, user) {
      if (err === "AccountDeleted") {
        return res.json({
          status: "error",
          message: "Account has been deleted successfully"
        });
      } else if (!user) {
        return res.json({
          status: "error",
          message: "Unauthorized access"
        });
      } else if (!req.body.user_id || !req.body.amount || !req.body.paynonce || !req.body.type) {
        return senderr(res);
      } else if (String(user._id) !== String(req.body.user_id)) {
        return res.json({
          status: "false",
          message: "Unauthorized access"
        });
      }

      try {
        const transid = String(req.body.paynonce).trim();
        const amount = selcomService.normalizeAmount(req.body.amount);
        const session = await SelcomPaymentSession.findOne({
          transid: transid,
          user_id: String(req.body.user_id),
          actor_type: "user"
        }).exec();

        if (!session) {
          return res.json({
            status: "false",
            message: "Payment session not found"
          });
        }

        if (session.consumed_at) {
          const currentUser = await User.findById(req.body.user_id).exec();
          const walletamount =
            currentUser && typeof currentUser.walletmoney !== "undefined"
              ? Math.round(Number(currentUser.walletmoney || 0) * 100) / 100
              : 0;

          return res.json({
            status: "true",
            walletmoney: walletamount,
            message: "Payment has been done successfully"
          });
        }

        if (session.status !== "verified" && !session.verified_at) {
          try {
            await ensureSelcomPaymentVerified(session, transid);
          } catch (verifyError) {
            return res.json({
              status: "false",
              message: verifyError && verifyError.message ? verifyError.message : "Payment has not been verified yet"
            });
          }
        }

        if (!amount || Math.abs(Number(session.amount) - Number(amount)) > 0.01) {
          return res.json({
            status: "false",
            message: "Payment amount mismatch"
          });
        }

        if (req.body.type === "wallet") {
          let walletCredit = new Wallet({
            user_id: req.body.user_id,
            amount: amount,
            transaction_id: transid,
            type: "credit",
            transaction: "addmoney",
            updated_at: timeZone()
          });
          await walletCredit.save();

          const updatedUser = await User.findOneAndUpdate(
            { _id: req.body.user_id },
            {
              $inc: {
                walletmoney: amount
              }
            },
            {
              new: true
            }
          ).exec();

          session.status = "completed";
          session.consumed_at = new Date();
          await session.save();

          return res.json({
            status: "true",
            walletmoney: Math.round(Number((updatedUser && updatedUser.walletmoney) || 0) * 100) / 100,
            message: "Amount credited to your wallet successfully"
          });
        }

        if (
          req.body.type !== "ride" ||
          !req.body.onride_id ||
          !req.body.driver_id ||
          typeof req.body.iswallet === "undefined"
        ) {
          return senderr(res);
        }

        const existingPayment = await Payments.countDocuments({
          onride_id: req.body.onride_id
        }).exec();

        if (existingPayment > 0) {
          session.status = "completed";
          session.consumed_at = session.consumed_at || new Date();
          await session.save();

          return res.json({
            status: "true",
            message: "Payment has been done successfully"
          });
        }

        const ride = await Rides.findOne({
          _id: req.body.onride_id,
          user_id: req.body.user_id
        }).exec();
        if (!ride) {
          return senderr(res);
        }

        const paidAt = new Date();
        let payObject = buildPaymentDocument({
          ride: ride,
          userId: req.body.user_id,
          driverId: req.body.driver_id,
          paymentType: "selcom",
          transactionId: transid,
          paidByWallet: req.body.iswallet == "1" ? Number(req.body.walletamount || 0) : 0,
          paidAt: paidAt,
          roundCustomerPayableAmount: roundCustomerPayableAmount
        });
        await new Payments(payObject).save();

        let walletamount;
        if (req.body.iswallet == "1") {
          let walletDebit = new Wallet({
            user_id: req.body.user_id,
            onride_id: req.body.onride_id,
            amount: req.body.walletamount,
            type: "debit",
            transaction: "payride",
            updated_at: timeZone()
          });
          await walletDebit.save();

          const updatedUser = await User.findOneAndUpdate(
            { _id: req.body.user_id },
            {
              $inc: {
                walletmoney: -Number(req.body.walletamount || 0)
              }
            },
            {
              new: true
            }
          ).exec();
          walletamount = Math.round(Number((updatedUser && updatedUser.walletmoney) || 0) * 100) / 100;
        }

        session.status = "completed";
        session.consumed_at = new Date();
        await session.save();
        markRidePaymentComplete(ride, "selcom", paidAt);
        await ride.save();

        let result = {
          status: "true",
          message: "Payment has been done successfully"
        };
        if (typeof walletamount !== "undefined") {
          result.walletmoney = walletamount;
        }

        return res.json(result);
      } catch (error) {
        return res.json({
          status: "false",
          message: error && error.message ? error.message : "Unable to complete Selcom payment"
        });
      }
    })(req, res);
  }
);

/* wallet history */
router.get(
  "/wallethistory/:userid",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else if (String(user._id) !== String(req.params.userid)) {
        res.json({
          status: "false",
          message: 'Unauthorized access'
        });
      } else {
        Wallet.count(
          {
            user_id: req.params.userid,
            wallet_for: "user"
          },
          function (err, count) {
            if (err) senderr(res);
            else {
              if (count > 0) {
                Wallet.find({
                  user_id: req.params.userid,
                  wallet_for: "user"
                })
                  .sort([["_id", -1]])
                  .exec(function (err, wallets) {
                    if (!err) {
                      res.json({
                        status: "true",
                        payment_list: wallets
                      });
                    } else {
                      res.json({
                        status: "false",
                        message: "No Wallet used"
                      });
                    }
                  });
              } else {
                res.json({
                  status: "false",
                  message: "No Wallet used"
                });
              }
            }
          }
        );
      }
    })(req, res);
  }
);

/* user review a ride */
router.post(
  "/review",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.onride_id) {
          senderr(res);
        } else {
          let querystring = {
            _id: req.body.onride_id,
            user_id: req.body.user_id
          };
          Reviews.count(
            {
              onride_id: req.body.onride_id
            },
            function (err, count) {
              if (count > 0) {
                Reviews.findOneAndUpdate(
                  {
                    onride_id: req.body.onride_id
                  },
                  {
                    $set: {
                      review_message: req.body.review_message,
                      rating: req.body.rating
                    }
                  }
                ).exec(function (err, reviews) {
                  if (err) {
                    senderr(res);
                  } else {
                    let query = Reviews.aggregate([
                      {
                        $match: {
                          driver_id: reviews.driver_id
                        }
                      },
                      {
                        $group: {
                          _id: "null",
                          ratings: {
                            $sum: "$rating"
                          }
                        }
                      }
                    ]);
                    query.exec(function (err, driver) {
                      if (err) {
                        senderr(res);
                      } else {
                        let rating = parseInt(driver[0].ratings);
                        let updateresult = {
                          rating: rating
                        };
                        Driver.findOneAndUpdate(
                          {
                            _id: reviews.driver_id
                          },
                          {
                            $set: updateresult
                          }
                        ).exec(function (err, drivers) {
                          if (err) {
                            senderr(res);
                          } else {
                            cetsSyncService.enqueueTripSync(req.body.onride_id, "trip_review_update").catch(function (syncError) {
                              console.error("CeTS trip review-update enqueue failed:", syncError);
                            });
                            res.json({
                              status: "true",
                              message: "Review Updated Successfully"
                            });
                          }
                        });
                      }
                    });
                  }
                });
              } else {
                Rides.findOne(querystring).exec(function (err, rides) {
                  if (!err) {
                    let reviewObject = {
                      user_id: req.body.user_id,
                      onride_id: req.body.onride_id,
                      review_message: req.body.review_message,
                      rating: req.body.rating,
                      driver_id: rides.driver_id
                    };
                    let newReview = new Reviews(reviewObject);
                    newReview.save(function (err, reviews) {
                      if (!err) {
                        if (req.body.rating == null) {
                          req.body.rating = 0;
                        }
                        Driver.update(
                          {
                            _id: rides.driver_id
                          },
                          {
                            $inc: {
                              rating: req.body.rating
                            }
                          },
                          {
                            new: true
                          },
                          function (err, doc) {
                            if (!err) {
                              cetsSyncService.enqueueTripSync(req.body.onride_id, "trip_review_create").catch(function (syncError) {
                                console.error("CeTS trip review-create enqueue failed:", syncError);
                              });
                              res.json({
                                status: "true",
                                message: "Review Updated Successfully"
                              });
                            } else {
                              senderr(res);
                            }
                          }
                        );
                      } else {
                        senderr(res);
                      }
                    });
                  } else {
                    senderr(res);
                  }
                });
              }
            }
          );
        }
      }
    })(req, res);
  }
);

/** message & contact admin */
router.post(
  "/contactus",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.name || !req.body.email || !req.body.subject || !req.body.message) {
          senderr(res);
        } else {
          Admin.findOne(function (err, admin) {
            let message = "Mail From: " + req.body.email;
            let mailOptions = {
              to: admin.email,
              subject: req.body.subject,
              html:
                "<i>Mail From " +
                req.body.name +
                "</i>" +
                "<br />" +
                req.body.message +
                "<br /><br />" +
                "you can contact him at this mail id " +
                req.body.email
            };
            let transporter = nodemailer.createTransport({
              host: admin.smptHost,
              port: admin.smtpPort,
              secure: false,
              auth: {
                user: admin.smtpUsername,
                pass: admin.smtpPassword
              }
            });
            // send mail with defined transport object
            transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                senderr(res);
              } else {
                res.json({
                  status: "true",
                  message: "Got your query. We will get back to you soon"
                });
              }
            });
          });
        }
      }
    })(req, res);
  }
);

/* edit name & edit country_code  & emergency contact*/
router.post(
  "/updateprofile",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id) {
          senderr(res);
        } else {
          let profileUpdates = {};
          ["full_name", "country_code", "phone_number"].forEach(function (field) {
            if (typeof req.body[field] !== "undefined") {
              profileUpdates[field] = req.body[field];
            }
          });
          if (typeof req.body.emergency_contact != "undefined") {
            profileUpdates.emergency_contact = JSON.parse(req.body.emergency_contact);
          }
          User.findOneAndUpdate(
            {
              _id: user._id
            },
            {
              $set: profileUpdates
            }
          ).exec(function (err, users) {
            if (err) {
              senderr(res);
            } else {
              res.json({
                status: "true",
                message: "User updated successfully"
              });
            }
          });
        }
      }
    })(req, res);
  }
);

/* edit name & edit country_code  & emergency contact*/
router.post("/updatephonenumber", function (req, res) {
  if (!req.body.user_id) {
    senderr(res);
  } else {
    let phoneUtil = require("google-libphonenumber").PhoneNumberUtil.getInstance();
    let number = phoneUtil.parseAndKeepRawInput(req.body.phoneNumber);
    let verified_phoneno = number.getNationalNumber();
    let verified_code = number.getCountryCode();
    User.findOneAndUpdate(
      {
        _id: req.body.user_id
      },
      {
        phone_number: verified_phoneno,
        country_code: verified_code
      }
    ).exec(function (err, userinfo) {
      if (err) {
        res.json({
          status: "false",
          message: "Something went to be wrong"
        });
      } else {
        res.json({
          status: "true",
          message: "Phone Number changed successfully"
        });
      }
    });
  }
});

/* app config */
router.get("/admindatas", function (req, res, next) {
  Admin.findOne(function (err, admin) {
    res.json({
      status: "true",
      currencycode: admin.currencyCode,
      currencysymbol: admin.currencySymbol,
      emergencycontact: admin.emergencyContact,
      androidstore: admin.androidUser,
      admin_enable_ads: admin.admin_enable_ads,
      ad_unit_id: admin.ad_unit_id
    });
  });
});

/* on ride not accepted */
router.post(
  "/nooneaccept",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.onride_id) {
          senderr(res);
        } else {
          let querystring = {
            _id: req.body.onride_id
          };
          Rides.findOne(querystring)
            .populate("user_id")
            .exec(function (err, rides) {
              if (!rides) {
                senderr(res);
              } else {
                rides.ridestatus = "ridenotaccepted";
                rides.ridestatusat = timeZone();
                rides.save();
                res.json({
                  status: "true",
                  message: "Status changed successfully"
                });
              }
            });
        }
      }
    })(req, res);
  }
);

/* To save place */
router.post(
  "/saveplace",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (req.body.type && req.body.type == "add") {
          if (
            !req.body.place_name ||
            !req.body.place_full_address ||
            !req.body.place_latitude ||
            !req.body.place_longitude ||
            !req.body.place_type ||
            !req.body.user_id ||
            !req.body.google_place_id
          ) {
            res.json({
              status: "false",
              message: "Please check the details"
            });
          } else {
            let newplace = {
              user_id: req.body.user_id,
              place_name: req.body.place_name,
              place_full_address: req.body.place_full_address,
              place_latitude: req.body.place_latitude,
              place_longitude: req.body.place_longitude,
              place_type: normalizeSavedPlaceType(req.body.place_type),
              google_place_id: req.body.google_place_id
            };

            const normalizedPlaceType = normalizeSavedPlaceType(req.body.place_type);
            const shortcutTypes = savedPlaceTypeQuery(normalizedPlaceType);
            const saveQuery = shortcutTypes.length === 1 && shortcutTypes[0] === normalizedPlaceType && !["Home", "Office"].includes(normalizedPlaceType)
              ? {
                user_id: req.body.user_id,
                google_place_id: req.body.google_place_id
              }
              : {
                user_id: req.body.user_id,
                place_type: {
                  $in: shortcutTypes
                }
              };

            Places.findOne(
              saveQuery,
              function (err, place) {
                if (err) {
                  return senderr(res);
                }
                if (place == null) {
                  let newuserplace = new Places(newplace);
                  newuserplace.save(function (err) {
                    if (err) {
                      senderr(res);
                    } else {
                      res.json({
                        status: "true",
                        place_id: newuserplace._id,
                        message: "Saved successfully"
                      });
                    }
                  });
                } else if (["Home", "Office"].includes(normalizedPlaceType)) {
                  Places.findByIdAndUpdate(
                    place._id,
                    {
                      $set: newplace
                    },
                    {
                      new: true
                    },
                    function (err, updatedPlace) {
                      if (err || !updatedPlace) {
                        return senderr(res);
                      }
                      res.json({
                        status: "true",
                        place_id: updatedPlace._id,
                        message: "Saved successfully"
                      });
                    }
                  );
                } else {
                  res.json({
                    status: "false",
                    message: "Place already saved"
                  });
                }
              },
            );
          }
        } else if (req.body.type && req.body.type == "remove") {
          if (req.body.user_id && req.body.google_place_id) {
            Places.findOneAndRemove(
              {
                user_id: req.body.user_id,
                google_place_id: req.body.google_place_id
              },
              function (err, count) {
                if (err) {
                  senderr(res);
                } else {
                  res.json({
                    status: "true",
                    message: "Removed successfully"
                  });
                }
              }
            );
          } else {
            res.json({
              status: "false",
              message: "Please check the detail"
            });
          }
        } else {
          res.json({
            status: "false",
            message: "Please select add/remove"
          });
        }
      }
    })(req, res);
  }
);

/* user's savedplaces */
router.post(
  "/savedplaces",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id) {
          senderr(res);
        } else {
          let allplace = [];
          Places.find({
            user_id: req.body.user_id
          })
            .exec(function (err, place) {
              if (err) {
                return res.json({
                  status: "false",
                  message: "Something went to be wrong"
                });
              }
              place.sort(function (a, b) {
                const weightDiff = savedPlaceSortWeight(a.place_type) - savedPlaceSortWeight(b.place_type);
                if (weightDiff !== 0) {
                  return weightDiff;
                }
                return String(a.place_type || "").localeCompare(String(b.place_type || ""));
              });
              place.forEach(function (h) {
                allplace.push({
                  place_id: h._id,
                  place_name: h.place_name,
                  place_full_address: h.place_full_address,
                  place_latitude: h.place_latitude,
                  place_longitude: h.place_longitude,
                  place_type: h.place_type,
                  google_place_id: h.google_place_id
                });
              });
              if (!err) {
                res.json({
                  status: "true",
                  saved_places: allplace
                });
              } else {
                res.json({
                  status: "false",
                  message: "Something went to be wrong"
                });
              }
            });
        }
      }
    })(req, res);
  }
);

/* account exists */
router.post("/checkaccountexists", function (req, res) {
  if (!req.body.email) {
    senderr(res);
  } else {
    User.count(
      {
        email: req.body.email
      },
      function (err, count) {
        if (count > 0) {
          res.json({
            status: "false",
            message: "Email already exists"
          });
        } else {
          res.json({
            status: "true",
            message: "New Account"
          });
        }
      }
    );
  }
});

/* all categories */
router.get("/allcategories", function (req, res) {
  Categories.find()
    .sort({
      _id: 1
    })
    .exec(function (err, categories) {
      if (categories && !err) {
        let availcategories = [];
        categories.forEach(function (c) {
          let categoryimage = base_url + "/imagegallery/" + c.image;
          availcategories.push({
            _id: c._id,
            category_name: c.category_name,
            image: categoryimage,
            baseprice: c.baseprice,
            reach_pickup: "2 mins",
            available: "0"
          });
        });
        res.json({
          status: "true",
          count: categories.length,
          categories: availcategories
        });
      } else {
        res.json({
          status: "false",
          message: "No categories found"
        });
      }
    });
});

/* all categories */
router.get("/allcategories", function (req, res) {
  Categories.find()
    .sort({
      _id: 1
    })
    .exec(function (err, categories) {
      if (categories && !err) {
        let availcategories = [];
        categories.forEach(function (c) {
          let categoryimage = base_url + "/imagegallery/" + c.image;
          availcategories.push({
            _id: c._id,
            category_name: c.category_name,
            image: categoryimage,
            baseprice: c.baseprice,
            reach_pickup: "2 mins",
            available: "0"
          });
        });
        res.json({
          status: "true",
          count: categories.length,
          categories: availcategories
        });
      } else {
        res.json({
          status: "false",
          message: "No categories found"
        });
      }
    });
});

/* all categories */
router.get("/lastridedetails/:user_id", function (req, res) {
  if (!req.params.user_id) {
    senderr(res);
  } else {
    let querystring = {
      user_id: req.params.user_id,
      ridestatus: "requested"
    };
    let rideresult = {};
    let allrides = [];
    Rides.count(querystring, function (err, count) {
      if (count > 0) {
        Rides.findOne(querystring)
          .populate("category_id")
          .sort({
            _id: -1
          })
          .limit(1)
          .exec(function (err, rides) {
            if (!err) {
              rideresult.ride_id = rides._id;
              rideresult.category_name = rides.category_id.category_name;
              let profile_image = rides.category_id.image;
              if (typeof profile_image == "undefined") {
                let profile_image = "category.png";
              }
              rideresult.category_image = base_url + "/imagegallery/" + profile_image;
              rideresult.pickup_location = rides.pickup_location;
              rideresult.pickup_lat = rides.pickup_lat;
              rideresult.pickup_lng = rides.pickup_lng;
              rideresult.drop_location = rides.drop_location;
              rideresult.drop_lat = rides.drop_lat;
              rideresult.drop_lng = rides.drop_lng;
              rideresult.ride_stops = rides.ride_stops || [];
              rideresult.pooling_opt_in = rides.pooling_opt_in;
              rideresult.seats_requested = rides.seats_requested;
              rideresult.pool_status = rides.pool_status;
              rideresult.pool_group_size = rides.pool_group_size || 1;
              rideresult.pool_discount_percent = rides.pool_discount_percent || 0;
              rideresult.approx_price = rides.category_id.baseprice;
              rideresult.notified = rides.notify;
              allrides.push(rideresult);
              res.json({ status: true, result: allrides });
            } else {
              senderr(res);
            }
          });
      } else {
        senderr(res);
      }
    });
  }
});

/* Audio Call Addon */
router.post("/makecall", function (req, res) {
  if (!req.body.sender_id || !req.body.receiver_id || !req.body.type || !req.body.user_type || !req.body.room_id || !req.body.platform || !req.body.timestamp) {
   
    senderr(res);
  } else {

    User.findOne({ _id: req.body.sender_id },
      function (err, user) {
       
        if (user && !err) {
          let profile_image = "user.png";
          if (typeof user.profile_image != "undefined") {
            profile_image = user.profile_image;
          }
          let data = {
            sender_id: req.body.sender_id,
            receiver_id: req.body.receiver_id,
            user_type: req.body.user_type,
            room_id: req.body.room_id,
            platform: req.body.platform,
            timestamp: req.body.timestamp,
            type: req.body.type,
            user_name: user.full_name,
            user_image: base_url + "/gallery/users/" + profile_image,
            message: "make_audio_call"
          };

          let userids = [req.body.receiver_id];

          if (req.body.user_type === "user") {
            driverNotify(userids, "", data);
            socketRegistry.emitToUser(req.body.receiver_id, "incoming-call", data);
          }

          if (req.body.user_type === "driver") {
            userNotify(userids, "", data);
            socketRegistry.emitToUser(req.body.receiver_id, "incoming-call", data);
          }

          console.log(JSON.stringify(data));

          saveOrUpdateCallLog({
            sender_id: req.body.sender_id,
            receiver_id: req.body.receiver_id,
            user_type: req.body.user_type,
            room_id: req.body.room_id,
            platform: req.body.platform,
            type: req.body.type,
            onride_id: req.body.onride_id,
            status: "started",
            started_at: new Date()
          });

          res.json({
            status: "true",
            message: "Call Connected Successfully"
          });
        }
        else {
          console.log(err);
          senderr(res);
        }
      });
  }
});

router.post("/endcall", function (req, res) {
  if (!req.body.sender_id || !req.body.receiver_id || !req.body.type || !req.body.user_type || !req.body.room_id || !req.body.platform || !req.body.timestamp) {
    senderr(res);
  } else {

    let data = {
      sender_id: req.body.sender_id,
      receiver_id: req.body.receiver_id,
      user_type: req.body.user_type,
      room_id: req.body.room_id,
      platform: req.body.platform,
      timestamp: req.body.timestamp,
      type: req.body.type,
      message: "end_audio_call"
    };

    let userids = [req.body.receiver_id];

    if (req.body.user_type === "user") {
      driverNotify(userids, "", data);
      socketRegistry.emitToUser(req.body.receiver_id, "end-call", data);
    }
    if (req.body.user_type === "driver") {
      userNotify(userids, "", data);
      socketRegistry.emitToUser(req.body.receiver_id, "end-call", data);
    }

    saveOrUpdateCallLog({
      room_id: req.body.room_id,
      status: "ended",
      ended_at: new Date()
    });

    res.json({
      status: "true",
      message: "Call Disconnected Successfully"
    });
  }
});

router.get("/ridechat/:onride_id/messages", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    Rides.findOne({
      _id: req.params.onride_id,
      user_id: String(user._id)
    }).exec(function (rideErr, ride) {
      if (rideErr || !ride) {
        return res.json({
          status: "false",
          message: "Ride not found"
        });
      }

      RideChatMessages.find({
        onride_id: String(ride._id)
      }).sort({ created_at: 1 }).exec(function (messageErr, messages) {
        if (messageErr) {
          return senderr(res);
        }
        return res.json({
          status: "true",
          result: messages
        });
      });
    });
  })(req, res);
});

router.post("/ridechat/:onride_id/message", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    let message = String(req.body.message || "").trim();
    if (!message) {
      return res.json({
        status: "false",
        message: "Message is required"
      });
    }

    Rides.findOne({
      _id: req.params.onride_id,
      user_id: String(user._id)
    }).exec(function (rideErr, ride) {
      if (rideErr || !ride) {
        return res.json({
          status: "false",
          message: "Ride not found"
        });
      }

      saveRideChatMessage({
        onride_id: ride._id,
        user_id: user._id,
        driver_id: ride.driver_id || "",
        sender_type: "user",
        sender_id: user._id,
        message: message
      }, function (messageErr, savedMessage) {
        if (messageErr) {
          return senderr(res);
        }

        let payload = {
          onride_id: String(ride._id),
          room_id: "ridechat_" + String(ride._id),
          sender_type: "user",
          sender_id: String(user._id),
          receiver_id: String(ride.driver_id || ""),
          user_name: user.full_name || "",
          user_image: base_url + "/gallery/users/" + (user.profile_image || "user.png"),
          message: savedMessage.message,
          created_at: savedMessage.created_at
        };

        if (ride.driver_id) {
          driverNotify([ride.driver_id], trimChatPreview(savedMessage.message), {
            type: "ride_chat",
            ride_id: String(ride._id),
            room_id: payload.room_id,
            sender_type: "user",
            sender_id: String(user._id),
            user_name: user.full_name || "",
            message: savedMessage.message
          });
          socketRegistry.emitToUser(ride.driver_id, "incoming-chat", payload);
        }

        return res.json({
          status: "true",
          result: savedMessage
        });
      });
    });
  })(req, res);
});

/* delete account */
router.post('/deleteaccount', function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!driver) {
      res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else {

      let querystring = [{
        ridestatus: 'onride'
      }, {
        ridestatus: 'ontheway'
      }, {
        ridestatus: 'scheduled'
      }, {
        ridestatus: 'accepted'
      }];

      Rides.count({
        user_id: req.body.user_id
      }).or(querystring).sort({
        '_id': -1
      }).
        exec(function (err, totalRides) {
          if (!err) {
            if (totalRides > 0) {
              res.json({
                status: "false",
                message: "You're in ride. You can't delete this account"
              });
            } else {
              User.findOneAndUpdate({
                _id: req.body.user_id
              }, {
                $set: { "deletion_status": 1 }
              }).exec(function (err, driver) {
                if (err) {
                  res.json({
                    status: "false",
                    message: "Something went to be wrong"
                  });
                } else {
                  res.json({
                    status: "true",
                    message: "Account has been deleted successfully"
                  });
                }
              });
            }
          } else {
            senderr(res);
          }
        });

    }
  })(req, res);
});



/* web account deletion*/
router.post('/accountdelete', function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, driver) {
      let querystring = [{
        ridestatus: 'onride'
      }, {
        ridestatus: 'ontheway'
      }, {
        ridestatus: 'scheduled'
      }, {
        ridestatus: 'accepted'
      }];
      Rides.count({
        user_id: req.body.user_id
      }).or(querystring).sort({
        '_id': -1
      }).
        exec(function (err, totalRides) {
          if (!err) {
            if (totalRides > 0) {
              res.json({
                status: "error",
                message: "You're in ride. You can't delete this account"
              });
            } else {
              User.findOneAndUpdate({
                _id: req.body.user_id
              }, {
                $set: { "deletion_status": 1 }
              }).exec(function (err, user) {
                if (err) {
                  res.json({
                    status: "false",
                    message: "Something went to be wrong"
                  });
                } else {
                  res.json({
                    status: "true",
                    message: "Account has been deleted successfully"
                  });
                }
              });
            }
          } else {
            senderr(res);
          }
        });    
  })(req, res);
});



/* make driver available */
freeDriver = function (driverid) {
  setDriverAvailableIfEligible(driverid, function () {});
};

/* fare calculation based on distance */
totalFare = function (c, distbycat, maxdistancecab) {
  let categoryId = c._id;
  let maxdistancepercab = parseFloat(maxdistancecab);
  let distancebykm = parseFloat(distbycat[categoryId]).toFixed(2);
  let categorybase = parseFloat(c.baseprice);
  let categoryunit = parseFloat(c.unitprice);
  let totalfare, unitfare, unitdistance;
  if (distancebykm > maxdistancepercab) {
    unitdistance = Math.abs(distancebykm - maxdistancepercab);
    unitfare = parseFloat(categoryunit * unitdistance);
    basefare = parseFloat(categorybase);
    totalfare = parseFloat(unitfare + basefare).toFixed(2);
  } else {
    totalfare = parseFloat(categorybase).toFixed(2);
  }
  return totalfare;
};

/* Pushnotify */
driverNotify = function (driverIds, message, data) {
  DriverDevices.find({
    device_type: "0"
  })
    .where("user_id")
    .in(driverIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        sendnotifications.push(rec.device_token);
      });
      fireBaseDriver(sendnotifications, message, data);
    });
  /** ios pushnotifications */
  DriverDevices.find({
    device_type: "1"
  })
    .where("user_id")
    .in(driverIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        sendnotifications.push(rec.device_token);
      });
      fireBaseAndroidDriver(sendnotifications, message, data);
    });
};

/* Pushnotify */
userNotify = function (userIds, message, data) {
  UserDevices.find({
    device_type: "0"
  })
    .where("user_id")
    .in(userIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        sendnotifications.push(rec.device_token);
      });
      fireBase(sendnotifications, message, data);
    });

  /** ios pushnotifications */
  UserDevices.find({
    device_type: "1"
  })
    .where("user_id")
    .in(userIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        sendnotifications.push(rec.device_token);
      });
      fireBaseAndroid(sendnotifications, message, data);
    });

  /** web pushnotifications */
  WebUsers.find()
    .where("user_id")
    .in(userIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        sendnotifications.push(rec.device_token);
      });
      fireBaseWeb(sendnotifications, message, data);
    });
};

userNotification = function (userIds, message, data) {
  UserDevices.find().where("user_id").in(userIds).sort({ notified_at: -1 }).limit(1).exec(function (err, records) {
    let deviceTokens = [];
    let voipTokens = [];
    let devicePlatfoms = [];
    if (records.length > 0) {
      records.forEach(function (rec) {
        deviceTokens.push(rec.device_token);
        voipTokens.push(rec.voip_token);
        devicePlatfoms.push(rec.device_type);
      });

      if (devicePlatfoms.indexOf("0") >= 0) {
        iOSUser(voipTokens, data);
      } else {
        fireBaseAndroid(deviceTokens, message, data);
      }
    }
  });
};

driverNotification = function (userIds, message, data) {
  DriverDevices.find().where("user_id").in(userIds).sort({ notified_at: -1 }).limit(1).exec(function (err, records) {
    let deviceTokens = [];
    let devicePlatfoms = [];
    let voipTokens = [];
    if (records.length > 0) {
      records.forEach(function (rec) {
        deviceTokens.push(rec.device_token);
        devicePlatfoms.push(rec.device_type);
        voipTokens.push(rec.voip_token);
      });

      if (devicePlatfoms.indexOf("0") >= 0) {
        iOSDriver(voipTokens, data);
      } else {
        fireBaseAndroidDriver(deviceTokens, message, data);
      }
    }
  });
};

iOSUser = function (devicetoken, message_data) {
  let options = {};
  options.cert = fs.readFileSync("/home/cabso2.0.1/cabso_v2.0.1/server/voip/ck_rider.pem");
  options.key = fs.readFileSync("/home/cabso2.0.1/cabso_v2.0.1/server/voip/ck_rider.pem");
  options.passphrase = "CabsoRider";
  // options.production = false;
  options.production = true;
  let apnProvider = new apn.Provider(options);
  let notification = new apn.Notification();
  notification.payload = message_data;
  notification.badge = 1;
  notification.alert = message_data.message;
  apnProvider.send(notification, devicetoken).then(result => {
    console.log("iOS Pushnotification log" + JSON.stringify(result));
  });
};

iOSDriver = function (devicetoken, message_data) {
  let options = {};
  options.cert = fs.readFileSync("/home/cabso2.0.1/cabso_v2.0.1/server/voip/ck_driver.pem");
  options.key = fs.readFileSync("/home/cabso2.0.1/cabso_v2.0.1/server/voip/ck_driver.pem");
  options.passphrase = "CabsoDriver";
  // options.production = false;
  options.production = true;
  let apnProvider = new apn.Provider(options);
  let notification = new apn.Notification();
  notification.payload = message_data;
  notification.badge = 1;
  notification.alert = message_data.message;
  apnProvider.send(notification, devicetoken).then(result => {
    console.log("iOS Pushnotification log" + JSON.stringify(result));
  });
};


/* notify nearby  drivers*/
nearBy = function (driverIds, rideId) {
  Rides.findOne({
    _id: rideId
  }).populate("user_id").exec(function (err, rides) {
    if (!err && rides) {
      let message = "New Ride available";
      let translatedstring = "";

      DriverDevices.find({
        device_type: "0"
      })
        .where("user_id")
        .in(driverIds)
        .exec(function (err, records) {
          let sendnotifications = [];
          records.forEach(function (rec) {
            //   sendnotifications.push(rec.device_token);

            let lang = rec.lang_type;
	            let data = {
	              ride_id: rideId,
              pickup_location: rides.pickup_location,
              pickup_lat: rides.pickup_lat,
              pickup_lng: rides.pickup_lng,
              drop_location: rides.drop_location,
              drop_lat: rides.drop_lat,
              drop_lng: rides.drop_lng,
              user_id: rides.user_id && rides.user_id._id ? rides.user_id._id : rides.user_id,
              user_name: rides.user_id && rides.user_id.full_name ? rides.user_id.full_name : "",
              category_id: rides.category_id,
              service_type: rides.service_type || "ride",
              ride_stops: JSON.stringify(rides.ride_stops || []),
	              onride_otp: rides.onride_otp,
	              approx_price: rides.baseprice,
	              pricing_mode: rides.pricing_mode || "platform",
                request_type: rides.request_type || "STANDARD",
	              offer_expires_at: rides.offer_expires_at || null,
                broadcast_expires_at: rides.broadcast_expires_at || null,
                passenger_offered_price: rides.passenger_offered_price || null,
                broadcast_radius: rides.broadcast_radius || null,
	              message: translationServer.langTranslate("NewRideavailable", lang),
	              type: "nearby"
            };
            translatedstring = translationServer.langTranslate("NewRideavailable", lang);

            fireBaseDriver([rec.device_token], translatedstring, data);
          });



        });
      /** ios pushnotifications */
      DriverDevices.find({
        device_type: "1"
      })
        .where("user_id")
        .in(driverIds)
        .exec(function (err, records) {
          let sendnotifications = [];
          records.forEach(function (rec) {
            let lang = rec.lang_type;
	            let data = {
	              ride_id: rideId,
              pickup_location: rides.pickup_location,
              pickup_lat: rides.pickup_lat,
              pickup_lng: rides.pickup_lng,
              drop_location: rides.drop_location,
              drop_lat: rides.drop_lat,
              drop_lng: rides.drop_lng,
              user_id: rides.user_id && rides.user_id._id ? rides.user_id._id : rides.user_id,
              user_name: rides.user_id && rides.user_id.full_name ? rides.user_id.full_name : "",
              category_id: rides.category_id,
              service_type: rides.service_type || "ride",
              ride_stops: JSON.stringify(rides.ride_stops || []),
	              onride_otp: rides.onride_otp,
	              approx_price: rides.baseprice,
	              pricing_mode: rides.pricing_mode || "platform",
                request_type: rides.request_type || "STANDARD",
	              offer_expires_at: rides.offer_expires_at || null,
                broadcast_expires_at: rides.broadcast_expires_at || null,
                passenger_offered_price: rides.passenger_offered_price || null,
                broadcast_radius: rides.broadcast_radius || null,
	              message: translationServer.langTranslate("NewRideavailable", lang),
	              type: "nearby"
            };
            translatedstring = translationServer.langTranslate("NewRideavailable", lang);

            fireBaseAndroidDriver([rec.device_token], translatedstring, data);


          });

        });
      Rides.findOneAndUpdate(
        {
          _id: rideId
        },
        {
          $set: {
            notify: 1
          }
        }
      ).exec(function (err, rides) {
        if (err) {
          senderr(res);
        } else {
          //console.log("notifications updated to nearby drivers");
        }
      });
    }
  });
};

/* notify nearby  drivers*/
schedulenearBy = function (driverIds, rides) {
  let message = "New Ride available";
  let translatedstring = "";

  /** android pushnotifications */
  DriverDevices.find({
    device_type: "0"
  })
    .where("user_id")
    .in(driverIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        //    sendnotifications.push(rec.device_token);
        let lang = rec.lang_type;
        let data = {
          ride_id: rides._id,
          pickup_location: rides.pickup_location,
          pickup_lat: rides.pickup_lat,
          pickup_lng: rides.pickup_lng,
          drop_location: rides.drop_location,
          drop_lat: rides.drop_lat,
          drop_lng: rides.drop_lng,
          message: translationServer.langTranslate("NewRideavailable", lang),
          type: "nearby"
        };
        translatedstring = translationServer.langTranslate("NewRideavailable", lang);

        fireBaseDriver([rec.device_token], translatedstring, data);


      });
      //   fireBaseDriver(sendnotifications, message, data);
    });
  /** ios pushnotifications */
  DriverDevices.find({
    device_type: "1"
  })
    .where("user_id")
    .in(driverIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        //   sendnotifications.push(rec.device_token);
        let lang = rec.lang_type;
        let data = {
          ride_id: rides._id,
          pickup_location: rides.pickup_location,
          pickup_lat: rides.pickup_lat,
          pickup_lng: rides.pickup_lng,
          drop_location: rides.drop_location,
          drop_lat: rides.drop_lat,
          drop_lng: rides.drop_lng,
          message: translationServer.langTranslate("NewRideavailable", lang),
          type: "nearby"
        };
        translatedstring = translationServer.langTranslate("NewRideavailable", lang);
        fireBaseAndroidDriver([rec.device_token], translatedstring, data);
      });
      //  fireBaseAndroidDriver(sendnotifications, message, data);
    });
  Rides.findOneAndUpdate(
    {
      _id: rides._id
    },
    {
      $set: {
        notify: 1,
        schedule_dispatched_at: new Date()
      }
    }
  ).exec(function (err, rides) {
    if (err) {
      console.error("Scheduled nearby notification update failed:", err);
    } else {
      //console.log("notifications updated to nearby drivers");
    }
  });
};

/* send user notifications */
notifyTo = function (notifications) {
  notifications.notified_at = timeZone();
  let newNotifications = new Notifications(notifications);
  newNotifications.save();
};

/* firebase ios cloud messaging */
fireBase = function (devicetokens, messagetext, data) {
  Admin.findOne(function (err, admin) {
    pushService
      .sendNotification({
        tokens: devicetokens,
        message: messagetext,
        data: data,
        mobile: true,
        siteName: admin && admin.siteName
      })
      .catch(function (_error) {});
  });
};

/* firebase android cloud messaging */
fireBaseAndroid = function (devicetokens, messagetext, data) {
  Admin.findOne(function (err, admin) {
    pushService
      .sendNotification({
        tokens: devicetokens,
        message: messagetext,
        data: data,
        mobile: true,
        siteName: admin && admin.siteName
      })
      .catch(function (_error) {});
  });
};

/* firebase web cloud messaging */
fireBaseWeb = function (devicetokens, messagetext, data) {
  Admin.findOne(function (err, admin) {
    pushService
      .sendNotification({
        tokens: devicetokens,
        title: admin && admin.siteName,
        message: data && data.message ? data.message : messagetext,
        data: data,
        web: true,
        siteName: admin && admin.siteName,
        icon: config.baseUrl + "/favicon.png"
      })
      .catch(function (_error) {});
  });
};

/* jwt authentication  */
getToken = function (headers) {
  if (headers && headers.authorization) {
    return headers.authorization;
  } else {
    return null;
  }
};

/* error handlers */
senderr = function (res) {
  return res.json({
    status: "false",
    message: "Something went to be wrong"
  });
};

/* firebase ios cloud messaging */
fireBaseDriver = function (devicetokens, messagetext, data) {
  Admin.findOne(function (err, admin) {
    pushService
      .sendNotification({
        tokens: devicetokens,
        title: DRIVER_NOTIFICATION_TITLE,
        message: messagetext,
        data: data,
        mobile: true,
        siteName: admin && admin.siteName
      })
      .catch(function (_error) {});
  });
};

/* firebase android cloud messaging */
fireBaseAndroidDriver = function (devicetokens, messagetext, data) {
  Admin.findOne(function (err, admin) {
    pushService
      .sendNotification({
        tokens: devicetokens,
        title: DRIVER_NOTIFICATION_TITLE,
        message: messagetext,
        data: data,
        mobile: true,
        siteName: admin && admin.siteName
      })
      .catch(function (_error) {});
  });
};

/* time based on your region */
timeZone = function () {
  return timezone.timestampSeconds();
};

/* schedule time based on your region */
scheduletimeZone = function () {
  return timezone.isoAfterMinutes(10);
};

module.exports = router;
