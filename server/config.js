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

function loadEnvFiles() {
  const rootDir = path.resolve(__dirname, "..");

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

function readLegacyLocalConfig() {
  try {
    return require("./config.local");
  } catch (_error) {
    return {};
  }
}

function asNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }

  return fallback;
}

loadEnvFiles();
const localConfig = readLegacyLocalConfig();
const resolvedApiPort = asNumber(process.env.API_PORT || process.env.PORT || localConfig.apiPort, 3000);
const featureFlags = {
  commission_enabled: asBoolean(process.env.COMMISSION_ENABLED || localConfig.commissionEnabled, false),
  driver_subscriptions_enabled: asBoolean(
    process.env.DRIVER_SUBSCRIPTIONS_ENABLED || localConfig.driverSubscriptionsEnabled,
    true
  ),
  driver_pricing_enabled: asBoolean(
    process.env.DRIVER_PRICING_ENABLED || localConfig.driverPricingEnabled,
    true
  ),
  passenger_price_broadcast_enabled: asBoolean(
    process.env.PASSENGER_PRICE_BROADCAST_ENABLED || localConfig.passengerPriceBroadcastEnabled,
    true
  ),
  driver_destination_broadcast_enabled: asBoolean(
    process.env.DRIVER_DESTINATION_BROADCAST_ENABLED || localConfig.driverDestinationBroadcastEnabled,
    true
  ),
  acceptance_settings_enabled: asBoolean(
    process.env.ACCEPTANCE_SETTINGS_ENABLED || localConfig.acceptanceSettingsEnabled,
    false
  )
};
const resolvedJwtSecret = process.env.JWT_SECRET || localConfig.secret;

if (!resolvedJwtSecret || resolvedJwtSecret === "CHANGE_ME") {
  throw new Error("JWT_SECRET must be configured with a non-default value");
}

module.exports = {
  database: process.env.MONGO_URL || localConfig.database || "mongodb://127.0.0.1:27017/shilota_db",
  secret: resolvedJwtSecret,
  apiPort: resolvedApiPort,
  socketPort: asNumber(process.env.SOCKET_PORT || localConfig.socketPort, 8081),
  httpsMode: process.env.HTTPS_MODE || localConfig.httpsMode || "disable",
  baseUrl: process.env.BASE_URL || localConfig.baseUrl || `http://localhost:${resolvedApiPort}`,
  turn: {
    urls: String(process.env.TURN_URLS || localConfig.turnUrls || "")
      .split(",")
      .map(function (value) { return value.trim(); })
      .filter(Boolean),
    sharedSecret: process.env.TURN_SHARED_SECRET || localConfig.turnSharedSecret || "",
    ttlSeconds: asNumber(process.env.TURN_CREDENTIAL_TTL || localConfig.turnCredentialTtl, 3600)
  },
  featureFlags: featureFlags,
  cets: {
    enabled: (process.env.CETS_ENABLED || localConfig.cetsEnabled || "false").toLowerCase() === "true",
    baseUrl: process.env.CETS_BASE_URL || localConfig.cetsBaseUrl || "",
    audience: process.env.CETS_AUDIENCE || localConfig.cetsAudience || process.env.CETS_BASE_URL || localConfig.cetsBaseUrl || "",
    issuer: process.env.CETS_ISSUER || localConfig.cetsIssuer || process.env.BASE_URL || localConfig.baseUrl || `http://localhost:${resolvedApiPort}`,
    subject: process.env.CETS_SUBJECT || localConfig.cetsSubject || process.env.BASE_URL || localConfig.baseUrl || `http://localhost:${resolvedApiPort}`,
    keyId: process.env.CETS_KEY_ID || localConfig.cetsKeyId || "",
    privateKey: process.env.CETS_PRIVATE_KEY || localConfig.cetsPrivateKey || "",
    publicKey: process.env.CETS_PUBLIC_KEY || localConfig.cetsPublicKey || "",
    discoveryPath: process.env.CETS_DISCOVERY_PATH || localConfig.cetsDiscoveryPath || "/.well-known/tz-e-ticketing-server",
    jwksPath: process.env.CETS_JWKS_PATH || localConfig.cetsJwksPath || "/cets/jwks",
    submitDriverPath: process.env.CETS_SUBMIT_DRIVER_PATH || localConfig.cetsSubmitDriverPath || "/api/v1/ticket-engine/rideDriver/submitDriver",
    submitVehiclePath: process.env.CETS_SUBMIT_VEHICLE_PATH || localConfig.cetsSubmitVehiclePath || "/api/v1/ticket-engine/rideVehicle/submitVehicle",
    submitTripPath: process.env.CETS_SUBMIT_TRIP_PATH || localConfig.cetsSubmitTripPath || "/api/v1/ticket-engine/rideHailing/submitTrip",
    submitReportPath: process.env.CETS_SUBMIT_REPORT_PATH || localConfig.cetsSubmitReportPath || "/api/v1/ticket-engine/rideReport/submitReport",
    backgroundSyncEnabled: (process.env.CETS_BACKGROUND_SYNC_ENABLED || localConfig.cetsBackgroundSyncEnabled || "true").toLowerCase() === "true",
    defaultRating: asNumber(process.env.CETS_DEFAULT_RATING || localConfig.cetsDefaultRating, 0)
  }
};
