const axios = require("axios");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const config = require("../config");

const VEHICLE_TYPE_ENUMS = ["CAR", "MOTORCYCLE", "TRICYCLE"];

function requireValue(value, message) {
  if (!value) {
    const error = new Error(message);
    error.statusCode = 400;
    throw error;
  }
}

function ensureCetsConfigured() {
  if (!config.cets.enabled) {
    const error = new Error("CeTS integration is disabled");
    error.statusCode = 400;
    throw error;
  }

  requireValue(config.cets.baseUrl, "CETS_BASE_URL is not configured");
  requireValue(config.cets.audience, "CETS_AUDIENCE is not configured");
  requireValue(config.cets.issuer, "CETS_ISSUER is not configured");
  requireValue(config.cets.subject, "CETS_SUBJECT is not configured");
  requireValue(config.cets.privateKey, "CETS_PRIVATE_KEY is not configured");
  requireValue(config.cets.publicKey, "CETS_PUBLIC_KEY is not configured");
}

function buildAbsoluteUrl(baseUrl, routePath) {
  return new URL(routePath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

function buildDiscoveryDocument() {
  ensureCetsConfigured();

  return {
    jwks_uri: buildAbsoluteUrl(config.baseUrl, config.cets.jwksPath)
  };
}

function getJwks() {
  ensureCetsConfigured();

  const keyObject = crypto.createPublicKey(config.cets.publicKey);
  const jwk = keyObject.export({ format: "jwk" });
  const kid = config.cets.keyId || crypto.createHash("sha256").update(JSON.stringify(jwk)).digest("hex").slice(0, 16);

  return {
    keys: [
      Object.assign({}, jwk, {
        use: "sig",
        alg: "RS256",
        kid: kid
      })
    ]
  };
}

function createAccessToken() {
  ensureCetsConfigured();

  return jwt.sign(
    {},
    config.cets.privateKey,
    {
      algorithm: "RS256",
      issuer: config.cets.issuer,
      subject: config.cets.subject,
      audience: config.cets.audience,
      expiresIn: "5m",
      keyid: config.cets.keyId || undefined
    }
  );
}

function createAuthorizedClient() {
  const token = createAccessToken();

  return axios.create({
    baseURL: config.cets.baseUrl,
    timeout: 15000,
    headers: {
      accept: "*/*",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });
}

function ensureSuccessfulCetsResponse(response, payload) {
  if (response && String(response.statusCode) === "5000") {
    return response;
  }

  const error = new Error(
    response && response.message
      ? `CeTS request failed: ${response.message}`
      : "CeTS request failed"
  );
  error.statusCode = 502;
  error.upstreamStatus = 200;
  error.upstreamBody = response || null;
  error.requestPayload = payload;
  throw error;
}

function formatDriverPhone(driver) {
  const phoneDigits = String(driver.phone_number || "").replace(/\D/g, "");
  if (!phoneDigits) {
    return "";
  }

  if (phoneDigits.length === 10 && phoneDigits.startsWith("0")) {
    return phoneDigits;
  }

  const countryDigits = String(driver.country_code || "").replace(/\D/g, "");
  if (countryDigits === "255" && phoneDigits.length === 9) {
    return `0${phoneDigits}`;
  }

  return phoneDigits;
}

function normalizeDate(value) {
  if (!value) {
    return "";
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

function inferVehicleType(vehicle) {
  const vehicleText = `${vehicle.body_type || ""} ${vehicle.vehicle_name || ""}`.toLowerCase();
  if (vehicleText.includes("motor") || vehicleText.includes("bike") || vehicleText.includes("boda")) {
    return "MOTORCYCLE";
  }

  if (vehicleText.includes("tricycle") || vehicleText.includes("tuk") || vehicleText.includes("bajaj")) {
    return "TRICYCLE";
  }

  return "CAR";
}

function buildDriverPayload(driver, overrides) {
  const payload = {
    driverName: String(overrides.driverName || driver.full_name || "").trim(),
    driverEmail: String(overrides.driverEmail || driver.email || "").trim(),
    driverPhone: String(overrides.driverPhone || formatDriverPhone(driver) || "").trim(),
    driverLicenseNumber: String(overrides.driverLicenseNumber || driver.driver_license_number || "").trim(),
    licenceCategory: String(overrides.licenceCategory || driver.licence_category || "").trim()
  };

  requireValue(payload.driverName, "driverName is required");
  requireValue(payload.driverEmail, "driverEmail is required");
  requireValue(payload.driverPhone, "driverPhone is required");
  requireValue(payload.driverLicenseNumber, "driverLicenseNumber is required");
  requireValue(payload.licenceCategory, "licenceCategory is required");

  return payload;
}

function formatCetsDateTime(value) {
  if (!value) {
    return "";
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return moment(parsed).utcOffset(180).format("YYYY-MM-DD HH:mm:ss");
}

function formatCoordinates(lng, lat) {
  if (typeof lng === "undefined" || typeof lat === "undefined" || lng === null || lat === null) {
    return "";
  }

  return `${String(lng).trim()},${String(lat).trim()}`;
}

function buildVehiclePayload(vehicle, overrides) {
  const vehicleTypeEnum = String(overrides.vehicleTypeEnum || inferVehicleType(vehicle)).trim().toUpperCase();
  if (!VEHICLE_TYPE_ENUMS.includes(vehicleTypeEnum)) {
    const error = new Error("vehicleTypeEnum must be one of CAR, MOTORCYCLE, TRICYCLE");
    error.statusCode = 400;
    throw error;
  }

  const payload = {
    vehicleRegistrationNumber: String(overrides.vehicleRegistrationNumber || vehicle.vehicle_number || "").trim(),
    vehicleModel: String(overrides.vehicleModel || vehicle.vehicle_name || "").trim(),
    vehicleChasisNumber: String(overrides.vehicleChasisNumber || vehicle.vehicle_chasis_number || "").trim(),
    vehicleTypeEnum: vehicleTypeEnum,
    vehicleRegistrationDate: String(overrides.vehicleRegistrationDate || normalizeDate(vehicle.vehicle_registration_date) || "").trim()
  };

  requireValue(payload.vehicleRegistrationNumber, "vehicleRegistrationNumber is required");
  requireValue(payload.vehicleChasisNumber, "vehicleChasisNumber is required");
  requireValue(payload.vehicleRegistrationDate, "vehicleRegistrationDate is required");

  return payload;
}

function buildTripPayload(context, overrides) {
  const ride = context.ride;
  const driver = context.driver;
  const user = context.user;
  const vehicle = context.vehicle;
  const review = context.review;

  const totalFareAmount = Number(
    typeof overrides.totalFareAmount !== "undefined"
      ? overrides.totalFareAmount
      : ((parseFloat(ride.baseprice || 0) + parseFloat(ride.tax || 0)).toFixed(2))
  );

  const driverEarning = Number(
    typeof overrides.driverEarning !== "undefined"
      ? overrides.driverEarning
      : (parseFloat(ride.total || 0).toFixed(2))
  );

  const payload = {
    tripId: String(overrides.tripId || ride._id || "").trim(),
    originCoordinates: String(overrides.originCoordinates || formatCoordinates(ride.pickup_lng, ride.pickup_lat)).trim(),
    endCoordinates: String(overrides.endCoordinates || formatCoordinates(ride.drop_lng, ride.drop_lat)).trim(),
    startTime: String(overrides.startTime || formatCetsDateTime(ride.ride_started_at || ride.created_at)).trim(),
    endTime: String(overrides.endTime || formatCetsDateTime(ride.ride_completed_at || ride.ridestatusat || ride.updatedAt || ride.created_at)).trim(),
    totalFareAmount: totalFareAmount,
    tripDistance: parseInt(typeof overrides.tripDistance !== "undefined" ? overrides.tripDistance : Math.round(parseFloat(ride.ridedistance || 0)), 10),
    rating: parseInt(typeof overrides.rating !== "undefined" ? overrides.rating : (review && typeof review.rating !== "undefined" && review.rating !== null ? review.rating : config.cets.defaultRating), 10),
    driverEarning: driverEarning,
    driverLicenseNumber: String(overrides.driverLicenseNumber || driver.driver_license_number || "").trim(),
    vehicleRegistrationNumber: String(overrides.vehicleRegistrationNumber || ride.vehicle_no || (vehicle && vehicle.vehicle_number) || "").trim(),
    passengerName: String(overrides.passengerName || user.full_name || "").trim(),
    passengerPhone: String(overrides.passengerPhone || `${user.country_code || ""}${user.phone_number || ""}`).trim(),
    pickupPoint: String(overrides.pickupPoint || ride.pickup_location || "").trim(),
    dropOffPoint: String(overrides.dropOffPoint || ride.drop_location || "").trim()
  };

  const passengerNida = String(overrides.passengerNida || user.nida_number || "").trim();
  if (passengerNida) {
    payload.passengerNida = passengerNida;
  }

  requireValue(payload.tripId, "tripId is required");
  requireValue(payload.originCoordinates, "originCoordinates is required");
  requireValue(payload.endCoordinates, "endCoordinates is required");
  requireValue(payload.startTime, "startTime is required");
  requireValue(payload.endTime, "endTime is required");
  if (!Number.isFinite(payload.totalFareAmount)) {
    throw Object.assign(new Error("totalFareAmount is required"), { statusCode: 400 });
  }
  if (!Number.isFinite(payload.tripDistance)) {
    throw Object.assign(new Error("tripDistance is required"), { statusCode: 400 });
  }
  if (!Number.isFinite(payload.rating) || payload.rating < 0 || payload.rating > 5) {
    throw Object.assign(new Error("rating must be between 0 and 5"), { statusCode: 400 });
  }
  if (!Number.isFinite(payload.driverEarning)) {
    throw Object.assign(new Error("driverEarning is required"), { statusCode: 400 });
  }
  requireValue(payload.driverLicenseNumber, "driverLicenseNumber is required");
  requireValue(payload.vehicleRegistrationNumber, "vehicleRegistrationNumber is required");
  requireValue(payload.passengerName, "passengerName is required");
  requireValue(payload.passengerPhone, "passengerPhone is required");
  requireValue(payload.pickupPoint, "pickupPoint is required");
  requireValue(payload.dropOffPoint, "dropOffPoint is required");

  return payload;
}

function buildDailyReportPayload(reportDate, totals, overrides) {
  const payload = {
    totalTrip: parseInt(typeof overrides.totalTrip !== "undefined" ? overrides.totalTrip : totals.totalTrip, 10),
    totalPaidAmount: parseInt(typeof overrides.totalPaidAmount !== "undefined" ? overrides.totalPaidAmount : totals.totalPaidAmount, 10),
    reportDate: String(overrides.reportDate || reportDate || "").trim()
  };

  if (!Number.isFinite(payload.totalTrip)) {
    throw Object.assign(new Error("totalTrip is required"), { statusCode: 400 });
  }
  if (!Number.isFinite(payload.totalPaidAmount)) {
    throw Object.assign(new Error("totalPaidAmount is required"), { statusCode: 400 });
  }
  requireValue(payload.reportDate, "reportDate is required");

  return payload;
}

async function postToCets(pathname, payload) {
  const client = createAuthorizedClient();
  const upstreamUrl = buildAbsoluteUrl(config.cets.baseUrl, pathname);

  try {
    const response = await client.post(pathname, payload);
    return ensureSuccessfulCetsResponse(response.data, payload);
  } catch (error) {
    const response = error && error.response ? error.response : null;
    const enrichedError = new Error(
      response && response.status
        ? `CeTS request failed with status code ${response.status}`
        : (error && error.message) || "CeTS request failed"
    );

    enrichedError.statusCode = response && response.status ? response.status : 502;
    enrichedError.upstreamUrl = upstreamUrl;
    enrichedError.upstreamStatus = response && response.status ? response.status : null;
    enrichedError.upstreamBody = response ? response.data : null;
    enrichedError.requestPayload = payload;
    throw enrichedError;
  }
}

async function submitDriver(driver, overrides) {
  const payload = buildDriverPayload(driver, overrides || {});
  const response = await postToCets(config.cets.submitDriverPath, payload);

  return {
    payload: payload,
    response: response
  };
}

async function submitVehicle(vehicle, overrides) {
  const payload = buildVehiclePayload(vehicle, overrides || {});
  const response = await postToCets(config.cets.submitVehiclePath, payload);

  return {
    payload: payload,
    response: response
  };
}

async function submitTrip(context, overrides) {
  const payload = buildTripPayload(context, overrides || {});
  const response = await postToCets(config.cets.submitTripPath, payload);

  return {
    payload: payload,
    response: response
  };
}

async function submitDailyReport(reportDate, totals, overrides) {
  const payload = buildDailyReportPayload(reportDate, totals, overrides || {});
  const response = await postToCets(config.cets.submitReportPath, payload);

  return {
    payload: payload,
    response: response
  };
}

module.exports = {
  buildDiscoveryDocument: buildDiscoveryDocument,
  getJwks: getJwks,
  createAccessToken: createAccessToken,
  submitDriver: submitDriver,
  submitVehicle: submitVehicle,
  submitTrip: submitTrip,
  submitDailyReport: submitDailyReport,
  formatCetsDateTime: formatCetsDateTime
};
