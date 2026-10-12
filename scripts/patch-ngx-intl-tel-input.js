"use strict";

// ngx-intl-tel-input 17 calls BsDropdownModule.forRoot() while initialising its
// module. ngx-bootstrap 21 (required by the Angular 22 admin) removed that API;
// the module itself is now the import value. Keep this small compatibility patch
// explicit and deterministic until the dependency publishes a compatible build.
const fs = require("fs");
const path = require("path");

const packageFile = path.join(
  __dirname,
  "..",
  "node_modules",
  "ngx-intl-tel-input",
  "fesm2022",
  "ngx-intl-tel-input.mjs"
);
const legacyCall = "const dropdownModuleForRoot = BsDropdownModule.forRoot();";
const compatibleImport = "const dropdownModuleForRoot = BsDropdownModule;";

if (!fs.existsSync(packageFile)) {
  throw new Error("ngx-intl-tel-input bundle is not installed");
}

const source = fs.readFileSync(packageFile, "utf8");
if (source.includes(compatibleImport)) {
  process.exit(0);
}
if (!source.includes(legacyCall)) {
  throw new Error("Unexpected ngx-intl-tel-input dropdown initialisation");
}

fs.writeFileSync(packageFile, source.replace(legacyCall, compatibleImport));
