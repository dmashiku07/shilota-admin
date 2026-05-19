const axios = require("axios");
const https = require("https");

function getBeemConfig() {
  return {
    apiKey: process.env.BEEM_API_KEY || "",
    secretKey: process.env.BEEM_SECRET_KEY || "",
    sourceAddr: process.env.BEEM_SOURCE_ADDR || ""
  };
}

function isConfigured() {
  const config = getBeemConfig();
  return Boolean(config.apiKey && config.secretKey && config.sourceAddr);
}

function normalizePhoneNumber(phoneNumber) {
  const digits = String(phoneNumber || "").replace(/[^0-9]/g, "");
  if (!digits) {
    return "";
  }

  if (digits.startsWith("255")) {
    return digits;
  }

  if (digits.startsWith("0")) {
    return `255${digits.slice(1)}`;
  }

  return digits;
}

async function sendSms(phoneNumber, message) {
  const config = getBeemConfig();
  if (!isConfigured()) {
    return {
      success: false,
      skipped: true,
      message: "BEEM SMS credentials are not configured"
    };
  }

  const auth = Buffer.from(`${config.apiKey}:${config.secretKey}`).toString("base64");
  const destAddr = normalizePhoneNumber(phoneNumber);

  try {
    const response = await axios.post(
      "https://apisms.beem.africa/v1/send",
      {
        source_addr: config.sourceAddr,
        schedule_time: "",
        encoding: 0,
        message,
        recipients: [
          {
            recipient_id: 1,
            dest_addr: destAddr
          }
        ]
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      }
    );

    return {
      success: Boolean(response?.data?.successful),
      skipped: false,
      response: response?.data || null
    };
  } catch (error) {
    return {
      success: false,
      skipped: false,
      error: error?.response?.data || error.message
    };
  }
}

module.exports = {
  isConfigured,
  normalizePhoneNumber,
  sendSms
};
