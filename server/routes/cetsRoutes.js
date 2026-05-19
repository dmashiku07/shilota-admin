const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/admin");
const CetsSubmission = require("../schema/cetssubmissions");
const config = require("../config");
const cetsService = require("../services/cetsService");
const cetsSyncService = require("../services/cetsSyncService");

const router = express.Router();

function extractJwtToken(req) {
  const authHeader = req.headers && req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  return authHeader.replace(/^JWT\s+/i, "").trim();
}

async function requireAdmin(req) {
  const token = extractJwtToken(req);
  if (!token) {
    const error = new Error("Unauthorized access");
    error.statusCode = 401;
    throw error;
  }

  const decoded = jwt.verify(token, config.secret);
  const adminPayload = decoded && decoded.data ? decoded.data : decoded;
  if (!adminPayload || adminPayload.role !== "admin" || !adminPayload._id) {
    const error = new Error("Unauthorized access");
    error.statusCode = 401;
    throw error;
  }

  const admin = await User.findById(adminPayload._id).exec();
  if (!admin) {
    const error = new Error("Unauthorized access");
    error.statusCode = 401;
    throw error;
  }

  return admin;
}

router.get(config.cets.discoveryPath, function (_req, res) {
  try {
    return res.json(cetsService.buildDiscoveryDocument());
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      msg: error.message
    });
  }
});

router.get(config.cets.jwksPath, function (_req, res) {
  try {
    return res.json(cetsService.getJwks());
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      msg: error.message
    });
  }
});

router.post("/admin/cets/driver/:id/submit", async function (req, res) {
  try {
    await requireAdmin(req);
    const immediate = await cetsSyncService.runSubmissionNow("driver", req.params.id, null, req.body || {});

    return res.json({
      success: true,
      payload: immediate.result.payload,
      response: immediate.result.response,
      submission_id: immediate.submission._id
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      msg: error.message || "Unable to submit driver to CeTS",
      upstream_url: error.upstreamUrl || null,
      upstream_status: typeof error.upstreamStatus === "undefined" ? null : error.upstreamStatus,
      upstream_body: typeof error.upstreamBody === "undefined" ? null : error.upstreamBody,
      payload: typeof error.requestPayload === "undefined" ? null : error.requestPayload
    });
  }
});

router.post("/admin/cets/vehicle/:id/submit", async function (req, res) {
  try {
    await requireAdmin(req);
    const immediate = await cetsSyncService.runSubmissionNow("vehicle", req.params.id, null, req.body || {});

    return res.json({
      success: true,
      payload: immediate.result.payload,
      response: immediate.result.response,
      submission_id: immediate.submission._id
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      msg: error.message || "Unable to submit vehicle to CeTS",
      upstream_url: error.upstreamUrl || null,
      upstream_status: typeof error.upstreamStatus === "undefined" ? null : error.upstreamStatus,
      upstream_body: typeof error.upstreamBody === "undefined" ? null : error.upstreamBody,
      payload: typeof error.requestPayload === "undefined" ? null : error.requestPayload
    });
  }
});

router.post("/admin/cets/trip/:id/submit", async function (req, res) {
  try {
    await requireAdmin(req);
    const immediate = await cetsSyncService.runSubmissionNow("trip", req.params.id, null, req.body || {});

    return res.json({
      success: true,
      payload: immediate.result.payload,
      response: immediate.result.response,
      submission_id: immediate.submission._id
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      msg: error.message || "Unable to submit trip to CeTS",
      upstream_url: error.upstreamUrl || null,
      upstream_status: typeof error.upstreamStatus === "undefined" ? null : error.upstreamStatus,
      upstream_body: typeof error.upstreamBody === "undefined" ? null : error.upstreamBody,
      payload: typeof error.requestPayload === "undefined" ? null : error.requestPayload
    });
  }
});

router.post("/admin/cets/report/:reportDate/submit", async function (req, res) {
  try {
    await requireAdmin(req);
    const immediate = await cetsSyncService.runSubmissionNow("daily_report", null, req.params.reportDate, req.body || {});

    return res.json({
      success: true,
      payload: immediate.result.payload,
      response: immediate.result.response,
      submission_id: immediate.submission._id
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      msg: error.message || "Unable to submit report to CeTS",
      upstream_url: error.upstreamUrl || null,
      upstream_status: typeof error.upstreamStatus === "undefined" ? null : error.upstreamStatus,
      upstream_body: typeof error.upstreamBody === "undefined" ? null : error.upstreamBody,
      payload: typeof error.requestPayload === "undefined" ? null : error.requestPayload
    });
  }
});

router.get("/admin/cets/submissions", async function (req, res) {
  try {
    await requireAdmin(req);

    const submissions = await CetsSubmission.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .exec();

    return res.json({
      success: true,
      result: submissions
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      msg: error.message || "Unable to load CeTS submissions"
    });
  }
});

module.exports = router;
