const mongoose = require("mongoose");
const AuditLog = require("../schema/auditlogs");

function normalizeValue(value) {
  if (value === null || typeof value === "undefined") {
    return "";
  }
  return String(value).trim();
}

function buildActor(req, fallback) {
  const requestUser = req && req.user ? req.user : null;
  const body = req && req.body ? req.body : {};
  const headers = req && req.headers ? req.headers : {};

  return {
    actor_type: normalizeValue(
      (fallback && fallback.actor_type) ||
      (requestUser && requestUser.role) ||
      headers["x-admin-role"] ||
      body.actor_type ||
      "admin"
    ) || "admin",
    actor_id: normalizeValue(
      (fallback && fallback.actor_id) ||
      (requestUser && (requestUser._id || requestUser.id)) ||
      headers["x-admin-id"] ||
      body.actor_id
    ),
    actor_label: normalizeValue(
      (fallback && fallback.actor_label) ||
      (requestUser && (requestUser.full_name || requestUser.email || requestUser.username)) ||
      headers["x-admin-name"] ||
      body.actor_label ||
      body.admin_notes ||
      "admin"
    )
  };
}

async function logAuditEvent(event) {
  if (!event || !event.action) {
    return null;
  }

  if (!mongoose.connection || mongoose.connection.readyState !== 1) {
    return null;
  }

  try {
    return await AuditLog.create({
      actor_type: normalizeValue(event.actor_type) || "system",
      actor_id: normalizeValue(event.actor_id),
      actor_label: normalizeValue(event.actor_label),
      action: normalizeValue(event.action),
      target_type: normalizeValue(event.target_type),
      target_id: normalizeValue(event.target_id),
      metadata: event.metadata || {}
    });
  } catch (error) {
    console.error("Audit log write failed:", error);
    return null;
  }
}

async function logAuditFromRequest(req, event) {
  const actor = buildActor(req, event);
  return logAuditEvent({
    actor_type: actor.actor_type,
    actor_id: actor.actor_id,
    actor_label: actor.actor_label,
    action: event && event.action,
    target_type: event && event.target_type,
    target_id: event && event.target_id,
    metadata: event && event.metadata
  });
}

module.exports = {
  buildActor,
  logAuditEvent,
  logAuditFromRequest
};
