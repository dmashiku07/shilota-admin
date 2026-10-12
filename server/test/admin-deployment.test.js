const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appSource = fs.readFileSync(path.join(__dirname, "..", "..", "app.js"), "utf8");
const adminRouteSource = fs.readFileSync(path.join(__dirname, "..", "routes", "user.js"), "utf8");
const driverRouteSource = fs.readFileSync(path.join(__dirname, "..", "routes", "driverRoutes.js"), "utf8");
const angularConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "angular.json"), "utf8")
);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8")
);
const appRoutingSource = fs.readFileSync(
  path.join(__dirname, "..", "..", "src", "app", "app-routing.module.ts"),
  "utf8"
);

test("production admin build is configured for /admin/", () => {
  const productionConfig =
    angularConfig.projects["taxi-booking-script"].architect.build.configurations.production;
  const buildConfig = angularConfig.projects["taxi-booking-script"].architect.build;

  assert.equal(productionConfig.baseHref, "/admin/");
  assert.equal(buildConfig.builder, "@angular/build:application");
  assert.deepEqual(buildConfig.options.outputPath, {
    base: "dist/shilota",
    browser: ""
  });
  assert.match(packageJson.scripts["build:admin"], /ng build --configuration production/);
});

test("the /admin base route starts the admin login instead of the passenger client", () => {
  assert.match(appRoutingSource, /path: ''[\s\S]*?views\/admin\/admin\.module/);
  assert.doesNotMatch(appRoutingSource, /views\/client\/client\.module/);
});

test("the admin login owns only the base route so authenticated dashboard paths remain reachable", () => {
  const adminRoutingSource = fs.readFileSync(
    path.join(__dirname, "..", "..", "src", "app", "views", "admin", "admin-routing.module.ts"),
    "utf8"
  );

  assert.match(adminRoutingSource, /path: '',\s*pathMatch: 'full',\s*component: ContentLayoutComponent/);
});

test("Express serves the Angular admin app only under /admin", () => {
  assert.match(appSource, /app\.use\('\/admin', express\.static\(adminDistRoot/);
  assert.match(appSource, /app\.get\(\['\/admin', '\/admin\/'\], sendAdminIndex\)/);
  assert.match(appSource, /app\.get\('\/admin\/\*'/);

  assert.doesNotMatch(appSource, /app\.get\('\*'/);
  assert.doesNotMatch(appSource, /app\.use\(express\.static\(dist/);
  assert.doesNotMatch(appSource, /app\.use\(express\.static\(__dirname \+ '\/src'\)/);
  assert.doesNotMatch(appSource, /app\.get\('\/assets\/runtime-config\.local\.js'/);
});

test("admin APIs are available behind /api while /admin remains reserved for SPA routes", () => {
  assert.match(appSource, /app\.use\('\/api\/admin', admin\)/);
  assert.doesNotMatch(appSource, /app\.use\('\/admin', admin\)/);
  assert.match(appSource, /app\.use\('\/api\/assets', express\.static\(apiAssetsRoot\)\)/);
  assert.match(appSource, /app\.use\('\/api\/gallery', express\.static\(mediaRoot\)\)/);
});

test("admin JWT contains identity only and does not serialize the admin settings document", () => {
  assert.match(adminRouteSource, /role: "admin"/);
  assert.match(adminRouteSource, /_id: user\._id/);
  assert.doesNotMatch(adminRouteSource, /data: user\s*[},]/);
});

test("driver search does not apply a regular expression to numeric phone fields", () => {
  assert.match(driverRouteSource, /buildSearchQuery\(params\.search, \['full_name', 'email'\]\)/);
  assert.match(driverRouteSource, /phone_number: phoneNumber/);
});
