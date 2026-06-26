var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var PoolSettingsSchema = new Schema({
  enabled: {
    type: Boolean,
    default: true
  },
  discount_percent: {
    type: Number,
    default: 15
  },
  max_passengers: {
    type: Number,
    default: 3
  },
  max_detour_km: {
    type: Number,
    default: 3
  },
  max_pickup_gap_km: {
    type: Number,
    default: 2
  },
  max_drop_gap_km: {
    type: Number,
    default: 3
  },
  zone_overrides: {
    type: Array,
    default: []
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("PoolSettings", PoolSettingsSchema);
