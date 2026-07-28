const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const adminDistDir = path.join(rootDir, "dist", "shilota");
const indexPath = path.join(adminDistDir, "index.html");

function fail(message) {
  console.error(`Admin build verification failed: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

assert(fs.existsSync(indexPath), "dist/shilota/index.html does not exist");

const indexHtml = fs.readFileSync(indexPath, "utf8");

assert(
  /<base\s+href=["']\/admin\/["']\s*>/.test(indexHtml),
  "index.html must use <base href=\"/admin/\">"
);

for (const badPattern of [
  /\s(?:src|href)=["']\/assets\//,
  /\s(?:src|href)=["']\/runtime[^"']*\.(?:js|css)/,
  /\s(?:src|href)=["']\/main[^"']*\.js/,
  /\s(?:src|href)=["']\/polyfills[^"']*\.js/,
  /\s(?:src|href)=["']\/styles[^"']*\.css/
]) {
  assert(!badPattern.test(indexHtml), "index.html contains a root-level asset or bundle URL");
}

const localRefs = Array.from(indexHtml.matchAll(/\s(?:src|href)=["']([^"']+)["']/g))
  .map(match => match[1])
  .filter(ref => !/^(https?:)?\/\//.test(ref) && !/^data:/.test(ref));

for (const ref of localRefs) {
  assert(
    ref.startsWith("/admin/") || !ref.startsWith("/"),
    `local resource ${ref} must be relative to /admin/ or start with /admin/`
  );

  const relativePath = ref.startsWith("/admin/") ? ref.slice("/admin/".length) : ref;
  const filePath = path.join(adminDistDir, relativePath.split("?")[0].split("#")[0]);
  assert(fs.existsSync(filePath), `referenced resource is missing: ${ref}`);
}

const runtimeConfigPath = path.join(adminDistDir, "assets", "runtime-config.local.js");
assert(fs.existsSync(runtimeConfigPath), "assets/runtime-config.local.js is missing from the admin build");

const runtimeConfig = fs.readFileSync(runtimeConfigPath, "utf8");
assert(
  /"apiUrl":\s*"\/api"/.test(runtimeConfig),
  "runtime-config.local.js must set apiUrl to /api for the admin deployment"
);
assert(
  /"socketUrl":\s*"\/"/.test(runtimeConfig),
  "runtime-config.local.js must set socketUrl to / for the admin deployment"
);
assert(
  !/localhost:3000|localhost:8081|shilota\.tz:3000|shilota\.tz:8081/.test(runtimeConfig),
  "runtime-config.local.js must not ship localhost or direct backend port URLs"
);

console.log("Admin build verified for /admin/ deployment.");
