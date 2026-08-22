const config = require("../config");
const RideOffer = require("../schema/rideoffers");
const Rides = require("../schema/rides");
const Driver = require("../schema/driver");
const Vehicles = require("../schema/vehicles");
const Reviews = require("../schema/reviews");
const PriceBroadcastSettings = require("../schema/pricebroadcastsettings");
const {
  evaluateDriverActionEligibility,
  filterEligibleDrivers
} = require("./driverEligibilityService");
const {
  getCurrentPassengerSubscriptionWithFeatures
} = require("./passengerSubscriptionService");

const OFFER_WINDOW_MINUTES = 5;
const OPEN_RIDE_STATUSES = ["requested", "ridenotaccepted"];
const ACCEPTABLE_RIDE_STATUSES = ["requested", "ridenotaccepted"];
const REQUEST_TYPE_STANDARD = "STANDARD";
const REQUEST_TYPE_PASSENGER_PRICE_BROADCAST = "PASSENGER_PRICE_BROADCAST";
const OFFER_TYPE_DRIVER_DIRECT = "DRIVER_DIRECT_OFFER";
const OFFER_TYPE_ACCEPT_PASSENGER_PRICE = "ACCEPT_PASSENGER_PRICE";
const OFFER_TYPE_DRIVER_COUNTER = "DRIVER_COUNTER_OFFER";

function isDriverPricingEnabled() {
  return Boolean(config.featureFlags && config.featureFlags.driver_pricing_enabled);
}

function isPassengerPriceBroadcastEnabled() {
  return Boolean(config.featureFlags && config.featureFlags.passenger_price_broadcast_enabled);
}

