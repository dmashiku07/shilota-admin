const config = require("../config");
const smsService = require("./smsService");
const crypto = require("crypto");

let SelcomGatewayClient = null;
try {
  ({ apigwCLient: SelcomGatewayClient } = require("selcom-apigw-client"));
} catch (_error) {
  SelcomGatewayClient = null;
}

function getSelcomConfig() {
  return {
    baseUrl: process.env.SELCOM_BASE_URL || "https://apigw.selcommobile.com",
    apiKey: process.env.SELCOM_API_KEY || "",
    apiSecret: process.env.SELCOM_API_SECRET || "",
    vendorId: process.env.SELCOM_VENDOR_ID || "",
    vendorPin: process.env.SELCOM_VENDOR_PIN || "",
    redirectBaseUrl: process.env.SELCOM_REDIRECT_BASE_URL || config.baseUrl,
    webhookUrl: process.env.SELCOM_WEBHOOK_URL || ""
  };
}

function isConfigured() {
  const selcomConfig = getSelcomConfig();
  return Boolean(
    SelcomGatewayClient &&
      selcomConfig.baseUrl &&
      selcomConfig.apiKey &&
      selcomConfig.apiSecret &&
      selcomConfig.vendorId
  );
}

function getClient() {
  if (!SelcomGatewayClient) {
    throw new Error("Selcom client dependency is not installed");
  }

  const selcomConfig = getSelcomConfig();
  return new SelcomGatewayClient(
    selcomConfig.baseUrl,
    selcomConfig.apiKey,
    selcomConfig.apiSecret
  );
}

function encodeBase64(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64");
}

function maybeDecodeBase64Url(value) {
  if (!value || typeof value !== "string") {
    return value;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return /^https?:\/\//i.test(decoded) ? decoded : value;
  } catch (_error) {
    return value;
  }
}

function firstDataItem(response) {
  if (Array.isArray(response && response.data)) {
    return response.data[0] || {};
  }

  return (response && response.data) || {};
}

function ensureSuccessfulResponse(response, action, extraAcceptedCodes) {
  const acceptedCodes = new Set(["000"].concat(extraAcceptedCodes || []));
  if (response && response.resultcode && acceptedCodes.has(String(response.resultcode))) {
    return;
  }

  const message = response && response.message ? response.message : "Unknown Selcom API error";
  const code = response && response.resultcode ? response.resultcode : "UNKNOWN_ERROR";
  throw new Error(`${action} failed [${code}]: ${message}`);
}

