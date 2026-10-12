var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var EmailActivationSchema = new Schema(
  {
    account_type: { type: String, enum: ["driver"], required: true, index: true },
    account_id: { type: Schema.Types.ObjectId, required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    code_hash: { type: String, required: true },
    expires_at: { type: Date, required: true, index: true },
    attempt_count: { type: Number, default: 0 },
    resend_count: { type: Number, default: 0 },
    verified: { type: Boolean, default: false, index: true },
    verified_at: { type: Date, default: null }
  },
  { timestamps: true }
);

EmailActivationSchema.index({ account_type: 1, account_id: 1, verified: 1 });

module.exports = mongoose.model("EmailActivation", EmailActivationSchema);
