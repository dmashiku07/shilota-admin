const mongoose = require("mongoose");
const config = require("../../server/config");
const Rides = require("../../server/schema/rides");
const RideOffer = require("../../server/schema/rideoffers");

async function run() {
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  await Rides.createCollection().catch(function () {});
  await RideOffer.createCollection().catch(function () {});

  await Rides.collection.updateMany(
    {
      pricing_mode: {
        $exists: false
      }
    },
    {
      $set: {
        pricing_mode: "platform",
        accepted_offer_id: "",
        final_agreed_currency: "TZS",
        offer_expires_at: null
      }
    }
  );

  await Rides.collection.updateMany(
    {
      final_agreed_price: {
        $exists: false
      }
    },
    {
      $set: {
        final_agreed_price: null
      }
    }
  );

  await RideOffer.collection.createIndex(
    { ride_request_id: 1, driver_id: 1, status: 1 },
    { name: "ride_offer_driver_status_idx" }
  ).catch(function () {});
  await RideOffer.collection.createIndex(
    { ride_request_id: 1, status: 1, created_at: -1 },
    { name: "ride_offer_request_status_idx" }
  ).catch(function () {});
  await RideOffer.collection.createIndex(
    { driver_id: 1, status: 1, expires_at: 1 },
    { name: "ride_offer_driver_expiry_idx" }
  ).catch(function () {});

  console.log("Phase 6 driver pricing migration completed");
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
