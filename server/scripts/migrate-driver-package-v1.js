/*
 * Staging-only, opt-in migration for the UAT driver package model.
 *
 * Usage: node server/scripts/migrate-driver-package-v1.js --apply
 * Without --apply this script reports candidate records and writes nothing.
 * It deliberately skips plans whose terms are not the approved 10 rides / 7
 * days, so no historic entitlement is guessed or overwritten.
 */
const mongoose = require("mongoose");
const config = require("../config");
const Subscription = require("../schema/subscriptions");
const SubscriptionPlan = require("../schema/subscriptionplans");

const APPLY = process.argv.indexOf("--apply") >= 0;
const CREDITS = 10;

async function main() {
  await mongoose.connect(config.mongoURI);
  const plans = await SubscriptionPlan.find({
    customer_type: "DRIVER",
    duration_unit: "WEEK",
    duration_value: 1,
    ride_credit_count: CREDITS
  }).select("_id").lean().exec();
  const planIds = plans.map(function (plan) { return plan._id; });
  const query = {
    customer_type: "DRIVER",
    plan_id: { $in: planIds },
    ride_credit_total_snapshot: null
  };
  const candidates = await Subscription.find(query).select("_id driver_id plan_id status payment_status").lean().exec();
  console.log(JSON.stringify({ apply: APPLY, candidates: candidates.length, skipped_unmatched_plan_terms: true }));
  if (APPLY && candidates.length) {
    await Subscription.updateMany(query, {
      $set: {
        ride_credit_total_snapshot: CREDITS,
        ride_credits_remaining: CREDITS,
        ride_credits_consumed: 0
      }
    }).exec();
    console.log(JSON.stringify({ migrated: candidates.length }));
  }
  await mongoose.disconnect();
}

main().catch(async function (error) {
  console.error(error && error.message ? error.message : error);
  await mongoose.disconnect();
  process.exitCode = 1;
});
