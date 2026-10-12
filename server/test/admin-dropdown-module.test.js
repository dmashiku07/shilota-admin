const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "..", "src", "app", "views", "client", "client.module.ts"),
  "utf8"
);
const dockerfile = fs.readFileSync(path.join(__dirname, "..", "..", "Dockerfile.api"), "utf8");
const compatibilityPatch = fs.readFileSync(
  path.join(__dirname, "..", "..", "scripts", "patch-ngx-intl-tel-input.js"),
  "utf8"
);

test("Angular 22 client module does not call the removed ngx-bootstrap forRoot API", function () {
  assert.match(source, /BsDropdownModule,/);
  assert.doesNotMatch(source, /BsDropdownModule\.forRoot\(/);
  assert.match(dockerfile, /node scripts\/patch-ngx-intl-tel-input\.js && rm -rf dist \.angular && npm run build:admin/);
  assert.match(compatibilityPatch, /BsDropdownModule\.forRoot\(\)/);
  assert.match(compatibilityPatch, /const dropdownModuleForRoot = BsDropdownModule;/);
});
