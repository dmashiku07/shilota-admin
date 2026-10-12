const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const service = require("../services/emailActivationService");
const driverRouteSource = fs.readFileSync(path.join(__dirname, "..", "routes", "driverRoutes.js"), "utf8");
const driverApiSource = fs.readFileSync(path.join(__dirname, "..", "apiroutes", "driverapi.js"), "utf8");

test("email activation uses the approved UAT limits", function () {
  assert.equal(service.EMAIL_ACTIVATION_EXPIRY_MINUTES, 10);
  assert.equal(service.EMAIL_ACTIVATION_MAX_ATTEMPTS, 3);
  assert.equal(service.EMAIL_ACTIVATION_MAX_RESENDS, 3);
});

test("driver activation is pending until code verification and SMTP uses environment configuration", function () {
  assert.match(driverRouteSource, /email_activation_required = true/);
  assert.match(driverRouteSource, /approval = "0"/);
  assert.match(driverApiSource, /A newly registered driver is not dispatch-eligible/);
  assert.match(driverApiSource, /router\.post\('\/verify-email-activation'/);
  assert.match(driverApiSource, /router\.post\('\/resend-email-activation'/);
  assert.match(driverApiSource, /approval: "1", email_activation_required: false/);
  assert.match(fs.readFileSync(path.join(__dirname, "..", "services", "emailActivationService.js"), "utf8"), /process\.env\.SMTP_HOST/);
});
