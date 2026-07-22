var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var SubscriptionPlanFeatureSchema = new Schema(
  {
    plan_id: {
      type: Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
      index: true
    },
    customer_type: {
      type: String,
      enum: ["DRIVER", "PASSENGER"],
      required: true,
      trim: true
    },
    feature_code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    feature_value: {
      type: Schema.Types.Mixed,
      default: true
    }
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  }
);

SubscriptionPlanFeatureSchema.index(
  { plan_id: 1, feature_code: 1 },
  { unique: true, name: "subscription_plan_feature_unique_idx" }
);

SubscriptionPlanFeatureSchema.index(
  { customer_type: 1, feature_code: 1 },
  { name: "subscription_plan_feature_customer_code_idx" }
);

module.exports = mongoose.model("SubscriptionPlanFeature", SubscriptionPlanFeatureSchema);
