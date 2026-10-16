const passport = require('passport');
const config = require('../config');
require('../driverpassport')(passport);
const jwt = require('jsonwebtoken');
const async = require('async');
const express = require('express');
const router = express.Router();
const path = require('path');
const moment = require("moment");
const socketRegistry = require("../socketRegistry");
const { buildIceServers } = require("../services/turnService");
const timezone = require("../utils/timezone");
const { UAT_RADIUS_OPTIONS_KM, driverMatchesActiveRadius, normalizeActiveRadiusKm } = require("../services/driverDispatchRadiusService");

/* schemas */
let Driver = require("../schema/driver");
let Bodytypes = require("../schema/bodytypes");
let Amenities = require("../schema/amenities");
let Vehicles = require("../schema/vehicles");
let Notifications = require("../schema/notification");
let Help = require("../models/helppage");
let Rides = require("../schema/rides");
let UserDevices = require("../schema/driverdevices");
let NotifyDevices = require("../schema/userdevices");
let Payments = require("../schema/payments");
let Wallet = require("../schema/wallets");
let SelcomPaymentSession = require("../schema/selcompaymentsession");
let Commissions = require("../schema/commissions");
let Reviews = require("../schema/reviews");
let Admin = require("../models/admin");
let Settlements = require("../schema/settlement");
let OtpVerification = require("../schema/otpverification");
let SosAlerts = require("../schema/sosalerts");
let LostItems = require("../schema/lostitems");
let LostItemMessages = require("../schema/lostitemmessages");
let RideChatMessages = require("../schema/ridechatmessages");
let RiderBlocks = require("../schema/riderblocks");
let CallLogs = require("../schema/calllogs");
let SubscriptionPlan = require("../schema/subscriptionplans");
let Subscription = require("../schema/subscriptions");
let RideOffer = require("../schema/rideoffers");
let DriverDestinationBroadcast = require("../schema/driverdestinationbroadcasts");
let DriverDestinationJoinRequest = require("../schema/driverdestinationjoinrequests");
let translationServer = require("../translation/translate.js");

/* api url */
const base_url = config.baseUrl;

function timeZone() {
  return timezone.timestampSeconds();
}

/* upload directories */
const driverassets = "./src/assets/media/drivers/";

/* image uploads */
const fs = require('fs');
const multer = require('multer');
const upload = multer();

/* mailers */
const nodemailer = require('nodemailer');

/* push notifications */
const pushService = require("../services/pushService");
const passwordService = require("../services/passwordService");
const braintree = require("braintree");

/* random string generation */
const crypto = require('crypto');
const randomstring = require("randomstring");
const smsService = require("../services/smsService");
const selcomService = require("../services/selcomService");
const cetsSyncService = require("../services/cetsSyncService");
const { roundCustomerPayableAmount } = require("../utils/pricing");
const { getRoadRouteDetails } = require("../services/routeGeometryService");
const {
  applyRideCompletionFinancials,
  buildPaymentDocument,
  getRideFinalAmount,
  isCommissionEnabled,
  isLegacyCommissionRide,
  markRidePaymentComplete
} = require("../services/rideRevenuePolicy");
const { formatValidity: formatPlanValidity } = require("../services/subscriptionPlanService");
const {
  DRIVER_SUBSCRIPTION_ACTOR_TYPE,
  buildSubscriptionUsageLabel,
  buildPendingDriverSubscriptionRecord,
  consumeCompletedRideUsage,
  expireDriverSubscriptions,
  finalizeSubscriptionSession,
  formatDriverSubscription,
  getCurrentDriverSubscription,
  getSubscriptionUsageSnapshot,
  markDriverSubscriptionPaymentFailed,
  resetDailyUsageIfNeeded,
  validatePlanForPurchase
} = require("../services/driverSubscriptionService");
const {
  applyPostRideAvailability,
  buildEligibilityErrorPayload,
  evaluateDriverActionEligibility,
  evaluateDriverEligibility,
  filterEligibleDrivers,
  hasInProgressRide
} = require("../services/driverEligibilityService");
const {
  DRIVER_DESTINATION_BROADCAST_ACTOR_TYPE,
  finalizeDestinationBroadcastSession,
  createDriverDestinationBroadcast,
  decideJoinRequest,
  expireDriverDestinationBroadcasts,
  getDestinationBroadcastSettings,
  isDriverDestinationBroadcastEnabled,
  retryDestinationBroadcastPayment,
  reconcilePendingDestinationBroadcastPayments,
  updateBroadcastStatus
} = require("../services/driverDestinationBroadcastService");
const {
  getDriverOfferForRide,
  isDriverOfferRide,
  isPassengerBroadcastRide,
  isDriverPricingEnabled,
  submitRideOffer,
  withdrawRideOffer
} = require("../services/rideOfferService");
const {
  requiredCurrentStatusForDriverTransition
} = require("../services/rideLifecycleService");
const {
  EMAIL_ACTIVATION_MAX_RESENDS,
  issueDriverActivation,
  verifyDriverActivation
} = require("../services/emailActivationService");

const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 3;
const DRIVER_WALLET_TYPE = "driver";
const DRIVER_FORGOT_PASSWORD_OTP_PURPOSE = "forgot_password";
const VALID_DRIVER_SERVICE_TYPES = ["ride", "delivery"];
const ACTIVE_RIDE_STATUSES = ["requested", "accepted", "ontheway", "onride"];
const DRIVER_NOTIFICATION_TITLE = "Shilota Driver";

function normalizeDriverServiceTypes(value) {
  let serviceTypes = value;
  if (typeof serviceTypes === "string") {
    try {
      serviceTypes = JSON.parse(serviceTypes);
    } catch (_error) {
      serviceTypes = serviceTypes.split(",");
    }
  }

  if (!Array.isArray(serviceTypes)) {
    serviceTypes = [];
  }

  serviceTypes = serviceTypes
    .map(function (serviceType) {
      return String(serviceType || "").trim().toLowerCase();
    })
    .filter(function (serviceType, index, list) {
      return VALID_DRIVER_SERVICE_TYPES.indexOf(serviceType) !== -1 && list.indexOf(serviceType) === index;
    });

  if (serviceTypes.length === 0) {
    serviceTypes.push("ride");
  }

  return serviceTypes;
}

function parseVehicleAmenities(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    try {
      return JSON.parse(value);
    } catch (_error) {
      return [];
    }
  }
  return [];
}

function firstDefined() {
  for (let i = 0; i < arguments.length; i++) {
    if (typeof arguments[i] !== "undefined") {
      return arguments[i];
    }
  }
  return undefined;
}

function buildVehicleDetailsUpdate(body) {
  let update = {
    user_id: body.user_id,
    vehicle_name: firstDefined(body.vehicle_name, body.driver_vehicle),
    available_seats: body.available_seats,
    body_type: firstDefined(body.body_type, body.vehicle_type),
    amenities: parseVehicleAmenities(firstDefined(body.amenities, body.amenitites)),
    amenitites: parseVehicleAmenities(firstDefined(body.amenitites, body.amenities)),
    vehicle_number: firstDefined(body.vehicle_number, body.vehicle_registration_number),
    licence_no: firstDefined(body.licence_no, body.license_no, body.driver_license_number),
    licence_date: firstDefined(body.licence_date, body.license_date, body.license_expiry_date),
    insurance_no: body.insurance_no,
    insurance_date: body.insurance_date,
    book_no: firstDefined(body.book_no, body.rcbook_no, body.rc_book_no),
    book_date: firstDefined(body.book_date, body.rcbook_date, body.rc_book_date),
    service_types: normalizeDriverServiceTypes(body.service_types)
  };

  if (typeof body.licensedoc !== "undefined" || typeof body.licence_doc !== "undefined") {
    update.licensedoc = firstDefined(body.licensedoc, body.licence_doc);
  }
  if (typeof body.insurancedoc !== "undefined" || typeof body.insurance_doc !== "undefined") {
    update.insurancedoc = firstDefined(body.insurancedoc, body.insurance_doc);
  }
  if (typeof body.bookdoc !== "undefined" || typeof body.book_doc !== "undefined") {
    update.bookdoc = firstDefined(body.bookdoc, body.book_doc);
  }

  Object.keys(update).forEach(function (key) {
    if (typeof update[key] === "undefined") {
      delete update[key];
    }
  });

  return update;
}

function hasVehicleDetailValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (typeof value === "number") {
    return value > 0;
  }
  if (value && typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return value !== null && typeof value !== "undefined" && String(value).trim() !== "";
}

function getMissingVehicleDetailFields(vehicle) {
  const data = vehicle && typeof vehicle.toObject === "function" ? vehicle.toObject() : (vehicle || {});
  const amenities = hasVehicleDetailValue(data.amenities) ? data.amenities : data.amenitites;
  const requiredFields = [
    ["vehicle_name", data.vehicle_name],
    ["available_seats", data.available_seats],
    ["body_type", data.body_type],
    ["amenities", amenities],
    ["vehicle_number", data.vehicle_number],
    ["licence_no", data.licence_no],
    ["licence_date", data.licence_date],
    ["licensedoc", data.licensedoc],
    ["insurance_no", data.insurance_no],
    ["insurance_date", data.insurance_date],
    ["insurancedoc", data.insurancedoc]
  ];

  return requiredFields
    .filter(function (field) {
      return !hasVehicleDetailValue(field[1]);
    })
    .map(function (field) {
      return field[0];
    });
}

function vehicleDetailsStatus(vehicle) {
  return getMissingVehicleDetailFields(vehicle).length === 0 ? "Complete" : "InComplete";
}

function syncVehicleDetailsStatus(userId, vehicle) {
  const status = vehicleDetailsStatus(vehicle);
  return Promise.all([
    Driver.findOneAndUpdate({ _id: userId }, {
      $set: { vehicle_details: status }
    }).exec(),
    Vehicles.findOneAndUpdate({ user_id: userId }, {
      $set: { completionStatus: status === "Complete" ? "1" : "0" }
    }).exec()
  ]).then(function () {
    return status;
  });
}

