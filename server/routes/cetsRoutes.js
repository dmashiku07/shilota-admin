const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/admin");
const CetsSubmission = require("../schema/cetssubmissions");
const Payment = require("../schema/payments");
const Driver = require("../schema/driver");
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

function parseDate(value, endOfDay) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const date = new Date(value + "T" + (endOfDay ? "23:59:59.999" : "00:00:00.000") + "Z");
  return Number.isNaN(date.getTime()) ? null : date;
}

function safePage(value) {
  return Math.max(1, Number.parseInt(value, 10) || 1);
}

function safePageSize(value) {
  return Math.min(100, Math.max(1, Number.parseInt(value, 10) || 25));
}

function submissionConfirmation(submission) {
  const response = submission.response_payload || {};
  const data = response.data || {};
  return submission.latra_reference_number || data.latra_reference_number || data.latraReferenceNumber ||
    data.reference_number || data.referenceNumber || response.reference_number || response.referenceNumber || null;
}

const CORRECTION_FIELDS = {
  driver: ["driverName", "driverEmail", "driverPhone", "driverLicenseNumber", "licenceCategory"],
  vehicle: ["vehicleRegistrationNumber", "vehicleModel", "vehicleChasisNumber", "vehicleTypeEnum", "vehicleRegistrationDate"],
  trip: ["tripId", "originCoordinates", "endCoordinates", "startTime", "endTime", "totalFareAmount", "tripDistance", "rating", "driverEarning", "driverLicenseNumber", "vehicleRegistrationNumber", "passengerName", "passengerPhone", "passengerNida", "pickupPoint", "dropOffPoint"],
  daily_report: ["totalTrip", "totalPaidAmount", "reportDate", "operator"]
};

function sanitizeOverrides(submissionType, input) {
  const allowed = CORRECTION_FIELDS[submissionType] || [];
  const source = input && typeof input === "object" ? input : {};
  return allowed.reduce(function (result, key) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      result[key] = source[key];
    }
    return result;
  }, {});
}

function inferMissingFields(submission) {
  const payload = submission.request_payload || {};
  const responseData = ((submission.response_payload || {}).data) || {};
  const overrides = submission.payload_overrides || {};
  return (CORRECTION_FIELDS[submission.submission_type] || []).filter(function (key) {
    if (key === "operator") {
      return !overrides.operator && !payload.operator && (responseData.operator === null || responseData.operator === "" || !Object.prototype.hasOwnProperty.call(payload, "operator"));
    }
    return payload[key] === null || payload[key] === "" || typeof payload[key] === "undefined";
  });
}

async function getSuccessfulTemplate(submission) {
  return CetsSubmission.findOne({
    submission_type: submission.submission_type,
    status: "synced",
    _id: { $ne: submission._id }
  }).sort({ processed_at: -1, createdAt: -1 }).lean().exec();
}

function serializeSubmission(submission, includePayload, successfulTemplate) {
  const result = {
    id: submission._id,
    submissionType: submission.submission_type || "unknown",
    reportDate: submission.report_date || null,
    entityId: submission.entity_id || null,
    status: submission.status || "unknown",
    attempts: submission.attempts || 0,
    sentAt: submission.last_attempt_at || submission.processed_at || submission.createdAt || null,
    createdAt: submission.createdAt || null,
    processedAt: submission.processed_at || null,
    upstreamStatus: submission.upstream_status === undefined ? null : submission.upstream_status,
    confirmationReference: submissionConfirmation(submission),
    errorMessage: submission.error_message || submission.reason || null
  };
  if (includePayload) {
    result.requestPayload = submission.request_payload || null;
    result.responsePayload = submission.response_payload || null;
    result.reason = submission.reason || null;
    result.nextRetryAt = submission.next_retry_at || null;
    result.payloadOverrides = submission.payload_overrides || {};
    result.correctionFields = CORRECTION_FIELDS[submission.submission_type] || [];
    result.missingFields = inferMissingFields(submission);
    result.successfulTemplate = successfulTemplate ? {
      id: successfulTemplate._id,
      status: successfulTemplate.status,
      sentAt: successfulTemplate.last_attempt_at || successfulTemplate.processed_at || successfulTemplate.createdAt || null,
      requestPayload: successfulTemplate.request_payload || null,
      responsePayload: successfulTemplate.response_payload || null,
      confirmationReference: submissionConfirmation(successfulTemplate)
    } : null;
  }
  return result;
}

