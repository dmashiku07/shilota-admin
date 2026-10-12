const crypto = require("crypto");
const nodemailer = require("nodemailer");
const config = require("../config");
const EmailActivation = require("../schema/emailactivation");

const EMAIL_ACTIVATION_EXPIRY_MINUTES = 10;
const EMAIL_ACTIVATION_MAX_ATTEMPTS = 3;
const EMAIL_ACTIVATION_MAX_RESENDS = 3;

function smtpConfiguration() {
  const host = String(process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 0);
  const user = String(process.env.SMTP_USERNAME || "").trim();
  const pass = String(process.env.SMTP_PASSWORD || "");
  const from = String(process.env.SMTP_FROM || "").trim();
  const secure = String(process.env.SMTP_SECURE || "false").trim().toLowerCase() === "true";

  if (!host || !Number.isInteger(port) || port <= 0 || !user || !pass || !from) {
    return null;
  }

  return { host, port, user, pass, from, secure };
}

function activationCode() {
  return String(crypto.randomInt(0, 10000)).padStart(4, "0");
}

function hashActivationCode(accountId, email, code) {
  return crypto
    .createHash("sha256")
    .update(`${config.secret}|email_activation|${accountId}|${String(email).toLowerCase()}|${code}`)
    .digest("hex");
}

async function sendActivationEmail(email, code) {
  const smtp = smtpConfiguration();
  if (!smtp) {
    return { delivered: false, reason: "SMTP_NOT_CONFIGURED" };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: { user: smtp.user, pass: smtp.pass }
  });

  try {
    await transporter.sendMail({
      from: smtp.from,
      to: email,
      subject: "Your Shilota activation code",
      text: `Your Shilota activation code is ${code}. It expires in ${EMAIL_ACTIVATION_EXPIRY_MINUTES} minutes.`,
      html: `<p>Your Shilota activation code is <strong>${code}</strong>.</p><p>It expires in ${EMAIL_ACTIVATION_EXPIRY_MINUTES} minutes.</p>`
    });
    return { delivered: true };
  } catch (error) {
    console.error("Activation email send failed:", error && error.message);
    return { delivered: false, reason: "SMTP_DELIVERY_FAILED" };
  }
}

async function issueDriverActivation(driver, options) {
  const now = (options && options.now) || new Date();
  const resend = Boolean(options && options.resend);
  const existing = await EmailActivation.findOne({
    account_type: "driver",
    account_id: driver._id,
    verified: false
  }).sort({ createdAt: -1 }).exec();

  if (resend && (!existing || existing.expires_at <= now)) {
    return { ok: false, code: "ACTIVATION_NOT_FOUND" };
  }
  if (resend && existing.resend_count >= EMAIL_ACTIVATION_MAX_RESENDS) {
    return { ok: false, code: "RESEND_LIMIT_REACHED" };
  }

  const code = activationCode();
  const activation = existing || new EmailActivation({
    account_type: "driver",
    account_id: driver._id,
    email: driver.email,
    resend_count: 0
  });
  activation.email = String(driver.email).toLowerCase();
  activation.code_hash = hashActivationCode(driver._id, activation.email, code);
  activation.expires_at = new Date(now.getTime() + EMAIL_ACTIVATION_EXPIRY_MINUTES * 60 * 1000);
  activation.attempt_count = 0;
  activation.verified = false;
  activation.verified_at = null;
  if (resend) activation.resend_count += 1;
  await activation.save();

  const delivery = await sendActivationEmail(activation.email, code);
  return {
    ok: true,
    delivery,
    expires_in: EMAIL_ACTIVATION_EXPIRY_MINUTES * 60,
    resends_remaining: EMAIL_ACTIVATION_MAX_RESENDS - activation.resend_count
  };
}

async function verifyDriverActivation(email, code, options) {
  const now = (options && options.now) || new Date();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const activation = await EmailActivation.findOne({
    account_type: "driver",
    email: normalizedEmail,
    verified: false
  }).sort({ createdAt: -1 }).exec();

  if (!activation) return { ok: false, code: "ACTIVATION_NOT_FOUND" };
  if (activation.expires_at <= now) return { ok: false, code: "ACTIVATION_EXPIRED" };
  if (activation.attempt_count >= EMAIL_ACTIVATION_MAX_ATTEMPTS) {
    return { ok: false, code: "MAX_ATTEMPTS_EXCEEDED" };
  }
  if (hashActivationCode(activation.account_id, activation.email, code) !== activation.code_hash) {
    await EmailActivation.updateOne({ _id: activation._id }, { $inc: { attempt_count: 1 } }).exec();
    return { ok: false, code: "INVALID_CODE" };
  }

  const claimed = await EmailActivation.findOneAndUpdate(
    { _id: activation._id, verified: false },
    { $set: { verified: true, verified_at: now } },
    { new: true }
  ).exec();
  return claimed ? { ok: true, account_id: claimed.account_id } : { ok: false, code: "ACTIVATION_ALREADY_USED" };
}

module.exports = {
  EMAIL_ACTIVATION_EXPIRY_MINUTES,
  EMAIL_ACTIVATION_MAX_ATTEMPTS,
  EMAIL_ACTIVATION_MAX_RESENDS,
  issueDriverActivation,
  smtpConfiguration,
  verifyDriverActivation
};
