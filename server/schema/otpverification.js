var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var OtpVerificationSchema = new Schema(
  {
    phone_number: {
      type: String,
      required: true,
      index: true
    },
    country_code: {
      type: Number,
      default: 255
    },
    purpose: {
      type: String,
      default: "signup",
      index: true
    },
    otp_hash: {
      type: String,
      required: true
    },
    expires_at: {
      type: Date,
      required: true,
      index: true
    },
    attempt_count: {
      type: Number,
      default: 0
    },
    verified: {
      type: Boolean,
      default: false,
      index: true
    },
    verified_at: {
      type: Date,
      default: null
    },
    consumed: {
      type: Boolean,
      default: false,
      index: true
    },
    consumed_at: {
      type: Date,
      default: null
    },
    sms_enabled: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("OtpVerification", OtpVerificationSchema);
