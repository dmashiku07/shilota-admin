const config = require("../config");
const Driver = require("../schema/driver");
const User = require("../schema/user");
const DriverDestinationBroadcast = require("../schema/driverdestinationbroadcasts");
const DriverDestinationJoinRequest = require("../schema/driverdestinationjoinrequests");
const DestinationBroadcastSettings = require("../schema/destinationbroadcastsettings");
const SelcomPaymentSession = require("../schema/selcompaymentsession");
const selcomService = require("./selcomService");
const {
  evaluateDriverActionEligibility
} = require("./driverEligibilityService");

const DRIVER_DESTINATION_BROADCAST_ACTOR_TYPE = "driver_destination_broadcast";
const DRIVER_DESTINATION_BROADCAST_PURPOSE = "driver_destination_broadcast";
const ACTIVE_BROADCAST_STATUSES = ["ACTIVE", "DRAFT", "FULL", "PENDING_PAYMENT"];
const OPEN_BROADCAST_STATUSES = ["ACTIVE", "DRAFT", "PENDING_PAYMENT"];
const PENDING_JOIN_STATUS = "PENDING";

function isDriverDestinationBroadcastEnabled() {
  return Boolean(
    config.featureFlags && config.featureFlags.driver_destination_broadcast_enabled
  );
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const radius = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeBroadcastStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizePaymentStatus(value) {
  return String(value || "").trim().toUpperCase();
}

function buildDefaultSettings() {
  return {
    enabled: true,
    broadcast_fee: 1000,
    currency: "TZS",
    default_radius_km: 8,
    max_radius_km: 20,
    expiry_duration_minutes: 30,
    maximum_active_broadcasts_per_driver: 1,
    cancellation_refund_policy: "NO_REFUND"
  };
}

async function getDestinationBroadcastSettings() {
  const settings = await DestinationBroadcastSettings.findOne().sort({ updated_at: -1 }).exec();
  return settings || buildDefaultSettings();
}

async function expireDriverDestinationBroadcasts(now) {
  const comparison = now instanceof Date ? now : new Date();

  await DriverDestinationBroadcast.updateMany(
    {
      status: { $in: OPEN_BROADCAST_STATUSES },
      $or: [
        { expires_at: { $lte: comparison } },
        { departure_time: { $lte: comparison } }
      ]
    },
    {
      $set: {
        status: "EXPIRED"
      }
    }
  ).exec();

  const pendingExpired = await DriverDestinationBroadcast.find({
    status: "PENDING_PAYMENT",
    $or: [
      { expires_at: { $lte: comparison } },
      { departure_time: { $lte: comparison } }
    ]
  }).select("_id").exec();

  if (pendingExpired.length > 0) {
    await DriverDestinationBroadcast.updateMany(
      {
        _id: { $in: pendingExpired.map(function (item) { return item._id; }) }
      },
      {
        $set: {
          status: "PAYMENT_FAILED",
          payment_status: "FAILED"
        }
      }
    ).exec();
  }

  const expiredBroadcasts = await DriverDestinationBroadcast.find({
    status: { $in: ["EXPIRED", "PAYMENT_FAILED", "CANCELLED", "COMPLETED"] }
  }).select("_id").exec();

  if (expiredBroadcasts.length > 0) {
    await DriverDestinationJoinRequest.updateMany(
      {
        broadcast_id: { $in: expiredBroadcasts.map(function (item) { return String(item._id); }) },
        status: PENDING_JOIN_STATUS
      },
      {
        $set: {
          status: "EXPIRED",
          expired_at: comparison,
          responded_at: comparison
        }
      }
    ).exec();
  }
}

async function reconcilePendingDestinationBroadcastPayments(now) {
  const comparison = now instanceof Date ? now : new Date();
  const staleBroadcasts = await DriverDestinationBroadcast.find({
    status: "PENDING_PAYMENT"
  }).select("_id selcom_session_id expires_at departure_time").exec();

  for (const broadcast of staleBroadcasts) {
    if (
      (broadcast.expires_at instanceof Date && broadcast.expires_at.getTime() <= comparison.getTime()) ||
      (broadcast.departure_time instanceof Date && broadcast.departure_time.getTime() <= comparison.getTime())
    ) {
      await DriverDestinationBroadcast.updateOne(
        { _id: broadcast._id, status: "PENDING_PAYMENT" },
        {
          $set: {
            status: "PAYMENT_FAILED",
            payment_status: "FAILED"
          }
        }
      ).exec();
      continue;
    }

    if (!broadcast.selcom_session_id) {
      continue;
    }

    const session = await SelcomPaymentSession.findById(broadcast.selcom_session_id).exec();
    if (!session) {
      continue;
    }

    if (
      session.expires_at instanceof Date &&
      session.expires_at.getTime() <= comparison.getTime() &&
      !session.verified_at &&
      normalizePaymentStatus(session.payment_status) !== "COMPLETED"
    ) {
      await DriverDestinationBroadcast.updateOne(
        { _id: broadcast._id, status: "PENDING_PAYMENT" },
        {
          $set: {
            status: "PAYMENT_FAILED",
            payment_status: "FAILED"
          }
        }
      ).exec();
    }
  }
}

async function buildBroadcastPayload(driverId, payload, settings, now) {
  const availableSeats = Math.max(parseInt(payload.available_seats, 10) || 0, 1);
  const requestedRadius = toNumber(payload.notification_radius, Number(settings.default_radius_km || 8));
  const normalizedRadius = Math.min(
    Math.max(requestedRadius, Number(settings.default_radius_km || 8)),
    Math.max(Number(settings.max_radius_km || settings.default_radius_km || 20), Number(settings.default_radius_km || 8))
  );
  const departureTime = new Date(payload.departure_time);

  if (!(departureTime instanceof Date) || Number.isNaN(departureTime.getTime())) {
    throw new Error("A valid departure time is required");
  }

  const currentTime = now instanceof Date ? now : new Date();
  if (departureTime.getTime() <= currentTime.getTime()) {
    throw new Error("Departure time must be in the future");
  }

  const expiryDurationMinutes = Math.max(Number(settings.expiry_duration_minutes || 30), 1);
  const expiresAt = new Date(currentTime.getTime() + (expiryDurationMinutes * 60 * 1000));
  const broadcastFee = Math.max(toNumber(settings.broadcast_fee, 0), 0);
  const currency = String(settings.currency || "TZS").trim().toUpperCase();

  return {
    driver_id: String(driverId),
    origin_label: String(payload.origin_label || "").trim(),
    origin_lat: toNumber(payload.origin_lat, NaN),
    origin_lng: toNumber(payload.origin_lng, NaN),
    destination_label: String(payload.destination_label || "").trim(),
    destination_lat: toNumber(payload.destination_lat, NaN),
    destination_lng: toNumber(payload.destination_lng, NaN),
    departure_time: departureTime,
    price_per_passenger: Math.max(toNumber(payload.price_per_passenger, 0), 0),
    available_seats: availableSeats,
    remaining_seats: availableSeats,
    notification_radius: normalizedRadius,
    broadcast_fee: broadcastFee,
    currency: currency,
    payment_status: broadcastFee > 0 ? "PENDING" : "PAID",
    payment_reference: "",
    paid_at: broadcastFee > 0 ? null : currentTime,
    starts_at: currentTime,
    expires_at: expiresAt,
    status: broadcastFee > 0 ? "PENDING_PAYMENT" : "ACTIVE",
    origin_loc: [
      toNumber(payload.origin_lng, NaN),
      toNumber(payload.origin_lat, NaN)
    ]
  };
}

function validateBroadcastPayload(payload) {
  if (!payload.origin_label || !payload.destination_label) {
    return "Origin and destination are required";
  }
  if (!Number.isFinite(payload.origin_lat) || !Number.isFinite(payload.origin_lng)) {
    return "Valid origin coordinates are required";
  }
  if (!Number.isFinite(payload.destination_lat) || !Number.isFinite(payload.destination_lng)) {
    return "Valid destination coordinates are required";
  }
  if (!Number.isFinite(payload.price_per_passenger) || payload.price_per_passenger < 0) {
    return "A valid passenger price is required";
  }
  if (!Number.isFinite(payload.available_seats) || payload.available_seats < 1) {
    return "Available seats must be at least 1";
  }
  if (!Number.isFinite(payload.notification_radius) || payload.notification_radius < 0) {
    return "Notification radius must be 0 or greater";
  }
  return "";
}

async function createDestinationBroadcastPaymentSession(options) {
  const broadcast = options.broadcast;
  const driver = options.driver;
  const transid = selcomService.generateTransId();
  const returnUrl = selcomService.buildReturnUrl(transid);
  const checkout = await selcomService.createOrder({
    transid: transid,
    amount: broadcast.broadcast_fee,
    user: driver,
    userId: String(driver._id),
    returnUrl: returnUrl,
    remarks: "Shilota destination broadcast fee"
  });

  const session = await SelcomPaymentSession.findOneAndUpdate(
    { transid: transid },
    {
      transid: transid,
      order_id: checkout.orderId,
      user_id: String(driver._id),
      actor_type: DRIVER_DESTINATION_BROADCAST_ACTOR_TYPE,
      purpose: DRIVER_DESTINATION_BROADCAST_PURPOSE,
      amount: broadcast.broadcast_fee,
      destination_broadcast_id: String(broadcast._id),
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

  broadcast.selcom_session_id = session._id;
  await broadcast.save();
  return {
    session: session,
    transid: transid,
    returnUrl: returnUrl,
    paymentUrl: checkout.paymentUrl
  };
}

async function createDriverDestinationBroadcast(options) {
  const now = options && options.now instanceof Date ? options.now : new Date();
  if (!isDriverDestinationBroadcastEnabled()) {
    return {
      ok: false,
      code: "DRIVER_DESTINATION_BROADCAST_DISABLED",
      message: "Driver destination broadcast is not enabled"
    };
  }

  const settings = await getDestinationBroadcastSettings();
  if (settings && settings.enabled === false) {
    return {
      ok: false,
      code: "DRIVER_DESTINATION_BROADCAST_DISABLED",
      message: "Destination broadcasts are disabled"
    };
  }

  const eligibility = await evaluateDriverActionEligibility(options.driverId, {
    now: now
  });
  if (!eligibility.eligible) {
    return {
      ok: false,
      code: eligibility.code,
      message: eligibility.message
    };
  }

  await expireDriverDestinationBroadcasts(now);
  await reconcilePendingDestinationBroadcastPayments(now);

  const activeCount = await DriverDestinationBroadcast.countDocuments({
    driver_id: String(options.driverId),
    status: { $in: ACTIVE_BROADCAST_STATUSES }
  }).exec();
  const maxActive = Math.max(Number(settings.maximum_active_broadcasts_per_driver || 1), 1);
  if (activeCount >= maxActive) {
    return {
      ok: false,
      code: "DRIVER_DESTINATION_BROADCAST_ALREADY_ACTIVE",
      message: "Maximum active destination broadcasts reached"
    };
  }

  const payload = await buildBroadcastPayload(options.driverId, options.payload || {}, settings, now);
  const validationMessage = validateBroadcastPayload(payload);
  if (validationMessage) {
    return {
      ok: false,
      code: "INVALID_DRIVER_DESTINATION_BROADCAST",
      message: validationMessage
    };
  }

  const broadcast = new DriverDestinationBroadcast(payload);
  await broadcast.save();

  if (Number(broadcast.broadcast_fee || 0) <= 0) {
    return {
      ok: true,
      broadcast: broadcast,
      settings: settings,
      requiresPayment: false
    };
  }

  if (!selcomService.isConfigured()) {
    broadcast.status = "PAYMENT_FAILED";
    broadcast.payment_status = "FAILED";
    await broadcast.save();
    return {
      ok: false,
      code: "DRIVER_DESTINATION_BROADCAST_PAYMENT_NOT_CONFIGURED",
      message: "Selcom payment is not configured"
    };
  }

  const driver = await Driver.findById(options.driverId).exec();
  const payment = await createDestinationBroadcastPaymentSession({
    broadcast: broadcast,
    driver: driver
  });

  return {
    ok: true,
    broadcast: broadcast,
    settings: settings,
    requiresPayment: true,
    paymentUrl: payment.paymentUrl,
    returnUrl: payment.returnUrl,
    transid: payment.transid
  };
}

async function retryDestinationBroadcastPayment(options) {
  const broadcast = await DriverDestinationBroadcast.findOne({
    _id: String(options.broadcastId),
    driver_id: String(options.driverId)
  }).exec();

  if (!broadcast) {
    return {
      ok: false,
      code: "DESTINATION_BROADCAST_NOT_FOUND",
      message: "Broadcast not found"
    };
  }

  if (normalizeBroadcastStatus(broadcast.status) === "ACTIVE") {
    return {
      ok: true,
      broadcast: broadcast,
      requiresPayment: false
    };
  }

  if (Number(broadcast.broadcast_fee || 0) <= 0) {
    broadcast.status = "ACTIVE";
    broadcast.payment_status = "PAID";
    if (!broadcast.paid_at) {
      broadcast.paid_at = new Date();
    }
    await broadcast.save();
    return {
      ok: true,
      broadcast: broadcast,
      requiresPayment: false
    };
  }

  if (!selcomService.isConfigured()) {
    return {
      ok: false,
      code: "DRIVER_DESTINATION_BROADCAST_PAYMENT_NOT_CONFIGURED",
      message: "Selcom payment is not configured"
    };
  }

  const driver = await Driver.findById(options.driverId).exec();
  broadcast.status = "PENDING_PAYMENT";
  broadcast.payment_status = "PENDING";
  broadcast.payment_reference = "";
  broadcast.paid_at = null;
  await broadcast.save();

  const payment = await createDestinationBroadcastPaymentSession({
    broadcast: broadcast,
    driver: driver
  });

  return {
    ok: true,
    broadcast: broadcast,
    requiresPayment: true,
    paymentUrl: payment.paymentUrl,
    returnUrl: payment.returnUrl,
    transid: payment.transid
  };
}

async function activateDestinationBroadcastPayment(options) {
  const broadcast = options && options.broadcast;
  const paymentReference = options && options.paymentReference;
  const now = options && options.now instanceof Date ? options.now : new Date();
  if (!broadcast) {
    return {
      activated: false,
      reason: "missing_broadcast"
    };
  }

  if (
    (broadcast.expires_at instanceof Date && broadcast.expires_at.getTime() <= now.getTime()) ||
    (broadcast.departure_time instanceof Date && broadcast.departure_time.getTime() <= now.getTime())
  ) {
    broadcast.status = "PAYMENT_FAILED";
    broadcast.payment_status = "FAILED";
    await broadcast.save();
    return {
      activated: false,
      reason: "expired_before_activation",
      broadcast: broadcast
    };
  }

  if (
    normalizeBroadcastStatus(broadcast.status) === "ACTIVE" &&
    normalizePaymentStatus(broadcast.payment_status) === "PAID"
  ) {
    return {
      activated: false,
      reason: "already_active",
      broadcast: broadcast
    };
  }

  broadcast.status = "ACTIVE";
  broadcast.payment_status = "PAID";
  broadcast.payment_reference = String(paymentReference || broadcast.payment_reference || "").trim();
  broadcast.paid_at = now;
  await broadcast.save();
  return {
    activated: true,
    reason: "activated",
    broadcast: broadcast
  };
}

async function markDestinationBroadcastPaymentFailed(broadcast, paymentReference) {
  if (!broadcast) {
    return {
      updated: false,
      reason: "missing_broadcast"
    };
  }
  if (normalizePaymentStatus(broadcast.payment_status) === "FAILED") {
    return {
      updated: false,
      reason: "already_failed",
      broadcast: broadcast
    };
  }
  broadcast.status = "PAYMENT_FAILED";
  broadcast.payment_status = "FAILED";
  broadcast.payment_reference = String(paymentReference || broadcast.payment_reference || "").trim();
  await broadcast.save();
  return {
    updated: true,
    reason: "marked_failed",
    broadcast: broadcast
  };
}

async function finalizeDestinationBroadcastSession(session, now) {
  if (!session || !session.destination_broadcast_id) {
    return {
      activated: false,
      reason: "missing_broadcast_reference"
    };
  }

  const broadcast = await DriverDestinationBroadcast.findById(session.destination_broadcast_id).exec();
  if (!broadcast) {
    return {
      activated: false,
      reason: "missing_broadcast"
    };
  }

  if (
    normalizeBroadcastStatus(broadcast.status) === "ACTIVE" &&
    normalizePaymentStatus(broadcast.payment_status) === "PAID"
  ) {
    return {
      activated: false,
      reason: "already_active",
      broadcast: broadcast
    };
  }

  if (
    session.expires_at instanceof Date &&
    session.expires_at.getTime() <= (now instanceof Date ? now.getTime() : Date.now()) &&
    !session.verified_at
  ) {
    return markDestinationBroadcastPaymentFailed(broadcast, session.reference || session.transid);
  }

  if (
    normalizePaymentStatus(session.payment_status) === "COMPLETED" ||
    normalizePaymentStatus(session.payment_status) === "PAID" ||
    normalizePaymentStatus(session.payment_status) === "SUCCESS"
  ) {
    return activateDestinationBroadcastPayment({
      broadcast: broadcast,
      paymentReference: session.reference || session.transid,
      now: now
    });
  }

  if (["FAILED", "CANCELLED", "ABANDONED"].indexOf(normalizePaymentStatus(session.payment_status)) >= 0) {
    return markDestinationBroadcastPaymentFailed(broadcast, session.reference || session.transid);
  }

  return {
    activated: false,
    reason: "pending",
    broadcast: broadcast
  };
}

async function listNearbyBroadcasts(options) {
  const now = options && options.now instanceof Date ? options.now : new Date();
  await expireDriverDestinationBroadcasts(now);
  await reconcilePendingDestinationBroadcastPayments(now);
  const passengerLat = toNumber(options && options.lat, NaN);
  const passengerLng = toNumber(options && options.lng, NaN);
  if (!Number.isFinite(passengerLat) || !Number.isFinite(passengerLng)) {
    return [];
  }

  const broadcasts = await DriverDestinationBroadcast.find({
    status: { $in: ["ACTIVE", "FULL"] },
    payment_status: "PAID",
    departure_time: { $gt: now }
  }).sort({ departure_time: 1, created_at: -1 }).exec();

  return broadcasts.filter(function (broadcast) {
    if (normalizeBroadcastStatus(broadcast.status) === "FULL") {
      return Number(broadcast.remaining_seats || 0) > 0;
    }
    return distanceKm(
      passengerLat,
      passengerLng,
      Number(broadcast.origin_lat || 0),
      Number(broadcast.origin_lng || 0)
    ) <= Number(broadcast.notification_radius || 0);
  });
}

async function createJoinRequest(options) {
  const now = options && options.now instanceof Date ? options.now : new Date();
  await expireDriverDestinationBroadcasts(now);

  const broadcast = await DriverDestinationBroadcast.findById(options.broadcastId).exec();
  if (
    !broadcast ||
    ["ACTIVE", "FULL"].indexOf(normalizeBroadcastStatus(broadcast.status)) === -1 ||
    normalizePaymentStatus(broadcast.payment_status) !== "PAID"
  ) {
    return {
      ok: false,
      code: "DESTINATION_BROADCAST_UNAVAILABLE",
      message: "This broadcast is no longer available"
    };
  }

  if (Number(broadcast.remaining_seats || 0) <= 0) {
    broadcast.status = "FULL";
    await broadcast.save();
    return {
      ok: false,
      code: "DESTINATION_BROADCAST_FULL",
      message: "No seats are available on this broadcast"
    };
  }

  const requestedSeats = Math.max(parseInt(options.requestedSeats, 10) || 0, 1);
  if (requestedSeats > Number(broadcast.remaining_seats || 0)) {
    return {
      ok: false,
      code: "DESTINATION_BROADCAST_NOT_ENOUGH_SEATS",
      message: "Requested seats exceed the seats remaining"
    };
  }

  const existingRequest = await DriverDestinationJoinRequest.findOne({
    broadcast_id: String(broadcast._id),
    passenger_id: String(options.passengerId),
    status: { $in: ["PENDING", "ACCEPTED"] }
  }).sort({ created_at: -1 }).exec();

  if (existingRequest) {
    return {
      ok: false,
      code: "DESTINATION_JOIN_REQUEST_EXISTS",
      message: "You already have an active request for this broadcast"
    };
  }

  const joinRequest = new DriverDestinationJoinRequest({
    broadcast_id: String(broadcast._id),
    passenger_id: String(options.passengerId),
    pickup_label: String(options.pickupLabel || "").trim(),
    pickup_lat: toNumber(options.pickupLat, NaN),
    pickup_lng: toNumber(options.pickupLng, NaN),
    requested_seats: requestedSeats,
    status: "PENDING"
  });

  if (
    !joinRequest.pickup_label ||
    !Number.isFinite(joinRequest.pickup_lat) ||
    !Number.isFinite(joinRequest.pickup_lng)
  ) {
    return {
      ok: false,
      code: "INVALID_DESTINATION_JOIN_REQUEST",
      message: "A valid pickup point is required"
    };
  }

  await joinRequest.save();
  return {
    ok: true,
    broadcast: broadcast,
    joinRequest: joinRequest
  };
}

async function decideJoinRequest(options) {
  const now = options && options.now instanceof Date ? options.now : new Date();
  const decision = String(options.decision || "").trim().toUpperCase();
  const joinRequest = await DriverDestinationJoinRequest.findById(options.joinRequestId).exec();
  if (!joinRequest) {
    return {
      ok: false,
      code: "DESTINATION_JOIN_REQUEST_NOT_FOUND",
      message: "Join request not found"
    };
  }

  const broadcast = await DriverDestinationBroadcast.findById(joinRequest.broadcast_id).exec();
  if (!broadcast || String(broadcast.driver_id) !== String(options.driverId)) {
    return {
      ok: false,
      code: "DESTINATION_BROADCAST_NOT_FOUND",
      message: "Broadcast not found"
    };
  }

  if (normalizeBroadcastStatus(joinRequest.status) !== "PENDING") {
    return {
      ok: false,
      code: "DESTINATION_JOIN_REQUEST_ALREADY_RESOLVED",
      message: "Join request was already resolved"
    };
  }

  if (decision === "REJECT") {
    joinRequest.status = "REJECTED";
    joinRequest.responded_at = now;
    await joinRequest.save();
    return {
      ok: true,
      broadcast: broadcast,
      joinRequest: joinRequest
    };
  }

  if (["ACTIVE", "FULL"].indexOf(normalizeBroadcastStatus(broadcast.status)) === -1) {
    return {
      ok: false,
      code: "DESTINATION_BROADCAST_UNAVAILABLE",
      message: "This broadcast is no longer active"
    };
  }

  const acceptedBroadcast = await DriverDestinationBroadcast.findOneAndUpdate(
    {
      _id: broadcast._id,
      remaining_seats: { $gte: Number(joinRequest.requested_seats || 0) },
      status: { $in: ["ACTIVE", "FULL"] }
    },
    {
      $inc: {
        remaining_seats: -Number(joinRequest.requested_seats || 0)
      }
    },
    {
      new: true
    }
  ).exec();

  if (!acceptedBroadcast) {
    return {
      ok: false,
      code: "DESTINATION_BROADCAST_NOT_ENOUGH_SEATS",
      message: "Another request used the final seat"
    };
  }

  joinRequest.status = "ACCEPTED";
  joinRequest.responded_at = now;
  await joinRequest.save();

  if (Number(acceptedBroadcast.remaining_seats || 0) <= 0) {
    acceptedBroadcast.status = "FULL";
    await acceptedBroadcast.save();
  }

  return {
    ok: true,
    broadcast: acceptedBroadcast,
    joinRequest: joinRequest
  };
}

async function updateBroadcastStatus(options) {
  const nextStatus = normalizeBroadcastStatus(options.status);
  if (["CANCELLED", "COMPLETED"].indexOf(nextStatus) === -1) {
    return {
      ok: false,
      code: "INVALID_DESTINATION_BROADCAST_STATUS",
      message: "Only cancelled or completed are supported"
    };
  }

  const broadcast = await DriverDestinationBroadcast.findOne({
    _id: String(options.broadcastId),
    driver_id: String(options.driverId)
  }).exec();

  if (!broadcast) {
    return {
      ok: false,
      code: "DESTINATION_BROADCAST_NOT_FOUND",
      message: "Broadcast not found"
    };
  }

  broadcast.status = nextStatus;
  await broadcast.save();

  if (nextStatus === "CANCELLED") {
    await DriverDestinationJoinRequest.updateMany(
      {
        broadcast_id: String(broadcast._id),
        status: "PENDING"
      },
      {
        $set: {
          status: "EXPIRED",
          expired_at: new Date(),
          responded_at: new Date()
        }
      }
    ).exec();
  }

  return {
    ok: true,
    broadcast: broadcast
  };
}

async function updatePassengerLocation(userId, payload) {
  const lat = toNumber(payload && (payload.lat || payload.latitude), NaN);
  const lng = toNumber(payload && (payload.lng || payload.longitude), NaN);
  const location = String(payload && payload.location || "").trim();
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return User.findByIdAndUpdate(
    userId,
    {
      $set: {
        current_lat: lat,
        current_lng: lng,
        current_location: location,
        loc: [lng, lat]
      }
    },
    {
      new: true
    }
  ).exec();
}

module.exports = {
  DRIVER_DESTINATION_BROADCAST_ACTOR_TYPE,
  DRIVER_DESTINATION_BROADCAST_PURPOSE,
  activateDestinationBroadcastPayment,
  createDriverDestinationBroadcast,
  createJoinRequest,
  decideJoinRequest,
  distanceKm,
  expireDriverDestinationBroadcasts,
  finalizeDestinationBroadcastSession,
  getDestinationBroadcastSettings,
  isDriverDestinationBroadcastEnabled,
  listNearbyBroadcasts,
  markDestinationBroadcastPaymentFailed,
  reconcilePendingDestinationBroadcastPayments,
  retryDestinationBroadcastPayment,
  updateBroadcastStatus,
  updatePassengerLocation
};
