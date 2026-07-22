const mongoose = require("mongoose");
const config = require("../../server/config");
const Subscription = require("../../server/schema/subscriptions");
const SelcomPaymentSession = require("../../server/schema/selcompaymentsession");

async function run() {
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  await Subscription.createCollection().catch(function () {});
  await SelcomPaymentSession.createCollection().catch(function () {});
  await Subscription.createIndexes();
  await SelcomPaymentSession.createIndexes();

  console.log("Phase 3 driver subscriptions migration completed");
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
