var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var LostItemsSchema = new Schema({
  ride_id: {
    type: String,
    required: true,
    ref: "Rides"
  },
  user_id: {
    type: String,
    required: true,
    ref: "User"
  },
  driver_id: {
    type: String,
    ref: "Driver"
  },
  item_description: {
    type: String,
    required: true
  },
  contact_phone: {
    type: String
  },
  status: {
    type: String,
    default: "open"
  },
  response_due_at: {
    type: Date
  },
  escalation_status: {
    type: String,
    default: "normal"
  },
  escalated_at: {
    type: Date
  },
  driver_notes: {
    type: String
  },
  driver_notified: {
    type: Boolean,
    default: false
  },
  chat_opened: {
    type: Boolean,
    default: false
  },
  return_incentive_status: {
    type: String,
    default: "eligible"
  },
  rider_confirmed_returned: {
    type: Boolean,
    default: false
  },
  rider_confirmed_returned_at: {
    type: Date
  },
  repeat_driver_loss_count: {
    type: Number,
    default: 0
  },
  driver_flagged: {
    type: Boolean,
    default: false
  },
  last_message_at: {
    type: Date
  },
  last_message_preview: {
    type: String
  },
  last_message_sender: {
    type: String
  },
  unread_user_count: {
    type: Number,
    default: 0
  },
  unread_admin_count: {
    type: Number,
    default: 0
  },
  unread_driver_count: {
    type: Number,
    default: 0
  },
  admin_notes: {
    type: String
  },
  resolved_at: {
    type: Date
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("LostItems", LostItemsSchema);
