var express = require('express');
var app = express();
var router = express.Router();
var Driver = require('../schema/driver');
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


router.route('/').get(async function (req, res) {
  try {
    const params = getPaginationParams(req, {
      defaultSortBy: '_id',
      allowedSortFields: ['_id', 'full_name', 'email', 'phone_number']
    });
    const match = mergeMatch(
      { deletion_status: 0 },
      buildSearchQuery(params.search, ['full_name', 'email', 'phone_number'])
    );
    const totalItems = await Driver.countDocuments(match).exec();
    const drivers = await Driver.find(match)
      .sort(buildSort(params.sortBy, params.sortDir))
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .populate("category_id")
      .exec();

    return res.json(buildPaginationResult(drivers, totalItems, params));
  } catch (_error) {
    return res.json({
      error: true,
      msg: "Unable to load records from database"
    });
  }
});

router.route('/deactive/:id').post(function (req, res) {
  Driver.findById(req.params.id, function (err, driver) {
    if (!driver)
      return next(new Error('Could not load Document'));
    else {
      driver.approval = '0';
      driver.save().then(driver => {
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

router.route('/active/:id').post(function (req, res) {
  Driver.findById(req.params.id, function (err, driver) {
    if (!driver)
      return next(new Error('Could not load Document'));
    else {
      driver.approval = "1";
      driver.save().then(driver => {
        cetsSyncService.enqueueDriverSync(driver._id, "admin_driver_activate").catch(function (syncError) {
          console.error("CeTS driver activate enqueue failed:", syncError);
        });
        // return res.json({success: true, msg: 'Driver Activated Successfully'});  
        //start send mail
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
              secure: false,
              auth: {
                user: user.smtpUsername,
                pass: user.smtpPassword
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
                    return res.json({
                      success: true,
                      msg: 'Vehicle activation message send to driver'
                    });
                });
              }
            });


          }
        })
        //end mail
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

router.route('/info/:id').get(function (req, res) {
  Driver.findById(req.params.id).populate("category_id")
    .exec(function (err, driver) {
      res.json(driver);
    });
});

router.route('/driverCount').get(function (req, res) {
  Driver.count(function (err, count) {
    if (err)
      return res.json({
        error: true,
        msg: "Driver not exists"
      });
    res.json(count);
  });
});

router.route('/onlineDriver').get(function (req, res) {
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


router.route('/activeDriver').get(function (req, res) {
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
    const match = mergeMatch(
      { deletion_status: 1 },
      buildSearchQuery(params.search, ['full_name', 'email', 'phone_number'])
    );
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

router.route('/revokedeletion/:id').post(function (req, res) {
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

module.exports = router;
