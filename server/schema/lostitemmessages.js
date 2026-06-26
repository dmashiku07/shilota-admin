var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var LostItemMessageSchema = new Schema({
  lost_item_id: {
    type: String,
    required: true,
    ref: "LostItems"
  },
  ride_id: {
    type: String,
    ref: "Rides"
  },
  user_id: {
    type: String,
    ref: "User"
  },
  driver_id: {
    type: String,
    ref: "Driver"
  },
  sender_type: {
    type: String,
    enum: ["user", "admin", "driver", "system"],
    required: true
  },
  sender_id: {
    type: String,
    default: ""
  },
  message: {
    type: String,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("LostItemMessages", LostItemMessageSchema);
