var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var RideChatMessageSchema = new Schema({
  onride_id: {
    type: String,
    required: true,
    index: true
  },
  user_id: {
    type: String,
    default: ""
  },
  driver_id: {
    type: String,
    default: ""
  },
  sender_type: {
    type: String,
    default: "user"
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

module.exports = mongoose.model("RideChatMessages", RideChatMessageSchema);