function saveDriverCallLog(payload, callback) {
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

  let log = new CallLogs({
    room_id: roomId,
    sender_id: String(payload.sender_id || ""),
    sender_type: "driver",
    receiver_id: String(payload.receiver_id || ""),
    receiver_type: "user",
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
}

function clearOtherActiveRidesForRider(userId, completedRideId) {
  if (!userId) {
    return;
  }

  Rides.updateMany({
    user_id: userId,
    _id: { $ne: completedRideId },
    ridestatus: { $in: ACTIVE_RIDE_STATUSES }
  }, {
    $set: {
      ridestatus: "cancelled",
      ridestatusat: timeZone()
    }
  }).exec(function (error) {
    if (error) {
      console.error("Unable to clear stale active rides:", error);
    }
  });
}

function completeRideForPayment(onrideId, driverId, callback) {
  Rides.findOne({
    _id: onrideId
  }, function (err, ride) {
    if (err || !ride) {
      return callback(err || new Error("Ride not found"));
    }

    if (ride.ridestatus !== "cancelled") {
      ride.ridestatus = "completed";
      ride.ridestatusat = timeZone();
      ride.ride_completed_at = ride.ride_completed_at || new Date();
    }

    ride.save(function (saveErr) {
      if (saveErr) {
        return callback(saveErr);
      }

      clearOtherActiveRidesForRider(ride.user_id, ride._id);
      consumeCompletedRideUsage({
        rideId: ride._id,
        driverId: driverId || ride.driver_id,
        now: new Date()
      }).then(function () {
        return applyPostRideAvailability(driverId || ride.driver_id, {
          now: new Date()
        });
      }).then(function () {
        callback(null, ride);
      }).catch(function (driverErr) {
        callback(driverErr, ride);
      });
    });
  });
}

function normalizeRideServiceType(value) {
  value = String(value || "ride").trim().toLowerCase();
  return value === "delivery" ? "delivery" : "ride";
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

function driverMatchesAcceptanceSettings(driver, ride) {
  if (!driverMatchesActiveRadius(driver)) {
    return false;
  }
  if (config.featureFlags.acceptance_settings_enabled !== true) {
    return true;
  }
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
}

function validateDriverCanAcceptRide(driverId, ride, callback) {
  let lon = parseFloat(ride.pickup_lng);
  let lat = parseFloat(ride.pickup_lat);
  if (isNaN(lon) || isNaN(lat)) {
    return callback(false);
  }

  Admin.findOne(function (err, admin) {
    if (err || !admin) {
      return callback(false);
    }
    let maxdistcoverage = parseInt(admin.distancePerCab);
    if (isNaN(maxdistcoverage) || maxdistcoverage <= 0) {
      maxdistcoverage = 1;
    }

    Driver.aggregate([
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
            _id: driverId,
            live_status: "1",
            approval: "1",
            category_id: ride.category_id,
            ...buildDriverServiceTypeMatch(ride.service_type)
          }
        }
      }
    ]).exec(function (geoErr, drivers) {
      if (geoErr || !Array.isArray(drivers) || drivers.length === 0) {
        return callback(false);
      }
      filterEligibleDrivers(drivers, {
        now: new Date()
      }).then(function (eligibleDrivers) {
        if (!Array.isArray(eligibleDrivers) || eligibleDrivers.length === 0) {
          return callback(false);
        }
        callback(driverMatchesAcceptanceSettings(eligibleDrivers[0], ride));
      }).catch(function () {
        callback(false);
      });
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
    sender_type: payload.sender_type || "driver",
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
      last_message_sender: payload.sender_type || "driver"
    };

    if (payload.sender_type === "driver") {
      counterUpdate.unread_user_count = Number(payload.increment_user_unread || 1);
      counterUpdate.unread_admin_count = Number(payload.increment_admin_unread || 1);
      counterUpdate.unread_driver_count = 0;
    } else {
      counterUpdate.unread_driver_count = Number(payload.increment_driver_unread || 1);
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
    sender_type: payload.sender_type || "driver",
    sender_id: payload.sender_id ? String(payload.sender_id) : "",
    message: messageText
  });

  newMessage.save(callback);
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

function getDriverOtpPurpose(req) {
  return req.body.purpose || "driver_signup";
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

async function verifyDriverOtpForPurpose(phoneNumber, purpose, otp) {
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

function getDriverWalletAmount(driver) {
  if (!driver || typeof driver.walletmoney === "undefined" || driver.walletmoney === null) {
    return 0;
  }

  return Math.round(Number(driver.walletmoney || 0) * 100) / 100;
}

function buildDriverSubscriptionResponse(subscription) {
  if (!subscription) {
    return null;
  }

  resetDailyUsageIfNeeded(subscription, new Date());
  const result = formatDriverSubscription(subscription);
  const usage = getSubscriptionUsageSnapshot(subscription, new Date());
  result.validity_label = formatPlanValidity({
    duration_unit: result.duration_unit_snapshot,
    duration_value: result.duration_value_snapshot
  });
  result.current_usage_label = buildSubscriptionUsageLabel(subscription, new Date());
  result.remaining_rides = usage.remaining_rides;
  result.reached_daily_limit = usage.reached_daily_limit;
  return result;
}

async function pushDriverWalletNotification(driverId, walletamount, message) {
  const admin = await Admin.findOne({}).sort({ _id: -1 }).exec();
  const notificationTitle = "Wallet Credited";
  const notificationMessage = "Your wallet has been credited & wallet balance is " + walletamount;

  let newNotification = new Notifications({
    user_id: "0",
    notify_to: String(driverId),
    title: notificationTitle,
    message: notificationMessage,
    notified_at: timeZone()
  });
  await newNotification.save();

  const devices = await UserDevices.find({ user_id: String(driverId) }).exec();
  const tokens = devices.map(function (device) {
    return device.device_token;
  }).filter(Boolean);

  if (tokens.length > 0) {
    await pushService.sendNotification({
      tokens: tokens,
      title: DRIVER_NOTIFICATION_TITLE,
      message: message,
      data: {
        type: "payment",
        message: message
      },
      mobile: true,
      siteName: admin && admin.siteName
    });
  }
}

/* signup as driver user */
router.post('/routepath', function (req, res) {
  passport.authenticate('jwt', { session: false }, async function (_err, user) {
    if (!user || String(user._id) !== String(req.body.user_id || '')) {
      return res.json({ status: 'false', message: 'Unauthorized access' });
    }
    try {
      const route = await getRoadRouteDetails(req.body || {});
      return res.json({
        status: 'true',
        encoded_polyline: route.encoded_polyline,
        distance_meters: Number.isFinite(route.distance_meters) ? String(route.distance_meters) : '',
        duration_seconds: Number.isFinite(route.duration_seconds) ? String(route.duration_seconds) : ''
      });
    } catch (routeError) {
      return res.json({
        status: 'false',
        message: routeError && routeError.message ? routeError.message : 'Unable to calculate route'
      });
    }
  })(req, res);
});

router.post('/signup', function (req, res) {
  if (!req.body.email || !req.body.password) {
    res.json({
      status: "false",
      message: "Something went to be wrong"
    });
  } else {
    let otp = randomstring.generate({
      length: 4,
      charset: 'numeric'
    });
    let BatchId = 'ID ' + otp.substr(0, 4);
    let newDriver = new Driver({
      email: req.body.email,
      password: req.body.password,
      full_name: req.body.full_name,
      country_code: req.body.country_code,
      phone_number: req.body.phone_number,
      lat: req.body.lat,
      lon: req.body.lon,
      loc: [req.body.lon, req.body.lat],
      service_types: normalizeDriverServiceTypes(req.body.service_types),
      instant_lat: req.body.lat,
      instant_lng: req.body.lon,
      location: req.body.location,
      vehicle_inspection: "InComplete",
      security_deposit: "InComplete",
      vehicle_details: "InComplete",
      payment_details: "InComplete",
      live_status: "0",
      // A newly registered driver is not dispatch-eligible until an administrator
      // approves them and the registered email activation code is verified.
      approval: "0",
      email_activation_required: false,
      batch_id: BatchId
    });
    // save the driver details
    newDriver.save(function (err, driver) {
      if (err) {
        res.json({
          status: "false",
          message: 'Email already exists.'
        });
      } else {
        Vehicles.count({
          user_id: driver._id
        }).exec()
          .then(function (count) {
            if (count == '0') {
              let newVehicle = new Vehicles({
                user_id: driver._id,
                service_types: driver.service_types,
                completionStatus: "0"
              });
              newVehicle.save(function (err, vehicles) {
                if (err) {
                  senderr(res);
                } else {
                  driver.vehicle_id = vehicles._id;
                  driver.save();
                  cetsSyncService.enqueueDriverSync(driver._id, "driver_signup").catch(function (syncError) {
                    console.error("CeTS driver signup enqueue failed:", syncError);
                  });
                  res.json({
                    status: "true",
                    message: 'Your account has been created, please login to your account.'
                  });
                }
              });
            }
          });
      }
    });
  }
});

/* driver phone OTP */
router.post("/getotp", async function (req, res) {
  const rawPhoneNumber = req.body.phone_number;
  const purpose = getDriverOtpPurpose(req);

  if (!rawPhoneNumber) {
    return res.json({
      status: "false",
      message: "Phone number is required"
    });
  }

  const phoneParts = buildPhoneParts(rawPhoneNumber);
  if (!phoneParts) {
    return res.json({
      status: "false",
      message: "Invalid phone number"
    });
  }

  if (purpose === DRIVER_FORGOT_PASSWORD_OTP_PURPOSE) {
    const existingDriver = await Driver.findOne({
      country_code: `+${phoneParts.countryCode}`,
      phone_number: phoneParts.nationalNumber,
      deletion_status: 0
    }).exec();

    if (!existingDriver) {
      return res.json({
        status: "false",
        message: "Phone number not registered"
      });
    }
  }

  const otp = randomstring.generate({
    // Keep staging driver phone/password verification compatible with production.
    length: 6,
    charset: "numeric"
  });
  const message = `Your Shilota verification code is ${otp}`;

  const smsResult = await smsService.sendSms(phoneParts.normalizedPhoneNumber, message);
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
    country_code: `+${phoneParts.countryCode}`,
    phone_number: phoneParts.normalizedPhoneNumber,
    sms_enabled: !smsResult.skipped,
    expires_in: OTP_EXPIRY_MINUTES * 60
  });
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
    const driver = await Driver.findOne({
      country_code: `+${phoneParts.countryCode}`,
      phone_number: phoneParts.nationalNumber
    }).exec();

    if (!driver) {
      return res.json({
        status: "false",
        message: "Phone number not registered"
      });
    }

    if (driver.deletion_status === 1) {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }

    const verificationResult = await verifyDriverOtpForPurpose(
      phoneParts.normalizedPhoneNumber,
      DRIVER_FORGOT_PASSWORD_OTP_PURPOSE,
      otp
    );

    if (!verificationResult.ok) {
      return res.json({
        status: "false",
        message: verificationResult.message
      });
    }

    await passwordService.replacePassword(Driver, driver._id, newPassword);

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

/* signin as user */
router.post('/signin', function (req, res) {
  Driver.findOne({
    email: req.body.email
  }, function (err, driver) {
    if (err) throw err;
    if (!driver) {
      res.json({
        status: "false",
        message: 'Email not registered'
      });
    } else {

      if (driver.deletion_status === 1) {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      }
      else {
        // check if password matches
        driver.comparePassword(req.body.password, function (err, isMatch) {
          if (isMatch && !err) {
            // if driver is found and password is right create a token
            let driverObj = driver.toObject();
            driverObj.role = "driver";
            let signintoken = jwt.sign(driverObj, config.secret);
            //save the country_code & phone number
            if (typeof req.body.country_code != 'undefined' && typeof req.body.phone_number != 'undefined') {
              driver.country_code = req.body.country_code;
              driver.phone_number = req.body.phone_number;
              driver.save();
            }
            let profile_image = driver.profile_image;
            if (typeof driver.profile_image == 'undefined') {
              let profile_image = 'driver.png';
            }
            Vehicles.findOne({
              user_id: driver._id
            }, function (err, vehicleinfo) {
              let result = {};
              let vehicleStatus;
              result.status = "true";
              result.user_id = driver._id;
              result.full_name = driver.full_name;
              result.email = driver.email;
              result.password = req.body.password;
              result.country_code = driver.country_code;
              result.phone_number = driver.phone_number;
              result.vehicle_inspection = driver.vehicle_inspection;
              result.security_deposit = driver.security_deposit;
              result.vehicle_details = vehicleinfo ? vehicleDetailsStatus(vehicleinfo) : "InComplete";
              result.payment_details = driver.payment_details;
              result.user_image = base_url + '/api/gallery/drivers/' + profile_image;
              result.token = 'JWT ' + signintoken;
              result.emergency_contact = driver.emergency_contact;
              result.walletmoney = getDriverWalletAmount(driver);
              result.service_types = driver.service_types && driver.service_types.length ? driver.service_types : ["ride"];
              result.approval = ((driver.approval == '1') ? "true" : "false");
              vehicleStatus = vehicleinfo && vehicleinfo.status == '1' ? "approved" : "rejected";
              result.vehicle_approval = (!vehicleinfo || typeof vehicleinfo.category == 'undefined') ? "pending" : vehicleStatus;
              if (driver.vehicle_details !== result.vehicle_details) {
                syncVehicleDetailsStatus(driver._id, vehicleinfo).catch(function (syncError) {
                  console.error("Vehicle details status reconciliation failed:", syncError);
                });
              }
              res.json(result);
            });
          } else {
            res.json({
              status: "false",
              message: 'Incorrect username or password'
            });
          }
        });
      }
    }
  });
});

/* Verify the code sent when an administrator approves a driver. */
router.post('/verify-email-activation', async function (req, res) {
  const email = String(req.body.email || '').trim().toLowerCase();
  const code = String(req.body.code || '');
  if (!email || !/^\d{4}$/.test(code)) {
    return res.json({ status: "false", message: "Email and a 4-digit activation code are required" });
  }

  try {
    const verification = await verifyDriverActivation(email, code);
    if (!verification.ok) {
      return res.json({
        status: "false",
        error_code: verification.code,
        message: "Email activation could not be verified"
      });
    }

    const driver = await Driver.findOneAndUpdate(
      { _id: verification.account_id, email: email, deletion_status: 0, email_activation_required: true },
      { $set: { approval: "1", email_activation_required: false, email_activated_at: new Date() } },
      { new: true }
    ).exec();
    if (!driver) {
      return res.json({ status: "false", error_code: "ACTIVATION_NOT_AVAILABLE", message: "Email activation is not available" });
    }

    cetsSyncService.enqueueDriverSync(driver._id, "driver_email_activated").catch(function (syncError) {
      console.error("CeTS driver activation enqueue failed:", syncError);
    });
    return res.json({ status: "true", message: "Email verified. Your driver account is active." });
  } catch (_error) {
    return senderr(res);
  }
});

/* Resending is explicit and only available to the authenticated pending driver. */
router.post('/resend-email-activation', function (req, res) {
  passport.authenticate('jwt', { session: false }, async function (_err, driver) {
    if (!driver || String(driver._id) !== String(req.body.user_id || '')) {
      return res.json({ status: "false", message: "Unauthorized access" });
    }
    if (!driver.email_activation_required || String(driver.approval) === "1") {
      return res.json({ status: "false", error_code: "ACTIVATION_NOT_PENDING", message: "Email activation is not pending" });
    }

    try {
      const activation = await issueDriverActivation(driver, { resend: true });
      if (!activation.ok) {
        return res.json({
          status: "false",
          error_code: activation.code,
          message: activation.code === "RESEND_LIMIT_REACHED"
            ? "The activation resend limit has been reached"
            : "No active email activation code was found"
        });
      }
      return res.json({
        status: activation.delivery.delivered ? "true" : "false",
        error_code: activation.delivery.delivered ? undefined : activation.delivery.reason,
        message: activation.delivery.delivered ? "Activation code sent" : "Activation email could not be sent",
        expires_in: activation.expires_in,
        resends_remaining: activation.resends_remaining
      });
    } catch (_error) {
      return senderr(res);
    }
  })(req, res);
});

/* driver profile */
router.get('/profile/:userid', function (req, res) {
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
      let token = getToken(req.headers);
      if (token) {
        Driver.findOne({
          _id: req.params.userid
        }, function (err, driver) {
          if (err) {
            return res.json({
              status: "false",
              message: "Unable to load profile"
            });
          }
          if (!driver) {
            res.json({
              status: "false",
              message: 'No users found.'
            });
          } else {
            let profile_image = driver.profile_image;
            if (!profile_image) {
              profile_image = 'driver.png';
            }

            let result = {};
            result.status = "true";
            result.user_id = driver._id;
            result.full_name = driver.full_name;
            result.email = driver.email;
            result.user_image = base_url + "/api/gallery/drivers/" + profile_image;
            result.country_code = driver.country_code;
            result.phone_number = driver.phone_number;
            result.emergency_contact = Array.isArray(driver.emergency_contact) ? driver.emergency_contact : [];
            result.nextinspectionon = driver.inspectionon;
            result.walletmoney = getDriverWalletAmount(driver);
            result.service_types = driver.service_types && driver.service_types.length ? driver.service_types : ["ride"];
            let querystring = {
              driver_id: req.params.userid
            };
            Reviews.count(querystring, function (err, count) {
              if (count > 0) {
                result.rating = parseFloat(driver.rating / count).toFixed(1);
                res.json(result);
              } else {
                result.rating = "0";
                res.json(result);
              }
            });
          }
        });
      } else {
        res.json({
          status: "false",
          message: "Something went to be wrong"
        });
      }
    }
  })(req, res);
});

/* admin datas */
router.get('/admindatas', function (req, res, next) {
  Bodytypes.find().exec()
    .then(function (bodytypes) {
      let result = [];
      return Amenities.find().exec()
        .then(function (amenities) {
          return [bodytypes, amenities];
        });
    })
    .then(function (result) {
      Help.count(function (err, count) {
        if (err) res.json({
          status: "false",
          message: "Something went to be wrong"
        });
        else {
          let pagetypes = ['vehicleInspection', 'securityDeposit'];
          let driverdocs = [],
            currencycode;
          Help.find().where('pagetype')
            .in(pagetypes)
            .exec(function (err, helps) {
              helps.forEach(function (h) {
                driverdocs.push(h);
              });
              if (!err) {
                Admin.findOne(function (err, admin) {
                  res.json({
                    status: "true",
                    body_type: result[0],
                    amenities: result[1],
                    driverdocs: driverdocs,
                    currencycode: admin.currencyCode,
                    currencysymbol: admin.currencySymbol,
                    emergencycontact: admin.emergencyContact
                  });
                });
              } else {
                res.json({
                  status: "false",
                  message: "Something went to be wrong"
                });
              }
            });
        }
      });
    })
    .then(undefined, function (err) {
      senderr(res);
    })
});

/* driver's new cab */
router.get('/getvehicledetails/:userid', function (req, res) {
  if (!req.params.userid) {
    res.json({
      status: "false",
      message: "Something went to be wrong"
    });
  } else {
    Vehicles.count({
      user_id: req.params.userid
    }).exec()
      .then(function (count) {
        if (count > 0) {
          Vehicles.findOne({
            user_id: req.params.userid
          }, function (err, vehicles) {
            if (err) {
              return senderr(res);
            }
            if (!vehicles) {
              return res.json({
                status: "false",
                message: "Something went to be wrong"
              });
            }
            syncVehicleDetailsStatus(req.params.userid, vehicles)
              .then(function (completionStatus) {
                let result = vehicles.toObject();
                result.status = "true";
                result.vehicle_details = completionStatus;
                res.json(result);
              })
              .catch(function () {
                senderr(res);
              });
          });
        } else {
          res.json({
            status: "false",
            message: 'No vehicles found.'
          });
        }
      })
      .then(undefined, function (err) {
        res.json({
          status: "false",
          message: "Something went to be wrong"
        });
      })
  }
});

router.post('/postvehicledetails', function (req, res) {
  if (!req.body.user_id) {
    res.json({
      status: "false",
      message: 'Something went to be wrong'
    });
  } else {
    let vehicleUpdate = buildVehicleDetailsUpdate(req.body);
    Vehicles.findOne({ user_id: req.body.user_id }).exec()
      .then(function (existingVehicle) {
        let candidate = Object.assign({}, existingVehicle ? existingVehicle.toObject() : {}, vehicleUpdate);
        let missingFields = getMissingVehicleDetailFields(candidate);
        if (missingFields.length > 0) {
          return res.json({
            status: "false",
            vehicle_details: "InComplete",
            missing_fields: missingFields.join(","),
            message: "Complete all required vehicle fields and documents"
          });
        }

        return Vehicles.findOneAndUpdate({ user_id: req.body.user_id }, {
          $set: vehicleUpdate
        }, {
          new: true,
          upsert: true,
          setDefaultsOnInsert: true
        }).exec().then(function (vehicles) {
          return syncVehicleDetailsStatus(req.body.user_id, vehicles).then(function (completionStatus) {
            cetsSyncService.enqueueVehicleSync(vehicles._id, existingVehicle ? "vehicle_details_update" : "vehicle_details_create").catch(function (syncError) {
              console.error("CeTS vehicle sync enqueue failed:", syncError);
            });
            return res.json({
              status: "true",
              vehicle_details: completionStatus,
              message: existingVehicle ? "Vehicle updated successfully" : "Vehicle saved successfully"
            });
          });
        });
      })
      .then(undefined, function (err) {
        res.json({
          status: "false",
          message: 'Something went to be wrong'
        });
      })
  }
});

/* change password */
router.post('/changepassword', function (req, res) {
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
      if (!req.body.user_id || !req.body.newpassword) {
        res.json({
          status: "false",
          message: "Something went to be wrong"
        });
      } else {
        Driver.findOne({
          _id: req.body.user_id
        }, function (err, driver) {
          if (!driver) {
            res.json({
              status: "false",
              message: "Something went to be wrong"
            });
          }
          driver.password = req.body.newpassword;
          driver.save(function (err) {
            res.json({
              status: "true",
              message: 'Password changed successfully'
            });
          });
        });
      }
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
        Driver.findOne(
          {
            email: req.body.email
          },
          function (err, driver) {
            if (!driver) {
              res.json({
                status: "false",
                message: "No account with that email address exists."
              });
            } else {
              if(driver.deletion_status===1){
                res.json({
                  status: "error",
                  message: "Account Deleted."
                });
              }else{ 
              driver.password = token;
              driver.save(function (err) {
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
                      console.log(error);
                      senderr(res);
                    } else {
                      res.json({
                        status: "true",
                        message: "Your Password has been reset successfully. Kindly check your registered mail now"
                      });
                    }
                  });
                });
              });}
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

/* help pages */
// router.get('/helppages', function (req, res) {
//   passport.authenticate('jwt', { session: false }, function (err, driver) {
//     if (err === "AccountDeleted") {
//       res.json({
//         status: "error",
//         message: 'Account has been deleted successfully'
//       });
//     } else if (!driver) {
//       res.json({
//         status: "error",
//         message: 'Unauthorized access'
//       });
//     } else {
//       Help.count(function (err, count) {
//         if (err) res.json({
//           status: "false",
//           message: "Something went to be wrong"
//         });
//         else {
//           Help.find({
//             type: "driver",
//             pagetype: {
//               $nin: ['vehicleInspection', 'securityDeposit']
//             }
//           }, function (err, helps) {
//             if (!err) {
//               res.json({
//                 status: "true",
//                 result: helps
//               });
//             } else {
//               res.json({
//                 status: "false",
//                 message: "Something went to be wrong"
//               });
//             }
//           });
//         }
//       });
//     }
//   })(req, res);
// });

router.get('/helppages', function (req, res) {
  Help.count(function (err, count) {
    if (err) res.json({
      status: "false",
      message: "Something went to be wrong"
    });
    else {
      Help.find({
        type: "driver",
        pagetype: {
          $nin: ['vehicleInspection', 'securityDeposit']
        }
      }, function (err, helps) {
        if (!err) {
          res.json({
            status: "true",
            result: helps
          });
        } else {
          res.json({
            status: "false",
            message: "Something went to be wrong"
          });
        }
      });
    }
  });
});

router.get('/subscriptionplans/:userid', function (req, res) {
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
    } else if (String(driver._id) !== String(req.params.userid)) {
      res.json({
        status: "false",
        message: 'Unauthorized access'
      });
    } else {
      SubscriptionPlan.find({
        customer_type: "DRIVER",
        is_active: true
      }).sort({
        display_order: 1,
        created_at: 1
      }).exec(function (planErr, plans) {
        if (planErr) {
          return res.json({
            status: "false",
            result: []
          });
        }

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
              daily_ride_limit: plan.daily_ride_limit,
              ride_credit_count: plan.ride_credit_count,
              is_unlimited: plan.is_unlimited,
              validity_label: formatPlanValidity(plan)
            };
          })
        });
      });
    }
  })(req, res);
});

