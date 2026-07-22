var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var SelcomPaymentSessionSchema = new Schema(
  {
    transid: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    user_id: {
      type: String,
      required: true,
      index: true
    },
    actor_type: {
      type: String,
      default: "user",
      index: true
    },
    purpose: {
      type: String,
      default: "wallet",
      index: true
    },
    amount: {
      type: Number,
      required: true
    },
    subscription_id: {
      type: String,
      default: null,
      index: true
    },
    destination_broadcast_id: {
      type: String,
      default: null,
      index: true
    },
    plan_id: {
      type: String,
      default: null
    },
    status: {
      type: String,
      default: "pending",
      index: true
    },
    order_id: {
      type: String,
      default: null
    },
    reference: {
      type: String,
      default: null
    },
    channel: {
      type: String,
      default: null
    },
    phone: {
      type: String,
      default: null
    },
    payment_status: {
      type: String,
      default: null
    },
    provider_result: {
      type: String,
      default: null
    },
    provider_resultcode: {
      type: String,
      default: null
    },
    provider_message: {
      type: String,
      default: null
    },
    paid_amount: {
      type: Number,
      default: null
    },
    callback_received_at: {
      type: Date,
      default: null
    },
    provider_payload: {
      type: Object,
      default: null
    },
    verified_at: {
      type: Date,
      default: null
    },
    consumed_at: {
      type: Date,
      default: null
    },
    expires_at: {
      type: Date,
      required: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("SelcomPaymentSession", SelcomPaymentSessionSchema);
