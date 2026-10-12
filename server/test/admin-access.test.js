const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const access = require("../services/adminAccessService");

test("only explicit legacy and Super Admin roles receive Super Admin authority", function () {
  assert.equal(access.normalizeAdminRole("admin"), access.SUPER_ADMIN);
  assert.equal(access.normalizeAdminRole("SUPER_ADMIN"), access.SUPER_ADMIN);
  assert.equal(access.normalizeAdminRole("OPS_ADMIN"), access.OPS_ADMIN);
  assert.equal(access.normalizeAdminRole("unknown"), "");
});

test("Ops Admin driver management is limited to assigned driver ids", function () {
  const opsRequest = { adminAccess: { role: access.OPS_ADMIN, admin: { assigned_driver_ids: ["driver-a"] } } };
  assert.equal(access.canManageDriver(opsRequest, "driver-a"), true);
  assert.equal(access.canManageDriver(opsRequest, "driver-b"), false);
});

test("admin routes protect assignments and local-area changes on the server", function () {
  const source = fs.readFileSync(path.join(__dirname, "..", "routes", "driverRoutes.js"), "utf8");
  assert.match(source, /router\.use\(requireAdmin\)/);
  assert.match(source, /ops-assignment.*requireSuperAdmin/);
  assert.match(source, /local-areas.*requireSuperAdmin/);
  assert.match(source, /dispatch-scope.*requireAssignedDriver/);
});
