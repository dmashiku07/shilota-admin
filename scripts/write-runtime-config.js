const fs = require("fs");
const path = require("path");

function parseEnvFile(content) {
  const env = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) {
      continue;
    }

    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (!key) {
      continue;
    }

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    env[key] = value.replace(/\\n/g, "\n");
  }

  return env;
}

function loadEnvFiles(rootDir) {
  for (const fileName of [".env", ".env.local"]) {
    const filePath = path.join(rootDir, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const parsed = parseEnvFile(fs.readFileSync(filePath, "utf8"));
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof process.env[key] === "undefined") {
        process.env[key] = value;
      }
    }
  }
}

function stringValue(value, fallback = "") {
  return typeof value === "undefined" || value === "" ? fallback : String(value);
}

const rootDir = path.resolve(__dirname, "..");
loadEnvFiles(rootDir);

const apiPort = stringValue(process.env.API_PORT || process.env.PORT, "3000");
const socketPort = stringValue(process.env.SOCKET_PORT, "8081");
const runtimeConfig = {
  apiUrl: stringValue(process.env.RUNTIME_API_URL || process.env.BASE_URL, `http://localhost:${apiPort}`),
  socketUrl: stringValue(process.env.RUNTIME_SOCKET_URL, `http://localhost:${socketPort}`),
  googleapiKey: stringValue(process.env.GOOGLE_MAPS_API_KEY),
  googleloginClientid: stringValue(process.env.GOOGLE_LOGIN_CLIENT_ID),
  enablePhoneVerification: stringValue(process.env.ENABLE_PHONE_VERIFICATION, "false"),
  featureFlags: {
    commission_enabled: stringValue(process.env.COMMISSION_ENABLED, "true"),
    driver_subscriptions_enabled: stringValue(process.env.DRIVER_SUBSCRIPTIONS_ENABLED, "false"),
    driver_pricing_enabled: stringValue(process.env.DRIVER_PRICING_ENABLED, "false"),
    passenger_price_broadcast_enabled: stringValue(process.env.PASSENGER_PRICE_BROADCAST_ENABLED, "false"),
    driver_destination_broadcast_enabled: stringValue(
      process.env.DRIVER_DESTINATION_BROADCAST_ENABLED,
      "false"
    )
  },
  firebase: {
    apiKey: stringValue(process.env.FIREBASE_API_KEY),
    authDomain: stringValue(process.env.FIREBASE_AUTH_DOMAIN),
    databaseURL: stringValue(process.env.FIREBASE_DATABASE_URL),
    projectId: stringValue(process.env.FIREBASE_PROJECT_ID),
    storageBucket: stringValue(process.env.FIREBASE_STORAGE_BUCKET),
    messagingSenderId: stringValue(process.env.FIREBASE_MESSAGING_SENDER_ID),
    appId: stringValue(process.env.FIREBASE_APP_ID),
    measurementId: stringValue(process.env.FIREBASE_MEASUREMENT_ID)
  }
};

const outputPath = path.join(rootDir, "src", "assets", "runtime-config.local.js");
fs.writeFileSync(outputPath, `window.__shilotaConfig = ${JSON.stringify(runtimeConfig, null, 2)};\n`, "utf8");
console.log(`Wrote runtime config to ${outputPath}`);
