const mongoose = require("mongoose");
const config = require("../../server/config");

async function run() {
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const db = mongoose.connection.db;
  const auditLogs = db.collection("auditlogs");
  const subscriptions = db.collection("subscriptions");
  const rideOffers = db.collection("rideoffers");
  const destinationBroadcasts = db.collection("driverdestinationbroadcasts");

  await auditLogs.createIndex(
    { action: 1, created_at: -1 },
    { name: "audit_log_action_created_idx" }
  );
  await auditLogs.createIndex(
    { target_type: 1, target_id: 1, created_at: -1 },
    { name: "audit_log_target_created_idx" }
  );
  await auditLogs.createIndex(
    { actor_type: 1, actor_id: 1, created_at: -1 },
    { name: "audit_log_actor_created_idx" }
  );
  await subscriptions.createIndex(
    { customer_type: 1, payment_status: 1, expires_at: 1 },
    { name: "subscription_reporting_status_expiry_idx" }
  );
  await rideOffers.createIndex(
    { ride_request_id: 1, offer_type: 1, status: 1 },
    { name: "ride_offer_reporting_type_status_idx" }
  );
  await destinationBroadcasts.createIndex(
    { payment_status: 1, status: 1, created_at: -1 },
    { name: "destination_broadcast_reporting_payment_status_idx" }
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
