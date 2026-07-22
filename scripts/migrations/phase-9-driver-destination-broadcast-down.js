const mongoose = require("mongoose");
const config = require("../../server/config");
const User = require("../../server/schema/user");
const DriverDestinationBroadcast = require("../../server/schema/driverdestinationbroadcasts");
const DriverDestinationJoinRequest = require("../../server/schema/driverdestinationjoinrequests");

async function run() {
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  await User.collection.updateMany(
    {},
    {
      $unset: {
        current_lat: 1,
        current_lng: 1,
        current_location: 1,
        loc: 1
      }
    }
  );

  await DriverDestinationBroadcast.collection.drop().catch(function () {});
  await DriverDestinationJoinRequest.collection.drop().catch(function () {});

  console.log("Phase 9 driver destination broadcast rollback completed");
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
