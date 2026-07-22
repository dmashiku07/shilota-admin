var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var DestinationBroadcastSettingsSchema = new Schema(
  {
    enabled: {
      type: Boolean,
      default: true
    },
    broadcast_fee: {
      type: Number,
      default: 1000,
      min: 0
    },
    currency: {
      type: String,
      default: "TZS",
      trim: true
    },
    default_radius_km: {
      type: Number,
      default: 8,
      min: 1
    },
    max_radius_km: {
      type: Number,
      default: 20,
      min: 1
    },
    expiry_duration_minutes: {
      type: Number,
      default: 30,
      min: 1
    },
    maximum_active_broadcasts_per_driver: {
      type: Number,
      default: 1,
      min: 1
    },
    cancellation_refund_policy: {
      type: String,
      default: "NO_REFUND",
      trim: true
    }
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  }
);

module.exports = mongoose.model("DestinationBroadcastSettings", DestinationBroadcastSettingsSchema);
