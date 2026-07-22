const mongoose = require("mongoose");
const config = require("../../server/config");
const Rides = require("../../server/schema/rides");

async function run() {
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  await Rides.collection.updateMany(
    {},
    {
      $unset: {
        subscription_usage_counted_at: 1
      }
    }
  );

  console.log("Phase 5 driver daily limit rollback completed");
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
