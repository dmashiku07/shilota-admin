var express = require('express');
var app = express();
var router = express.Router();
var Driver = require('../schema/driver');
var nodemailer = require('nodemailer');
var User = require('../models/admin');
var cetsSyncService = require('../services/cetsSyncService');
var { logAuditFromRequest } = require('../services/auditLogService');
var { evaluateDriverEligibility } = require('../services/driverEligibilityService');
var DriverLocalArea = require('../schema/driverlocalareas');
var {
  canManageDriver,
  requireAdmin,
  requireAssignedDriver,
  requireSuperAdmin
} = require('../services/adminAccessService');
var { UAT_RADIUS_OPTIONS_KM, normalizeActiveRadiusKm } = require('../services/driverDispatchRadiusService');
var {
  buildPaginationResult,
  buildSearchQuery,
  buildSort,
  getPaginationParams,
  mergeMatch
} = require('../utils/pagination');

router.use(requireAdmin);

function scopedDriverMatch(req, match) {
  if (req.adminAccess.role !== "OPS_ADMIN") return match;
  return mergeMatch(match, { _id: { $in: req.adminAccess.admin.assigned_driver_ids || [] } });
}

function sendDriverActivationMail(driver, callback) {
  User.findOne({}).sort({
    _id: -1
  }).exec(function (err, user) {
    if (err || !user) {
      console.error("Driver activation email skipped: admin email settings not found", err);
      return callback();
    }

    let transporter = nodemailer.createTransport({
      host: user.smptHost,
      port: user.smtpPort,
      secure: false,
      auth: {
        user: user.smtpUsername,
        pass: user.smtpPassword
      }
    });

    let mailOptions = {
      to: driver.email,
      subject: "Vehicle approved message",
      html: "Your registered vehicle approved sucessfully" + "<br><br> Regards, <br><br>" + user.siteName
    };

    transporter.verify(function (error) {
      if (error) {
        console.error("Driver activation email SMTP verification failed:", error);
        return callback();
      }

      transporter.sendMail(mailOptions, function (mailError) {
        if (mailError) {
          console.error("Driver activation email send failed:", mailError);
        }
        return callback();
      });
    });
  });
}

router.route('/').get(async function (req, res) {
  try {
    const params = getPaginationParams(req, {
      defaultSortBy: '_id',
      allowedSortFields: ['_id', 'full_name', 'email', 'phone_number']
    });
    let searchMatch = buildSearchQuery(params.search, ['full_name', 'email']);
    const numericPhoneSearch = String(params.search || '').replace(/[^0-9]/g, '');
    if (params.search && numericPhoneSearch && numericPhoneSearch === String(params.search).replace(/\s+/g, '')) {
      const phoneNumber = Number(numericPhoneSearch);
      if (Number.isFinite(phoneNumber)) {
        searchMatch = searchMatch || { $or: [] };
        searchMatch.$or.push({ phone_number: phoneNumber });
      }
    }
    const match = scopedDriverMatch(req, mergeMatch({ deletion_status: 0 }, searchMatch));
    const totalItems = await Driver.countDocuments(match).exec();
    const drivers = await Driver.find(match)
      .sort(buildSort(params.sortBy, params.sortDir))
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .populate("category_id")
      .exec();

    const items = await Promise.all((drivers || []).map(async function (driver) {
      const record = driver.toObject();
      try {
        const eligibility = await evaluateDriverEligibility(driver, {
          now: new Date()
        });
        record.subscription_eligible = eligibility.eligible;
        record.subscription_error_code = eligibility.code || "";
        record.subscription_message = eligibility.message || "";
      } catch (eligibilityError) {
        console.error('Unable to evaluate driver subscription eligibility:', {
          driver_id: String(driver._id),
          message: eligibilityError && eligibilityError.message
        });
        record.subscription_eligible = false;
        record.subscription_error_code = "ELIGIBILITY_CHECK_FAILED";
        record.subscription_message = "Subscription eligibility could not be evaluated";
      }
      return record;
    }));

    return res.json(buildPaginationResult(items, totalItems, params));
  } catch (error) {
    console.error('Unable to load driver records:', error);
    return res.json({
      error: true,
      msg: "Unable to load records from database"
    });
  }
});

