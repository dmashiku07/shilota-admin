const mongoose = require("mongoose");
const config = require("../../server/config");

async function run() {
  await mongoose.connect(config.db, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const db = mongoose.connection.db;
  const destinationBroadcasts = db.collection("driverdestinationbroadcasts");
  const settings = db.collection("destinationbroadcastsettings");
  const sessions = db.collection("selcompaymentsessions");

  await destinationBroadcasts.updateMany(
    {},
    {
      $unset: {
        broadcast_fee: "",
        currency: "",
        payment_status: "",
        payment_reference: "",
        paid_at: "",
        selcom_session_id: ""
      }
    }
  );

  await settings.drop().catch(function () {});
  await sessions.dropIndex("selcom_destination_broadcast_lookup_idx").catch(function () {});

  await mongoose.disconnect();
}

run().catch(async function (error) {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch (_disconnectError) {}
  process.exit(1);
});
