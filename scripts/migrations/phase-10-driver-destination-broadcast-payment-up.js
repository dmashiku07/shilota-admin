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
      $set: {
        broadcast_fee: 0,
        currency: "TZS",
        payment_status: "PAID",
        payment_reference: ""
      },
      $setOnInsert: {
        paid_at: null,
        selcom_session_id: null
      }
    }
  );

  await settings.updateOne(
    {},
    {
      $setOnInsert: {
        enabled: true,
        broadcast_fee: 1000,
        currency: "TZS",
        default_radius_km: 8,
        max_radius_km: 20,
        expiry_duration_minutes: 30,
        maximum_active_broadcasts_per_driver: 1,
        cancellation_refund_policy: "NO_REFUND",
        created_at: new Date(),
        updated_at: new Date()
      }
    },
    { upsert: true }
  );

  await sessions.createIndex(
    { destination_broadcast_id: 1, actor_type: 1, createdAt: -1 },
    { name: "selcom_destination_broadcast_lookup_idx", sparse: true }
  );

  await mongoose.disconnect();
}

run().catch(async function (error) {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch (_disconnectError) {}
  process.exit(1);
});
