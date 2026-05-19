const cron = require("node-cron");
const moment = require("moment");
const config = require("../config");
const Driver = require("../schema/driver");
const Vehicles = require("../schema/vehicles");
const Rides = require("../schema/rides");
const Reviews = require("../schema/reviews");
const User = require("../schema/user");
const CetsSubmission = require("../schema/cetssubmissions");
const cetsService = require("./cetsService");

const STATUS_PENDING = "pending";
const STATUS_PROCESSING = "processing";
const STATUS_SYNCED = "synced";
const STATUS_FAILED = "failed";
const STATUS_SKIPPED = "skipped";

let processorInitialized = false;
let isProcessing = false;

function isIntegrationEnabled() {
  return config.cets.enabled;
}

function isBackgroundSyncEnabled() {
  return config.cets.enabled && config.cets.backgroundSyncEnabled;
}

function createRetryDate(attempts) {
  const delayMinutes = Math.min(Math.pow(2, Math.max(attempts, 0)), 360);
  return new Date(Date.now() + delayMinutes * 60 * 1000);
}

async function upsertSubmission(definition) {
  const update = {
    submission_type: definition.submission_type,
    entity_id: definition.entity_id || null,
    reason: definition.reason || "",
    payload_overrides: definition.payload_overrides || {},
    report_date: definition.report_date || null
  };

  const existing = await CetsSubmission.findOne({ dedupe_key: definition.dedupe_key }).exec();
  if (existing) {
    if (existing.status !== STATUS_SYNCED) {
      existing.status = STATUS_PENDING;
      existing.next_retry_at = new Date();
      existing.reason = update.reason;
      existing.payload_overrides = update.payload_overrides;
      if (update.report_date) {
        existing.report_date = update.report_date;
      }
      await existing.save();
    }
    return existing;
  }

  return CetsSubmission.create(Object.assign({}, update, {
    dedupe_key: definition.dedupe_key,
    status: STATUS_PENDING,
    next_retry_at: new Date()
  }));
}

async function enqueueDriverSync(driverId, reason, overrides) {
  if (!isIntegrationEnabled() || !driverId) {
    return null;
  }

  return upsertSubmission({
    submission_type: "driver",
    entity_id: String(driverId),
    dedupe_key: `driver:${driverId}`,
    reason: reason,
    payload_overrides: overrides || {}
  });
}

async function enqueueVehicleSync(vehicleId, reason, overrides) {
  if (!isIntegrationEnabled() || !vehicleId) {
    return null;
  }

  return upsertSubmission({
    submission_type: "vehicle",
    entity_id: String(vehicleId),
    dedupe_key: `vehicle:${vehicleId}`,
    reason: reason,
    payload_overrides: overrides || {}
  });
}

async function enqueueTripSync(rideId, reason, overrides) {
  if (!isIntegrationEnabled() || !rideId) {
    return null;
  }

  return upsertSubmission({
    submission_type: "trip",
    entity_id: String(rideId),
    dedupe_key: `trip:${rideId}`,
    reason: reason,
    payload_overrides: overrides || {}
  });
}

async function enqueueDailyReport(reportDate, reason, overrides) {
  if (!isIntegrationEnabled() || !reportDate) {
    return null;
  }

  return upsertSubmission({
    submission_type: "daily_report",
    dedupe_key: `daily_report:${reportDate}`,
    reason: reason,
    payload_overrides: overrides || {},
    report_date: reportDate
  });
}

async function markSubmissionSuccess(submission, result) {
  submission.status = STATUS_SYNCED;
  submission.request_payload = result.payload;
  submission.response_payload = result.response;
  submission.error_message = "";
  submission.upstream_url = null;
  submission.upstream_status = null;
  submission.processed_at = new Date();
  submission.last_attempt_at = new Date();
  submission.attempts += 1;
  submission.latra_reference_number = result.response && result.response.data ? result.response.data.latraReferenceNumber || null : null;
  submission.trip_ref = result.response && result.response.data ? result.response.data.tripRef || null : null;
  await submission.save();
}

async function markSubmissionFailure(submission, error, shouldRetry) {
  submission.status = shouldRetry ? STATUS_FAILED : STATUS_SKIPPED;
  submission.error_message = error.message || "CeTS sync failed";
  submission.upstream_url = error.upstreamUrl || null;
  submission.upstream_status = typeof error.upstreamStatus === "undefined" ? null : error.upstreamStatus;
  submission.response_payload = typeof error.upstreamBody === "undefined" ? null : error.upstreamBody;
  submission.request_payload = typeof error.requestPayload === "undefined" ? submission.request_payload : error.requestPayload;
  submission.processed_at = new Date();
  submission.last_attempt_at = new Date();
  submission.attempts += 1;
  submission.next_retry_at = shouldRetry ? createRetryDate(submission.attempts) : null;
  await submission.save();
  await updateEntityFailureStatus(submission, error);
}

