var express = require('express');
var app = express();
var router = express.Router();
var Vehicles = require('../schema/vehicles');
var Driver = require('../schema/driver');
var Category = require('../schema/categories');
var nodemailer = require('nodemailer');
var User = require('../models/admin');
var cetsSyncService = require('../services/cetsSyncService');
var {
  buildPaginationResult,
  buildSearchQuery,
  buildSort,
  getPaginationParams,
  mergeMatch
} = require('../utils/pagination');

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

router.route('/').get(async function (req, res) {
  try {
    const params = getPaginationParams(req, {
      defaultSortBy: '_id',
      allowedSortFields: ['_id', 'vehicle_name', 'vehicle_number', 'status']
    });
    const match = mergeMatch(
      { completionStatus: "1" },
      buildSearchQuery(params.search, ['vehicle_name', 'vehicle_number'])
    );
    const totalItems = await Vehicles.countDocuments(match).exec();
    const vehicles = await Vehicles.find(match)
      .sort(buildSort(params.sortBy, params.sortDir))
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .exec();

    return res.json(buildPaginationResult(vehicles, totalItems, params));
  } catch (_error) {
    return res.json({
      error: true,
      msg: "Unable to load records from database"
    });
  }
});

router.route('/deactive/:id').post(function (req, res) {
  Vehicles.findById(req.params.id, function (err, vehicles) {
    if (!vehicles)
      return next(new Error('Could not load Document'));
    else {
      vehicles.status = 0;
      vehicles.save().then(vehicles => {
          cetsSyncService.enqueueVehicleSync(vehicles._id, "admin_vehicle_deactivate").catch(function (syncError) {
            console.error("CeTS vehicle deactivate enqueue failed:", syncError);
          });
          return res.json({
            success: true,
            msg: 'Vehicles information rejected'
          });
        })
        .catch(err => {
          return res.json({
            error: true,
            msg: "Error with rejection"
          });

        });
    }
  });
});

router.route('/active/:id').post(function (req, res) {
  Vehicles.findById(req.params.id, function (err, vehicles) {
    if (!vehicles)
      return next(new Error('Could not load Document'));
    else {
      vehicles.status = 1;
      vehicles.save().then(vehicles => {
          cetsSyncService.enqueueVehicleSync(vehicles._id, "admin_vehicle_activate").catch(function (syncError) {
            console.error("CeTS vehicle activate enqueue failed:", syncError);
          });
          return res.json({
            success: true,
            msg: 'Vehicles information approved Successfully'
          });
        })
        .catch(err => {
          return res.json({
            error: true,
            msg: "Error with approved"
          });

        });
    }
  });
});

router.route('/edit/:id').get(function (req, res) {
  Vehicles.findById(req.params.id).populate("user_id")
    .exec(function (err, vehicles) {
      if (err) {
        return res.json({
          error: true,
          msg: "Unable to load records from database"
        });
      } else {
        res.json(vehicles);
      }

    });
});

router.route('/totalCount').get(function (req, res) {
  Vehicles.count(function (err, count) {
    if (err)
      return res.json({
        error: true,
        msg: "Vehicle not exists"
      });
    res.json(count);
  });
});

router.route('/category').get(function (req, res) {
  Category.find(function (err, category) {
    if (err) {
      return res.json({
        error: true,
        msg: "Unable to load records from database"
      });
    } else {
      res.json(category);
    }
  });
});

router.route('/update/:id').post(function (req, res) {
  Vehicles.findById(req.params.id, function (err, vehicles) {
    if (!vehicles)
      return next(new Error('Could not load Document'));
    else {
      vehicles.category = req.body.category;
      vehicles.status = req.body.status;
      vehicles.save().then(vehicles => {
          cetsSyncService.enqueueVehicleSync(vehicles._id, "admin_vehicle_update").catch(function (syncError) {
            console.error("CeTS vehicle update enqueue failed:", syncError);
          });
          User.findOne({}).sort({
            _id: -1
          }).exec(function (err, admin) {
            Driver.findById(req.body.user_id, function (err, driver) {
              if (!driver)
                return next(new Error('Could not load Document'));
              else {
                driver.category_id = req.body.category;
                if (req.body.status == '1') {
                  let dt = new Date();
                  let duration = parseInt(admin && admin.inspectionon, 10);

                  if (Number.isNaN(duration) || duration < 0) {
                    return res.json({
                      error: true,
                      msg: "Invalid vehicle inspection duration in website settings"
                    });
                  }

                  const nextInspectionDate = new Date(dt.setMonth(dt.getMonth() + duration));

                  if (!isValidDate(nextInspectionDate)) {
                    return res.json({
                      error: true,
                      msg: "Unable to calculate the next inspection date"
                    });
                  }

                  driver.inspectionon = nextInspectionDate;
                  driver.completionStatus = 1;
                } else {
                  driver.completionStatus = 0;
                }
                driver.save().then(driver => {
                    cetsSyncService.enqueueDriverSync(driver._id, "admin_vehicle_driver_update").catch(function (syncError) {
                      console.error("CeTS driver enqueue after vehicle update failed:", syncError);
                    });
                    //start mail sending
                    if (driver.approval == 1) {
                      User.findOne({}).sort({
                        _id: -1
                      }).exec(function (err, user) {
                        if (!user)
                          return next(new Error('Could not load Document'));
                        else {
                          let mailOptions = {
                            to: driver.email, // list of receivers
                            subject: "Vehicle approved message", // Subject line
                            html: "Your registered vehicle approved sucessfully" + "<br><br> Regards, <br><br>" + user.siteName // html body
                          };

                          let transporter = nodemailer.createTransport({
                            host: user.smptHost,
                            port: user.smtpPort,
                            secure: false, // true for 465, false for other ports
                            auth: {
                              user: user.smtpUsername, // generated ethereal user
                              pass: user.smtpPassword // generated ethereal password
                            }
                          });

                          //send mail with defined transport object
                          transporter.verify(function (error, success) {
                            if (error) {
                              if (error) res.json({
                                error: true,
                                msg: "Sorry, SMTP Connection error check email setting"
                              });
                            } else {

                              transporter.sendMail(mailOptions, (err, result) => {
                                if (err) res.json({
                                  error: true,
                                  msg: "Message not send"
                                });
                                else
                                  //  console.log(result);
                                  // return res.json({success: true, msg: 'Vehicle activation message send to driver'});      
                                  return res.json({
                                    success: true,
                                    msg: 'Vehicle activation message send to driver'
                                  });
                              });
                            }
                          });

                        }
                      })
                    } else {
                      return res.json({
                        success: true,
                        msg: 'Vehicle Status Updated'
                      });
                    }

                    //end mail sending
                  })
                  .catch(err => {
                    return res.json({
                      error: true,
                      msg: err
                    });

                  });
              }
            });
          });
          // return res.json({success: true, msg: 'Vehicle Status Updated'});      
        })
        .catch(err => {
          return res.json({
            error: true,
            msg: err
          });

        });
    }
  });

});

module.exports = router;
