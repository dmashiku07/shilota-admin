var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var SubscriptionSchema = new Schema(
  {
    plan_id: {
      type: Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true
    },
    customer_type: {
      type: String,
      enum: ["DRIVER", "PASSENGER"],
      required: true
    },
    driver_id: {
      type: Schema.Types.ObjectId,
      ref: "Driver",
      default: null
    },
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    status: {
      type: String,
      enum: ["PENDING_PAYMENT", "ACTIVE", "EXPIRED", "CANCELLED", "SUSPENDED", "PAYMENT_FAILED"],
      default: "PENDING_PAYMENT"
    },
    payment_status: {
      type: String,
      enum: ["PENDING", "PAID", "FAILED"],
      default: "PENDING"
    },
    payment_reference: {
      type: String,
      default: ""
    },
    started_at: {
      type: Date,
      default: null
    },
    expires_at: {
      type: Date,
      default: null
    },
    rides_used_today: {
      type: Number,
      default: 0
    },
    ride_count_date: {
      type: String,
      default: ""
    },
    broadcasts_used_today: {
      type: Number,
      default: 0
    },
    broadcast_count_date: {
      type: String,
      default: ""
    },
    plan_name_snapshot: {
      type: String,
      default: ""
    },
    price_snapshot: {
      type: Number,
      default: 0
    },
    currency_snapshot: {
      type: String,
      default: "TZS"
    },
    duration_unit_snapshot: {
      type: String,
      enum: ["DAY", "WEEK", "MONTH", ""],
      default: ""
    },
    duration_value_snapshot: {
      type: Number,
      default: 0
    },
    daily_limit_snapshot: {
      type: Number,
      default: null
    },
    is_unlimited_snapshot: {
      type: Boolean,
      default: false
    },
    plan_features_snapshot: {
      type: [
        {
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
        }
      ],
      default: []
    },
    selcom_session_id: {
      type: Schema.Types.ObjectId,
      ref: "SelcomPaymentSession",
      default: null
    }
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  }
);

SubscriptionSchema.index(
  { plan_id: 1, status: 1 },
  { name: "subscription_plan_ref_idx" }
);
SubscriptionSchema.index(
  { customer_type: 1, status: 1 },
  { name: "subscription_customer_status_idx" }
);
SubscriptionSchema.index(
  { driver_id: 1, status: 1, expires_at: 1 },
  { name: "subscription_driver_status_expiry_idx" }
);
SubscriptionSchema.index(
  { driver_id: 1, created_at: -1 },
  { name: "subscription_driver_history_idx" }
);
SubscriptionSchema.index(
  { user_id: 1, status: 1, expires_at: 1 },
  { name: "subscription_user_status_expiry_idx" }
);
SubscriptionSchema.index(
  { user_id: 1, created_at: -1 },
  { name: "subscription_user_history_idx" }
);

module.exports = mongoose.model("Subscription", SubscriptionSchema);
