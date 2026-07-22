const mongoose = require("mongoose");
const config = require("../../server/config");
const Rides = require("../../server/schema/rides");
const RideOffer = require("../../server/schema/rideoffers");

async function run() {
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  await Rides.collection.updateMany(
    {},
    {
      $unset: {
        pricing_mode: 1,
        accepted_offer_id: 1,
        final_agreed_currency: 1,
        offer_expires_at: 1,
        final_agreed_price: 1
      }
    }
  );

  await RideOffer.collection.drop().catch(function () {});

  console.log("Phase 6 driver pricing rollback completed");
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