// Read-only operational reporting. It deliberately does not trigger a CeTS/LATRA submission.
router.get("/admin/latra/submissions", async function (req, res) {
  try {
    await requireAdmin(req);
    const criteria = {};
    if (req.query.status) criteria.status = req.query.status;
    if (req.query.type) criteria.submission_type = req.query.type;
    if (req.query.driverId) criteria.entity_id = req.query.driverId;
    if (req.query.confirmation === "confirmed") {
      criteria.latra_reference_number = { $exists: true, $nin: [null, ""] };
    } else if (req.query.confirmation === "unconfirmed") {
      criteria.$or = [
        { latra_reference_number: { $exists: false } },
        { latra_reference_number: null },
        { latra_reference_number: "" }
      ];
    }
    const from = parseDate(req.query.from, false);
    const to = parseDate(req.query.to, true);
    if (from || to) {
      criteria.createdAt = {};
      if (from) criteria.createdAt.$gte = from;
      if (to) criteria.createdAt.$lte = to;
    }
    const page = safePage(req.query.page);
    const pageSize = safePageSize(req.query.pageSize);
    const totalItems = await CetsSubmission.countDocuments(criteria).exec();
    const submissions = await CetsSubmission.find(criteria)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .exec();
    return res.json({
      success: true,
      items: submissions.map(serializeSubmission),
      pagination: { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) }
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, msg: error.message || "Unable to load LATRA submissions" });
  }
});

router.get("/admin/latra/submissions/:id", async function (req, res) {
  try {
    await requireAdmin(req);
    const submission = await CetsSubmission.findById(req.params.id).exec();
    if (!submission) {
      return res.status(404).json({ success: false, msg: "LATRA submission not found" });
    }
    const successfulTemplate = await getSuccessfulTemplate(submission);
    return res.json({ success: true, item: serializeSubmission(submission, true, successfulTemplate) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, msg: error.message || "Unable to load LATRA submission" });
  }
});

router.put("/admin/latra/submissions/:id/correction", async function (req, res) {
  try {
    await requireAdmin(req);
    const submission = await CetsSubmission.findById(req.params.id).exec();
    if (!submission) {
      return res.status(404).json({ success: false, msg: "LATRA submission not found" });
    }
    const overrides = sanitizeOverrides(submission.submission_type, req.body && req.body.overrides);
    submission.payload_overrides = Object.assign({}, submission.payload_overrides || {}, overrides);
    submission.reason = "admin_correction_saved";
    await submission.save();
    const successfulTemplate = await getSuccessfulTemplate(submission);
    return res.json({ success: true, item: serializeSubmission(submission, true, successfulTemplate) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, msg: error.message || "Unable to save LATRA correction" });
  }
});

// A retry is intentional and is only initiated by an authenticated admin's explicit action.
router.post("/admin/latra/submissions/:id/retry", async function (req, res) {
  try {
    await requireAdmin(req);
    const submission = await CetsSubmission.findById(req.params.id).exec();
    if (!submission) {
      return res.status(404).json({ success: false, msg: "LATRA submission not found" });
    }
    const allowedTypes = ["driver", "vehicle", "trip", "daily_report"];
    if (!allowedTypes.includes(submission.submission_type)) {
      return res.status(400).json({ success: false, msg: "This submission type cannot be retried" });
    }
    if (submission.submission_type === "daily_report" && !submission.report_date) {
      return res.status(400).json({ success: false, msg: "This daily report has no report date" });
    }
    if (submission.submission_type !== "daily_report" && !submission.entity_id) {
      return res.status(400).json({ success: false, msg: "This submission has no record identifier" });
    }
    const immediate = await cetsSyncService.runSubmissionNow(
      submission.submission_type,
      submission.entity_id || null,
      submission.report_date || null,
      sanitizeOverrides(
        submission.submission_type,
        (req.body && req.body.overrides) || submission.payload_overrides || {}
      )
    );
    const refreshed = await CetsSubmission.findById(immediate.submission._id).exec();
    const finalSubmission = refreshed || immediate.submission;
    const successfulTemplate = await getSuccessfulTemplate(finalSubmission);
    return res.json({ success: true, item: serializeSubmission(finalSubmission, true, successfulTemplate) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      msg: error.message || "Unable to retry LATRA submission",
      upstreamStatus: typeof error.upstreamStatus === "undefined" ? null : error.upstreamStatus,
      upstreamBody: typeof error.upstreamBody === "undefined" ? null : error.upstreamBody
    });
  }
});

