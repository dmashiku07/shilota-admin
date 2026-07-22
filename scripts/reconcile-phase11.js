const mongoose = require("mongoose");
const config = require("../server/config");
const {
  reconcileDailyRideUsage,
  reconcileExpiredBroadcasts,
  reconcileExpiredOffers,
  reconcilePendingPayments,
  reconcileSubscriptionStatuses
} = require("../server/services/reportingService");

const COMMANDS = {
  "subscription-statuses": reconcileSubscriptionStatuses,
  "daily-ride-usage": reconcileDailyRideUsage,
  "pending-payments": reconcilePendingPayments,
  "expired-offers": reconcileExpiredOffers,
  "expired-broadcasts": reconcileExpiredBroadcasts
};

async function run() {
  const command = String(process.argv[2] || "").trim();
  if (!COMMANDS[command]) {
    console.error("Usage: node scripts/reconcile-phase11.js <subscription-statuses|daily-ride-usage|pending-payments|expired-offers|expired-broadcasts>");
    process.exit(1);
  }

  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const result = await COMMANDS[command](new Date());
  console.log(JSON.stringify({
    command: command,
    executed_at: new Date().toISOString(),
    result: result
  }, null, 2));
  await mongoose.disconnect();
}

run().catch(async function (error) {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch (_disconnectError) {}
  process.exit(1);
});
