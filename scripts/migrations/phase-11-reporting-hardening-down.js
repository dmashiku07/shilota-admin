const mongoose = require("mongoose");
const config = require("../../server/config");

async function run() {
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const db = mongoose.connection.db;
  await db.collection("auditlogs").dropIndex("audit_log_action_created_idx").catch(function () {});
  await db.collection("auditlogs").dropIndex("audit_log_target_created_idx").catch(function () {});
  await db.collection("auditlogs").dropIndex("audit_log_actor_created_idx").catch(function () {});
  await db.collection("subscriptions").dropIndex("subscription_reporting_status_expiry_idx").catch(function () {});
  await db.collection("rideoffers").dropIndex("ride_offer_reporting_type_status_idx").catch(function () {});
  await db.collection("driverdestinationbroadcasts").dropIndex("destination_broadcast_reporting_payment_status_idx").catch(function () {});

  await mongoose.disconnect();
}

run().catch(async function (error) {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch (_disconnectError) {}
  process.exit(1);
});
