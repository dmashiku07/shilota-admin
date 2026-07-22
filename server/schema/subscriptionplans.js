var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var SubscriptionPlanSchema = new Schema(
  {
    customer_type: {
      type: String,
      enum: ["DRIVER", "PASSENGER"],
      required: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: "",
      trim: true
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: "TZS"
    },
    duration_unit: {
      type: String,
      enum: ["DAY", "WEEK", "MONTH"],
      required: true,
      trim: true
    },
    duration_value: {
      type: Number,
      required: true,
      min: 1
    },
    daily_ride_limit: {
      type: Number,
      default: null,
      validate: {
        validator: function (value) {
          if (this.is_unlimited) {
            return value === null || typeof value === "undefined" || Number(value) > 0;
          }
          if (this.customer_type === "DRIVER") {
            return Number(value) > 0;
          }
          return value === null || typeof value === "undefined" || Number(value) > 0;
        },
        message: "Daily ride limit is invalid for the selected plan type"
      }
    },
    is_unlimited: {
      type: Boolean,
      default: false
    },
    is_active: {
      type: Boolean,
      default: true
    },
    display_order: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  }
);

SubscriptionPlanSchema.index(
  { customer_type: 1, display_order: 1 },
  { name: "subscription_plan_customer_order_idx" }
);
SubscriptionPlanSchema.index(
  { customer_type: 1, is_active: 1, display_order: 1 },
  { name: "subscription_plan_customer_active_idx" }
);
SubscriptionPlanSchema.index(
  { customer_type: 1, name: 1 },
  { name: "subscription_plan_customer_name_idx" }
);

module.exports = mongoose.model("SubscriptionPlan", SubscriptionPlanSchema);
