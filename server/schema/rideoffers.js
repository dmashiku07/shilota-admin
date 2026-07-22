var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var RideOfferSchema = new Schema(
  {
    ride_request_id: {
      type: String,
      required: true,
      ref: "Rides"
    },
    driver_id: {
      type: String,
      required: true,
      ref: "Driver"
    },
    offered_price: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: "TZS",
      trim: true,
      uppercase: true
    },
    offer_type: {
      type: String,
      enum: ["DRIVER_DIRECT_OFFER", "ACCEPT_PASSENGER_PRICE", "DRIVER_COUNTER_OFFER"],
      default: "DRIVER_DIRECT_OFFER"
    },
    estimated_arrival_minutes: {
      type: Number,
      default: null
    },
    message: {
      type: String,
      default: "",
      trim: true
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED", "WITHDRAWN", "EXPIRED"],
      default: "PENDING"
    },
    expires_at: {
      type: Date,
      required: true
    }
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  }
);

RideOfferSchema.index(
  { ride_request_id: 1, driver_id: 1, status: 1 },
  { name: "ride_offer_driver_status_idx" }
);
RideOfferSchema.index(
  { ride_request_id: 1, status: 1, created_at: -1 },
  { name: "ride_offer_request_status_idx" }
);
RideOfferSchema.index(
  { driver_id: 1, status: 1, expires_at: 1 },
  { name: "ride_offer_driver_expiry_idx" }
);

module.exports = mongoose.model("RideOffer", RideOfferSchema);