async function getPriceBroadcastSettings() {
  const settings = await PriceBroadcastSettings.findOne().sort({ updated_at: -1 }).exec();
  return settings || {
    enabled: true,
    default_radius_km: 8,
    max_radius_km: 20,
    default_expiry_minutes: 5,
    max_expiry_minutes: 15,
    max_broadcasts_per_day: null
  };
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCurrency(value) {
  const normalized = String(value || "TZS").trim().toUpperCase();
  return normalized || "TZS";
}

function isDriverOfferRide(ride) {
  return !!(
    ride &&
    String(ride.pricing_mode || "").toLowerCase() === "driver_offer" &&
    String(ride.type || "").toLowerCase() !== "schedule"
  );
}

function isPassengerBroadcastRide(ride) {
  return !!(
    ride &&
    String(ride.request_type || "").toUpperCase() === REQUEST_TYPE_PASSENGER_PRICE_BROADCAST
  );
}

function isOfferBasedRide(ride) {
  return isDriverOfferRide(ride) || isPassengerBroadcastRide(ride);
}

function buildOfferExpiry(now, ride) {
  if (ride && ride.broadcast_expires_at instanceof Date) {
    return new Date(ride.broadcast_expires_at.getTime());
  }
  if (ride && ride.offer_expires_at instanceof Date) {
    return new Date(ride.offer_expires_at.getTime());
  }
  return new Date((now instanceof Date ? now : new Date()).getTime() + (OFFER_WINDOW_MINUTES * 60 * 1000));
}

async function expireRideOffers(now) {
  const comparisonDate = now instanceof Date ? now : new Date();
  await RideOffer.updateMany(
    {
      status: "PENDING",
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
}

async function expireDriverPricedRideRequests(now) {
  const comparisonDate = now instanceof Date ? now : new Date();
  await Rides.updateMany(
    {
      pricing_mode: "driver_offer",
      ridestatus: {
        $in: OPEN_RIDE_STATUSES
      },
      offer_expires_at: {
        $lte: comparisonDate
      },
      accepted_offer_id: {
        $in: [null, ""]
      }
    },
    {
      $set: {
        ridestatus: "ridenotaccepted"
      }
    }
  ).exec();
}

async function expirePassengerPriceBroadcastRequests(now) {
  const comparisonDate = now instanceof Date ? now : new Date();
  await Rides.updateMany(
    {
      request_type: REQUEST_TYPE_PASSENGER_PRICE_BROADCAST,
      ridestatus: {
        $in: OPEN_RIDE_STATUSES
      },
      broadcast_expires_at: {
        $lte: comparisonDate
      },
      accepted_offer_id: {
        $in: [null, ""]
      }
    },
    {
      $set: {
        ridestatus: "ridenotaccepted"
      }
    }
  ).exec();
}

function prepareDriverPricedRidePayload(ride, now) {
  if (!ride || !isDriverPricingEnabled() || String(ride.type || "").toLowerCase() === "schedule") {
    return ride;
  }

  ride.pricing_mode = "driver_offer";
  ride.accepted_offer_id = "";
  ride.final_agreed_price = null;
  ride.final_agreed_currency = "TZS";
  ride.offer_expires_at = buildOfferExpiry(now, ride);
  return ride;
}

async function preparePassengerPriceBroadcastPayload(ride, options) {
  if (!ride || !options || options.enabled !== true) {
    return ride;
  }

  const expiryMinutes = Math.max(parseInt(options.expiryMinutes, 10) || OFFER_WINDOW_MINUTES, 1);
  const broadcastRadius = Math.max(Number(options.broadcastRadius || options.defaultRadius || 8), 0);
  ride.request_type = REQUEST_TYPE_PASSENGER_PRICE_BROADCAST;
  ride.pricing_mode = "passenger_broadcast";
  ride.accepted_offer_id = "";
  ride.final_agreed_price = null;
  ride.final_agreed_currency = normalizeCurrency(options.currency || "TZS");
  ride.passenger_offered_price = toNumber(options.passengerOfferedPrice, 0);
  ride.broadcast_radius = broadcastRadius;
  ride.broadcast_expires_at = new Date((options.now instanceof Date ? options.now : new Date()).getTime() + (expiryMinutes * 60 * 1000));
  ride.offer_expires_at = ride.broadcast_expires_at;
  return ride;
}

async function findPendingOffer(rideId, driverId) {
  return RideOffer.findOne({
    ride_request_id: String(rideId),
    driver_id: String(driverId),
    status: "PENDING"
  }).sort({ updated_at: -1, created_at: -1 }).exec();
}

async function buildOfferSummary(offer) {
  const driver = await Driver.findById(offer.driver_id).exec();
  const vehicle = driver
    ? await Vehicles.findOne({ user_id: String(driver._id) }).exec()
    : null;
  return {
    id: String(offer._id),
    ride_request_id: String(offer.ride_request_id),
    driver_id: String(offer.driver_id),
    // Keep the driver anonymous until the passenger selects an offer. The
    // accepted-ride response reveals the full driver and vehicle details.
    driver_name: "",
    driver_image: "",
    driver_rating: 0,
    vehicle_name: "",
    vehicle_number: vehicle ? String(vehicle.vehicle_number || "") : "",
    offered_price: toNumber(offer.offered_price, 0),
    currency: normalizeCurrency(offer.currency),
    offer_type: String(offer.offer_type || OFFER_TYPE_DRIVER_DIRECT),
    estimated_arrival_minutes:
      typeof offer.estimated_arrival_minutes === "number" ? offer.estimated_arrival_minutes : null,
    message: String(offer.message || ""),
    status: String(offer.status || "PENDING"),
    expires_at: offer.expires_at || null,
    created_at: offer.created_at || null,
    updated_at: offer.updated_at || null
  };
}

async function listRideOffersForPassenger(rideId, userId, now) {
  await expireRideOffers(now);
  await expirePassengerPriceBroadcastRequests(now);
  const ride = await Rides.findOne({
    _id: String(rideId),
    user_id: String(userId)
  }).exec();

  if (!ride) {
    return {
      ride: null,
      offers: []
    };
  }

  const offers = await RideOffer.find({
    ride_request_id: String(ride._id),
    status: "PENDING",
    expires_at: {
      $gt: now instanceof Date ? now : new Date()
    }
  }).sort({ offered_price: 1, created_at: 1 }).exec();

  const summaries = [];
  for (const offer of offers) {
    summaries.push(await buildOfferSummary(offer));
  }

  return {
    ride,
    offers: summaries
  };
}

async function submitRideOffer(options) {
  const now = options && options.now instanceof Date ? options.now : new Date();
  const rideId = String(options.rideId || "").trim();
  const driverId = String(options.driverId || "").trim();
  const offeredPrice = toNumber(options.offeredPrice, NaN);
  const estimatedArrivalMinutes =
    options.estimatedArrivalMinutes === null || typeof options.estimatedArrivalMinutes === "undefined"
      ? null
      : Math.max(parseInt(options.estimatedArrivalMinutes, 10) || 0, 0);
  const message = String(options.message || "").trim();
  const currency = normalizeCurrency(options.currency);
  const requestedOfferType = String(options.offerType || "").trim().toUpperCase();

  if (!rideId || !driverId) {
    return {
      ok: false,
      code: "INVALID_RIDE_OFFER",
      message: "A valid ride offer price is required"
    };
  }

  await expireRideOffers(now);
  await expirePassengerPriceBroadcastRequests(now);
  const ride = await Rides.findById(rideId).exec();
  if (!ride || !isOfferBasedRide(ride) || OPEN_RIDE_STATUSES.indexOf(String(ride.ridestatus || "")) === -1) {
    return {
      ok: false,
      code: "RIDE_NOT_OPEN_FOR_OFFERS",
      message: "This ride is not open for offers"
    };
  }

  const rideExpiry = buildOfferExpiry(now, ride);
  if (rideExpiry instanceof Date && rideExpiry.getTime() <= now.getTime()) {
    return {
      ok: false,
      code: "RIDE_OFFER_WINDOW_EXPIRED",
      message: "This ride request is no longer accepting offers"
    };
  }

  const eligibility = await evaluateDriverActionEligibility(driverId, { now: now });
  if (!eligibility.eligible) {
    return {
      ok: false,
      code: eligibility.code,
      message: eligibility.message
    };
  }

  let effectiveOfferType = requestedOfferType || OFFER_TYPE_DRIVER_DIRECT;
  let effectiveOfferedPrice = offeredPrice;
  if (isPassengerBroadcastRide(ride)) {
    if (effectiveOfferType === OFFER_TYPE_ACCEPT_PASSENGER_PRICE) {
      effectiveOfferedPrice = toNumber(ride.passenger_offered_price, NaN);
      if (!Number.isFinite(effectiveOfferedPrice) || effectiveOfferedPrice < 0) {
        return {
          ok: false,
          code: "PASSENGER_PRICE_NOT_AVAILABLE",
          message: "The passenger price is no longer available"
        };
      }
      effectiveOfferType = OFFER_TYPE_ACCEPT_PASSENGER_PRICE;
    } else {
      effectiveOfferType = OFFER_TYPE_DRIVER_COUNTER;
      if (!Number.isFinite(effectiveOfferedPrice) || effectiveOfferedPrice < 0) {
        return {
          ok: false,
          code: "INVALID_RIDE_OFFER",
          message: "A valid counter-offer price is required"
        };
      }
    }
  } else if (!Number.isFinite(effectiveOfferedPrice) || effectiveOfferedPrice < 0) {
    return {
      ok: false,
      code: "INVALID_RIDE_OFFER",
      message: "A valid ride offer price is required"
    };
  }

  const existing = await findPendingOffer(rideId, driverId);
  if (existing) {
    existing.offered_price = effectiveOfferedPrice;
    existing.currency = currency;
    existing.offer_type = effectiveOfferType;
    existing.estimated_arrival_minutes = estimatedArrivalMinutes;
    existing.message = message;
    existing.expires_at = buildOfferExpiry(now, ride);
    await existing.save();
    return {
      ok: true,
      action: "updated",
      ride,
      offer: await buildOfferSummary(existing)
    };
  }

  const created = await RideOffer.create({
    ride_request_id: String(ride._id),
    driver_id: driverId,
    offered_price: effectiveOfferedPrice,
    currency: currency,
    offer_type: effectiveOfferType,
    estimated_arrival_minutes: estimatedArrivalMinutes,
    message: message,
    status: "PENDING",
    expires_at: buildOfferExpiry(now, ride)
  });

  return {
    ok: true,
    action: "created",
    ride,
    offer: await buildOfferSummary(created)
  };
}

async function withdrawRideOffer(options) {
  const rideId = String(options.rideId || "").trim();
  const driverId = String(options.driverId || "").trim();
  const offerId = String(options.offerId || "").trim();

  const query = {
    driver_id: driverId,
    status: "PENDING"
  };
  if (offerId) {
    query._id = offerId;
  } else if (rideId) {
    query.ride_request_id = rideId;
  }

  const offer = await RideOffer.findOneAndUpdate(
    query,
    {
      $set: {
        status: "WITHDRAWN"
      }
    },
    {
      new: true
    }
  ).exec();

  if (!offer) {
    return {
      ok: false,
      code: "RIDE_OFFER_NOT_FOUND",
      message: "No active ride offer was found to withdraw"
    };
  }

  return {
    ok: true,
    offer: await buildOfferSummary(offer)
  };
}

async function acceptRideOffer(options) {
  const now = options && options.now instanceof Date ? options.now : new Date();
  const rideId = String(options.rideId || "").trim();
  const userId = String(options.userId || "").trim();
  const offerId = String(options.offerId || "").trim();

  await expireRideOffers(now);
  await expirePassengerPriceBroadcastRequests(now);
  const ride = await Rides.findOne({
    _id: rideId,
    user_id: userId
  }).exec();

  if (!ride || !isOfferBasedRide(ride)) {
    return {
      ok: false,
      code: "RIDE_NOT_OPEN_FOR_OFFERS",
      message: "This ride does not support offers"
    };
  }

  if (ACCEPTABLE_RIDE_STATUSES.indexOf(String(ride.ridestatus || "")) === -1 || String(ride.accepted_offer_id || "").trim()) {
    return {
      ok: false,
      code: "RIDE_OFFER_ALREADY_ACCEPTED",
      message: "A driver has already been selected for this ride"
    };
  }

  const offer = await RideOffer.findOne({
    _id: offerId,
    ride_request_id: rideId,
    status: "PENDING",
    expires_at: {
      $gt: now
    }
  }).exec();

  if (!offer) {
    return {
      ok: false,
      code: "RIDE_OFFER_NOT_AVAILABLE",
      message: "The selected driver offer is no longer available"
    };
  }

  const eligibility = await evaluateDriverActionEligibility(offer.driver_id, { now: now });
  if (!eligibility.eligible) {
    return {
      ok: false,
      code: eligibility.code,
      message: eligibility.message
    };
  }

  const driver = await Driver.findById(offer.driver_id).exec();
  const vehicle = driver
    ? await Vehicles.findOne({ user_id: String(driver._id) }).exec()
    : null;

  const acceptedRide = await Rides.findOneAndUpdate(
    {
      _id: rideId,
      user_id: userId,
      pricing_mode: ride.pricing_mode,
      ridestatus: {
        $in: ACCEPTABLE_RIDE_STATUSES
      },
      $or: [
        {
          accepted_offer_id: {
            $exists: false
          }
        },
        {
          accepted_offer_id: ""
        },
        {
          accepted_offer_id: null
        }
      ]
    },
    {
      $set: {
        accepted_offer_id: String(offer._id),
        final_agreed_price: toNumber(offer.offered_price, 0),
        final_agreed_currency: normalizeCurrency(offer.currency),
        driver_id: String(offer.driver_id),
        vehicle_no: vehicle ? String(vehicle.vehicle_number || "") : "",
        ridestatus: "accepted",
        ridestatusat: Math.floor(now.getTime() / 1000).toString()
      }
    },
    {
      new: true
    }
  ).exec();

  if (!acceptedRide) {
    return {
      ok: false,
      code: "RIDE_OFFER_ALREADY_ACCEPTED",
      message: "A driver has already been selected for this ride"
    };
  }

  await RideOffer.updateMany(
    {
      ride_request_id: rideId,
      status: "PENDING"
    },
    {
      $set: {
        status: "REJECTED"
      }
    }
  ).exec();
  await RideOffer.updateOne(
    {
      _id: offer._id
    },
    {
      $set: {
        status: "ACCEPTED"
      }
    }
  ).exec();
  await Driver.updateOne(
    {
      _id: String(offer.driver_id)
    },
    {
      $set: {
        live_status: "2"
      }
    }
  ).exec();

  return {
    ok: true,
    ride: acceptedRide,
    offer: await buildOfferSummary({
      ...offer.toObject(),
      status: "ACCEPTED"
    }),
    driver,
    vehicle
  };
}

async function getDriverOfferForRide(rideId, driverId, now) {
  await expireRideOffers(now);
  await expirePassengerPriceBroadcastRequests(now);
  const offer = await RideOffer.findOne({
    ride_request_id: String(rideId),
    driver_id: String(driverId)
  }).sort({ updated_at: -1, created_at: -1 }).exec();

  if (!offer) {
    return null;
  }

  return buildOfferSummary(offer);
}

async function filterEligibleDriverIdsForRide(driverDocs, now) {
  const eligible = await filterEligibleDrivers(driverDocs, { now: now });
  return eligible.map(function (driver) {
    return String(driver._id);
  });
}

async function getPassengerBroadcastAuthorization(userId, now, settings) {
  if (!isPassengerPriceBroadcastEnabled()) {
    return {
      allowed: false,
      code: "PASSENGER_PRICE_BROADCAST_DISABLED",
      message: "Passenger price broadcast is not enabled"
    };
  }

  const subscriptionState = await getCurrentPassengerSubscriptionWithFeatures(userId, now);
  if (!subscriptionState.subscription) {
    return {
      allowed: false,
      code: "PASSENGER_SUBSCRIPTION_REQUIRED",
      message: "An active passenger subscription is required"
    };
  }
  if (!subscriptionState.featureMap.CAN_SET_RIDE_PRICE) {
    return {
      allowed: false,
      code: "PASSENGER_PRICE_PERMISSION_REQUIRED",
      message: "Your subscription does not allow custom ride pricing"
    };
  }
  if (!subscriptionState.featureMap.CAN_BROADCAST_RIDE_REQUEST) {
    return {
      allowed: false,
      code: "PASSENGER_BROADCAST_PERMISSION_REQUIRED",
      message: "Your subscription does not allow ride request broadcasts"
    };
  }

  return {
    allowed: true,
    subscription: subscriptionState.subscription,
    featureMap: subscriptionState.featureMap,
    settings: settings
  };
}

module.exports = {
  OFFER_WINDOW_MINUTES,
  OFFER_TYPE_ACCEPT_PASSENGER_PRICE,
  OFFER_TYPE_DRIVER_COUNTER,
  OFFER_TYPE_DRIVER_DIRECT,
  REQUEST_TYPE_PASSENGER_PRICE_BROADCAST,
  REQUEST_TYPE_STANDARD,
  acceptRideOffer,
  buildOfferExpiry,
  expireDriverPricedRideRequests,
  expirePassengerPriceBroadcastRequests,
  expireRideOffers,
  filterEligibleDriverIdsForRide,
  getDriverOfferForRide,
  getPassengerBroadcastAuthorization,
  getPriceBroadcastSettings,
  isDriverOfferRide,
  isOfferBasedRide,
  isDriverPricingEnabled,
  isPassengerBroadcastRide,
  isPassengerPriceBroadcastEnabled,
  listRideOffersForPassenger,
  prepareDriverPricedRidePayload,
  preparePassengerPriceBroadcastPayload,
  submitRideOffer,
  withdrawRideOffer
};