async function updateEntityFailureStatus(submission, error) {
  const errorMessage = error.message || "CeTS sync failed";
  const errorBody = typeof error.upstreamBody === "undefined" ? null : error.upstreamBody;

  if (submission.submission_type === "driver" && submission.entity_id) {
    await Driver.updateOne({
      _id: submission.entity_id
    }, {
      $set: {
        cets_sync_status: STATUS_FAILED,
        cets_last_sync_error: errorMessage,
        cets_last_sync_response: errorBody
      }
    }).exec();
  } else if (submission.submission_type === "vehicle" && submission.entity_id) {
    await Vehicles.updateOne({
      _id: submission.entity_id
    }, {
      $set: {
        cets_sync_status: STATUS_FAILED,
        cets_last_sync_error: errorMessage,
        cets_last_sync_response: errorBody
      }
    }).exec();
  } else if (submission.submission_type === "trip" && submission.entity_id) {
    await Rides.updateOne({
      _id: submission.entity_id
    }, {
      $set: {
        cets_sync_status: STATUS_FAILED,
        cets_last_sync_error: errorMessage,
        cets_last_sync_response: errorBody
      }
    }).exec();
  }
}

async function syncDriverSubmission(submission) {
  const driver = await Driver.findById(submission.entity_id).exec();
  if (!driver) {
    throw Object.assign(new Error("Driver not found"), { statusCode: 404 });
  }

  const result = await cetsService.submitDriver(driver, submission.payload_overrides || {});
  driver.cets_sync_status = STATUS_SYNCED;
  driver.cets_last_synced_at = new Date();
  driver.cets_last_sync_error = "";
  driver.cets_last_sync_response = result.response;
  await driver.save();
  return result;
}

async function syncVehicleSubmission(submission) {
  const vehicle = await Vehicles.findById(submission.entity_id).exec();
  if (!vehicle) {
    throw Object.assign(new Error("Vehicle not found"), { statusCode: 404 });
  }

  const result = await cetsService.submitVehicle(vehicle, submission.payload_overrides || {});
  vehicle.cets_sync_status = STATUS_SYNCED;
  vehicle.cets_last_synced_at = new Date();
  vehicle.cets_last_sync_error = "";
  vehicle.cets_last_sync_response = result.response;
  await vehicle.save();
  return result;
}

async function buildTripContext(rideId) {
  const ride = await Rides.findById(rideId).exec();
  if (!ride) {
    throw Object.assign(new Error("Ride not found"), { statusCode: 404 });
  }

  const [driver, user, vehicle, review] = await Promise.all([
    Driver.findById(ride.driver_id).exec(),
    User.findById(ride.user_id).exec(),
    Vehicles.findOne({ user_id: ride.driver_id }).exec(),
    Reviews.findOne({ onride_id: ride._id }).exec()
  ]);

  if (!driver) {
    throw Object.assign(new Error("Ride driver not found"), { statusCode: 404 });
  }

  if (!user) {
    throw Object.assign(new Error("Ride passenger not found"), { statusCode: 404 });
  }

  if (!vehicle) {
    throw Object.assign(new Error("Driver vehicle not found"), { statusCode: 404 });
  }

  return {
    ride: ride,
    driver: driver,
    user: user,
    vehicle: vehicle,
    review: review
  };
}

async function syncTripSubmission(submission) {
  const context = await buildTripContext(submission.entity_id);

  if (context.driver.cets_sync_status !== STATUS_SYNCED) {
    await enqueueDriverSync(context.driver._id, "trip_dependency_driver");
    throw Object.assign(new Error("Driver must be synced to CeTS before trip submission"), { statusCode: 409 });
  }

  if (context.vehicle.cets_sync_status !== STATUS_SYNCED) {
    await enqueueVehicleSync(context.vehicle._id, "trip_dependency_vehicle");
    throw Object.assign(new Error("Vehicle must be synced to CeTS before trip submission"), { statusCode: 409 });
  }

  const result = await cetsService.submitTrip(context, submission.payload_overrides || {});
  context.ride.cets_sync_status = STATUS_SYNCED;
  context.ride.cets_last_synced_at = new Date();
  context.ride.cets_last_sync_error = "";
  context.ride.cets_last_sync_response = result.response;
  context.ride.latra_reference_number = result.response && result.response.data ? result.response.data.latraReferenceNumber || null : null;
  context.ride.cets_trip_ref = result.response && result.response.data ? result.response.data.tripRef || null : null;
  await context.ride.save();
  return result;
}

