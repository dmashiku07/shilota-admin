const mongoose = require("mongoose");
const config = require("../../server/config");
const Subscription = require("../../server/schema/subscriptions");
const SubscriptionPlanFeature = require("../../server/schema/subscriptionplanfeatures");
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

  await Subscription.collection.updateMany(
    {},
    {
      $unset: {
        plan_features_snapshot: 1
      }
    }
  );

  await dropIndexSafe(Subscription.collection, "subscription_user_status_expiry_idx");
  await dropIndexSafe(Subscription.collection, "subscription_user_history_idx");
  await dropIndexSafe(SubscriptionPlanFeature.collection, "subscription_plan_feature_unique_idx");
  await dropIndexSafe(SubscriptionPlanFeature.collection, "subscription_plan_feature_customer_code_idx");
  await SubscriptionPlanFeature.collection.drop().catch(function () {});
  await dropIndexSafe(SelcomPaymentSession.collection, "actor_type_1");

  console.log("Phase 7 passenger subscriptions rollback completed");
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
