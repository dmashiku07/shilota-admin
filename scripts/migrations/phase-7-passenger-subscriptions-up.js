const mongoose = require("mongoose");
const config = require("../../server/config");
const Subscription = require("../../server/schema/subscriptions");
const SubscriptionPlanFeature = require("../../server/schema/subscriptionplanfeatures");
const SelcomPaymentSession = require("../../server/schema/selcompaymentsession");

async function run() {
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  await Subscription.createCollection().catch(function () {});
  await SubscriptionPlanFeature.createCollection().catch(function () {});
  await SelcomPaymentSession.createCollection().catch(function () {});

  await Subscription.collection.updateMany(
    {
      plan_features_snapshot: {
        $exists: false
      }
    },
    {
      $set: {
        plan_features_snapshot: []
      }
    }
  );

  await Subscription.createIndexes();
  await SubscriptionPlanFeature.createIndexes();
  await SelcomPaymentSession.createIndexes();

  console.log("Phase 7 passenger subscriptions migration completed");
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
