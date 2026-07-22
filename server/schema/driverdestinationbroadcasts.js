var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var DriverDestinationBroadcastSchema = new Schema(
  {
    driver_id: {
      type: String,
      required: true,
      ref: "Driver"
    },
    origin_label: {
      type: String,
      required: true,
      trim: true
    },
    origin_lat: {
      type: Number,
      required: true
    },
    origin_lng: {
      type: Number,
      required: true
    },
    destination_label: {
      type: String,
      required: true,
      trim: true
    },
    destination_lat: {
      type: Number,
      required: true
    },
    destination_lng: {
      type: Number,
      required: true
    },
    departure_time: {
      type: Date,
      required: true
    },
    price_per_passenger: {
      type: Number,
      required: true,
      min: 0
    },
    available_seats: {
      type: Number,
      required: true,
      min: 1
    },
    remaining_seats: {
      type: Number,
      required: true,
      min: 0
    },
    notification_radius: {
      type: Number,
      required: true,
      min: 0
    },
    broadcast_fee: {
      type: Number,
      required: true,
      default: 0,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      default: "TZS",
      trim: true
    },
    payment_status: {
      type: String,
      required: true,
      default: "UNPAID",
      trim: true
    },
    payment_reference: {
      type: String,
      default: "",
      trim: true
    },
    paid_at: {
      type: Date,
      default: null
    },
    selcom_session_id: {
      type: Schema.Types.ObjectId,
      ref: "SelcomPaymentSession",
      default: null
    },
    starts_at: {
      type: Date,
      default: Date.now
    },
    expires_at: {
      type: Date,
      required: true
    },
    status: {
      type: String,
      enum: ["DRAFT", "PENDING_PAYMENT", "PAYMENT_FAILED", "ACTIVE", "FULL", "EXPIRED", "CANCELLED", "COMPLETED"],
      default: "DRAFT"
    },
    origin_loc: {
      type: [Number],
      index: {
        type: "2dsphere",
        sparse: true
      }
    }
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at"
    }
  }
);

DriverDestinationBroadcastSchema.index(
  { driver_id: 1, status: 1, departure_time: 1 },
  { name: "driver_destination_broadcast_driver_status_idx" }
);

DriverDestinationBroadcastSchema.index(
  { status: 1, expires_at: 1, departure_time: 1 },
  { name: "driver_destination_broadcast_status_expiry_idx" }
);

module.exports = mongoose.model("DriverDestinationBroadcast", DriverDestinationBroadcastSchema);
