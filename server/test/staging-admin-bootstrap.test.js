const assert = require("node:assert/strict");
const test = require("node:test");
const {
  REQUIRED_CONFIRMATION,
  bootstrapStagingSuperAdmin,
  resolveBootstrapConfig
} = require("../services/stagingSuperAdminBootstrap");

function validEnv(overrides = {}) {
  return {
    APP_ENV: "staging",
    STAGING_ADMIN_BOOTSTRAP_ENABLED: "true",
    STAGING_ADMIN_BOOTSTRAP_CONFIRM: REQUIRED_CONFIRMATION,
    STAGING_ADMIN_BOOTSTRAP_EMAIL: "uat-super-admin@example.test",
    STAGING_ADMIN_BOOTSTRAP_PASSWORD: "a-local-test-password-that-is-long",
    ...overrides
  };
}

test("staging Super Admin bootstrap is closed unless every explicit staging gate is present", () => {
  assert.throws(() => resolveBootstrapConfig(validEnv({ APP_ENV: "production" })), /APP_ENV=staging/);
  assert.throws(() => resolveBootstrapConfig(validEnv({ STAGING_ADMIN_BOOTSTRAP_ENABLED: "false" })), /ENABLED=true/);
  assert.throws(() => resolveBootstrapConfig(validEnv({ STAGING_ADMIN_BOOTSTRAP_CONFIRM: "yes" })), /confirmation/);
  assert.throws(() => resolveBootstrapConfig(validEnv({ STAGING_ADMIN_BOOTSTRAP_PASSWORD: "too-short" })), /at least 16/);
});

test("staging Super Admin bootstrap creates only a Super Admin with a hashed password", async () => {
  let created;
  const Admin = {
    findOne: () => ({ exec: async () => null }),
    create: async document => {
      created = document;
      return { _id: "created-admin" };
    }
  };

  const result = await bootstrapStagingSuperAdmin({
    Admin,
    env: validEnv(),
    hashPassword: async password => `hashed:${password}`
  });

  assert.deepEqual(result, { status: "created", id: "created-admin" });
  assert.equal(created.role, "SUPER_ADMIN");
  assert.equal(created.username, "uat-super-admin@example.test");
  assert.match(created.password, /^hashed:/);
});

test("staging Super Admin bootstrap will not change an existing non-Super-Admin account", async () => {
  const Admin = {
    findOne: () => ({ exec: async () => ({ _id: "ops-admin", role: "OPS_ADMIN" }) }),
    create: async () => assert.fail("create must not be called")
  };

  await assert.rejects(
    () => bootstrapStagingSuperAdmin({ Admin, env: validEnv() }),
    /existing non-Super-Admin/
  );
});