async function buildDailyReportTotals(reportDate) {
  const start = moment.tz ? moment.tz(reportDate, "YYYY-MM-DD", "Africa/Dar_es_Salaam").startOf("day") : moment(reportDate, "YYYY-MM-DD").utcOffset(180).startOf("day");
  const end = start.clone().endOf("day");

  const rides = await Rides.find({
    ridestatus: "completed",
    $or: [
      {
        ride_completed_at: {
          $gte: start.toDate(),
          $lte: end.toDate()
        }
      },
      {
        ride_completed_at: null,
        created_at: {
          $gte: start.toDate(),
          $lte: end.toDate()
        }
      }
    ]
  }).exec();

  const totalTrip = rides.length;
  const totalPaidAmount = rides.reduce((sum, ride) => {
    return sum + parseFloat(ride.baseprice || 0) + parseFloat(ride.tax || 0);
  }, 0);

  return {
    totalTrip: totalTrip,
    totalPaidAmount: Math.round(totalPaidAmount)
  };
}

async function syncDailyReportSubmission(submission) {
  const reportDate = submission.report_date || moment().utcOffset(180).subtract(1, "day").format("YYYY-MM-DD");
  const totals = await buildDailyReportTotals(reportDate);
  const result = await cetsService.submitDailyReport(reportDate, totals, submission.payload_overrides || {});
  return result;
}

async function processSubmission(submission) {
  submission.status = STATUS_PROCESSING;
  submission.last_attempt_at = new Date();
  await submission.save();

  switch (submission.submission_type) {
    case "driver":
      return syncDriverSubmission(submission);
    case "vehicle":
      return syncVehicleSubmission(submission);
    case "trip":
      return syncTripSubmission(submission);
    case "daily_report":
      return syncDailyReportSubmission(submission);
    default:
      throw Object.assign(new Error(`Unsupported CeTS submission type: ${submission.submission_type}`), { statusCode: 400 });
  }
}

async function processPendingSubmissions(limit) {
  if (!isIntegrationEnabled() || isProcessing) {
    return;
  }

  isProcessing = true;
  try {
    const submissions = await CetsSubmission.find({
      status: { $in: [STATUS_PENDING, STATUS_FAILED] },
      next_retry_at: { $lte: new Date() }
    })
      .sort({ next_retry_at: 1, createdAt: 1 })
      .limit(limit || 10)
      .exec();

    for (const submission of submissions) {
      try {
        const result = await processSubmission(submission);
        await markSubmissionSuccess(submission, result);
      } catch (error) {
        const retryableStatus = typeof error.statusCode === "number" ? error.statusCode >= 500 || error.statusCode === 409 : true;
        await markSubmissionFailure(submission, error, retryableStatus);
      }
    }
  } finally {
    isProcessing = false;
  }
}

function initializeSchedulers() {
  if (processorInitialized || !isBackgroundSyncEnabled()) {
    return;
  }

  processorInitialized = true;

  cron.schedule("* * * * *", function () {
    processPendingSubmissions(10).catch(function (error) {
      console.error("CeTS submission processing failed:", error);
    });
  });

  cron.schedule("0 0 * * *", function () {
    const reportDate = moment().utcOffset(180).subtract(1, "day").format("YYYY-MM-DD");
    enqueueDailyReport(reportDate, "scheduled_daily_report").catch(function (error) {
      console.error("CeTS daily report enqueue failed:", error);
    });
  }, {
    timezone: "Africa/Dar_es_Salaam"
  });
}

async function runSubmissionNow(submissionType, entityId, reportDate, overrides) {
  let submission;
  if (submissionType === "driver") {
    submission = await enqueueDriverSync(entityId, "manual_sync", overrides);
  } else if (submissionType === "vehicle") {
    submission = await enqueueVehicleSync(entityId, "manual_sync", overrides);
  } else if (submissionType === "trip") {
    submission = await enqueueTripSync(entityId, "manual_sync", overrides);
  } else if (submissionType === "daily_report") {
    submission = await enqueueDailyReport(reportDate, "manual_sync", overrides);
  } else {
    throw new Error("Unsupported CeTS submission type");
  }

  if (!submission) {
    throw new Error("Unable to enqueue CeTS submission");
  }

  try {
    const result = await processSubmission(submission);
    await markSubmissionSuccess(submission, result);
    return {
      submission: submission,
      result: result
    };
  } catch (error) {
    const retryableStatus = typeof error.statusCode === "number" ? error.statusCode >= 500 || error.statusCode === 409 : true;
    await markSubmissionFailure(submission, error, retryableStatus);
    throw error;
  }
}

module.exports = {
  enqueueDriverSync: enqueueDriverSync,
  enqueueVehicleSync: enqueueVehicleSync,
  enqueueTripSync: enqueueTripSync,
  enqueueDailyReport: enqueueDailyReport,
  initializeSchedulers: initializeSchedulers,
  processPendingSubmissions: processPendingSubmissions,
  runSubmissionNow: runSubmissionNow
};
