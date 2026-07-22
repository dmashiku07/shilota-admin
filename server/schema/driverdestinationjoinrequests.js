var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var DriverDestinationJoinRequestSchema = new Schema(
  {
    broadcast_id: {
      type: String,
      required: true,
      ref: "DriverDestinationBroadcast"
    },
    passenger_id: {
      type: String,
      required: true,
      ref: "User"
    },
    pickup_label: {
      type: String,
      required: true,
      trim: true
    },
    pickup_lat: {
      type: Number,
      required: true
    },
    pickup_lng: {
      type: Number,
      required: true
    },
    requested_seats: {
      type: Number,
      required: true,
      min: 1
    },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "REJECTED", "CANCELLED", "EXPIRED"],
      default: "PENDING"
    },
    responded_at: {
      type: Date,
      default: null
    },
    cancelled_at: {
      type: Date,
      default: null
    },
    expired_at: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  }
);

DriverDestinationJoinRequestSchema.index(
  { broadcast_id: 1, passenger_id: 1, status: 1 },
  { name: "driver_destination_join_request_passenger_status_idx" }
);

DriverDestinationJoinRequestSchema.index(
  { broadcast_id: 1, status: 1, created_at: 1 },
  { name: "driver_destination_join_request_broadcast_status_idx" }
);

module.exports = mongoose.model("DriverDestinationJoinRequest", DriverDestinationJoinRequestSchema);
