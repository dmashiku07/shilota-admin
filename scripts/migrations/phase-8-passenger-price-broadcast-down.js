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

  await Rides.collection.updateMany(
    {},
    {
      $unset: {
        request_type: 1,
        passenger_offered_price: 1,
        broadcast_radius: 1,
        broadcast_expires_at: 1
      }
    }
  );

  await RideOffer.collection.updateMany(
    {},
    {
      $unset: {
        offer_type: 1
      }
    }
  );

  await Subscription.collection.updateMany(
    {},
    {
      $unset: {
        broadcasts_used_today: 1,
        broadcast_count_date: 1
      }
    }
  );

  await PriceBroadcastSettings.collection.drop().catch(function () {});
  await Rides.collection.dropIndex("ride_request_type_status_expiry_idx").catch(function () {});
  await RideOffer.collection.dropIndex("ride_offer_type_status_idx").catch(function () {});

  console.log("Phase 8 passenger price broadcast rollback completed");
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
