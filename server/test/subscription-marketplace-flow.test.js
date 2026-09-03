const test = require("node:test");
const assert = require("node:assert/strict");

const config = require("../config");
const Driver = require("../schema/driver");
const RideOffer = require("../schema/rideoffers");
const Rides = require("../schema/rides");
const Reviews = require("../schema/reviews");
const Subscription = require("../schema/subscriptions");
const Vehicles = require("../schema/vehicles");
const driverSubscriptionService = require("../services/driverSubscriptionService");
const revenuePolicy = require("../services/rideRevenuePolicy");
const rideOfferService = require("../services/rideOfferService");

function execResult(value) {
  return {
    exec: async function () {
      return value;
    }
  };
}

function sortedExecResult(value) {
  return {
    sort: function () {
      return execResult(value);
    }
  };
}

function selectedExecResult(value) {
  return {
    select: function () {
      return execResult(value);
    }
  };
}

function createOfferDocument(data) {
  return {
    ...data,
    save: async function () {
      return this;
    },
    toObject: function () {
      const copy = { ...this };
      delete copy.save;
      delete copy.toObject;
      return copy;
    }
  };
}

function installMarketplaceMocks(state) {
  const originals = {
    driverFindById: Driver.findById,
    driverUpdateOne: Driver.updateOne,
    rideOfferCreate: RideOffer.create,
    rideOfferFindOne: RideOffer.findOne,
    rideOfferUpdateMany: RideOffer.updateMany,
    rideOfferUpdateOne: RideOffer.updateOne,
    ridesFindById: Rides.findById,
    ridesFindOne: Rides.findOne,
    ridesFindOneAndUpdate: Rides.findOneAndUpdate,
    ridesUpdateMany: Rides.updateMany,
    reviewsCountDocuments: Reviews.countDocuments,
    subscriptionFind: Subscription.find,
    subscriptionFindOne: Subscription.findOne,
    subscriptionFindOneAndUpdate: Subscription.findOneAndUpdate,
    subscriptionUpdateMany: Subscription.updateMany,
    subscriptionUpdateOne: Subscription.updateOne,
    vehiclesFindOne: Vehicles.findOne
  };

  Driver.findById = function (driverId) {
    return execResult(String(driverId) === String(state.driver._id) ? state.driver : null);
  };
  Driver.updateOne = function (_query, update) {
    if (update && update.$set) {
      Object.assign(state.driver, update.$set);
    }
    return execResult({ matchedCount: 1 });
  };

  Vehicles.findOne = function (query) {
    return execResult(String(query.user_id) === String(state.driver._id) ? state.vehicle : null);
  };
  Reviews.countDocuments = function () {
    return execResult(0);
  };

  Subscription.find = function () {
    return selectedExecResult([]);
  };
  Subscription.findOne = function (query) {
    let result = null;
    if (String(query.customer_type || "").toUpperCase() === "PASSENGER") {
      result = state.passengerSubscription;
    } else if (String(query.customer_type || "").toUpperCase() === "DRIVER") {
      result = state.driverSubscription;
    }
    if (result && query.status && String(result.status) !== String(query.status)) {
      result = null;
    }
    return sortedExecResult(result);
  };
  Subscription.updateMany = function () {
    return execResult({ matchedCount: 0 });
  };
  Subscription.updateOne = function (query, update) {
    return execResult((async function () {
      const subscription = state.driverSubscription;
      if (!subscription || String(subscription._id) !== String(query._id)) {
        return { matchedCount: 0 };
      }
      if (query.ride_count_date && query.ride_count_date.$ne === subscription.ride_count_date) {
        return { matchedCount: 0 };
      }
      if (update.$set) {
        Object.assign(subscription, update.$set);
      }
      return { matchedCount: 1 };
    })());
  };
  Subscription.findOneAndUpdate = function (query, update) {
    return execResult((async function () {
      const subscription = state.driverSubscription;
      if (!subscription || String(subscription._id) !== String(query._id)) {
        return null;
      }
      if (update.$inc && typeof update.$inc.rides_used_today === "number") {
        subscription.rides_used_today += update.$inc.rides_used_today;
      }
      if (update.$set) {
        Object.assign(subscription, update.$set);
      }
      return subscription;
    })());
  };

  Rides.findById = function (rideId) {
    return execResult(String(rideId) === String(state.ride._id) ? state.ride : null);
  };
  Rides.findOne = function (query) {
    const isRideMatch =
      String(query._id) === String(state.ride._id) &&
      (!query.user_id || String(query.user_id) === String(state.ride.user_id));
    return execResult(isRideMatch ? state.ride : null);
  };
  Rides.findOneAndUpdate = function (query, update) {
    return execResult((async function () {
      if (String(query._id) !== String(state.ride._id)) {
        return null;
      }

      if (query.ridestatus === "completed") {
        if (
          String(state.ride.driver_id) !== String(query.driver_id) ||
          state.ride.ridestatus !== "completed" ||
          state.ride.subscription_usage_counted_at
        ) {
          return null;
        }
        Object.assign(state.ride, update.$set || {});
        return state.ride;
      }

      if (
        query.user_id &&
        String(query.user_id) === String(state.ride.user_id) &&
        query.ridestatus &&
        Array.isArray(query.ridestatus.$in) &&
        query.ridestatus.$in.indexOf(state.ride.ridestatus) >= 0 &&
        !String(state.ride.accepted_offer_id || "").trim()
      ) {
        Object.assign(state.ride, update.$set || {});
        return state.ride;
      }

      return null;
    })());
  };
  Rides.updateMany = function () {
    return execResult({ matchedCount: 0 });
  };

  RideOffer.create = async function (payload) {
    const offer = createOfferDocument({
      _id: "offer-counter-1",
      created_at: state.now,
      updated_at: state.now,
      ...payload
    });
    state.offers.push(offer);
    return offer;
  };
  RideOffer.findOne = function (query) {
    let offer = null;
    if (query._id) {
      offer = state.offers.find(function (item) {
        return (
          String(item._id) === String(query._id) &&
          String(item.ride_request_id) === String(query.ride_request_id) &&
          String(item.status) === String(query.status)
        );
      }) || null;
    } else {
      offer = state.offers.find(function (item) {
        return (
          String(item.ride_request_id) === String(query.ride_request_id) &&
          String(item.driver_id) === String(query.driver_id) &&
          String(item.status) === String(query.status)
        );
      }) || null;
    }
    return query.driver_id && !query._id ? sortedExecResult(offer) : execResult(offer);
  };
  RideOffer.updateMany = function (query, update) {
    state.offers.forEach(function (offer) {
      if (String(offer.ride_request_id) === String(query.ride_request_id) && String(offer.status) === String(query.status)) {
        Object.assign(offer, update.$set || {});
      }
    });
    return execResult({ matchedCount: state.offers.length });
  };
  RideOffer.updateOne = function (query, update) {
    const offer = state.offers.find(function (item) {
      return String(item._id) === String(query._id);
    });
    if (offer && update.$set) {
      Object.assign(offer, update.$set);
    }
    return execResult({ matchedCount: offer ? 1 : 0 });
  };

  return function restore() {
    Driver.findById = originals.driverFindById;
    Driver.updateOne = originals.driverUpdateOne;
    RideOffer.create = originals.rideOfferCreate;
    RideOffer.findOne = originals.rideOfferFindOne;
    RideOffer.updateMany = originals.rideOfferUpdateMany;
    RideOffer.updateOne = originals.rideOfferUpdateOne;
    Rides.findById = originals.ridesFindById;
    Rides.findOne = originals.ridesFindOne;
    Rides.findOneAndUpdate = originals.ridesFindOneAndUpdate;
    Rides.updateMany = originals.ridesUpdateMany;
    Reviews.countDocuments = originals.reviewsCountDocuments;
    Subscription.find = originals.subscriptionFind;
    Subscription.findOne = originals.subscriptionFindOne;
    Subscription.findOneAndUpdate = originals.subscriptionFindOneAndUpdate;
    Subscription.updateMany = originals.subscriptionUpdateMany;
    Subscription.updateOne = originals.subscriptionUpdateOne;
    Vehicles.findOne = originals.vehiclesFindOne;
  };
}