router.get('/subscriptions/current/:userid', function (req, res) {
  passport.authenticate('jwt', { session: false }, async function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!driver) {
      return res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else if (String(driver._id) !== String(req.params.userid)) {
      return res.json({
        status: "false",
        message: 'Unauthorized access'
      });
    }

    try {
      const activeSubscription = await getCurrentDriverSubscription(driver._id, new Date());
      const pendingSubscription = await Subscription.findOne({
        customer_type: "DRIVER",
        driver_id: driver._id,
        status: "PENDING_PAYMENT"
      }).sort({ created_at: -1 }).exec();

      return res.json({
        status: "true",
        current_subscription: buildDriverSubscriptionResponse(activeSubscription),
        pending_subscription: buildDriverSubscriptionResponse(pendingSubscription)
      });
    } catch (_error) {
      return res.json({
        status: "false",
        message: "Unable to load subscription details"
      });
    }
  })(req, res);
});

router.get('/subscriptions/usage/:userid', function (req, res) {
  passport.authenticate('jwt', { session: false }, async function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!driver) {
      return res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else if (String(driver._id) !== String(req.params.userid)) {
      return res.json({
        status: "false",
        message: 'Unauthorized access'
      });
    }

    try {
      const activeSubscription = await getCurrentDriverSubscription(driver._id, new Date());
      const usage = activeSubscription ? getSubscriptionUsageSnapshot(activeSubscription, new Date()) : null;
      return res.json({
        status: "true",
        current_subscription: buildDriverSubscriptionResponse(activeSubscription),
        usage: usage
      });
    } catch (_error) {
      return res.json({
        status: "false",
        message: "Unable to load subscription usage"
      });
    }
  })(req, res);
});

router.get('/subscriptions/remainingrides/:userid', function (req, res) {
  passport.authenticate('jwt', { session: false }, async function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!driver) {
      return res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else if (String(driver._id) !== String(req.params.userid)) {
      return res.json({
        status: "false",
        message: 'Unauthorized access'
      });
    }

    try {
      const activeSubscription = await getCurrentDriverSubscription(driver._id, new Date());
      const usage = activeSubscription ? getSubscriptionUsageSnapshot(activeSubscription, new Date()) : null;
      return res.json({
        status: "true",
        is_unlimited: usage ? usage.is_unlimited : false,
        rides_used_today: usage ? usage.rides_used_today : 0,
        daily_limit: usage ? usage.daily_limit : null,
        remaining_rides: usage ? usage.remaining_rides : null,
        reached_daily_limit: usage ? usage.reached_daily_limit : false,
        ride_credit_total: usage ? usage.ride_credit_total : null,
        ride_credits_remaining: usage ? usage.ride_credits_remaining : null,
        ride_credits_consumed: usage ? usage.ride_credits_consumed : 0,
        package_exhausted: usage ? usage.package_exhausted : false
      });
    } catch (_error) {
      return res.json({
        status: "false",
        message: "Unable to load remaining rides"
      });
    }
  })(req, res);
});

router.get('/subscriptions/history/:userid', function (req, res) {
  passport.authenticate('jwt', { session: false }, async function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!driver) {
      return res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else if (String(driver._id) !== String(req.params.userid)) {
      return res.json({
        status: "false",
        message: 'Unauthorized access'
      });
    }

    try {
      await expireDriverSubscriptions(new Date());
      const subscriptions = await Subscription.find({
        customer_type: "DRIVER",
        driver_id: driver._id
      }).sort({ created_at: -1 }).limit(20).exec();

      return res.json({
        status: "true",
        result: (subscriptions || []).map(buildDriverSubscriptionResponse)
      });
    } catch (_error) {
      return res.json({
        status: "false",
        result: []
      });
    }
  })(req, res);
});

router.post('/subscriptions/initiate', function (req, res) {
  passport.authenticate('jwt', { session: false }, async function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    } else if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    } else if (!req.body.user_id || !req.body.plan_id) {
      return senderr(res);
    } else if (String(driver._id) !== String(req.body.user_id)) {
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
      await expireDriverSubscriptions(new Date());
      const plan = await SubscriptionPlan.findById(req.body.plan_id).exec();
      const validationMessage = validatePlanForPurchase(plan);
      if (validationMessage) {
        return res.json({
          status: "false",
          message: validationMessage
        });
      }

      const existingPendingSubscription = await Subscription.findOne({
        customer_type: "DRIVER",
        driver_id: driver._id,
        plan_id: plan._id,
        status: "PENDING_PAYMENT",
        payment_status: "PENDING"
      }).sort({ created_at: -1 }).exec();

      let subscription = existingPendingSubscription;
      if (!subscription) {
        subscription = new Subscription(buildPendingDriverSubscriptionRecord(driver._id, plan, new Date()));
        await subscription.save();
      }

      const transid = selcomService.generateTransId();
      const returnUrl = selcomService.buildReturnUrl(transid);
      const checkout = await selcomService.createOrder({
        transid: transid,
        amount: subscription.price_snapshot,
        user: driver,
        userId: req.body.user_id,
        returnUrl: returnUrl,
        remarks: "Shilota driver subscription payment"
      });

      const session = await SelcomPaymentSession.findOneAndUpdate(
        { transid: transid },
        {
          transid: transid,
          order_id: checkout.orderId,
          user_id: String(req.body.user_id),
          actor_type: DRIVER_SUBSCRIPTION_ACTOR_TYPE,
          amount: subscription.price_snapshot,
          status: "pending",
          purpose: "driver_subscription",
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
        result: buildDriverSubscriptionResponse(subscription)
      });
    } catch (error) {
      return res.json({
        status: "false",
        message: error && error.message ? error.message : "Unable to create subscription payment"
      });
    }
  })(req, res);
});

router.get('/subscriptions/verifyselcom/:transid', async function (req, res) {
  const transid = String(req.params.transid || "").trim();
  if (!transid) {
    return senderr(res);
  }

  try {
    const session = await SelcomPaymentSession.findOne({
      transid: transid,
      actor_type: DRIVER_SUBSCRIPTION_ACTOR_TYPE
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
          await finalizeSubscriptionSession(session, new Date());
        }
        return res.json({
          status: "false",
          message: verifyError && verifyError.message ? verifyError.message : "Payment is still pending"
        });
      }
    }

    const finalized = await finalizeSubscriptionSession(session, new Date());
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
        result: buildDriverSubscriptionResponse(finalized.subscription)
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

/* notifications */
router.get('/notifications/:userid', function (req, res) {
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
      Notifications.count({
        notify_to: req.params.userid
      }, function (err, count) {
        if (count > 0) {
          Notifications.find({
            notify_to: req.params.userid
          }).sort({
            '_id': -1
          }).
            exec(function (err, notifications) {
              if (!err) {
                res.json({
                  status: "true",
                  result: notifications
                });
              } else {
                res.json({
                  status: "false",
                  message: "Something went to be wrong"
                });
              }
            });
        } else {
          res.json({
            status: "false",
            message: 'No notifications found'
          });
        }
      });
    }
  })(req, res);
});

/* add & edit & delete edit emergency_contact */
router.post('/updateprofile', function (req, res) {
  if (!req.body.user_id) {
    res.json({
      status: "false",
      message: "Something went to be wrong"
    });
  } else {
    if (typeof req.body.emergency_contact != 'undefined') {
      req.body.emergency_contact = JSON.parse(req.body.emergency_contact);
    }
    Driver.findOneAndUpdate({
      _id: req.body.user_id
    }, {
      $set: req.body
    }).exec(function (err, driver) {
      if (err) {
        res.json({
          status: "false",
          message: "Something went to be wrong"
        });
      } else {
        let updatestring = {
          _id: req.body.user_id,
          payment_details: "Complete",
          vehicle_details: "Complete"
        };
        let querystring = {
          completionStatus: "1"
        };
        Driver.count(updatestring).
          exec(function (err, updatedcount) {
            if (updatedcount > 0) {
              Vehicles.findOneAndUpdate({
                "user_id": req.body.user_id
              }, {
                $set: querystring
              }).exec(function (err, vehicles) {
                if (err) {
                  senderr(res);
                } else {
                  cetsSyncService.enqueueDriverSync(req.body.user_id, "driver_profile_update").catch(function (syncError) {
                    console.error("CeTS driver profile enqueue failed:", syncError);
                  });
                  res.json({
                    status: "true",
                    message: 'User updated successfully'
                  });
                }
              });
            } else {
              res.json({
                status: "true",
                message: 'User updated successfully'
              });
            }
          });
      }
    });
  }
});

router.post('/active-radius/:userid', function (req, res) {
  passport.authenticate('jwt', { session: false }, async function (err, driver) {
    if (err || !driver || String(driver._id) !== String(req.params.userid)) {
      return res.status(401).json({ status: "false", message: "Unauthorized access" });
    }
    const radiusKm = normalizeActiveRadiusKm(req.body && req.body.active_radius_km);
    if (radiusKm === null) {
      return res.status(400).json({
        status: "false",
        message: "Active radius must be one of " + UAT_RADIUS_OPTIONS_KM.join(", ") + " km"
      });
    }
    try {
      const updated = await Driver.findByIdAndUpdate(driver._id, {
        $set: { active_radius_km: radiusKm }
      }, { new: true }).exec();
      return res.json({
        status: "true",
        active_radius_km: updated.active_radius_km,
        local_area_key: updated.local_area_key || ""
      });
    } catch (_error) {
      return res.status(500).json({ status: "false", message: "Unable to update active radius" });
    }
  })(req, res);
});

/* add & edit & delete edit emergency_contact */
router.post('/paymentinfo', function (req, res) {
  if (!req.body.user_id || !req.body.type) {
    res.json({
      status: "false",
      message: "Something went to be wrong"
    });
  } else {
    Driver.findOne({
      _id: req.body.user_id
    }, function (err, driver) {
      if (!driver) {
        res.json({
          status: "false",
          message: "Something went to be wrong"
        });
      }
      let pay = {};
      pay.status = "true";
      if (req.body.type == "cash") {
        pay.type = req.body.type;
      } else {
        pay.type = req.body.type;
        pay.routingno = req.body.routing_no; // ABA/Routing number of the receiving bank
        pay.bankaccountno = req.body.bank_ac; // Recipient's bank account number
        pay.name = req.body.name; // Recipient's name (as listed on the account)
        pay.address = req.body.address; //Recipient's address (as listed on the account)
      }
      driver.payment_account = pay;
      driver.payment_details = "Complete";
      driver.save(function (err) {
        let updatestring = {
          _id: req.body.user_id,
          payment_details: "Complete",
          vehicle_details: "Complete"
        };
        let querystring = {
          completionStatus: "1"
        };
        Driver.count(updatestring).
          exec(function (err, updatedcount) {
            if (updatedcount > 0) {
              Vehicles.findOneAndUpdate({
                "user_id": req.body.user_id
              }, {
                $set: querystring
              }).exec(function (err, vehicles) {
                if (err) {
                  senderr(res);
                } else {
                  res.json(pay);
                }
              });
            } else {
              res.json(pay);
            }
          });
      });
    });
  }
});

/* send driver payment details */
router.get('/paymentinfo/:userid', function (req, res) {
  if (!req.params.userid) {
    res.json({
      status: "false",
      message: "Something went to be wrong"
    });
  } else {
    Driver.findOne({
      _id: req.params.userid
    }, function (err, driver) {
      if (!driver) {
        res.json({
          status: "false",
          message: "Something went to be wrong"
        });
      } else {
        res.json(driver.payment_account);
      }
    });
  }
});

/* get a braintree client token for driver wallet topups */
router.post('/getclienttoken', function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, authenticatedDriver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!authenticatedDriver) {
      return res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else if (!req.body.user_id || String(authenticatedDriver._id) !== String(req.body.user_id)) {
      return res.json({
        status: "false",
        message: 'Unauthorized access'
      });
    }

    Driver.findOne({
      _id: req.body.user_id
    }, function (err, driver) {
      if (err || !driver) {
        return senderr(res);
      }

      Admin.findOne(function (adminErr, admin) {
        if (adminErr || !admin) {
          return senderr(res);
        }

        let gateway = braintree.connect({
          environment:
            admin.BraintreeStatus == "1" ? braintree.Environment.Production : braintree.Environment.Sandbox,
          merchantId: admin.merchandId,
          publicKey: admin.publicKey,
          privateKey: admin.privateKey
        });

        let generateToken = function (customerId) {
          let querystring = customerId ? { customerId: customerId } : {};
          gateway.clientToken.generate(querystring, function (tokenErr, response) {
            if (!tokenErr && response && response.success) {
              return res.json({
                status: "true",
                clientToken: response.clientToken
              });
            }

            return senderr(res);
          });
        };

        if (driver.customer_id) {
          return generateToken(driver.customer_id);
        }

        gateway.customer.create(
          {
            firstName: driver.full_name,
            email: driver.email,
            phone: driver.phone_number
          },
          function (customerErr, result) {
            if (customerErr || !result || !result.success) {
              return senderr(res);
            }

            driver.customer_id = result.customer.id;
            driver.save(function (saveErr) {
              if (saveErr) {
                return senderr(res);
              }

              return generateToken(result.customer.id);
            });
          }
        );
      });
    });
  })(req, res);
});

