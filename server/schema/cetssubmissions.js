const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const CetsSubmissionSchema = new Schema(
  {
    submission_type: {
      type: String,
      required: true
    },
    entity_id: {
      type: String
    },
    dedupe_key: {
      type: String,
      required: true,
      unique: true
    },
    status: {
      type: String,
      default: "pending"
    },
    reason: {
      type: String
    },
    attempts: {
      type: Number,
      default: 0
    },
    next_retry_at: {
      type: Date,
      default: Date.now
    },
    payload_overrides: {
      type: Object
    },
    request_payload: {
      type: Object
    },
    response_payload: {
      type: Object
    },
    error_message: {
      type: String
    },
    upstream_url: {
      type: String
    },
    upstream_status: {
      type: Number
    },
    report_date: {
      type: String
    },
    latra_reference_number: {
      type: String
    },
    trip_ref: {
      type: String
    },
    processed_at: {
      type: Date
    },
    last_attempt_at: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("CetsSubmission", CetsSubmissionSchema);
