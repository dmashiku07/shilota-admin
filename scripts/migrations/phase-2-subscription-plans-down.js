const mongoose = require("mongoose");
const config = require("../../server/config");
const SubscriptionPlan = require("../../server/schema/subscriptionplans");
const Subscription = require("../../server/schema/subscriptions");

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

  await dropIndexSafe(SubscriptionPlan.collection, "subscription_plan_customer_order_idx");
  await dropIndexSafe(SubscriptionPlan.collection, "subscription_plan_customer_active_idx");
  await dropIndexSafe(SubscriptionPlan.collection, "subscription_plan_customer_name_idx");
  await dropIndexSafe(Subscription.collection, "subscription_plan_ref_idx");
  await dropIndexSafe(Subscription.collection, "subscription_customer_status_idx");

  console.log("Phase 2 subscription plan rollback completed");
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