/* add money to driver wallet */
router.post('/addmoney', function (req, res) {
  passport.authenticate('jwt', { session: false }, async function (err, authenticatedDriver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!authenticatedDriver) {
      return res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else if (!req.body.user_id || !req.body.amount || !req.body.paynonce) {
      return senderr(res);
    } else if (String(authenticatedDriver._id) !== String(req.body.user_id)) {
      return res.json({
        status: "false",
        message: 'Unauthorized access'
      });
    }

    try {
      const admin = await Admin.findOne({}).sort({ _id: -1 }).exec();
      const driver = await Driver.findById(req.body.user_id).exec();
      if (!admin || !driver) {
        return senderr(res);
      }

      let gateway = braintree.connect({
        environment: admin.BraintreeStatus == "1" ? braintree.Environment.Production : braintree.Environment.Sandbox,
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
        async function (saleErr, result) {
          if (saleErr || !result || !result.success) {
            return senderr(res);
          }

          try {
            await new Wallet({
              user_id: String(req.body.user_id),
              amount: Number(result.transaction.amount),
              transaction_id: result.transaction.id,
              type: "credit",
              transaction: "addmoney",
              wallet_for: DRIVER_WALLET_TYPE,
              updated_at: timeZone()
            }).save();

            const updatedDriver = await Driver.findOneAndUpdate(
              { _id: req.body.user_id },
              {
                $inc: {
                  walletmoney: Number(result.transaction.amount)
                }
              },
              {
                new: true
              }
            ).exec();

            const walletamount = getDriverWalletAmount(updatedDriver);
            const translatedstring = translationServer.langTranslate("Amountcreditedtoyourwalletsuccessfully", "en");
            await pushDriverWalletNotification(req.body.user_id, walletamount, translatedstring);

            return res.json({
              status: "true",
              walletmoney: walletamount,
              message: "Amount credited to your wallet successfully"
            });
          } catch (_walletError) {
            return senderr(res);
          }
        }
      );
    } catch (_error) {
      return senderr(res);
    }
  })(req, res);
});

/* create selcom hosted checkout for driver wallet topups */
router.post('/getselcomurl', function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    } else if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    } else if (!req.body.user_id || !req.body.amount) {
      return senderr(res);
    } else if (String(driver._id) !== String(req.body.user_id)) {
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
        user: driver,
        userId: req.body.user_id,
        returnUrl: returnUrl,
        remarks: "Shilota driver wallet payment"
      });

      await SelcomPaymentSession.findOneAndUpdate(
        { transid: transid },
        {
          transid: transid,
          order_id: checkout.orderId,
          user_id: String(req.body.user_id),
          actor_type: DRIVER_WALLET_TYPE,
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
});

/* verify selcom transaction for driver wallet topups */
router.get('/verifyselcom/:transid', async function (req, res) {
  const transid = String(req.params.transid || "").trim();
  if (!transid) {
    return senderr(res);
  }

  try {
    const session = await SelcomPaymentSession.findOne({
      transid: transid,
      actor_type: DRIVER_WALLET_TYPE
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

/* finalize verified selcom driver wallet payment */
router.post('/paybyselcom', function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    } else if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    } else if (!req.body.user_id || !req.body.amount || !req.body.paynonce) {
      return senderr(res);
    } else if (String(driver._id) !== String(req.body.user_id)) {
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
        actor_type: DRIVER_WALLET_TYPE
      }).exec();

      if (!session) {
        return res.json({
          status: "false",
          message: "Payment session not found"
        });
      }

      if (session.consumed_at) {
        const currentDriver = await Driver.findById(req.body.user_id).exec();
        return res.json({
          status: "true",
          walletmoney: getDriverWalletAmount(currentDriver),
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

      await new Wallet({
        user_id: String(req.body.user_id),
        amount: amount,
        transaction_id: transid,
        type: "credit",
        transaction: "addmoney",
        wallet_for: DRIVER_WALLET_TYPE,
        updated_at: timeZone()
      }).save();

      const updatedDriver = await Driver.findOneAndUpdate(
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

      const walletamount = getDriverWalletAmount(updatedDriver);
      const translatedstring = translationServer.langTranslate("Amountcreditedtoyourwalletsuccessfully", "en");
      await pushDriverWalletNotification(req.body.user_id, walletamount, translatedstring);

      return res.json({
        status: "true",
        walletmoney: walletamount,
        message: "Amount credited to your wallet successfully"
      });
    } catch (error) {
      return res.json({
        status: "false",
        message: error && error.message ? error.message : "Unable to complete Selcom payment"
      });
    }
  })(req, res);
});

/* driver wallet history */
router.get('/wallethistory/:userid', function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!driver) {
      return res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else if (String(driver._id) !== String(req.params.userid)) {
      return res.json({
        status: "false",
        message: 'Unauthorized access'
      });
    }

    Wallet.count({
      user_id: req.params.userid,
      wallet_for: DRIVER_WALLET_TYPE
    }, function (countErr, count) {
      if (countErr) {
        return senderr(res);
      }

      if (count > 0) {
        Wallet.find({
          user_id: req.params.userid,
          wallet_for: DRIVER_WALLET_TYPE
        })
          .sort([["_id", -1]])
          .exec(function (walletErr, wallets) {
            if (!walletErr) {
              return res.json({
                status: "true",
                payment_list: wallets
              });
            }

            return res.json({
              status: "false",
              message: "No Wallet used"
            });
          });
      } else {
        return res.json({
          status: "false",
          message: "No Wallet used"
        });
      }
    });
  })(req, res);
});

/* dashboard for driver */
router.get('/dashboard/:userid', function (req, res) {
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
      if (!req.params.userid) {
        res.json({
          status: "false",
          message: "Something went to be wrong"
        });
      } else {
        let reportsummary = {};
        let ridebytoday = 0,
          ridebymonth = 0;
        let querystring = {
          driver_id: req.params.userid,
          ridestatus: "completed"
        };
        Rides.count(querystring, function (err, count) {
          let ridesstatscount = count;
          let total_earning = 0;
          /* today starts at */
          let start = new Date();
          start.setHours(0, 0, 0, 0);
          let todaystarts = start.toISOString();
          /* today ends at */
          let end = new Date();
          let thisyear = (new Date()).getFullYear();
          end.setHours(23, 59, 59, 999);
          let todayends = end.toISOString();
          let startmonth = new Date(start.getFullYear(), start.getMonth(), 1);
          let endmonth = new Date(start.getFullYear(), start.getMonth() + 1, 0);
          let monthstarts = startmonth.toISOString();
          let monthends = endmonth.toISOString();
          let settledamount = 0.0;
          if (count > 0) {
            Rides.find(querystring).
              exec(function (err, rides) {
                if (!err) {
                  reportsummary.available_amount = 0;
                  reportsummary.cash_collected = 0;
                  reportsummary.booking_count = ridesstatscount;
                  rides.forEach(function (ridesstats) {
                    let rideids = [ridesstats._id];
                    let tax = parseFloat(ridesstats.tax);
                    let baseprice = parseFloat(ridesstats.baseprice);
                    total_earning += tax + baseprice;
                  });
                  /* total earnings*/
                  reportsummary.total_earning = Math.round(total_earning * 100) / 100;
                  Rides.count({
                    created_at: {
                      $gte: todaystarts,
                      $lte: todayends,
                    },
                    driver_id: req.params.userid,
                    ridestatus: "completed"
                  }, function (err, ridetoday) {
                    if (ridetoday > 0) {
                      ridebytoday = ridetoday;
                    }
                    reportsummary.ride_today = ridebytoday;
                    Rides.count({
                      created_at: {
                        $gte: monthstarts,
                        $lte: monthends,
                      },
                      driver_id: req.params.userid,
                      ridestatus: "completed"
                    }, function (err, ridemonth) {
                      if (ridemonth > 0) {
                        ridebymonth = ridemonth;
                      }
                      reportsummary.ridebymonth = ridebymonth;
                      let query = Rides.aggregate([{
                        $match: {
                          driver_id: req.params.userid,
                          ridestatus: "completed"
                        }
                      },
                      {
                        "$project": {
                          "y": {
                            "$year": "$created_at"
                          },
                          "m": {
                            "$month": "$created_at"
                          },
                        }
                      },
                      {
                        "$group": {
                          "_id": {
                            "year": "$y",
                            "month": "$m",
                          },

                          count: {
                            "$sum": 1
                          }
                        }
                      },
                      {
                        $sort: {
                          "_id.year": 1,
                          "_id.month": 1,
                          "_id.day": 1
                        }
                      }
                      ]);

                      let paymentQuery = Payments.aggregate([{
                        $match: {
                          driver_id: req.params.userid,
                          payment_type: 'cash'
                        }
                      }, {
                        $group: {
                          _id: "null",
                          totalbaseprice: {
                            $sum: "$baseprice"
                          },
                          totalcommissionamount: {
                            $sum: "$commissionamount"
                          },
                          totaltax: {
                            $sum: "$tax"
                          }
                        }
                      },
                      {
                        $addFields: {
                          totalamount: {
                            $add: ["$totalbaseprice", "$totalcommissionamount", "$totaltax"]
                          }
                        }
                      }
                      ]);

                      let availableamoutQuery = Payments.aggregate([{
                        $match: {
                          driver_id: req.params.userid,
                          direct_to_driver: {
                            $ne: 1
                          }
                        }
                      }, {
                        $group: {
                          _id: "null",
                          totalbaseprice: {
                            $sum: "$baseprice"
                          },
                          totaltax: {
                            $sum: "$tax"
                          }
                        }
                      },
                      {
                        $addFields: {
                          totalsumamount: {
                            $add: ["$totalbaseprice", "$totaltax"]
                          }
                        }
                      }
                      ]);

                      let settlementQuery = Settlements.aggregate([{
                        $match: {
                          driver_id: req.params.userid,
                        }
                      }, {
                        $group: {
                          _id: "null",
                          totalearnings: {
                            $sum: "$total_earning"
                          },
                        }
                      },]);

                      query.exec(function (err, ridedetails) {
                        if (err) {
                          senderr(res);
                        } else {
                          let data = JSON.parse(JSON.stringify(ridedetails));
                          let latestridesbymonth = [];
                          for (let i = 0; i < data.length; i++) {
                            let ridemonth = JSON.parse(JSON.stringify(data[i]._id));
                            for (let key in ridemonth) {
                              if (key == 'month' && ridemonth["year"] == thisyear) {
                                latestridesbymonth.push({
                                  month: ridemonth["month"],
                                  count: data[i].count,
                                });
                              }
                            }
                          }
                          reportsummary.cumulative_report = latestridesbymonth;
                          Driver.findOne({
                            _id: req.params.userid
                          }, function (err, driver) {
                            if (!err) {
                              evaluateDriverEligibility(driver, {
                                now: new Date()
                              }).then(function (eligibility) {
                              return hasInProgressRide(driver._id).then(function (activeRide) {
                                if (!eligibility.eligible && !activeRide && String(driver.live_status) !== "0") {
                                  return applyPostRideAvailability(driver._id, {
                                    now: new Date()
                                  }).then(function () {
                                    driver.live_status = "0";
                                    return eligibility;
                                  });
                                }
                                return eligibility;
                              });
                              }).then(function (eligibility) {
                              reportsummary.livestatus = ((driver.live_status == '0') ? "false" : "true");
                              reportsummary.subscription_eligible = eligibility.eligible ? "true" : "false";
                              reportsummary.subscription_error_code = eligibility.code || "";
                              reportsummary.subscription_message = eligibility.message || "";
                              reportsummary.subscription_rides_used_today = eligibility.usage ? String(eligibility.usage.rides_used_today || 0) : "0";
                              reportsummary.subscription_daily_limit = eligibility.usage && eligibility.usage.daily_limit !== null
                                ? String(eligibility.usage.daily_limit)
                                : "";
                              reportsummary.subscription_remaining_rides = eligibility.usage && eligibility.usage.remaining_rides !== null
                                ? String(eligibility.usage.remaining_rides)
                                : "";
                              reportsummary.subscription_is_unlimited = eligibility.usage && eligibility.usage.is_unlimited ? "true" : "false";
                              reportsummary.subscription_reached_daily_limit = eligibility.usage && eligibility.usage.reached_daily_limit ? "true" : "false";
                              settlementQuery.exec(function (err, settlementdetails) {
                                //console.log(settlementdetails);
                                if (!err && settlementdetails.length > 0) {
                                  settledamount = settlementdetails[0].totalearnings;
                                }
                                availableamoutQuery.exec(function (err, availableamountdetails) {
                                  if (!err && availableamountdetails.length > 0) {
                                    let availamount = parseFloat(availableamountdetails[0].totalsumamount) - parseFloat(settledamount);
                                    reportsummary.available_amount = Math.round(availamount * 100) / 100;
                                  }
                                  paymentQuery.exec(function (err, paymentdetails) {
                                    if (!err && paymentdetails.length > 0) {
                                      reportsummary.cash_collected = Math.round(paymentdetails[0].totalamount * 100) / 100;
                                    }
                                    Reviews.count({
                                      driver_id: req.params.userid
                                    }, function (err, count) {
                                      if (count > 0) {
                                        reportsummary.rating = parseFloat(driver.rating / count).toFixed(1);
                                        res.json(reportsummary);
                                      } else {
                                        reportsummary.rating = "0";
                                        res.json(reportsummary);
                                      }
                                    });
                                  });
                                });
                              });
                              }).catch(function () {
                                senderr(res);
                              });
                            } else {
                              senderr(res);
                            }
                          });
                        }
                      });

                    });
                  });
                } else {
                  senderr(res);
                }
              });
          } else {
            Driver.findOne({
              _id: req.params.userid
            }, function (err, driver) {
              if (!err) {
                evaluateDriverEligibility(driver, {
                  now: new Date()
                }).then(function (eligibility) {
                  return hasInProgressRide(driver._id).then(function (activeRide) {
                    if (!eligibility.eligible && !activeRide && String(driver.live_status) !== "0") {
                      return applyPostRideAvailability(driver._id, {
                        now: new Date()
                      }).then(function () {
                        driver.live_status = "0";
                        return eligibility;
                      });
                    }
                    return eligibility;
                  });
                }).then(function (eligibility) {
                  let noreportedsummary = {
                    status: "true",
                    available_amount: 0,
                    cash_collected: 0,
                    total_earning: 0,
                    ride_today: 0,
                    ridebymonth: 0,
                    rating: "0",
                    booking_count: 0,
                    livestatus: ((driver.live_status == '0') ? "false" : "true"),
                    subscription_eligible: eligibility.eligible ? "true" : "false",
                    subscription_error_code: eligibility.code || "",
                    subscription_message: eligibility.message || "",
                    subscription_rides_used_today: eligibility.usage ? String(eligibility.usage.rides_used_today || 0) : "0",
                    subscription_daily_limit: eligibility.usage && eligibility.usage.daily_limit !== null
                      ? String(eligibility.usage.daily_limit)
                      : "",
                    subscription_remaining_rides: eligibility.usage && eligibility.usage.remaining_rides !== null
                      ? String(eligibility.usage.remaining_rides)
                      : "",
                    subscription_is_unlimited: eligibility.usage && eligibility.usage.is_unlimited ? "true" : "false",
                    subscription_reached_daily_limit: eligibility.usage && eligibility.usage.reached_daily_limit ? "true" : "false",
                    cumulative_report: []
                  };
                  res.json(noreportedsummary);
                }).catch(function () {
                  senderr(res);
                });
              } else {
                senderr(res);
              }
            });
          }
        });
      }
    }
  })(req, res);
});

/* upload user image */
router.post('/uploadimage', function (req, res) {
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
      if (!req.body.user_id || !req.body.profileimage) {
        res.json({
          status: "false",
          message: "Something went to be wrong"
        });
      } else {
        let base64Data = req.body.profileimage;
        let imagename = Date.now() + '.jpeg';
        fs.writeFile(driverassets + imagename, base64Data, 'base64', function (err) {
          if (err) {
            res.json({
              status: "false",
              message: "Something went to be wrong"
            });
          } else {
            Driver.findOne({
              _id: req.body.user_id
            }, function (err, driver) {
              if (driver && typeof driver.profile_image != 'undefined') {
                fs.unlink(driverassets + driver.profile_image, function (error) {
                  if (error) {
                    res.json({
                      status: "false",
                      message: "Something went to be wrong"
                    });
                  }
                });
              }
              driver.profile_image = imagename;
              driver.save();
              res.json({
                status: "true",
                message: 'Image uploaded successfully'
              });
            });
          }

        });
      }
    }
  })(req, res);
});

