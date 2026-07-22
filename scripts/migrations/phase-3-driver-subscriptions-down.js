const mongoose = require("mongoose");
const config = require("../../server/config");
const Subscription = require("../../server/schema/subscriptions");
const SelcomPaymentSession = require("../../server/schema/selcompaymentsession");

async function dropIndexSafe(collection, indexName) {
  try {
    await collection.dropIndex(indexName);
  } catch (_error) {}
}

async function run() {
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  await dropIndexSafe(Subscription.collection, "subscription_driver_status_expiry_idx");
  await dropIndexSafe(Subscription.collection, "subscription_driver_history_idx");
  await dropIndexSafe(SelcomPaymentSession.collection, "purpose_1");
  await dropIndexSafe(SelcomPaymentSession.collection, "subscription_id_1");
  await dropIndexSafe(SelcomPaymentSession.collection, "plan_id_1");

  console.log("Phase 3 driver subscriptions rollback completed");
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
