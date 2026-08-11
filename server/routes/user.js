const express = require("express");
const router = express.Router();
const passport = require("passport");
const jwt = require("jsonwebtoken");
const config = require("../config");
const User = require("../models/admin");
const Accounts = require("../schema/user");
const multer = require("multer");
const path = require("path");
const bcrypt = require("bcryptjs");
var fs = require("fs");
const DriverDevices = require("../schema/driverdevices");
const Notifications = require("../schema/notification");
const Driver = require("../schema/driver");
const pushService = require("../services/pushService");

const nodemailer = require("nodemailer");

function extractJwtToken(req) {
  const authHeader = req.headers && req.headers.authorization;
  if (!authHeader) {
    return null;
  }

  return authHeader.replace(/^JWT\s+/i, "").trim();
}

function adminNotifyTimestamp() {
  const selectedDate = new Date();
  selectedDate.setHours(selectedDate.getHours() + 5);
  selectedDate.setMinutes(selectedDate.getMinutes() + 30);
  const currentTime = selectedDate.getTime();
  const localOffset = -1 * selectedDate.getTimezoneOffset() * 60000;
  return Math.round(new Date(currentTime + localOffset).getTime() / 1000);
}

// Register
router.post("/register", (req, res, next) => {
  let newUser = new User({
    name: req.body.name,
    email: req.body.email,
    username: req.body.username,
    password: req.body.password
  });

  User.addUser(newUser, (err, user) => {
    if (err) {
      res.json({
        success: false,
        msg: "Failed to register user"
      });
    } else {
      res.json({
        success: true,
        msg: "User registered"
      });
    }
  });
});

// Authenticate
router.post("/authenticate", (req, res, next) => {
  const username = req.body.username;
  const password = req.body.password;

  User.getUserByUsername(username, (err, user) => {
    if (err) throw err;
    if (!user) {
      return res.json({
        success: false,
        msg: "User not found"
      });
    }

    User.comparePassword(password, user.password, (err, isMatch) => {
      if (err) throw err;
      if (isMatch) {
        const token = jwt.sign(
          {
            data: {
              role: "admin",
              _id: user._id,
              name: user.name,
              username: user.username
            }
          },
          config.secret,
          {
            expiresIn: "12h" // 1 week
          }
        );
        res.json({
          success: true,
          token: "JWT " + token,
          user: {
            id: user._id,
            name: user.name,
            email: user.username,
            role: "admin"
          }
        });
      } else {
        return res.json({
          success: false,
          msg: "Wrong password"
        });
      }
    });
  });
});

router.post("/testpush/driver", async (req, res) => {
  try {
    const token = extractJwtToken(req);
    if (!token) {
      return res.json({
        success: false,
        msg: "Unauthorized access"
      });
    }

    const decoded = jwt.verify(token, config.secret);
    const adminPayload = decoded && decoded.data ? decoded.data : decoded;
    if (!adminPayload || adminPayload.role !== "admin" || !adminPayload._id) {
      return res.json({
        success: false,
        msg: "Unauthorized access"
      });
    }

    const admin = await User.findById(adminPayload._id).exec();
    if (!admin) {
      return res.json({
        success: false,
        msg: "Unauthorized access"
      });
    }

    const driverId = String(req.body.driver_id || "").trim();
    const message = String(req.body.message || "Test push notification from Shilota admin API").trim();
    if (!driverId) {
      return res.json({
        success: false,
        msg: "driver_id is required"
      });
    }

    const driver = await Driver.findById(driverId).exec();
    if (!driver) {
      return res.json({
        success: false,
        msg: "Driver not found"
      });
    }

    const devices = await DriverDevices.find({ user_id: driverId }).exec();
    const tokens = Array.from(
      new Set(
        devices.map(device => String(device.device_token || "").trim()).filter(Boolean)
      )
    );

    if (!tokens.length) {
      return res.json({
        success: false,
        msg: "No registered device tokens found for this driver"
      });
    }

    await pushService.sendNotification({
      tokens: tokens,
      message: message,
      data: {
        type: "testpush",
        message: message,
        user_id: driverId
      },
      mobile: true,
      siteName: admin.siteName
    });

    await new Notifications({
      user_id: "0",
      notify_to: driverId,
      title: admin.siteName || "Shilota",
      message: message,
      notified_at: adminNotifyTimestamp()
    }).save();

    return res.json({
      success: true,
      msg: "Test push notification queued successfully",
      driver_id: driverId,
      mobile_tokens: tokens.length
    });
  } catch (error) {
    return res.json({
      success: false,
      msg: error && error.message ? error.message : "Unable to send test push notification"
    });
  }
});