/* upload user image */
/* upload user profile image */
let storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, driverassets)
  },
  filename: function (req, file, callback) {
    crypto.pseudoRandomBytes(16, function (err, raw) {
      if (err) return callback(err);
      callback(null, raw.toString('hex') + path.extname(file.originalname));
    });
  }
})

router.post('/uploadprofileimage', function (req, res) {
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
      let upload = multer({
        storage: storage,
        fileFilter: function (req, file, callback) {
          let ext = path.extname(file.originalname)
          if (ext !== '.png' && ext !== '.jpg' && ext !== '.jpeg') {
            return callback(res.end('Only images are allowed'), null)
          }
          callback(null, true)
        }
      }).single('driverImage');
      upload(req, res, function (err) {
        Driver.findOne({
          _id: req.body.user_id
        }, function (err, driver) {
          /* if (driver && typeof driver.profile_image != 'undefined') {
            fs.unlink(driverassets + driver.profile_image, function (error) {
              if (error) {
                senderr(res);
              }
            });
          } */
          driver.profile_image = res.req.file.filename;
          driver.save();
          res.json({
            status: "true",
            user_image: base_url + '/api/gallery/drivers/' + res.req.file.filename,
            message: 'Image uploaded successfully'
          });
        });
      })
    }
  })(req, res);
});

/* upload user documents */
router.post('/uploaddoc', function (req, res) {

  const allowedDocFields = {
    insurancedoc: "insurancedoc",
    licensedoc: "licensedoc",
    bookdoc: "bookdoc"
  };
  let upload = multer({
    storage: storage,
    fileFilter: function (req, file, callback) {
      let ext = path.extname(file.originalname).toLowerCase()
      if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.pdf') {
        return callback(new Error('Only images & pdf are allowed'))
      }
      callback(null, true)
    }
  }).single('uploaddoc');
  upload(req, res, function (err) {
    if (err) {
      return res.json({
        status: "false",
        message: err.message || "Document upload failed"
      });
    }
    if (!req.file) {
      return res.json({
        status: "false",
        message: "Document file is required"
      });
    }
    if (!req.body.user_id || !allowedDocFields[req.body.uploaddocfor]) {
      return res.json({
        status: "false",
        message: "Invalid upload request"
      });
    }

    let docField = allowedDocFields[req.body.uploaddocfor];
    let result = {};
    result[docField] = req.file.filename;

    Vehicles.findOne({
      user_id: req.body.user_id
    }, function (err, vehicles) {
      if (err) {
        return res.json({
          status: "false",
          message: "Something went to be wrong"
        });
      }
      if (!vehicles) {
        return res.json({
          status: "false",
          message: "Vehicle details not found"
        });
      }

      let colname = vehicles[docField];
      if (colname) {
        fs.unlink(driverassets + colname, function (error) {
          if (error) {
            console.log(error);
          }
        });
      }
      Vehicles.findOneAndUpdate({
        "user_id": req.body.user_id
      }, {
        $set: result
      }, {
        new: true
      }).exec(function (err, vehicles) {
        if (err) {
          res.json({
            status: "false",
            message: "Something went to be wrong12"
          });
        } else if (!vehicles) {
          res.json({
            status: "false",
            message: "Vehicle details not found"
          });
        } else {
          syncVehicleDetailsStatus(req.body.user_id, vehicles)
            .then(function (completionStatus) {
              res.json({
                status: "true",
                vehicle_details: completionStatus,
                message: 'Image uploaded successfully'
              });
            })
            .catch(function () {
              senderr(res);
            });
        }
      });
    });
  });
});

/* driver online or offline */
router.post('/liveme', function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      res.json({
        status: "error",
        message: 'Account has been deleted successfully',
        deleted_type:"driver"
      });
    } else if (!driver) {
      res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else {
      if (!req.body.user_id || !req.body.status) {
        senderr(res);
      } else if (String(driver._id) !== String(req.body.user_id)) {
        return res.json({
          status: "error",
          message: "Unauthorized access"
        });
      } else {
        Driver.findOne({
          _id: req.body.user_id
        }, function (err, driverRecord) {
          if (!driverRecord) {
            senderr(res);
          } else {
            if (req.body.status == 'online') {
              evaluateDriverActionEligibility(driverRecord, {
                now: new Date()
              }).then(function (eligibility) {
                if (!eligibility.eligible) {
                  return res.json(buildEligibilityErrorPayload(eligibility));
                }
                if (driverRecord.live_status != '2') {
                  driverRecord.live_status = "1";
                  driverRecord.save(function () {
                    res.json({
                      status: "true",
                      message: 'Driver is ' + req.body.status
                    });
                  });
                } else {
                  res.json({
                    status: "false",
                    message: 'You are on ride'
                  });
                }
              }).catch(function () {
                senderr(res);
              });
              return;
            }

            if (driverRecord.live_status != '2') {
              let liveme = "0";
              driverRecord.live_status = liveme;
              driverRecord.save(function (err) {
                res.json({
                  status: "true",
                  message: 'Driver is ' + req.body.status
                });
              });
            } else {
              res.json({
                status: "false",
                message: 'You are on ride'
              });
            }

          }
        });
      }
    }
  })(req, res);
});

/* online driver instant status */
router.post('/whereiam', function (req, res) {
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
      let translatedstring = "";
      if (!req.body.user_id || !req.body.onride_id || !req.body.status) {
        senderr(res);
      } else if (String(driver._id) !== String(req.body.user_id)) {
        return res.json({
          status: "error",
          message: "Unauthorized access"
        });
      } else {
        let query;
        let timestamp = timeZone();
        const requestedStatus = String(req.body.status || "").toLowerCase();
        const requiredCurrentStatus = requiredCurrentStatusForDriverTransition(requestedStatus);
        if (!requiredCurrentStatus) {
          return res.json({
            status: "false",
            error_code: "INVALID_RIDE_TRANSITION",
            message: "This ride cannot be moved to the requested status"
          });
        }
        if (requestedStatus === "onride" && !req.body.onride_otp) {
          return res.json({
            status: "false",
            error_code: "OTP_REQUIRED",
            message: "OTP verification failed."
          });
        }
        if (requestedStatus === "onride") {
          query = Rides.findOne({
            _id: req.body.onride_id,
            driver_id: driver._id,
            ridestatus: requiredCurrentStatus,
            onride_otp: req.body.onride_otp
          });
          //let querystring = [{ ridestatus: 'ontheway' }];
          //querystring = [{ ridestatus: 'ontheway' }, { ridestatus: 'onride' }];
          ridequery = Rides.find({
            driver_id: req.body.user_id
          }).or({
            ridestatus: 'ontheway'
          }).or({
            ridestatus: 'onride'
          });
          ridequery.exec(function (err, rides) {
            rides.forEach(function (rec) {
              if (rec._id != req.body.onride_id) {
                rec.ridestatus = 'cancelled';
                rec.save();
              }
            });
          });
        } else {
          query = Rides.findOne({
            _id: req.body.onride_id,
            driver_id: driver._id,
            ridestatus: requiredCurrentStatus
          });
        }
        const proceedWithRideStatusChange = function () {
          query.exec(function (err, rides) {
          if (!rides) {
            res.json({
              status: "false",
              message: "OTP verification failed."
            });
          } else {
            console.log("Where iam api is calling");
            console.log("instantstatus_req.body.status"+req.body.status);
            rides.ridestatus = req.body.status;
            rides.ridestatusat = timestamp;
            if (req.body.status == "onride" && !rides.ride_started_at) {
              rides.ride_started_at = new Date();
            }
            rides.save(function (err) {
              Driver.findOne({
                _id: req.body.user_id
              }, function (err, driver) {
                driver.live_status = "2";
                driver.save();
                
                
                if (req.body.status == "ontheway") {
                  NotifyDevices.findOne({
                    user_id: rides.user_id
                  }, function (err, userdevices) {
                    if (userdevices) {
                      let lang = userdevices.lang_type;
                      
                      translatedstring = translationServer.langTranslate("Yourdriverisarrivingnow", lang);
                      let userids = [rides.user_id];
                      let message = translatedstring;
                      let data = {
                        "ride_id": rides._id,
                        "type": "ontheway",
                        "message": message
                      };
                      userNotific(userids, message, data);
                    }
                  });
                }
                
               
                if (req.body.status == "onride") {
                
                NotifyDevices.findOne({
                    user_id: rides.user_id
                  }, function (err, userdevices) {
                    console.log(userdevices);
                     if (userdevices) {
                    let lang = userdevices.lang_type;
                    
                  //translatedstring = translationServer.langTranslate("Yourdriverisarrivingnow",lang);
                          
                             
                                 let userids = [rides.user_id];
                                let message = "Your ride started";
                                let data = {
                                  "ride_id": rides._id,
                                  "type": "onride",
                                  "message": message
                                };
                                userNotific(userids, message, data);
                    } 

                  });
               
              }
                res.json({
                  status: "true",
                  message: "Status changed successfully"
                });
              });
            });
          }
          });
        };

        evaluateDriverActionEligibility(driver, {
          now: new Date(),
          allowActiveRideContinuation: true,
          rideId: req.body.onride_id
        }).then(function (eligibility) {
          if (!eligibility.eligible) {
            return res.json(buildEligibilityErrorPayload(eligibility));
          }
          proceedWithRideStatusChange();
        }).catch(function () {
          senderr(res);
        });
      }
    }
  })(req, res);
});

/* driver accept status */
router.post('/goride', function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } 
    else if (!driver) {
      res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } 
    else {
      if (!req.body.user_id || !req.body.onride_id) {
        senderr(res);
      } else if (String(driver._id) !== String(req.body.user_id)) {
        res.json({
          status: "error",
          message: "Unauthorized access"
        });
      } else {
        evaluateDriverActionEligibility(driver, {
          now: new Date()
        }).then(function (eligibility) {
          if (!eligibility.eligible) {
            return res.json(buildEligibilityErrorPayload(eligibility));
          }

          let querystring = {
            _id: req.body.onride_id
          };
          Rides.findOne(querystring).populate('user_id').
            exec(function (err, rides) {
              if (!rides) {
                senderr(res);
              } else {
                let rideresult = {};
	                console.log("goride_rides.ridestatus" + rides.ridestatus);

	                if (isDriverOfferRide(rides) && isDriverPricingEnabled()) {
	                  return res.json({
	                    status: "false",
	                    message: "Submit a driver offer for this trip instead of directly accepting it",
	                    error_code: "DRIVER_OFFER_REQUIRED"
	                  });
	                }

                    if (isPassengerBroadcastRide(rides)) {
                      return res.json({
                        status: "false",
                        message: "Accept the passenger's price through the offer flow",
                        error_code: "PASSENGER_PRICE_ACCEPTANCE_REQUIRED"
                      });
                    }

	                if (rides.ridestatus == "requested" || rides.ridestatus == "scheduled" || rides.ridestatus == "ridenotaccepted" || rides.ridestatus == "scheduleridenotaccepted") {
                  validateDriverCanAcceptRide(driver._id, rides, function (canAccept) {
                    if (!canAccept) {
                      return res.json({
                        status: "false",
                        message: "This ride is no longer available near you."
                      });
                    }
                    rides.ridestatus = "accepted";
                    console.log("gorideddddd---------" + rides);

                    rides.driver_id = req.body.user_id;
                    Vehicles.findOne({
                      user_id: rides.driver_id
                    }).exec(function (err, vehicles) {
                      if (!vehicles) {
                        senderr(res);
                      } else {
                        rides.vehicle_no = vehicles.vehicle_number;
                        rides.save(function (err) {
                          if (err) {
                            senderr(res);
                          } else {
                            Driver.findOne({
                              _id: req.body.user_id
                            }, function (err, driver) {
                              if (!err) {
                                driver.live_status = "2";
                                driver.save();

                                NotifyDevices.findOne({
                                  user_id: rides.user_id._id
                                }, function (err, userdevices) {

                                  console.log("userdevices--------" + userdevices);
                                  if (userdevices) {
                                    let lang = userdevices.lang_type;


                                    let userids = [rides.user_id._id];
                                    let message = "Your ride has been accepted";
                                    let data = {
                                      "ride_id": rides._id,
                                      "type": "accepted",
                                      "message": "Your ride has been accepted"
                                    };
                                    userNotific(userids, message, data);
                                  }

                                });

                                rideresult.status = "true";
                                rideresult.user_id = rides.user_id._id;
                                rideresult.rideuserid = rides.user_id._id;
                                rideresult.user_name = rides.user_id.full_name;
                                rideresult.onride_otp = rides.onride_otp;
                                rideresult.pickup_location = rides.pickup_location;
                                rideresult.pickup_lat = rides.pickup_lat;
                                rideresult.pickup_lng = rides.pickup_lng;
                                rideresult.drop_location = rides.drop_location;
                                rideresult.drop_lat = rides.drop_lat;
                                rideresult.drop_lng = rides.drop_lng;
                                rideresult.from = "accepted";
                                rideresult.service_type = rides.service_type || "ride";
                                rideresult.ride_stops = JSON.stringify(rides.ride_stops || []);
                                rideresult.vehicle_no = rides.vehicle_no;
                                res.json(rideresult);
                              } else {
                                senderr(res);
                              }

                            });

                          }
                        });
                      }
                    });
                  });
                } else {
                  res.json({
                    status: "false",
                    message: "This ride is unavailable now. Kindly look for another one."
                  });
                }
              }
            });
        }).catch(function () {
          senderr(res);
        });
      }
    }
	})(req, res);
});

router.post("/rideoffers/submit", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (!req.body.user_id || !req.body.onride_id || typeof req.body.offered_price === "undefined") {
      return senderr(res);
    }
    if (String(driver._id) !== String(req.body.user_id)) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    submitRideOffer({
      rideId: req.body.onride_id,
      driverId: req.body.user_id,
      offeredPrice: req.body.offered_price,
      currency: req.body.currency || "TZS",
      offerType: req.body.offer_type || "",
      estimatedArrivalMinutes: req.body.estimated_arrival_minutes,
      message: req.body.message || "",
      now: new Date()
    }).then(function (result) {
      if (!result.ok) {
        return res.json({
          status: "false",
          message: result.message,
          error_code: result.code
        });
      }

      NotifyDevices.findOne({
        user_id: result.ride.user_id
      }, function (_notifyErr, userdevices) {
        const acceptedPassengerPrice = result.autoAccepted === true;
        const message = acceptedPassengerPrice
          ? "A driver accepted your price"
          : result.action === "updated"
            ? "A driver updated an offer for your trip"
            : "A driver sent an offer for your trip";
        const data = {
          ride_id: String(result.ride._id),
          type: acceptedPassengerPrice
            ? "acceptride"
            : result.action === "updated" ? "offer_updated" : "offer_created",
          message: message,
          offer_id: String(result.offer.id),
          offer_type: String(result.offer.offer_type || "DRIVER_DIRECT_OFFER"),
          offered_price: String(result.offer.offered_price),
          currency: result.offer.currency,
          driver_id: String(result.offer.driver_id)
        };
        if (userdevices) {
          userNotific([result.ride.user_id], message, data);
        }
        socketRegistry.emitToUser(String(result.ride.user_id), "ride-offer", data);
      });

      return res.json({
        status: "true",
        message: result.autoAccepted === true
          ? "Passenger price accepted and ride assigned"
          : result.action === "updated" ? "Ride offer updated" : "Ride offer submitted",
        offer: result.offer,
        ride_status: result.ride.ridestatus,
        assigned: result.autoAccepted === true ? "true" : "false"
      });
    }).catch(function () {
      senderr(res);
    });
  })(req, res);
});

