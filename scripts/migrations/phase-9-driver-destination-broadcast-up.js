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

  await User.createCollection().catch(function () {});
  await DriverDestinationBroadcast.createCollection().catch(function () {});
  await DriverDestinationJoinRequest.createCollection().catch(function () {});

  await User.collection.updateMany(
    { current_lat: { $exists: false } },
    {
      $set: {
        current_lat: null,
        current_lng: null,
        current_location: ""
      }
    }
  );

  await User.collection.updateMany(
    { loc: { $exists: false } },
    {
      $set: {
        loc: []
      }
    }
  );

  await DriverDestinationBroadcast.collection.createIndex(
    { driver_id: 1, status: 1, departure_time: 1 },
    { name: "driver_destination_broadcast_driver_status_idx" }
  ).catch(function () {});

  await DriverDestinationBroadcast.collection.createIndex(
    { status: 1, expires_at: 1, departure_time: 1 },
    { name: "driver_destination_broadcast_status_expiry_idx" }
  ).catch(function () {});

  await DriverDestinationJoinRequest.collection.createIndex(
    { broadcast_id: 1, passenger_id: 1, status: 1 },
    { name: "driver_destination_join_request_passenger_status_idx" }
  ).catch(function () {});

  await DriverDestinationJoinRequest.collection.createIndex(
    { broadcast_id: 1, status: 1, created_at: 1 },
    { name: "driver_destination_join_request_broadcast_status_idx" }
  ).catch(function () {});

  console.log("Phase 9 driver destination broadcast migration completed");
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
