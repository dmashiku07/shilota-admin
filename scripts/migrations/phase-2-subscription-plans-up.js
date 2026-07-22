const mongoose = require("mongoose");
const config = require("../../server/config");
const SubscriptionPlan = require("../../server/schema/subscriptionplans");
const Subscription = require("../../server/schema/subscriptions");

async function run() {
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  await SubscriptionPlan.createCollection().catch(function () {});
  await Subscription.createCollection().catch(function () {});
  await SubscriptionPlan.createIndexes();
  await Subscription.createIndexes();

  console.log("Phase 2 subscription plan migration completed");
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