router.post("/rideoffers/withdraw", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (!req.body.user_id || (!req.body.onride_id && !req.body.offer_id)) {
      return senderr(res);
    }
    if (String(driver._id) !== String(req.body.user_id)) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    withdrawRideOffer({
      rideId: req.body.onride_id,
      offerId: req.body.offer_id,
      driverId: req.body.user_id
    }).then(function (result) {
      if (!result.ok) {
        return res.json({
          status: "false",
          message: result.message,
          error_code: result.code
        });
      }

      Rides.findById(result.offer.ride_request_id).exec(function (_rideErr, ride) {
        if (ride) {
          const message = "A driver withdrew an offer for your trip";
          const data = {
            ride_id: String(ride._id),
            type: "offer_withdrawn",
            message: message,
            offer_id: String(result.offer.id),
            driver_id: String(result.offer.driver_id)
          };
          userNotific([ride.user_id], message, data);
          socketRegistry.emitToUser(String(ride.user_id), "ride-offer-withdrawn", data);
        }
      });

      return res.json({
        status: "true",
        message: "Ride offer withdrawn",
        offer: result.offer
      });
    }).catch(function () {
      senderr(res);
    });
  })(req, res);
});

router.get("/rideoffers/:rideid/:userid", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (String(driver._id) !== String(req.params.userid)) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    getDriverOfferForRide(req.params.rideid, req.params.userid, new Date())
      .then(function (offer) {
        return res.json({
          status: "true",
          offer: offer
        });
      })
      .catch(function () {
        senderr(res);
      });
  })(req, res);
});

/* ride marked completed by driver */
router.post('/completeride', function (req, res) {
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
      if (!req.body.user_id || !req.body.onride_id || !req.body.distance) {
        
        senderr(res);
      } else {
        let querystring = {
          _id: req.body.onride_id
        };
        let timestamp = timeZone();
        let requestDistance = parseFloat(req.body.distance);
        if (!Number.isFinite(requestDistance) || requestDistance <= 0) {
          requestDistance = 1;
        }
        let distance = Math.max(requestDistance, 1).toFixed(2);
        Rides.findOne(querystring).populate('user_id').populate('category_id').
          exec({
            _id: req.body.onride_id
          }, function (err, rides) {
            if (!rides) {
              
              senderr(res);
            } else {
              if (String(rides.driver_id) !== String(driver._id)) {
                return res.json({
                  status: "false",
                  message: "Unauthorized access"
                });
              }
              Admin.findOne(function (err, admin) {
                if (rides.ridestatus === "completed") {
                  consumeCompletedRideUsage({
                    rideId: rides._id,
                    driverId: rides.driver_id,
                    now: new Date()
                  }).then(function () {
                    return applyPostRideAvailability(rides.driver_id, {
                      now: new Date()
                    });
                  }).then(function () {
                    clearOtherActiveRidesForRider(rides.user_id && rides.user_id._id ? rides.user_id._id : rides.user_id, rides._id);
                    return res.json({
                      status: "true",
                      type: rides.payment_type,
                      message: 'Your Ride has been marked as completed'
                    });
                  }).catch(function () {
                    senderr(res);
                  });
                  return;
                }

                if (rides.ridestatus !== "onride") {
                  return res.json({
                    status: "false",
                    error_code: "INVALID_RIDE_TRANSITION",
                    message: "Only an in-progress ride can be completed"
                  });
                }

                if (rides.ridestatus !== "cancelled") {
                  rides.ridestatus = "completed";
                  rides.ridestatusat = timestamp;
                  rides.ride_completed_at = new Date();
                  rides.ridedistance = distance;
                  let distbycat = [];
                  distbycat[rides.category_id._id] = distance;
	                  let fareamount = totalFare(rides.category_id, distbycat, admin.maxDistance);
	                  if (isDriverOfferRide(rides) && Number.isFinite(Number(rides.final_agreed_price))) {
	                    fareamount = Number(rides.final_agreed_price);
	                  }
                  applyRideCompletionFinancials({
                    ride: rides,
                    baseFare: fareamount,
                    taxRate: admin.tax,
                    commissionBands: [],
                    commissionEnabled: isCommissionEnabled(),
                    roundCustomerPayableAmount: roundCustomerPayableAmount
                  });
                  // save the driver details
                  rides.save(function (err) {
                    if (err) {
                      senderr(res);
                    } else {
                      consumeCompletedRideUsage({
                        rideId: rides._id,
                        driverId: rides.driver_id,
                        now: new Date()
                      }).then(function () {
                        return applyPostRideAvailability(rides.driver_id, {
                          now: new Date()
                        });
                      }).then(function () {
                          clearOtherActiveRidesForRider(rides.user_id && rides.user_id._id ? rides.user_id._id : rides.user_id, rides._id);
                          /* let notifications = {
                            user_id: req.body.user_id, notify_to: rides.user_id._id, title: "Ride Completed",
                            message: "Your Ride has been completed."
                          };
                          notifyTo(notifications); */
                          Commissions.find().exec(function (commissionErr, results) {
                            if (commissionErr) {
                              return senderr(res);
                            }

                            applyRideCompletionFinancials({
                              ride: rides,
                              baseFare: rides.total,
                              taxRate: admin.tax,
                              commissionBands: results,
                              commissionEnabled: isCommissionEnabled(),
                              roundCustomerPayableAmount: roundCustomerPayableAmount
                            });

                            rides.save(function (rideSaveError) {
                              if (rideSaveError) {
                                console.error("Unable to persist final ride totals for CeTS sync:", rideSaveError);
                                return senderr(res);
                              }

                              cetsSyncService.enqueueTripSync(rides._id, "ride_completed").catch(function (syncError) {
                                console.error("CeTS trip enqueue failed:", syncError);
                              });

                              NotifyDevices.findOne({
                                user_id: rides.user_id._id
                              }, function (err, userdevices) {
                                if (userdevices) {
                                  let userids = [rides.user_id._id];
                                  let message = "Your ride has been completed";
                                  let data = {
                                    "ride_id": rides._id,
                                    "type": "completed",
                                    "message": "Your ride has been completed"
                                  };
                                  userNotific(userids, message, data);
                                }
                              });

                              res.json({
                                status: "true",
                                type: rides.payment_type,
                                message: 'Your Ride has been marked as completed'
                              });
                            });
                          });
                      }).catch(function () {
                        senderr(res);
                      });

                    }
                  });
                } else {
                  
                  senderr(res);
                }
              });
            }
          });
      }
    }
  })(req, res);
});

