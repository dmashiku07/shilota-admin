var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var RiderBlocksSchema = new Schema({
  driver_id: {
    type: String,
    required: true,
    ref: "Driver"
  },
  user_id: {
    type: String,
    required: true,
    ref: "User"
  },
  ride_id: {
    type: String,
    ref: "Rides"
  },
  reason: {
    type: String
  },
  status: {
    type: String,
    default: "active"
  },
  rider_block_count: {
    type: Number,
    default: 1
  },
  requires_account_review: {
    type: Boolean,
    default: false
  },
  driver_block_count: {
    type: Number,
    default: 1
  },
  requires_driver_review: {
    type: Boolean,
    default: false
  },
  admin_review_status: {
    type: String,
    default: "none"
  },
  escalation_action: {
    type: String,
    default: ""
  },
  review_notes: {
    type: String,
    default: ""
  },
  reviewed_at: {
    type: Date
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

RiderBlocksSchema.index({ driver_id: 1, user_id: 1 }, { unique: true });

module.exports = mongoose.model("RiderBlocks", RiderBlocksSchema);
