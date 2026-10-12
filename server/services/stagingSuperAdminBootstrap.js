"use strict";

const bcrypt = require("bcryptjs");
const { SUPER_ADMIN } = require("./adminAccessService");

const REQUIRED_ENVIRONMENT = "staging";
const REQUIRED_CONFIRMATION = "CREATE_STAGING_SUPER_ADMIN";

function requiredValue(env, key) {
  const value = env[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${key} must be set`);
  }
  return value;
}

function resolveBootstrapConfig(env = process.env) {
  if (String(env.APP_ENV || "").trim().toLowerCase() !== REQUIRED_ENVIRONMENT) {
    throw new Error("Staging Super Admin bootstrap is only permitted when APP_ENV=staging");
  }
  if (env.STAGING_ADMIN_BOOTSTRAP_ENABLED !== "true") {
    throw new Error("STAGING_ADMIN_BOOTSTRAP_ENABLED=true is required");
  }
  if (env.STAGING_ADMIN_BOOTSTRAP_CONFIRM !== REQUIRED_CONFIRMATION) {
    throw new Error("STAGING_ADMIN_BOOTSTRAP_CONFIRM does not contain the required confirmation value");
  }

  const email = requiredValue(env, "STAGING_ADMIN_BOOTSTRAP_EMAIL").trim().toLowerCase();
  const password = requiredValue(env, "STAGING_ADMIN_BOOTSTRAP_PASSWORD");
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new Error("STAGING_ADMIN_BOOTSTRAP_EMAIL must be a valid email address");
  }
  if (password.length < 16) {
    throw new Error("STAGING_ADMIN_BOOTSTRAP_PASSWORD must contain at least 16 characters");
  }

  return {
    email,
    password,
    name: String(env.STAGING_ADMIN_BOOTSTRAP_NAME || "Staging Super Admin").trim() || "Staging Super Admin"
  };
}

async function bootstrapStagingSuperAdmin({ Admin, env = process.env, hashPassword = bcrypt.hash }) {
  const bootstrap = resolveBootstrapConfig(env);
  const existing = await Admin.findOne({
    $or: [{ email: bootstrap.email }, { username: bootstrap.email }]
  }).exec();

  if (existing) {
    const existingRole = String(existing.role || "").trim().toUpperCase();
    if (existingRole === SUPER_ADMIN || existingRole === "ADMIN") {
      return { status: "already_exists", id: String(existing._id) };
    }
    throw new Error("An existing non-Super-Admin account uses the requested bootstrap email");
  }

  const password = await hashPassword(bootstrap.password, 12);
  const admin = await Admin.create({
    name: bootstrap.name,
    email: bootstrap.email,
    username: bootstrap.email,
    password,
    role: SUPER_ADMIN,
    assigned_driver_ids: []
  });

  return { status: "created", id: String(admin._id) };
}

module.exports = {
  REQUIRED_CONFIRMATION,
  bootstrapStagingSuperAdmin,
  resolveBootstrapConfig
};