/* complete ride details */
router.post('/completeridedetails', function (req, res) {
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
      if (!req.body.user_id || !req.body.onride_id) {
        senderr(res);
      } else {
        let querystring = {
          _id: req.body.onride_id,
          ridestatus: "completed"
        };
        let rideresult = {};
        Rides.count(querystring, function (err, count) {
          if (count > 0) {
            Rides.findOne(querystring).populate('payment_id').populate('driver_id').populate('user_id').populate('category_id').
              exec(function (err, rides) {
                if (!err) {
                  rideresult.status = "true";
                  let profile_image = rides.category_id.image;
                  if (typeof profile_image == 'undefined') {
                    let profile_image = 'category.png';
                  }
                  rideresult.category_image = base_url + '/imagegallery/' + profile_image;
                  rideresult.category_name = rides.category_id.category_name;
                  rideresult.username = rides.user_id.full_name;
	                  rideresult.user_image = base_url + '/api/gallery/users/' + rides.user_id.profile_image;
                  rideresult.driver_id = rides.driver_id._id;
                  rideresult.pickup_location = rides.pickup_location;
                  rideresult.pickup_lat = rides.pickup_lat;
                  rideresult.pickup_lng = rides.pickup_lng;
                  rideresult.drop_location = rides.drop_location;
                  rideresult.drop_lat = rides.drop_lat;
                  rideresult.drop_lng = rides.drop_lng;
                  rideresult.driver_name = rides.driver_id.full_name;
	                  rideresult.driver_image = base_url + '/api/gallery/drivers/' + rides.driver_id.profile_image;
	                  rideresult.ride_fare = getRideFinalAmount(rides, roundCustomerPayableAmount);
                  rideresult.basefare = rides.total;
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
});

/* user review a ride */
router.post('/ridedetails', function (req, res) {
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
            Rides.findOne(querystring).populate('category_id').populate('user_id').
              exec(function (err, rides) {
                if (!err && rides) {
                  rideresult.status = "true";
                  rideresult.user_name = rides.user_id && rides.user_id.full_name ? rides.user_id.full_name : "";
                  rideresult.category_name = rides.category_id && rides.category_id.category_name ? rides.category_id.category_name : "";
                  let profile_image = rides.category_id && rides.category_id.image ? rides.category_id.image : "category.png";
                  if (typeof profile_image == 'undefined') {
                    profile_image = 'category.png';
                  }
                  let categoryimage = base_url + '/imagegallery/' + profile_image;
                  rideresult.category_image = categoryimage;
                  rideresult.pickup_location = rides.pickup_location;
                  rideresult.pickup_lat = rides.pickup_lat;
                  rideresult.pickup_lng = rides.pickup_lng;
                  rideresult.drop_location = rides.drop_location;
                  rideresult.drop_lat = rides.drop_lat;
                  rideresult.drop_lng = rides.drop_lng;
                  rideresult.ride_stops = JSON.stringify(rides.ride_stops || []);
                  rideresult.onride_otp = rides.onride_otp;
                  rideresult.approx_price = rides.baseprice;
                  res.json(rideresult);
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
});

/* user's rides (or) booking history */
router.post('/ridehistory', function (req, res) {
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
      if (!req.body.user_id || !req.body.type) {
        senderr(res);
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
        let rideresult = [],
          taxprice, statustime, vehicle_no;
        if (req.body.type == "passed") {
          querystring = [{
            ridestatus: 'cancelled'
          }, {
            ridestatus: 'completed'
          }];
        }
        Rides.find({
          driver_id: req.body.user_id
        }).or(querystring).populate('category_id').sort({
          '_id': -1
        }).
	          exec(function (err, rides) {
	            if (!err) {
	              if (rides.length == '0') {
	                res.json({
	                  status: "false",
	                  message: 'No rides found'
	                });
	              } else {
	                rides.forEach(function (c) {
	                  if (typeof c.tax == "undefined" || c.tax == null) {
	                    taxprice = 0;
	                  } else {
	                    taxprice = Math.round(c.tax * 100) / 100;
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
	                  let profile_image = c.category_id && c.category_id.image ? c.category_id.image : "category.png";
	                  if (typeof profile_image == 'undefined') {
	                    profile_image = 'category.png';
	                  }
	                  let categoryimage = base_url + '/imagegallery/' + profile_image;
	                  let rideTotal = getRideFinalAmount(c, roundCustomerPayableAmount);
	                  rideresult.push({
	                    onride_id: c._id,
	                    category_image: categoryimage,
	                    category_name: c.category_id && c.category_id.category_name ? c.category_id.category_name : "",
	                    ride_status: c.ridestatus,
	                    total_price: rideTotal,
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
});

/* cancel a ride */
router.post('/cancelride', function (req, res) {
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
      if (!req.body.onride_id) {
        return senderr(res);
      } else {
        Rides.findOneAndUpdate({
          _id: req.body.onride_id,
          driver_id: String(driver._id),
          ridestatus: { $in: ["accepted", "ontheway"] }
        }, {
          "$set": {
            ridestatus: "cancelled",
            ridestatusat: timeZone(),
            ride_cancelled_at: new Date(),
            cancelled_by: "driver",
            cancellation_reason: String(req.body.reason || "Driver could not continue the ride")
          }
        }, { new: true }).exec(function (err, ride) {
          if (err) {
            return senderr(res);
          } else if (!ride) {
            return res.json({
              status: "false",
              message: "This ride cannot be cancelled by the driver in its current state"
            });
          } else {
            const message = "Your ride has been cancelled by the driver";
            const data = {
              ride_id: String(ride._id),
              type: "cancelride",
              cancelled_by: "driver",
              message: message
            };
            userNotific([ride.user_id], message, data);
            socketRegistry.emitToUser(String(ride.user_id), "ride-cancelled", data);
            applyPostRideAvailability(driver._id, { now: new Date() }).catch(function () {});
            return res.json({
              status: "true",
              message: 'Your ride has been cancelled'
            });
          }
        });
      }
    }
  })(req, res);
});

/* pay by cash or wallet */
router.post('/paybycash', function (req, res) {
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
      let translatedstring = "";
      if (!req.body.user_id || !req.body.amount || !req.body.onride_id || !req.body.iswallet || !req.body.rideuserid) {
        senderr(res);
      } else {
        completeRideForPayment(req.body.onride_id, req.body.user_id, function (completeErr) {
          if (completeErr) {
            return senderr(res);
          }

          let paidby = "cash";
          if (req.body.amount == 0) {
            paidby = "wallet";
          }
          Payments.count({
            onride_id: req.body.onride_id
          }, function (err, count) {
            if (count > 0) {
              res.json({
                status: "true",
                message: 'Payment has been done successfully'
              });
            } else {
              Rides.findOne({
                _id: req.body.onride_id,
                driver_id: req.body.user_id
              }).exec(function (rideErr, ride) {
                if (rideErr || !ride) {
                  return senderr(res);
                }

                let paidAt = new Date();
                let payObject = buildPaymentDocument({
                  ride: ride,
                  userId: req.body.rideuserid,
                  driverId: req.body.user_id,
                  paymentType: paidby,
                  paidByWallet: req.body.iswallet == "1" ? Number(req.body.walletamount || 0) : 0,
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
                    user_id: req.body.rideuserid,
                    onride_id: req.body.onride_id,
                    amount: req.body.walletamount,
                    type: "debit",
                    transaction: "payride",
                    updated_at: timeZone()
                  };
                  let newWallet = new Wallet(paywalletObject);
                  newWallet.save(function (err) {
                    if (!err) {
                      User.findOneAndUpdate({
                        "_id": req.body.rideuserid
                      }, {
                        "$inc": {
                          "walletmoney": -req.body.walletamount
                        }
                      }, {
                        new: true
                      }, function (err, doc) {
                        if (!err) {
                          let walletamount;
                          if (typeof doc.walletmoney != 'undefined') {
                            walletamount = Math.round(doc.walletmoney * 100) / 100;
                          } else {
                            walletamount = 0;
                          }
                          let message = "Payment has been done successfully";
                          let notifications = {
                            user_id: "0",
                            notify_to: req.body.rideuserid,
                            title: "Payment Completed",
                            message: message
                          };
                          notifyTo(notifications);
                          Rides.findOne({
                            _id: req.body.onride_id
                          }, function (err, rides) {
                            if (!rides) {
                              senderr(res);
                            } else {
                              let userids = [req.body.rideuserid];
                              let driverids = [rides.driver_id];
                              let drivernotifications = {
                                user_id: "0",
                                notify_to: rides.driver_id,
                                title: "Payment Completed",
                                message: message
                              };
                              notifyTo(drivernotifications);
                              NotifyDevices.findOne({
                                user_id: req.body.rideuserid
                              }, function (err, userdevices) {
                                if (userdevices) {
                                  let lang = userdevices.lang_type;
                                  
                                  let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                                  let data = {
                                    "type": "payment",
                                    "message": message,
                                    "ride_id": rides._id
                                  };
                                  translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                                  userNotify(userids, translatedstring, data);
                                }
                              });
                              UserDevices.findOne({
                                user_id: rides.driver_id
                              }, function (err, driverdevices) {
                                if (driverdevices) {
                                  let driverlang = driverdevices.lang_type;
                                  
                                  let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);
                                  let data = {
                                    "type": "payment",
                                    "message": message,
                                    "ride_id": rides._id
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
                          });
                        } else {
                          senderr(res);
                        }
                      });
                    } else {
                      senderr(res);
                    }
                  });
                } else {
                  let message = "Payment has been done successfully";
                  let notifications = {
                    user_id: "0",
                    notify_to: req.body.rideuserid,
                    title: "Payment Completed",
                    message: message
                  };
                  notifyTo(notifications);
                  Rides.findOne({
                    _id: req.body.onride_id
                  }, function (err, rides) {
                    if (!rides) {
                      senderr(res);
                    } else {
                      let userids = [req.body.rideuserid];
                      let driverids = [rides.driver_id];
                      let drivernotifications = {
                        user_id: "0",
                        notify_to: rides.driver_id,
                        title: "Payment Completed",
                        message: message
                      };
                      notifyTo(drivernotifications);
                      NotifyDevices.findOne({
                        user_id: req.body.rideuserid
                      }, function (err, userdevices) {
                        if (userdevices) {
                          let lang = userdevices.lang_type;
                          
                          let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                          let data = {
                            "type": "payment",
                            "message": message,
                            "ride_id": rides._id
                          };
                          translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                          userNotify(userids, translatedstring, data);
                        }
                      });
                      UserDevices.findOne({
                        user_id: rides.driver_id
                      }, function (err, driverdevices) {
                        if (driverdevices) {
                          let driverlang = driverdevices.lang_type;
                          
                          let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);
                          let data = {
                            "type": "payment",
                            "message": message,
                            "ride_id": rides._id
                          };
                          translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", "ar");
                          driverNotify(driverids, translatedstring, data);
                        }
                      });
                      res.json({
                        status: "true",
                        message: message
                      });
                    }
                  });
                }
              } else {
                senderr(res);
              }
            });
              });
            }
          });
        });
      }
    }
  })(req, res);
});

/** message & contact admin */
router.post('/contactus', function (req, res) {
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
      if (!req.body.user_id || !req.body.name || !req.body.email || !req.body.subject || !req.body.message) {
        senderr(res);
      } else {
        Admin.findOne(function (err, admin) {
          let message = "Mail From: " + req.body.email;
          let mailOptions = {
            to: admin.email,
            subject: req.body.subject,
            html: '<i>Mail From ' + req.body.name + '</i>' + '<br />' + req.body.message +
              '<br /><br />' + 'you can contact him at this mail id ' + req.body.email,
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
});

/* register a user device */
router.post('/pushsignin', function (req, res) {
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
      if (!req.body.user_id || !req.body.device_token || !req.body.device_type || !req.body.device_id) {
        senderr(res);
      } else {
        console.log(req.body);
        UserDevices.count({
          device_id: req.body.device_id
        }, function (err, count) {

          if (count > 0) {
            UserDevices.findOneAndUpdate({
              device_id: req.body.device_id
            }, {
              "$set": req.body
            }).exec(function (err, userdevices) {
              console.log(" hjsaj " + userdevices);
              if (err) {
                senderr(res);
              } else {
                res.json({
                  status: "true",
                  message: 'Registered successfully'
                });
              }
            });
          } else {
            let newDevices = new UserDevices(req.body);
            newDevices.save();
            res.json({
              status: "true",
              message: 'Registered successfully'
            });
          }
        });
      }
    }
  })(req, res);
});

/* unregister a user device */
router.delete('/pushsignout', function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      res.json({
        status: "error",
        message: 'Account has been deleted successfully',
        deleted_type:"driver"
      });
    } else if (!driver) {
      res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else {
      if (!req.body.device_id) {
        senderr(res);
      } else {
        UserDevices.count({
          device_id: req.body.device_id
        }, function (err, count) {
          if (count > 0) {
            UserDevices.findOneAndRemove({
              device_id: req.body.device_id
            }, function (err, count) {
              res.json({
                status: "true",
                message: 'Unregistered successfully'
              });
            });
          } else {
            senderr(res);
          }
        });
      }
    }
  })(req, res);
});

/* send a test push to the authenticated driver's registered devices */
router.post('/testpush', function (req, res) {
  passport.authenticate('jwt', { session: false }, async function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!driver) {
      return res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    }

    try {
      const targetDriverId = String(driver._id);
      const message = String(req.body.message || 'Test push notification from Shilota driver API').trim();
      const admin = await Admin.findOne({}).sort({ _id: -1 }).exec();
      const devices = await UserDevices.find({ user_id: targetDriverId }).exec();
      const tokens = devices.map(rec => rec.device_token).filter(Boolean);

      if (!tokens.length) {
        return res.json({
          status: "false",
          message: 'No registered device tokens found for this driver'
        });
      }

      await pushService.sendNotification({
        tokens: tokens,
        title: DRIVER_NOTIFICATION_TITLE,
        message: message,
        data: {
          type: 'testpush',
          message: message,
          user_id: targetDriverId
        },
        mobile: true,
        siteName: admin && admin.siteName
      });

      let newNotifications = new Notifications({
        user_id: "0",
        notify_to: targetDriverId,
        title: admin && admin.siteName ? admin.siteName : "Shilota",
        message: message,
        notified_at: timeZone()
      });
      newNotifications.save();

      return res.json({
        status: "true",
        message: 'Test push notification queued successfully',
        mobile_tokens: tokens.length
      });
    } catch (error) {
      return res.json({
        status: "false",
        message: error && error.message ? error.message : 'Unable to send test push notification'
      });
    }
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
        driver_id: req.body.user_id
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
              Driver.findOneAndUpdate({
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

router.post("/sosalert", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    let alert = new SosAlerts({
      actor_type: "driver",
      actor_id: driver._id,
      actor_model: "Driver",
      ride_id: req.body.ride_id || req.body.onride_id || "",
      location: req.body.location || "",
      lat: req.body.lat || req.body.latitude || "",
      lng: req.body.lng || req.body.lon || req.body.longitude || "",
      message: req.body.message || "Driver emergency alert",
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
      let smsMessage = "Emergency alert from " + (driver.full_name || "driver") + "." + locationUrl;
      sendEmergencySmsToContacts(emergencyContactsFromProfile(driver), smsMessage, function (sentCount) {
        SosAlerts.updateOne(
          { _id: savedAlert._id },
          { $set: { contacts_notified: sentCount } }
        ).exec(function () {});
      });

      notifyTo({
        user_id: String(driver._id),
        notify_to: "admin",
        title: "Driver Emergency Alert",
        message: alert.message
      });

      return res.json({
        status: "true",
        message: "Emergency Alert sent",
        sos_id: savedAlert._id
      });
    });
  })(req, res);
});

router.post("/blockrider", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (!req.body.user_id) {
      return senderr(res);
    }

    RiderBlocks.findOneAndUpdate(
      {
        driver_id: String(driver._id),
        user_id: req.body.user_id
      },
      {
        $set: {
          ride_id: req.body.ride_id || req.body.onride_id || "",
          reason: req.body.reason || "",
          status: "active"
        },
        $setOnInsert: {
          created_at: new Date()
        }
      },
      {
        new: true,
        upsert: true
      }
    ).exec(function (blockErr, block) {
      if (blockErr) {
        return senderr(res);
      }
      RiderBlocks.count({ user_id: req.body.user_id, status: "active" }).exec(function (_riderCountErr, riderBlockCount) {
        RiderBlocks.count({ driver_id: String(driver._id), status: "active" }).exec(function (_driverCountErr, driverBlockCount) {
          let requiresAccountReview = Number(riderBlockCount || 0) >= 3;
          let requiresDriverReview = Number(driverBlockCount || 0) >= 10;
          let reviewStatus = requiresAccountReview || requiresDriverReview ? "pending" : "none";
          let escalationAction = requiresAccountReview ? "account_review" : "";
          if (requiresDriverReview) {
            escalationAction = escalationAction ? escalationAction + ",driver_review" : "driver_review";
          }

          RiderBlocks.updateOne(
            { _id: block._id },
            {
              $set: {
                rider_block_count: riderBlockCount || 1,
                driver_block_count: driverBlockCount || 1,
                requires_account_review: requiresAccountReview,
                requires_driver_review: requiresDriverReview,
                admin_review_status: reviewStatus,
                escalation_action: escalationAction
              }
            }
          ).exec(function () {});

          notifyTo({
            user_id: String(driver._id),
            notify_to: "admin",
            title: requiresAccountReview ? "Rider Block Review Required" : "Rider Blocked",
            message: driver.full_name + " blocked rider " + req.body.user_id
          });
          return res.json({
            status: "true",
            message: requiresAccountReview ? "Rider blocked and account review requested" : "Rider blocked",
            block_id: block._id,
            rider_block_count: riderBlockCount || 1,
            driver_block_count: driverBlockCount || 1,
            requires_account_review: requiresAccountReview,
            requires_driver_review: requiresDriverReview
          });
        });
      });
    });
  })(req, res);
});

router.get("/lostitems/:driver_id", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver || String(driver._id) !== String(req.params.driver_id)) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    LostItems.find({
      driver_id: String(driver._id)
    })
      .sort({ created_at: -1 })
      .limit(100)
      .populate("ride_id")
      .populate("user_id")
      .exec(function (caseErr, cases) {
        if (caseErr) {
          return senderr(res);
        }
        return res.json({
          status: "true",
          result: cases || []
        });
      });
  })(req, res);
});

router.post("/lostitems/:id/status", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    let allowedStatuses = ["open", "found", "returned", "resolved"];
    let requestedStatus = allowedStatuses.indexOf(req.body.status) >= 0 ? req.body.status : "found";
    let update = {
      status: requestedStatus,
      driver_notes: req.body.driver_notes || req.body.notes || ""
    };
    if (requestedStatus === "resolved" || requestedStatus === "returned") {
      update.resolved_at = new Date();
    }

    LostItems.findOneAndUpdate(
      {
        _id: req.params.id,
        driver_id: String(driver._id)
      },
      {
        $set: update
      },
      {
        new: true
      }
    ).exec(function (caseErr, lostItem) {
      if (caseErr || !lostItem) {
        return senderr(res);
      }

      notifyTo({
        user_id: lostItem.user_id,
        notify_to: "user",
        title: "Lost Item Update",
        message: "Your lost item report status is now " + requestedStatus
      });

      return res.json({
        status: "true",
        lost_item_id: lostItem._id,
        case_status: requestedStatus,
        message: "Lost item status updated"
      });
    });
  })(req, res);
});

router.get("/lostitems/:id/messages", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    LostItems.findOne({
      _id: req.params.id,
      driver_id: String(driver._id)
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
              unread_driver_count: 0
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

router.post("/lostitems/:id/messages", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (!req.body.message) {
      return res.json({
        status: "false",
        message: "Message is required"
      });
    }

    LostItems.findOne({
      _id: req.params.id,
      driver_id: String(driver._id)
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
        sender_type: "driver",
        sender_id: driver._id,
        message: req.body.message,
        increment_user_unread: lostItem.user_id ? 1 : 0,
        increment_admin_unread: 1
      }, function (messageErr, savedMessage) {
        if (messageErr) {
          return senderr(res);
        }

        notifyTo({
          user_id: String(lostItem.user_id || ""),
          notify_to: "user",
          title: "Lost Item Follow-up",
          message: req.body.message
        });
        notifyTo({
          user_id: String(driver._id),
          notify_to: "admin",
          title: "Driver Lost Item Reply",
          message: req.body.message
        });

        return res.json({
          status: "true",
          data: savedMessage
        });
      });
    });
  })(req, res);
});

router.get("/ridechat/:onride_id/messages", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    Rides.findOne({
      _id: req.params.onride_id,
      driver_id: String(driver._id)
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
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
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
      driver_id: String(driver._id)
    }).exec(function (rideErr, ride) {
      if (rideErr || !ride) {
        return res.json({
          status: "false",
          message: "Ride not found"
        });
      }

      saveRideChatMessage({
        onride_id: ride._id,
        user_id: ride.user_id || "",
        driver_id: driver._id,
        sender_type: "driver",
        sender_id: driver._id,
        message: message
      }, function (messageErr, savedMessage) {
        if (messageErr) {
          return senderr(res);
        }

        let payload = {
          onride_id: String(ride._id),
          room_id: "ridechat_" + String(ride._id),
          sender_type: "driver",
          sender_id: String(driver._id),
          receiver_id: String(ride.user_id || ""),
          driver_name: driver.full_name || "",
          driver_image: base_url + "/api/gallery/drivers/" + (driver.profile_image || "driver.png"),
          message: savedMessage.message,
          created_at: savedMessage.created_at
        };

        if (ride.user_id) {
          riderNotific([ride.user_id], message, {
            type: "ride_chat",
            ride_id: String(ride._id),
            room_id: payload.room_id,
            sender_type: "driver",
            sender_id: String(driver._id),
            driver_name: driver.full_name || "",
            message: savedMessage.message
          });
          socketRegistry.emitToUser(ride.user_id, "incoming-chat", payload);
        }

        return res.json({
          status: "true",
          result: savedMessage
        });
      });
    });
  })(req, res);
});

/* Audio Call Addon */
router.get("/call/ice-servers/:userid", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err || !driver || String(driver._id) !== String(req.params.userid)) {
      return res.status(401).json({ status: "false", message: "Unauthorized access" });
    }
    return res.json({ status: "true", ice_servers: buildIceServers(driver._id) });
  })(req, res);
});

router.post("/makecall", function (req, res) {
  if (!req.body.sender_id || (!req.body.receiver_id && !req.body.onride_id) || !req.body.type || !req.body.user_type || !req.body.room_id || !req.body.platform || !req.body.timestamp) {
    return senderr(res);
  }

  Driver.findOne({
    _id: req.body.sender_id
  }, function (err, driver) {
    if (err || !driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (driver.deletion_status === 1) {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }

    let profileImage = "driver.png";
    if (typeof driver.profile_image !== "undefined" && driver.profile_image) {
      profileImage = driver.profile_image;
    }

    let sendCallNotification = function (receiverId) {
      receiverId = receiverId ? String(receiverId) : "";
      if (!receiverId) {
        return senderr(res);
      }

      let data = {
        sender_id: req.body.sender_id,
        receiver_id: receiverId,
        user_type: req.body.user_type,
        room_id: req.body.room_id,
        platform: req.body.platform,
        timestamp: req.body.timestamp,
        type: req.body.type,
        user_name: driver.full_name,
        user_image: base_url + "/api/gallery/drivers/" + profileImage,
        onride_id: req.body.onride_id || "",
        ride_id: req.body.onride_id || "",
        message: "make_audio_call"
      };

      console.log("driver_makecall_notify", JSON.stringify({
        sender_id: req.body.sender_id,
        receiver_id: receiverId,
        room_id: req.body.room_id,
        onride_id: req.body.onride_id || ""
      }));
      userNotific([receiverId], "Incoming call from " + driver.full_name, data);
      const socketDelivered = socketRegistry.emitToUser(receiverId, "incoming-call", data);
      console.log("driver_makecall_socket", JSON.stringify({
        receiver_id: receiverId,
        delivered: socketDelivered
      }));

      saveDriverCallLog({
        sender_id: req.body.sender_id,
        receiver_id: receiverId,
        room_id: req.body.room_id,
        platform: req.body.platform,
        onride_id: req.body.onride_id || "",
        type: req.body.type,
        status: "started",
        started_at: new Date()
      });

      return res.json({
        status: "true",
        receiver_id: receiverId,
        socket_delivered: socketDelivered ? "true" : "false",
        message: "Call Connected Successfully"
      });
    };

    if (req.body.onride_id) {
      return Rides.findOne({
        _id: req.body.onride_id
      }, function (err, ride) {
        if (err || !ride || !ride.user_id) {
          return senderr(res);
        }
        if (ride.driver_id && String(ride.driver_id) !== String(req.body.sender_id)) {
          return res.json({
            status: "error",
            message: "Unauthorized access"
          });
        }
        return sendCallNotification(ride.user_id);
      });
    }

    return sendCallNotification(req.body.receiver_id);
  });
});

router.post("/endcall", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (!req.body.sender_id || !req.body.receiver_id || !req.body.type || !req.body.user_type || !req.body.room_id || !req.body.platform || !req.body.timestamp) {
      return senderr(res);
    }

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

    userNotific([req.body.receiver_id], "", data);
    socketRegistry.emitToUser(String(req.body.receiver_id), "end-call", data);
    saveDriverCallLog({
      room_id: req.body.room_id,
      status: "ended",
      ended_at: new Date()
    });

    return res.json({
      status: "true",
      message: "Call Disconnected Successfully"
    });
  })(req, res);
});