router.get(
  "/profile",
  /* passport.authenticate('jwt', {
  session: false
}) */ (req, res, next) => {
    User.findOne({})
      .sort({
        _id: -1
      })
      .exec(function(err, docs) {
        res.json(docs);
      });
  }
);

router.get(
  "/getProfile" /* , passport.authenticate('jwt', {
  session: false
}), */,
  (req, res, next) => {
    User.findOne({})
      .sort({
        _id: -1
      })
      .exec(function(err, docs) {
        res.json(docs);
      });
  }
);

/* router.get('/getProfile', (req, res, next) => {
  User.findOne({}).sort({
    _id: -1
  }).exec(function (err, docs) {
    res.json(docs);
  });
}); */

router.route("/update/:id").post(function(req, res) {
  User.findById(req.params.id, function(err, user) {
    if (!user) return next(new Error("Could not load Document"));
    else {
      user.facebook = req.body.facebook;
      user.twitter = req.body.twitter;
      user.instagram = req.body.instagram;
      user.linkedin = req.body.linkedin;
      user.googleplus = req.body.googleplus;
      user
        .save()
        .then(user => {
          return res.json({
            success: true,
            msg: "SocialLink updated Successfully"
          });
        })
        .catch(err => {
          return res.json({
            success: false,
            msg: "Not able to update"
          });
        });
    }
  });
});

//logo update

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, "./src/assets/uploads/");
  },
  filename: function(req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now());
  }
});

var upload = multer({
  storage: storage
});

router.post("/logo", upload.single("logo"), function(req, res, next) {
  // return res.json({
  //   success: true,
  //   msg: "This option is won't work for demo purpose"
  // });
  User.findOne({})
    .sort({
      _id: -1
    })
    .exec(function(err, user) {
      if (!user) return next(new Error("Could not load Document"));
      else {
        user.logo = req.file.filename;
        user
          .save()
          .then(user => {
            return res.json({
              success: true,
              msg: "Logo updated Successfully"
            });
          })
          .catch(err => {
            return res.json({
              success: false,
              msg: "Not able to update"
            });
          });
          
      }
    });
});

const storageIcon = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, "./src/");
  },
  filename: function(req, file, cb) {
    cb(null, "favicon" + ".png");
  }
});

var uploaddata = multer({
  storage: storageIcon
});

router.post("/favicon", uploaddata.single("favIcon"), function(req, res, next) { 
  // return res.json({
  //   success: true,
  //   msg: "This option is won't work for demo purpose"
  // });
  User.findOne({})
    .sort({
      _id: -1
    })
    .exec(function(err, user) {
      if (!user) return next(new Error("Could not load Document"));
      else {
        user
          .save()
          .then(user => {
            return res.json({
              success: true,
              msg: "favicon updated Successfully"
            });
          })
          .catch(err => {
            return res.json({
              success: false,
              msg: "Not able to update"
            });
          });
      }
    });
});

router.route("/changePassword/:id").post(function(req, res) {
  User.findById(req.params.id, function(err, user) {
    if (!user)
      return res.json({
        error: true,
        msg: "Could not load Document"
      });
    else {
      const password = req.body.password;
      const newPassword = req.body.newPassword;

      User.comparePassword(password, user.password, (err, isMatch) => {
        if (err) throw err;
        if (isMatch) {
          bcrypt.genSalt(10, (err, salt) => {
            bcrypt.hash(newPassword, salt, (err, hash) => {
              if (err) throw err;
              user.password = hash;
              user
                .save()
                .then(user => {
                  return res.json({
                    success: true,
                    msg: "password updated Successfully"
                  });
                })
                .catch(err => {
                  return res.json({
                    error: true,
                    msg: "Not able to update"
                  });
                });
            });
          });
        } else {
          return res.json({
            error: true,
            msg: "Wrong password"
          });
        }
      });
    }
  });
});

router.post("/upload", function(req, res, next) {
  var path = "";
  upload(req, res, function(err) {
    if (err) {
      return res.status(422).send("an Error occured");
    }
    path = req.file.path;
    return res.send("Upload Completed for " + path);
  });
});

//website setting

