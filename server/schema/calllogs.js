var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var CallLogsSchema = new Schema({
  room_id: {
    type: String,
    required: true,
    index: true
  },
  sender_id: {
    type: String,
    required: true
  },
  sender_type: {
    type: String,
    required: true
  },
  receiver_id: {
    type: String,
    required: true
  },
  receiver_type: {
    type: String,
    default: "unknown"
  },
  onride_id: {
    type: String,
    ref: "Rides"
  },
  call_type: {
    type: String,
    default: "audio"
  },
  platform: {
    type: String,
    default: ""
  },
  status: {
    type: String,
    default: "started"
  },
  started_at: {
    type: Date,
    default: Date.now
  },
  ended_at: {
    type: Date
  },
  duration_seconds: {
    type: Number,
    default: 0
  },
  abuse_flag_status: {
    type: String,
    default: "none"
  },
  abuse_notes: {
    type: String,
    default: ""
  },
  reviewed_by: {
    type: String,
    default: ""
  },
  reviewed_at: {
    type: Date
  },
  created_at: {
    type: Date,
    default: Date.now,
    expires: 604800
  }
});

module.exports = mongoose.model("CallLogs", CallLogsSchema);