router.get("/admin/latra/summary", async function (req, res) {
  try {
    await requireAdmin(req);
    const grouped = await CetsSubmission.aggregate([
      { $group: { _id: { type: "$submission_type", status: "$status" }, count: { $sum: 1 } } }
    ]).exec();
    const total = grouped.reduce((sum, row) => sum + row.count, 0);
    const confirmed = await CetsSubmission.countDocuments({ latra_reference_number: { $exists: true, $nin: [null, ""] } }).exec();
    return res.json({ success: true, total, confirmed, groups: grouped.map(row => ({ type: row._id.type || "unknown", status: row._id.status || "unknown", count: row.count })) });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, msg: error.message || "Unable to load LATRA summary" });
  }
});

// Payment records are the current source for the disbursement view. This does not settle or alter any payment.
router.get("/admin/disbursements", async function (req, res) {
  try {
    await requireAdmin(req);
    const criteria = {};
    if (req.query.driverId) criteria.driver_id = req.query.driverId;
    if (req.query.paymentType) criteria.payment_type = req.query.paymentType;
    const from = parseDate(req.query.from, false);
    const to = parseDate(req.query.to, true);
    if (from || to) {
      criteria.drop_time = {};
      if (from) criteria.drop_time.$gte = from;
      if (to) criteria.drop_time.$lte = to;
    }
    const page = safePage(req.query.page);
    const pageSize = safePageSize(req.query.pageSize);
    const totalItems = await Payment.countDocuments(criteria).exec();
    const payments = await Payment.find(criteria).sort({ drop_time: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean().exec();
    const driverIds = [...new Set(payments.map(payment => payment.driver_id).filter(Boolean))];
    const drivers = driverIds.length ? await Driver.find({ _id: { $in: driverIds } }).select("full_name email phone_number").lean().exec() : [];
    const driverById = new Map(drivers.map(driver => [String(driver._id), driver]));
    const items = payments.map(payment => {
      const driver = driverById.get(String(payment.driver_id)) || {};
      return {
        id: payment._id,
        driverId: payment.driver_id || null,
        driverName: driver.full_name || "Unknown driver",
        driverEmail: driver.email || null,
        rideId: payment.onride_id || null,
        paymentType: payment.payment_type || "unknown",
        fare: Number(payment.ride_fare || payment.baseprice || 0),
        tax: Number(payment.tax || 0),
        recordedCommission: Number(payment.commissionamount || 0),
        paymentStatus: payment.payment_status || (payment.paid ? "paid" : "pending"),
        paid: Boolean(payment.paid),
        directToDriver: Boolean(payment.direct_to_driver),
        recordedAt: payment.drop_time || payment.paid_at || null
      };
    });
    const totals = await Payment.aggregate([
      { $match: criteria },
      { $group: { _id: "$payment_type", count: { $sum: 1 }, fare: { $sum: { $ifNull: ["$ride_fare", "$baseprice"] } } } }
    ]).exec();
    return res.json({
      success: true,
      items,
      totals: totals.map(row => ({ paymentType: row._id || "unknown", count: row.count, fare: row.fare || 0 })),
      pagination: { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) }
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ success: false, msg: error.message || "Unable to load disbursement records" });
  }
});

module.exports = router;
