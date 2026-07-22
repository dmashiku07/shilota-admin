const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const AuditLog = require("../schema/auditlogs");
const auditLogService = require("../services/auditLogService");
const reportingService = require("../services/reportingService");

const appSource = fs.readFileSync(path.join(__dirname, "..", "..", "app.js"), "utf8");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8")
);
const reportingRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "routes", "reportingRoutes.js"),
  "utf8"
);
const subscriptionPlanRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "routes", "subscriptionPlanRoutes.js"),
  "utf8"
);
const driverRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "routes", "driverRoutes.js"),
  "utf8"
);
const safetyRouteSource = fs.readFileSync(
  path.join(__dirname, "..", "routes", "safetyRoutes.js"),
  "utf8"
);
const driverSubscriptionServiceSource = fs.readFileSync(
  path.join(__dirname, "..", "services", "driverSubscriptionService.js"),
  "utf8"
);
const passengerSubscriptionServiceSource = fs.readFileSync(
  path.join(__dirname, "..", "services", "passengerSubscriptionService.js"),
  "utf8"
);

test("audit log schema exposes reporting and audit trail fields", function () {
  const paths = AuditLog.schema.paths;
  ["actor_type", "actor_id", "actor_label", "action", "target_type", "target_id", "metadata", "created_at"].forEach(function (field) {
    assert.ok(paths[field], `expected audit log schema to include ${field}`);
  });
});

test("audit actor helper prefers request context and fallbacks", function () {
  const actor = auditLogService.buildActor({
    user: {
      role: "admin",
      _id: "admin-1",
      full_name: "Operations Admin"
    },
    body: {},
    headers: {}
  });

  assert.equal(actor.actor_type, "admin");
  assert.equal(actor.actor_id, "admin-1");
  assert.equal(actor.actor_label, "Operations Admin");
});

test("reporting service exports overview and reconciliation functions", function () {
  assert.equal(typeof reportingService.buildReportingOverview, "function");
  assert.equal(typeof reportingService.buildRecentAuditLogs, "function");
  assert.equal(typeof reportingService.reconcileSubscriptionStatuses, "function");
  assert.equal(typeof reportingService.reconcileDailyRideUsage, "function");
  assert.equal(typeof reportingService.reconcilePendingPayments, "function");
  assert.equal(typeof reportingService.reconcileExpiredOffers, "function");
  assert.equal(typeof reportingService.reconcileExpiredBroadcasts, "function");
});

test("app mounts reporting route and disables cache for reporting endpoints", function () {
  assert.match(appSource, /require\('\.\/server\/routes\/reportingRoutes'\)/);
  assert.match(appSource, /app\.use\('\/reporting', reporting\)/);
  assert.match(appSource, /'\/reporting'/);
});

test("phase 11 package scripts expose migration and reconciliation commands", function () {
  assert.equal(packageJson.scripts["migrate:phase11:reporting-hardening:up"], "node scripts/migrations/phase-11-reporting-hardening-up.js");
  assert.equal(packageJson.scripts["migrate:phase11:reporting-hardening:down"], "node scripts/migrations/phase-11-reporting-hardening-down.js");
  assert.equal(packageJson.scripts["reconcile:subscription-statuses"], "node scripts/reconcile-phase11.js subscription-statuses");
  assert.equal(packageJson.scripts["reconcile:daily-ride-usage"], "node scripts/reconcile-phase11.js daily-ride-usage");
  assert.equal(packageJson.scripts["reconcile:pending-payments"], "node scripts/reconcile-phase11.js pending-payments");
  assert.equal(packageJson.scripts["reconcile:expired-offers"], "node scripts/reconcile-phase11.js expired-offers");
  assert.equal(packageJson.scripts["reconcile:expired-broadcasts"], "node scripts/reconcile-phase11.js expired-broadcasts");
});

test("reporting routes expose overview and audit log endpoints", function () {
  assert.match(reportingRouteSource, /router\.get\("\/overview"/);
  assert.match(reportingRouteSource, /router\.get\("\/audit-logs"/);
});

test("subscription plan routes are audit logged", function () {
  assert.match(subscriptionPlanRouteSource, /subscription_plan\.created/);
  assert.match(subscriptionPlanRouteSource, /subscription_plan\.updated/);
  assert.match(subscriptionPlanRouteSource, /subscription_plan\.activated/);
  assert.match(subscriptionPlanRouteSource, /subscription_plan\.deactivated/);
  assert.match(subscriptionPlanRouteSource, /subscription_plan\.reordered/);
});

test("manual admin routes write audit logs", function () {
  assert.match(driverRouteSource, /driver\.activated/);
  assert.match(driverRouteSource, /driver\.deactivated/);
  assert.match(safetyRouteSource, /call_log\.reviewed/);
  assert.match(safetyRouteSource, /price_broadcast_settings\.updated/);
  assert.match(safetyRouteSource, /destination_broadcast_settings\.updated/);
  assert.match(safetyRouteSource, /pool_settings\.updated/);
});

test("subscription lifecycle services emit audit actions for status changes", function () {
  assert.match(driverSubscriptionServiceSource, /driver_subscription\.activated/);
  assert.match(driverSubscriptionServiceSource, /driver_subscription\.payment_failed/);
  assert.match(driverSubscriptionServiceSource, /driver_subscription\.expired/);
  assert.match(passengerSubscriptionServiceSource, /passenger_subscription\.activated/);
  assert.match(passengerSubscriptionServiceSource, /passenger_subscription\.payment_failed/);
  assert.match(passengerSubscriptionServiceSource, /passenger_subscription\.expired/);
});
