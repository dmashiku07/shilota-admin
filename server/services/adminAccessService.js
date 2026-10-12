const jwt = require("jsonwebtoken");
const config = require("../config");
const Admin = require("../models/admin");

const SUPER_ADMIN = "SUPER_ADMIN";
const OPS_ADMIN = "OPS_ADMIN";

function normalizeAdminRole(value) {
  const role = String(value || "").trim().toUpperCase();
  if (role === "ADMIN" || role === SUPER_ADMIN) return SUPER_ADMIN;
  if (role === OPS_ADMIN) return OPS_ADMIN;
  return "";
}

async function requireAdmin(req, res, next) {
  try {
    const token = String(req.headers.authorization || "").replace(/^JWT\s+/i, "").trim();
    const decoded = jwt.verify(token, config.secret);
    const payload = decoded && decoded.data ? decoded.data : decoded;
    if (!payload || payload.role !== "admin" || !payload._id) {
      return res.status(401).json({ status: "false", message: "Unauthorized access" });
    }
    const admin = await Admin.findById(payload._id).exec();
    const role = admin ? normalizeAdminRole(admin.role) : "";
    if (!admin || !role) {
      return res.status(403).json({ status: "false", message: "Admin role is not authorized" });
    }
    req.adminAccess = { admin: admin, role: role };
    req.user = { _id: admin._id, role: "admin", admin_role: role, full_name: admin.name || admin.username };
    return next();
  } catch (_error) {
    return res.status(401).json({ status: "false", message: "Unauthorized access" });
  }
}

function requireSuperAdmin(req, res, next) {
  if (req.adminAccess && req.adminAccess.role === SUPER_ADMIN) return next();
  return res.status(403).json({ status: "false", message: "Super Admin access is required" });
}

function canManageDriver(req, driverId) {
  if (!req.adminAccess) return false;
  if (req.adminAccess.role === SUPER_ADMIN) return true;
  return (req.adminAccess.admin.assigned_driver_ids || []).some(function (id) {
    return String(id) === String(driverId);
  });
}

function requireAssignedDriver(req, res, next) {
  const driverId = req.params.id || req.body.driver_id;
  if (canManageDriver(req, driverId)) return next();
  return res.status(403).json({ status: "false", message: "You are not assigned to this driver" });
}

module.exports = { OPS_ADMIN, SUPER_ADMIN, canManageDriver, normalizeAdminRole, requireAdmin, requireAssignedDriver, requireSuperAdmin };