router.route('/deactive/:id').post(requireAssignedDriver, function (req, res) {
  Driver.findById(req.params.id, function (err, driver) {
    if (!driver)
      return next(new Error('Could not load Document'));
    else {
      driver.approval = '0';
      driver.save().then(driver => {
        logAuditFromRequest(req, {
          action: 'driver.deactivated',
          target_type: 'driver',
          target_id: driver._id,
          metadata: {
            driver_name: driver.full_name,
            email: driver.email
          }
        });
        cetsSyncService.enqueueDriverSync(driver._id, "admin_driver_deactivate").catch(function (syncError) {
          console.error("CeTS driver deactivate enqueue failed:", syncError);
        });
        return res.json({
          success: true,
          msg: 'Driver Deactivated Successfully'
        });
      })
        .catch(err => {
          return res.json({
            error: true,
            msg: "Error with Deactivation"
          });

        });
    }
  });
});

router.route('/active/:id').post(requireAssignedDriver, function (req, res) {
  Driver.findById(req.params.id, function (err, driver) {
    if (!driver)
      return next(new Error('Could not load Document'));
    else {
      driver.approval = "1";
      driver.save().then(driver => {
        logAuditFromRequest(req, {
          action: 'driver.activated',
          target_type: 'driver',
          target_id: driver._id,
          metadata: {
            driver_name: driver.full_name,
            email: driver.email
          }
        });
        cetsSyncService.enqueueDriverSync(driver._id, "admin_driver_activate").catch(function (syncError) {
          console.error("CeTS driver activate enqueue failed:", syncError);
        });
        return sendDriverActivationMail(driver, function () {
          return res.json({
            success: true,
            msg: 'Driver Activated Successfully'
          });
        });
      })
        .catch(err => {
          return res.json({
            error: true,
            msg: "Error with Deactivation"
          });

        });
    }
  });
});

router.route('/info/:id').get(requireAssignedDriver, function (req, res) {
  Driver.findById(req.params.id).populate("category_id")
    .exec(function (err, driver) {
      res.json(driver);
    });
});

router.route('/driverCount').get(requireSuperAdmin, function (req, res) {
  Driver.count(function (err, count) {
    if (err)
      return res.json({
        error: true,
        msg: "Driver not exists"
      });
    res.json(count);
  });
});

router.route('/onlineDriver').get(requireSuperAdmin, function (req, res) {
  Driver.aggregate(
    [{
      $match: {
        'approval': '1',
      }
    },
    {
      $group: {
        _id: "$live_status",
        count: {
          $sum: 1
        }
      },
    },
    {$sort: {_id: 1}}
    ],
    function (err, drivers) {
      if (err) {
        senderr(res);
      } else {
        let driverlist = Object.values(drivers);
        console.log("driverlist" + JSON.stringify(driverlist));
        let driverlist1 = 0;
        let driverlist2 = 0;
        let driverlist3 = 0;
        if (driverlist) {
          driverlist1 = (driverlist[0]) ? driverlist[0].count : 0;
          driverlist2 = (driverlist[1]) ? driverlist[1].count : 0;
          driverlist3 = (driverlist[2]) ? driverlist[2].count : 0;
        }
        res.json({
          status: true,
          active: parseInt(driverlist1) + parseInt(driverlist2) + parseInt(driverlist3),
          online: parseInt(driverlist2) + parseInt(driverlist3)
        });
      }
    }
  );
});


router.route('/activeDriver').get(requireSuperAdmin, function (req, res) {
  Driver.count({
    $and: [{
      approval: 1
    }, {
      live_status: 0
    }]
  })
    .exec(function (err, count) {
      if (err) {
        return res.json({
          error: true,
          msg: "Unable to load records from database"
        });
      } else {
        res.json(count);
      }

    });
});