router.route("/setting/:id").post(function(req, res) {
  // return res.json({
  //   success: true,
  //   msg: "This option is won't work for demo purpose"
  // });
  User.findById(req.params.id, function(err, user) {
    if (!user)
      return res.json({
        error: true,
        msg: "Could not load Document"
      });
    else {
      user.username = req.body.username;
      user.email = req.body.email;
      user.footer = req.body.footer;
      user.apptitle = req.body.apptitle;
      user.appcontent = req.body.appcontent;
      user.phone = req.body.phone;
      user.tax = req.body.tax;
      user.maxDistance = req.body.maxDistance;
      user.distancePerCab = req.body.distancePerCab;
      user.currencyCode = req.body.currencyCode;
      user.siteName = req.body.siteName;
      user.currencySymbol = req.body.currencySymbol;
      user.emergencyContact = req.body.emergencyContact;
      user.googleMapKey = req.body.googleMapKey;
      user.inspectionon = req.body.inspectionon;
      user.helppagesheader = req.body.helppagesheader;
      user.maxdisperride = req.body.maxdisperride;
      user
        .save()
        .then(user => {
          return res.json({
            success: true,
            msg: "Website Setting updated Successfully"
          });
        })
        .catch(err => {
          return res.json({
            error: true,
            msg: "Not able to update"
          });
        });
    }
  });
});

router.route("/sendMail").post(function(req, res) {
  User.findOne({})
    .sort({
      _id: -1
    })
    .exec(function(err, user) {
      if (!user) return next(new Error("Could not load Document"));
      else {
        let mailOptions = {
          to: user.email, // list of receivers
          subject: req.body.subject, // Subject line
          html:
            req.body.message +
            "<br><br> Regards, <br><br>" +
            req.body.name +
            "<br><br>" +
            req.body.email // html body
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
        transporter.verify(function(error, success) {
          if (error) {
              console.log(JSON.stringify(error))
              res.json({
                error: true,
                msg: "Sorry, SMTP Connection error check email setting"
              });
          } else {
            //send mail
            transporter.sendMail(mailOptions, (err, result) => {
              if (err)
                res.json({
                  error: true,
                  msg: "Message not send"
                });
              else
                return res.json({
                  success: true,
                  msg: "Thanks for contacting us, we will help you shortly"
                });
            });
          }
        });
      }
    });
});

router.route("/smtp/:id").post(function(req, res) {
  User.findById(req.params.id, function(err, user) {
    if (!user) return next(new Error("Could not load Document"));
    else {
      user.smptHost = req.body.smptHost;
      user.smtpPort = req.body.smtpPort;
      user.smtpUsername = req.body.smtpUsername;
      user.smtpPassword = req.body.smtpPassword;
      user
        .save()
        .then(user => {
          return res.json({
            success: true,
            msg: "SMTP Setting updated Successfully"
          });
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

router.route("/emailSetting/:id").post(function(req, res) {
  User.findById(req.params.id, function(err, user) {
    if (!user) return next(new Error("Could not load Document"));
    else {
      user.smptHost = req.body.smptHost;
      user.smtpPort = req.body.smtpPort;
      user.smtpUsername = req.body.smtpUsername;
      user.smtpPassword = req.body.smtpPassword;
      user
        .save()
        .then(user => {
          return res.json({
            success: true,
            msg: "Email Setting updated Successfully"
          });
        })
        .catch(err => {
          return res.json({
            error: true,
            msg: "Not able to update"
          });
        });
    }
  });
});

router.route("/app/:id").post(function(req, res) {
  User.findById(req.params.id, function(err, user) {
    if (!user)
      return res.json({
        error: true,
        msg: "Could not load Document"
      });
    else {
      user.iosUser = req.body.iosUser;
      user.iosDriver = req.body.iosDriver;
      user.androidUser = req.body.androidUser;
      user.androidDriver = req.body.androidDriver;
      user
        .save()
        .then(user => {
          return res.json({
            success: true,
            msg: "Mobile app setting updated Successfully"
          });
        })
        .catch(err => {
          return res.json({
            error: true,
            msg: "Not able to update"
          });
        });
    }
  });
});

router.route("/payment/:id").post(function(req, res) {
  User.findById(req.params.id, function(err, user) {
    if (!user)
      return res.json({
        error: true,
        msg: "Could not load Document"
      });
    else {
      user.merchandId = req.body.merchandId;
      user.publicKey = req.body.publicKey;
      user.privateKey = req.body.privateKey;
      user.BraintreeStatus = req.body.BraintreeStatus;
      return res.json({
        success: true,
        msg: "Payment setting updated Successfully"
      });
      /* user
        .save()
        .then(user => {
          resetBraintreeAccounts();
          return res.json({
            success: true,
            msg: "Payment setting updated Successfully"
          });
        })
        .catch(err => {
          return res.json({
            error: true,
            msg: "Not able to update"
          });
        }); */
    }
  });
});

/* reset the braintree customer's ids */
resetBraintreeAccounts = function() {
  Accounts.update(
    {},
    {
      $set: {
        customer_id: ""
      }
    },
    {
      multi: true
    },
    function(err, updateResult) {
      if (err) {
        console.log(err);
      }
      console.log(updateResult);
    }
  );
};

module.exports = router;
