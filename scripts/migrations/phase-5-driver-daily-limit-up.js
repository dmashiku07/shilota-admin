const mongoose = require("mongoose");
const config = require("../../server/config");
const Rides = require("../../server/schema/rides");

async function run() {
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  await Rides.createCollection().catch(function () {});

  await Rides.collection.updateMany(
    {
      subscription_usage_counted_at: {
        $exists: false
      }
    },
    {
      $set: {
        subscription_usage_counted_at: null
      }
    }
  );

  console.log("Phase 5 driver daily limit migration completed");
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