test("subscription marketplace flow gates, accepts passenger price, completes, and records no commission", async function () {
  const previousFlags = { ...config.featureFlags };
  Object.assign(config.featureFlags, {
    commission_enabled: false,
    driver_subscriptions_enabled: true,
    driver_pricing_enabled: true,
    passenger_price_broadcast_enabled: true,
    driver_destination_broadcast_enabled: true
  });

  const state = {
    now: new Date("2026-07-24T09:00:00.000Z"),
    driver: {
      _id: "driver-market-1",
      full_name: "Market Driver",
      profile_image: "",
      rating: 0,
      approval: "1",
      deletion_status: 0,
      live_status: "1"
    },
    driverSubscription: null,
    passengerSubscription: null,
    vehicle: {
      user_id: "driver-market-1",
      vehicle_name: "Toyota Spacio",
      vehicle_number: "T123 ABC"
    },
    ride: {
      _id: "ride-market-1",
      user_id: "passenger-market-1",
      type: "now",
      payment_type: "cash",
      category_id: "category-1",
      pickup_location: "Upanga",
      pickup_lat: "-6.812",
      pickup_lng: "39.287",
      drop_location: "Airport",
      drop_lat: "-6.878",
      drop_lng: "39.202",
      ridestatus: "requested",
      accepted_offer_id: "",
      payment_status: "unpaid"
    },
    offers: []
  };
  const restore = installMarketplaceMocks(state);

  try {
    const blockedPassenger = await rideOfferService.getPassengerBroadcastAuthorization(
      state.ride.user_id,
      state.now,
      { enabled: true }
    );
    assert.equal(blockedPassenger.allowed, false);
    assert.equal(blockedPassenger.code, "PASSENGER_SUBSCRIPTION_REQUIRED");

    state.passengerSubscription = {
      _id: "passenger-sub-1",
      customer_type: "PASSENGER",
      user_id: state.ride.user_id,
      status: "ACTIVE",
      starts_at: new Date("2026-07-24T00:00:00.000Z"),
      expires_at: new Date("2026-08-24T00:00:00.000Z"),
      plan_features_snapshot: [
        { feature_code: "CAN_SET_RIDE_PRICE", feature_value: true },
        { feature_code: "CAN_BROADCAST_RIDE_REQUEST", feature_value: true }
      ]
    };

    const allowedPassenger = await rideOfferService.getPassengerBroadcastAuthorization(
      state.ride.user_id,
      state.now,
      { enabled: true }
    );
    assert.equal(allowedPassenger.allowed, true);

    await rideOfferService.preparePassengerPriceBroadcastPayload(state.ride, {
      enabled: true,
      passengerOfferedPrice: 8000,
      broadcastRadius: 8,
      expiryMinutes: 10,
      currency: "TZS",
      now: state.now
    });
    assert.equal(state.ride.request_type, rideOfferService.REQUEST_TYPE_PASSENGER_PRICE_BROADCAST);
    assert.equal(state.ride.passenger_offered_price, 8000);

    const blockedDriverOffer = await rideOfferService.submitRideOffer({
      rideId: state.ride._id,
      driverId: state.driver._id,
      offeredPrice: 10000,
      offerType: rideOfferService.OFFER_TYPE_DRIVER_COUNTER,
      currency: "TZS",
      now: state.now
    });
    assert.equal(blockedDriverOffer.ok, false);
    assert.equal(blockedDriverOffer.code, "DRIVER_SUBSCRIPTION_REQUIRED");

    state.driverSubscription = {
      _id: "driver-sub-1",
      customer_type: "DRIVER",
      driver_id: state.driver._id,
      status: "ACTIVE",
      starts_at: new Date("2026-07-24T00:00:00.000Z"),
      expires_at: new Date("2026-07-25T00:00:00.000Z"),
      rides_used_today: 0,
      ride_count_date: "2026-07-24",
      daily_limit_snapshot: 3,
      is_unlimited_snapshot: false
    };

    const rejectedCounter = await rideOfferService.submitRideOffer({
      rideId: state.ride._id,
      driverId: state.driver._id,
      offeredPrice: 10000,
      offerType: rideOfferService.OFFER_TYPE_DRIVER_COUNTER,
      estimatedArrivalMinutes: 6,
      message: "I can take this trip for 10,000",
      currency: "TZS",
      now: state.now
    });
    assert.equal(rejectedCounter.ok, false);
    assert.equal(rejectedCounter.code, "COUNTER_OFFERS_NOT_ALLOWED");

    const driverAcceptance = await rideOfferService.submitRideOffer({
      rideId: state.ride._id,
      driverId: state.driver._id,
      offeredPrice: 8000,
      offerType: rideOfferService.OFFER_TYPE_ACCEPT_PASSENGER_PRICE,
      estimatedArrivalMinutes: 6,
      currency: "TZS",
      now: state.now
    });
    assert.equal(driverAcceptance.ok, true);
    assert.equal(driverAcceptance.autoAccepted, true);
    assert.equal(driverAcceptance.action, "accepted");
    assert.equal(driverAcceptance.offer.offered_price, 8000);
    assert.equal(driverAcceptance.offer.offer_type, rideOfferService.OFFER_TYPE_ACCEPT_PASSENGER_PRICE);
    assert.equal(state.ride.driver_id, state.driver._id);
    assert.equal(state.ride.accepted_offer_id, "offer-counter-1");
    assert.equal(state.ride.final_agreed_price, 8000);
    assert.equal(state.ride.final_agreed_currency, "TZS");

    state.ride.ridestatus = "completed";
    revenuePolicy.applyRideCompletionFinancials({
      ride: state.ride,
      baseFare: state.ride.final_agreed_price,
      taxRate: 0,
      commissionBands: [{ price_from: 0, price_to: 50000, percentage: 20 }],
      commissionEnabled: false
    });
    revenuePolicy.markRidePaymentComplete(state.ride, "cash", new Date("2026-07-24T09:30:00.000Z"));

    const counted = await driverSubscriptionService.consumeCompletedRideUsage({
      rideId: state.ride._id,
      driverId: state.driver._id,
      now: new Date("2026-07-24T09:31:00.000Z")
    });
    const duplicateCount = await driverSubscriptionService.consumeCompletedRideUsage({
      rideId: state.ride._id,
      driverId: state.driver._id,
      now: new Date("2026-07-24T09:32:00.000Z")
    });
    assert.equal(counted.counted, true);
    assert.equal(duplicateCount.counted, false);
    assert.equal(state.driverSubscription.rides_used_today, 1);
    assert.equal(counted.usage.remaining_rides, 2);

    const payment = revenuePolicy.buildPaymentDocument({
      ride: state.ride,
      userId: state.ride.user_id,
      driverId: state.driver._id,
      paymentType: "cash",
      paidAt: new Date("2026-07-24T09:30:00.000Z")
    });
    assert.equal(state.ride.commissionamount, 0);
    assert.equal(state.ride.payment_direct_to_driver, 1);
    assert.equal(payment.commissionamount, 0);
    assert.equal(payment.direct_to_driver, 1);
    assert.equal(revenuePolicy.isSettlementEligiblePayment(payment), false);
  } finally {
    restore();
    Object.assign(config.featureFlags, previousFlags);
  }
});