router.route("/deleteddrivers").get(async function (req, res) {
  try {
    const params = getPaginationParams(req, {
      defaultSortBy: '_id',
      allowedSortFields: ['_id', 'full_name', 'email', 'phone_number']
    });
    const match = scopedDriverMatch(req, mergeMatch(
      { deletion_status: 1 },
      buildSearchQuery(params.search, ['full_name', 'email', 'phone_number'])
    ));
    const totalItems = await Driver.countDocuments(match).exec();
    const drivers = await Driver.find(match)
      .sort(buildSort(params.sortBy, params.sortDir))
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .exec();

    return res.json(buildPaginationResult(drivers, totalItems, params));
  } catch (_error) {
    return res.json({
      error: true,
      msg: "Unable to load records from database"
    });
  }
});

router.route('/revokedeletion/:id').post(requireAssignedDriver, function (req, res) {
  Driver.findById(req.params.id, function (err, driver) {
    if (!driver)
      return next(new Error('Could not load Document'));
    else {
      driver.deletion_status = 0;
      driver.save().then(driver => {
        cetsSyncService.enqueueDriverSync(driver._id, "admin_driver_restore").catch(function (syncError) {
          console.error("CeTS driver restore enqueue failed:", syncError);
        });
        return res.json({
          success: true,
          msg: 'Account Deletion has been revoked Successfully'
        });
      })
        .catch(err => {
          return res.json({
            error: true,
            msg: "Something went wrong"
          });

        });
    }
  });
});

router.post('/local-areas', requireSuperAdmin, async function (req, res) {
  const key = String(req.body.local_area_key || "").trim();
  const label = String(req.body.label || "").trim();
  if (!key || !label) return res.status(400).json({ status: "false", message: "Local area key and label are required" });
  try {
    const area = await DriverLocalArea.findOneAndUpdate({ local_area_key: key }, {
      $set: { label: label, allowed_radius_options_km: UAT_RADIUS_OPTIONS_KM, is_active: req.body.is_active !== false }
    }, { new: true, upsert: true, setDefaultsOnInsert: true }).exec();
    return res.json({ status: "true", result: area });
  } catch (_error) {
    return res.status(400).json({ status: "false", message: "Unable to save local area" });
  }
});

router.get('/local-areas', async function (_req, res) {
  const areas = await DriverLocalArea.find({ is_active: true }).sort({ label: 1 }).exec();
  return res.json({ status: "true", result: areas });
});

router.post('/:id/dispatch-scope', requireAssignedDriver, async function (req, res) {
  const radiusKm = normalizeActiveRadiusKm(req.body.active_radius_km);
  const localAreaKey = String(req.body.local_area_key || "").trim();
  if (!localAreaKey || radiusKm === null) return res.status(400).json({ status: "false", message: "An active local area and 1, 2, or 3 km radius are required" });
  const area = await DriverLocalArea.findOne({ local_area_key: localAreaKey, is_active: true }).exec();
  if (!area || area.allowed_radius_options_km.indexOf(radiusKm) < 0) return res.status(400).json({ status: "false", message: "Radius is not available for this local area" });
  const driver = await Driver.findByIdAndUpdate(req.params.id, { $set: { local_area_key: localAreaKey, active_radius_km: radiusKm } }, { new: true }).exec();
  if (!driver) return res.status(404).json({ status: "false", message: "Driver not found" });
  return res.json({ status: "true", result: { driver_id: driver._id, local_area_key: driver.local_area_key, active_radius_km: driver.active_radius_km } });
});

router.post('/:id/ops-assignment', requireSuperAdmin, async function (req, res) {
  const opsAdminId = String(req.body.ops_admin_id || "").trim();
  if (!opsAdminId) return res.status(400).json({ status: "false", message: "Ops Admin is required" });
  const Admin = require('../models/admin');
  const opsAdmin = await Admin.findById(opsAdminId).exec();
  if (!opsAdmin || String(opsAdmin.role || "").toUpperCase() !== "OPS_ADMIN") return res.status(400).json({ status: "false", message: "A valid Ops Admin is required" });
  const driver = await Driver.findById(req.params.id).exec();
  if (!driver) return res.status(404).json({ status: "false", message: "Driver not found" });
  if (!opsAdmin.assigned_driver_ids.some(function (id) { return String(id) === String(driver._id); })) {
    opsAdmin.assigned_driver_ids.push(driver._id);
    await opsAdmin.save();
  }
  return res.json({ status: "true", message: "Driver assigned to Ops Admin" });
});

module.exports = router;
