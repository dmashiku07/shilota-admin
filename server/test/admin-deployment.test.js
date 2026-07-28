const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appSource = fs.readFileSync(path.join(__dirname, "..", "..", "app.js"), "utf8");
const angularConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "angular.json"), "utf8")
);
const packageJson = JSON.parse(
  fs.readFileSync(path.join(__dirname, "..", "..", "package.json"), "utf8")
);

test("production admin build is configured for /admin/", () => {
  const productionConfig =
    angularConfig.projects["taxi-booking-script"].architect.build.configurations.production;

  assert.equal(productionConfig.baseHref, "/admin/");
  assert.equal(productionConfig.deployUrl, "/admin/");
  assert.match(packageJson.scripts["build:admin"], /ng build --configuration production/);
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
