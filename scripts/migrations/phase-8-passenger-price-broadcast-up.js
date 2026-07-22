const mongoose = require("mongoose");
const config = require("../../server/config");
const Rides = require("../../server/schema/rides");
const RideOffer = require("../../server/schema/rideoffers");
const Subscription = require("../../server/schema/subscriptions");
const PriceBroadcastSettings = require("../../server/schema/pricebroadcastsettings");

async function run() {
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  await Rides.createCollection().catch(function () {});
  await RideOffer.createCollection().catch(function () {});
  await Subscription.createCollection().catch(function () {});
  await PriceBroadcastSettings.createCollection().catch(function () {});

  await Rides.collection.updateMany(
    { request_type: { $exists: false } },
    {
      $set: {
        request_type: "STANDARD",
        passenger_offered_price: null,
        broadcast_radius: null,
        broadcast_expires_at: null
      }
    }
  );

  await RideOffer.collection.updateMany(
    { offer_type: { $exists: false } },
    {
      $set: {
        offer_type: "DRIVER_DIRECT_OFFER"
      }
    }
  );

  await Subscription.collection.updateMany(
    { broadcasts_used_today: { $exists: false } },
    {
      $set: {
        broadcasts_used_today: 0,
        broadcast_count_date: ""
      }
    }
  );

  await PriceBroadcastSettings.findOneAndUpdate(
    {},
    {
      $setOnInsert: {
        enabled: true,
        default_radius_km: 8,
        max_radius_km: 20,
        default_expiry_minutes: 5,
        max_expiry_minutes: 15,
        max_broadcasts_per_day: null,
        updated_at: new Date()
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  ).exec();

  await Rides.collection.createIndex(
    { request_type: 1, ridestatus: 1, broadcast_expires_at: 1 },
    { name: "ride_request_type_status_expiry_idx" }
  ).catch(function () {});

  await RideOffer.collection.createIndex(
    { ride_request_id: 1, offer_type: 1, status: 1 },
    { name: "ride_offer_type_status_idx" }
  ).catch(function () {});

  console.log("Phase 8 passenger price broadcast migration completed");
}

run()
  .then(function () {
    return mongoose.disconnect();
  })
  .catch(function (error) {
    console.error(error);
    mongoose.disconnect().finally(function () {
      process.exit(1);
    });
  });