function generateTransId() {
  return `SELCOM${Date.now()}${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function normalizeAmount(amount) {
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    return null;
  }

  return Math.round(parsedAmount * 100) / 100;
}

function buildReturnUrl(transid) {
  const selcomConfig = getSelcomConfig();
  const redirectTarget = String(
    selcomConfig.redirectBaseUrl || `${config.baseUrl.replace(/\/$/, "")}/wallet-payment-success`
  ).trim();
  const redirectUrl = new URL(redirectTarget);
  redirectUrl.searchParams.set("transid", String(transid || ""));
  redirectUrl.searchParams.set("provider", "selcom");
  return redirectUrl.toString();
}

function buildWebhookUrl() {
  const selcomConfig = getSelcomConfig();
  return String(selcomConfig.webhookUrl || `${config.baseUrl.replace(/\/$/, "")}/api/selcom/callback`).trim();
}

function toHeaderString(value) {
  if (Array.isArray(value)) {
    return String(value[0] || "");
  }

  return String(value || "");
}

function buildSignedString(timestamp, signedFields, payload) {
  return ["timestamp=" + timestamp]
    .concat(
      signedFields.map(function (field) {
        return `${field}=${typeof payload[field] === "undefined" || payload[field] === null ? "" : payload[field]}`;
      })
    )
    .join("&");
}

function timingSafeEquals(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function verifyWebhookRequest(headers, payload) {
  const selcomConfig = getSelcomConfig();
  const authorization = toHeaderString(headers && headers.authorization).trim();
  const digestMethod = toHeaderString(headers && headers["digest-method"]).trim().toUpperCase();
  const digest = toHeaderString(headers && headers.digest).trim();
  const timestamp = toHeaderString(headers && headers.timestamp).trim();
  const signedFieldsHeader = toHeaderString(headers && headers["signed-fields"]).trim();

  if (!authorization || !digestMethod || !digest || !timestamp || !signedFieldsHeader) {
    return false;
  }

  const expectedAuthorization = `SELCOM ${Buffer.from(String(selcomConfig.apiKey || ""), "utf8").toString("base64")}`;
  if (authorization !== expectedAuthorization) {
    return false;
  }

  if (digestMethod !== "HS256") {
    return false;
  }

  const signedFields = signedFieldsHeader
    .split(",")
    .map(function (field) {
      return field.trim();
    })
    .filter(Boolean);

  if (!signedFields.length) {
    return false;
  }

  const signingString = buildSignedString(timestamp, signedFields, payload || {});
  const expectedDigest = crypto
    .createHmac("sha256", String(selcomConfig.apiSecret || ""))
    .update(signingString)
    .digest("base64");

  return timingSafeEquals(expectedDigest, digest);
}

function isSuccessfulWebhookPayload(payload) {
  const resultcode = String(payload && payload.resultcode || "").trim();
  const paymentStatus = String(payload && payload.payment_status || "").trim().toUpperCase();
  return resultcode === "000" && paymentStatus === "COMPLETED";
}

function buildBuyerPhone(user) {
  const phoneFromCountryCode =
    user && user.country_code && user.phone_number
      ? `${user.country_code}${user.phone_number}`
      : user && user.phone_number
        ? user.phone_number
        : "";

  return smsService.normalizePhoneNumber(phoneFromCountryCode);
}

async function createOrder(options) {
  const selcomConfig = getSelcomConfig();
  const amount = normalizeAmount(options && options.amount);
  const transid = options && options.transid ? String(options.transid) : generateTransId();
  const orderId = options && options.orderId ? String(options.orderId) : transid;
  const user = (options && options.user) || {};
  const buyerPhone = buildBuyerPhone(user);
  const returnUrl = options && options.returnUrl ? options.returnUrl : buildReturnUrl(transid);
  const cancelUrl = options && options.cancelUrl ? options.cancelUrl : returnUrl;
  const webhookUrl = options && options.webhookUrl ? options.webhookUrl : buildWebhookUrl();

  if (!amount) {
    throw new Error("Invalid payment amount");
  }

  if (!buyerPhone) {
    throw new Error("User phone number is required for Selcom checkout");
  }

  const orderData = {
    vendor: selcomConfig.vendorId,
    order_id: orderId,
    buyer_email: user.email || `user-${String(user._id || "guest")}@shilota.local`,
    buyer_name: user.full_name || "Shilota User",
    buyer_phone: buyerPhone,
    amount,
    currency: "TZS",
    redirect_url: encodeBase64(returnUrl),
    cancel_url: encodeBase64(cancelUrl),
    webhook: encodeBase64(webhookUrl),
    buyer_remarks: options && options.remarks ? String(options.remarks) : "Shilota payment",
    merchant_remarks: options && options.remarks ? String(options.remarks) : "Shilota payment",
    no_of_items: 1
  };

  const response = await getClient().postFunc("/v1/checkout/create-order-minimal", orderData);
  ensureSuccessfulResponse(response, "Selcom order creation");

  const result = firstDataItem(response);
  return {
    transid,
    orderId,
    response,
    reference: result.reference || response.reference || "",
    gatewayBuyerUuid: result.gateway_buyer_uuid || "",
    paymentUrl: maybeDecodeBase64Url(result.payment_gateway_url || result.payment_url || ""),
    returnUrl
  };
}

async function queryTransaction(transid) {
  const response = await getClient().getFunc("/v1/checkout/query", {
    transid: String(transid || "")
  });

  ensureSuccessfulResponse(response, "Selcom transaction query", ["111"]);
  return response;
}

module.exports = {
  buildReturnUrl,
  buildWebhookUrl,
  createOrder,
  generateTransId,
  getSelcomConfig,
  isSuccessfulWebhookPayload,
  isConfigured,
  normalizeAmount,
  queryTransaction,
  verifyWebhookRequest
};
