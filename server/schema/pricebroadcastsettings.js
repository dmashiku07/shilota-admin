var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var PriceBroadcastSettingsSchema = new Schema(
  {
    enabled: {
      type: Boolean,
      default: true
    },
    default_radius_km: {
      type: Number,
      default: 8
    },
    max_radius_km: {
      type: Number,
      default: 20
    },
    default_expiry_minutes: {
      type: Number,
      default: 5
    },
    max_expiry_minutes: {
      type: Number,
      default: 15
    },
    max_broadcasts_per_day: {
      type: Number,
      default: null
    },
    updated_at: {
      type: Date,
      default: Date.now
    }
  },
  {
    collection: "pricebroadcastsettings"
  }
);

module.exports = mongoose.model("PriceBroadcastSettings", PriceBroadcastSettingsSchema);
