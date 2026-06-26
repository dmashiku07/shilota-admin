var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var SosAlertsSchema = new Schema({
  actor_type: {
    type: String,
    enum: ["user", "driver"],
    required: true
  },
  actor_id: {
    type: String,
    required: true,
    refPath: "actor_model"
  },
  actor_model: {
    type: String,
    required: true,
    enum: ["User", "Driver"]
  },
  ride_id: {
    type: String,
    ref: "Rides"
  },
  location: {
    type: String
  },
  lat: {
    type: String
  },
  lng: {
    type: String
  },
  message: {
    type: String
  },
  action_type: {
    type: String
  },
  contact_target: {
    type: String
  },
  status: {
    type: String,
    default: "active"
  },
  contacts_notified: {
    type: Number,
    default: 0
  },
  ops_notified: {
    type: Boolean,
    default: true
  },
  response_due_at: {
    type: Date
  },
  callback_required: {
    type: Boolean,
    default: true
  },
  callback_status: {
    type: String,
    default: "pending"
  },
  resolved_at: {
    type: Date
  },
  resolved_by: {
    type: String
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("SosAlerts", SosAlertsSchema);
