var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var AuditLogSchema = new Schema(
  {
    actor_type: {
      type: String,
      default: "system",
      trim: true
    },
    actor_id: {
      type: String,
      default: "",
      trim: true
    },
    actor_label: {
      type: String,
      default: "",
      trim: true
    },
    action: {
      type: String,
      required: true,
      trim: true
    },
    target_type: {
      type: String,
      default: "",
      trim: true
    },
    target_id: {
      type: String,
      default: "",
      trim: true
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: false
    }
  }
);

AuditLogSchema.index(
  { action: 1, created_at: -1 },
  { name: "audit_log_action_created_idx" }
);
AuditLogSchema.index(
  { target_type: 1, target_id: 1, created_at: -1 },
  { name: "audit_log_target_created_idx" }
);
AuditLogSchema.index(
  { actor_type: 1, actor_id: 1, created_at: -1 },
  { name: "audit_log_actor_created_idx" }
);

module.exports = mongoose.model("AuditLog", AuditLogSchema);