router.get("/scheduledupcoming/:userid", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    Rides.find({
      driver_id: req.params.userid,
      type: "schedule"
    }).or([
      { ridestatus: "scheduled" },
      { ridestatus: "accepted" },
      { ridestatus: "scheduleridenotaccepted" }
    ]).populate("category_id").populate("user_id").sort({ schedule_time: 1 }).limit(25).exec(function (rideErr, rides) {
      if (rideErr) {
        return senderr(res);
      }
      return res.json({
        status: "true",
        result: (rides || []).map(function (ride) {
          return {
            onride_id: ride._id,
            user_name: ride.user_id && ride.user_id.full_name || "",
            pickup_location: ride.pickup_location,
            pickup_lat: ride.pickup_lat,
            pickup_lng: ride.pickup_lng,
            drop_location: ride.drop_location,
            drop_lat: ride.drop_lat,
            drop_lng: ride.drop_lng,
            schedule_time: ride.schedule_time,
            ride_status: ride.ridestatus,
            ride_stops: ride.ride_stops || [],
            service_type: ride.service_type || "ride",
            category_name: ride.category_id && ride.category_id.category_name || ""
          };
        })
      });
    });
  })(req, res);
});

router.post("/preacceptschedule", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (!req.body.user_id || !req.body.onride_id) {
      return senderr(res);
    }
    if (String(driver._id) !== String(req.body.user_id)) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    evaluateDriverActionEligibility(driver, {
      now: new Date()
    }).then(function (eligibility) {
      if (!eligibility.eligible) {
        return res.json(buildEligibilityErrorPayload(eligibility));
      }

    Rides.findOneAndUpdate(
      {
        _id: req.body.onride_id,
        driver_id: req.body.user_id,
        type: "schedule",
        ridestatus: {
          $in: ["scheduled", "scheduleridenotaccepted"]
        }
      },
      {
        $set: {
          ridestatus: "accepted",
          schedule_preaccepted_at: new Date()
        }
      },
      {
        new: true
      }
    ).exec(function (rideErr, ride) {
      if (rideErr || !ride) {
        return res.json({
          status: "false",
          message: "Unable to pre-accept this scheduled ride"
        });
      }
      return res.json({
        status: "true",
        message: "Scheduled ride pre-accepted"
      });
    });
    }).catch(function () {
      senderr(res);
    });
  })(req, res);
});

router.get("/acceptancesettings/:userid", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    return res.json({
      status: "true",
      acceptance_settings: driver.acceptance_settings || {}
    });
  })(req, res);
});

router.post("/acceptancesettings", function (req, res) {
  passport.authenticate("jwt", { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    let rideTypes = req.body.ride_types;
    if (typeof rideTypes === "string") {
      try {
        rideTypes = JSON.parse(rideTypes);
      } catch (_error) {
        rideTypes = rideTypes.split(",");
      }
    }
    if (!Array.isArray(rideTypes) || rideTypes.length === 0) {
      rideTypes = ["ride", "delivery", "pool"];
    }

    driver.acceptance_settings = {
      auto_accept: req.body.auto_accept === true || req.body.auto_accept === "true" || req.body.auto_accept === "1",
      max_pickup_distance_km: Math.max(Number(req.body.max_pickup_distance_km || 0), 0),
      min_fare: Math.max(Number(req.body.min_fare || 0), 0),
      ride_types: rideTypes
        .map(function (type) {
          return String(type || "").trim().toLowerCase();
        })
        .filter(function (type, index, list) {
          return ["ride", "delivery", "pool"].indexOf(type) !== -1 && list.indexOf(type) === index;
        })
    };

    driver.save(function (saveErr) {
      if (saveErr) {
        return senderr(res);
      }
      return res.json({
        status: "true",
        acceptance_settings: driver.acceptance_settings
      });
    });
  })(req, res);
});

router.post("/destinationbroadcasts", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (!req.body.user_id || String(driver._id) !== String(req.body.user_id)) {
      return res.json({
        status: "false",
        message: "Unauthorized access"
      });
    }

    try {
      const result = await createDriverDestinationBroadcast({
        driverId: driver._id,
        payload: req.body,
        now: new Date()
      });
      if (!result.ok) {
        return res.json({
          status: "false",
          message: result.message,
          error_code: result.code
        });
      }

      if (result.requiresPayment) {
        return res.json({
          status: "true",
          message: "Destination broadcast payment initiated",
          payment_required: "true",
          payment_url: result.paymentUrl,
          return_url: result.returnUrl,
          transid: result.transid,
          result: result.broadcast
        });
      }

      await notifyDriverDestinationBroadcastPassengers(result.broadcast, driver);

      return res.json({
        status: "true",
        message: "Destination broadcast created",
        result: result.broadcast
      });
    } catch (_error) {
      return senderr(res);
    }
  })(req, res);
});

router.get("/destinationbroadcastsettings", function (_req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({ status: "error", message: "Account has been deleted successfully" });
    }
    if (!driver) {
      return res.json({ status: "error", message: "Unauthorized access" });
    }

    try {
      const settings = await getDestinationBroadcastSettings();
      return res.json({
        status: "true",
        result: settings
      });
    } catch (_error) {
      return senderr(res);
    }
  })(_req, res);
});

router.get("/destinationbroadcasts/:userid", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (String(driver._id) !== String(req.params.userid)) {
      return res.json({
        status: "false",
        message: "Unauthorized access"
      });
    }

    try {
      await expireDriverDestinationBroadcasts(new Date());
      await reconcilePendingDestinationBroadcastPayments(new Date());
      const broadcasts = await DriverDestinationBroadcast.find({
        driver_id: String(driver._id)
      }).sort({ created_at: -1 }).limit(25).exec();
      return res.json({
        status: "true",
        result: broadcasts
      });
    } catch (_error) {
      return senderr(res);
    }
  })(req, res);
});

router.post("/destinationbroadcasts/retrypayment", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({ status: "error", message: "Account has been deleted successfully" });
    }
    if (!driver) {
      return res.json({ status: "error", message: "Unauthorized access" });
    }
    if (!req.body.user_id || String(driver._id) !== String(req.body.user_id)) {
      return res.json({ status: "false", message: "Unauthorized access" });
    }

    try {
      const result = await retryDestinationBroadcastPayment({
        broadcastId: req.body.broadcast_id,
        driverId: driver._id
      });
      if (!result.ok) {
        return res.json({
          status: "false",
          message: result.message,
          error_code: result.code
        });
      }
      return res.json({
        status: "true",
        message: result.requiresPayment ? "Destination broadcast payment retried" : "Destination broadcast activated",
        payment_required: result.requiresPayment ? "true" : "false",
        payment_url: result.paymentUrl || "",
        return_url: result.returnUrl || "",
        transid: result.transid || "",
        result: result.broadcast
      });
    } catch (_error) {
      return senderr(res);
    }
  })(req, res);
});

router.get('/destinationbroadcasts/verifyselcom/:transid', async function (req, res) {
  const transid = String(req.params.transid || "").trim();
  if (!transid) {
    return senderr(res);
  }

  try {
    const session = await SelcomPaymentSession.findOne({
      transid: transid,
      actor_type: DRIVER_DESTINATION_BROADCAST_ACTOR_TYPE
    }).exec();

    if (!session) {
      return res.json({ status: "false", message: "Payment session not found" });
    }

    if (session.expires_at && session.expires_at.getTime() < Date.now() && !session.verified_at) {
      return res.json({ status: "false", message: "Payment session has expired" });
    }

    if (session.status !== "verified" && session.status !== "completed" && !session.verified_at) {
      try {
        await ensureSelcomPaymentVerified(session, transid);
      } catch (verifyError) {
        await finalizeDestinationBroadcastSession(session, new Date());
        return res.json({
          status: "false",
          message: verifyError && verifyError.message ? verifyError.message : "Payment is still pending"
        });
      }
    }

    const finalized = await finalizeDestinationBroadcastSession(session, new Date());
    if (finalized && finalized.broadcast) {
      if (!session.consumed_at && (session.status === "verified" || session.status === "completed" || session.verified_at)) {
        session.status = "completed";
        session.consumed_at = new Date();
        await session.save();
      }
      if (finalized.activated) {
        const broadcastDriver = await Driver.findById(finalized.broadcast.driver_id).exec().catch(function () {
          return null;
        });
        await notifyDriverDestinationBroadcastPassengers(finalized.broadcast, broadcastDriver);
      }

      return res.json({
        status: finalized.activated || finalized.reason === "already_active" ? "true" : "false",
        message: finalized.activated || finalized.reason === "already_active"
          ? "Destination broadcast activated successfully"
          : "Payment is still pending",
        transid: transid,
        paidamount: String(session.paid_amount || session.amount || ""),
        result: finalized.broadcast
      });
    }

    return res.json({ status: "false", message: "Payment is still pending" });
  } catch (error) {
    return res.json({
      status: "false",
      message: error && error.message ? error.message : "Unable to verify Selcom payment"
    });
  }
});

router.get("/destinationbroadcasts/requests/:userid", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (String(driver._id) !== String(req.params.userid)) {
      return res.json({
        status: "false",
        message: "Unauthorized access"
      });
    }

    try {
      const broadcasts = await DriverDestinationBroadcast.find({
        driver_id: String(driver._id)
      }).select("_id destination_label remaining_seats departure_time status").exec();
      const requests = await DriverDestinationJoinRequest.find({
        broadcast_id: { $in: broadcasts.map(function (item) { return String(item._id); }) }
      }).sort({ created_at: -1 }).limit(50).exec();
      const users = await User.find({
        _id: { $in: requests.map(function (item) { return String(item.passenger_id); }) }
      }).select("_id full_name profile_image").exec();

      return res.json({
        status: "true",
        result: requests.map(function (item) {
          const broadcast = broadcasts.find(function (entry) {
            return String(entry._id) === String(item.broadcast_id);
          });
          const passenger = users.find(function (entry) {
            return String(entry._id) === String(item.passenger_id);
          });
          return {
            _id: String(item._id),
            broadcast_id: String(item.broadcast_id),
            passenger_id: String(item.passenger_id),
            passenger_name: passenger ? String(passenger.full_name || "") : "",
            passenger_image: passenger ? String(passenger.profile_image || "") : "",
            pickup_label: item.pickup_label,
            pickup_lat: item.pickup_lat,
            pickup_lng: item.pickup_lng,
            requested_seats: item.requested_seats,
            status: item.status,
            destination_label: broadcast ? broadcast.destination_label : "",
            departure_time: broadcast ? broadcast.departure_time : null,
            remaining_seats: broadcast ? broadcast.remaining_seats : 0,
            broadcast_status: broadcast ? broadcast.status : ""
          };
        })
      });
    } catch (_error) {
      return senderr(res);
    }
  })(req, res);
});

router.post("/destinationbroadcasts/requests/decision", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (!req.body.user_id || String(driver._id) !== String(req.body.user_id)) {
      return res.json({
        status: "false",
        message: "Unauthorized access"
      });
    }

    try {
      const result = await decideJoinRequest({
        driverId: driver._id,
        joinRequestId: req.body.join_request_id,
        decision: req.body.decision,
        now: new Date()
      });
      if (!result.ok) {
        return res.json({
          status: "false",
          message: result.message,
          error_code: result.code
        });
      }

      userNotific([String(result.joinRequest.passenger_id)], result.joinRequest.status === "ACCEPTED"
        ? "Your destination trip request was accepted"
        : "Your destination trip request was rejected", {
        type: result.joinRequest.status === "ACCEPTED"
          ? "destination_join_request_accepted"
          : "destination_join_request_rejected",
        broadcast_id: String(result.broadcast._id),
        join_request_id: String(result.joinRequest._id),
        status: result.joinRequest.status,
        destination_label: result.broadcast.destination_label,
        remaining_seats: String(result.broadcast.remaining_seats),
        message: result.joinRequest.status === "ACCEPTED"
          ? "Your destination trip request was accepted"
          : "Your destination trip request was rejected"
      });

      return res.json({
        status: "true",
        message: result.joinRequest.status === "ACCEPTED"
          ? "Passenger request accepted"
          : "Passenger request rejected",
        result: {
          join_request_id: String(result.joinRequest._id),
          status: result.joinRequest.status,
          remaining_seats: result.broadcast.remaining_seats,
          broadcast_status: result.broadcast.status
        }
      });
    } catch (_error) {
      return senderr(res);
    }
  })(req, res);
});

router.post("/destinationbroadcasts/status", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, driver) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }
    if (!driver) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }
    if (!req.body.user_id || String(driver._id) !== String(req.body.user_id)) {
      return res.json({
        status: "false",
        message: "Unauthorized access"
      });
    }

    try {
      const result = await updateBroadcastStatus({
        broadcastId: req.body.broadcast_id,
        driverId: driver._id,
        status: req.body.status
      });
      if (!result.ok) {
        return res.json({
          status: "false",
          message: result.message,
          error_code: result.code
        });
      }
      return res.json({
        status: "true",
        message: "Broadcast updated",
        result: result.broadcast
      });
    } catch (_error) {
      return senderr(res);
    }
  })(req, res);
});

async function notifyDriverDestinationBroadcastPassengers(broadcast, driver) {
  if (!broadcast || String(broadcast.status || "").toUpperCase() !== "ACTIVE") {
    return 0;
  }

  const originLat = Number(broadcast.origin_lat || 0);
  const originLng = Number(broadcast.origin_lng || 0);
  const radiusKm = Number(broadcast.notification_radius || 0);
  if (!Number.isFinite(originLat) || !Number.isFinite(originLng) || !Number.isFinite(radiusKm) || radiusKm <= 0) {
    return 0;
  }

  const nearbyPassengers = await User.find({
    loc: {
      $near: {
        $geometry: {
          type: "Point",
          coordinates: [originLng, originLat]
        },
        $maxDistance: radiusKm * 1000
      }
    },
    deletion_status: 0
  }).select("_id").limit(100).exec().catch(function () {
    return [];
  });

  const nearbyPassengerIds = nearbyPassengers.map(function (item) {
    return String(item._id);
  });
  if (nearbyPassengerIds.length === 0) {
    return 0;
  }

  userNotific(nearbyPassengerIds, "A driver is headed your way", {
    type: "driver_destination_broadcast",
    broadcast_id: String(broadcast._id),
    driver_id: String(broadcast.driver_id || (driver && driver._id) || ""),
    driver_name: String((driver && driver.full_name) || ""),
    origin_label: broadcast.origin_label,
    destination_label: broadcast.destination_label,
    departure_time: broadcast.departure_time,
    price_per_passenger: String(broadcast.price_per_passenger),
    remaining_seats: String(broadcast.remaining_seats),
    notification_radius: String(broadcast.notification_radius),
    message: "A driver is headed your way"
  });

  return nearbyPassengerIds.length;
}

notifyTo = function (notifications) {
  notifications.notified_at = timeZone();
  let newNotifications = new Notifications(notifications);
  newNotifications.save();
};

/* Pushnotify */
userNotific = function (driverIds, message, data) {
  NotifyDevices.find({
    device_type: "0"
  })
    .where('user_id')
    .in(driverIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        sendnotifications.push(rec.device_token);
      });
      console.log("userNotific_ios_tokens", JSON.stringify({
        user_ids: driverIds,
        count: sendnotifications.length,
        message: data && data.message
      }));
      fireBase(sendnotifications, message, data);
    });

  /** ios pushnotifications */
  NotifyDevices.find({
    device_type: "1"
  })
    .where('user_id')
    .in(driverIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        sendnotifications.push(rec.device_token);
      });
      console.log("userNotific_android_tokens", JSON.stringify({
        user_ids: driverIds,
        count: sendnotifications.length,
        message: data && data.message
      }));
      fireBaseAndroid(sendnotifications, message, data);
    });
};

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


riderNotific = function (userIds, message, data) {
  NotifyDevices.find({
    device_type: "0"
  })
    .where('user_id')
    .in(userIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        sendnotifications.push(rec.device_token);
      });
      fireBase(sendnotifications, message, data);
    });

  /** ios pushnotifications */
  NotifyDevices.find({
    device_type: "1"
  })
    .where('user_id')
    .in(userIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        sendnotifications.push(rec.device_token);
      });
      fireBaseAndroid(sendnotifications, message, data);
    });
};

module.exports = router;
