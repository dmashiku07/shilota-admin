const passport = require("passport");
const Request = require("request");
const config = require("../config");
require("../userpassport")(passport);
const jwt = require("jsonwebtoken");
const async = require("async");
const crypto = require("crypto");
const randomstring = require("randomstring");
const express = require("express");
const router = express.Router();
const path = require("path");
const moment = require("moment");
const googledistance = require("google-distance");
/* image downloader */
const download = require("image-downloader");
/* cron */
const cron = require("node-cron");
/* baseurl */
const base_url = config.baseUrl;
const apn = require("apn");

/** schemas */
let User = require("../schema/user");
let Help = require("../models/helppage");
let Notifications = require("../schema/notification");
let UserDevices = require("../schema/userdevices");
let Rides = require("../schema/rides");
let Commissions = require("../schema/commissions");
let Categories = require("../schema/categories");
let Driver = require("../schema/driver");
let Reviews = require("../schema/reviews");
let Payments = require("../schema/payments");
let Wallet = require("../schema/wallets");
let SelcomPaymentSession = require("../schema/selcompaymentsession");
let DriverDevices = require("../schema/driverdevices");
let Vehicles = require("../schema/vehicles");
let Places = require("../schema/places");
let Admin = require("../models/admin");
let WebUsers = require("../schema/webusers");
let OtpVerification = require("../schema/otpverification");
let translationServer = require("../translation/translate.js");
/* upload directories */
const userassets = "./src/assets/media/users/";
const categoryassets = "./src/assets/uploads";
/* image upload functionality*/
const fs = require("fs");
const multer = require("multer");
const upload = multer();
/* mailer */
const nodemailer = require("nodemailer");
/* braintree setting */
const braintree = require("braintree");
const smsService = require("../services/smsService");
const selcomService = require("../services/selcomService");
const pushService = require("../services/pushService");
const cetsSyncService = require("../services/cetsSyncService");
const { roundCustomerPayableAmount } = require("../utils/pricing");

const OTP_EXPIRY_MINUTES = 5;
const OTP_MAX_ATTEMPTS = 5;
const FORGOT_PASSWORD_OTP_PURPOSE = "forgot_password";

function mapSelcomSessionStatus(payload) {
  const paymentStatus = String(payload && payload.payment_status || "").trim().toUpperCase();
  const resultcode = String(payload && payload.resultcode || "").trim();

  if (resultcode === "000" && paymentStatus === "COMPLETED") {
    return "verified";
  }

  if (paymentStatus === "CANCELLED" || paymentStatus === "USERCANCELED" || String(payload && payload.result || "").trim().toUpperCase() === "FAIL") {
    return "failed";
  }

  return "pending";
}

async function applySelcomProviderUpdate(session, payload) {
  const nextStatus = mapSelcomSessionStatus(payload);
  session.status = nextStatus;
  session.order_id = payload && payload.order_id ? String(payload.order_id) : session.order_id;
  session.reference = payload && payload.reference ? String(payload.reference) : session.reference;
  session.channel = payload && payload.channel ? String(payload.channel) : session.channel;
  session.phone = payload && payload.phone ? String(payload.phone) : session.phone;
  session.payment_status = payload && payload.payment_status ? String(payload.payment_status) : session.payment_status;
  session.provider_result = payload && payload.result ? String(payload.result) : session.provider_result;
  session.provider_resultcode = payload && payload.resultcode ? String(payload.resultcode) : session.provider_resultcode;
  session.provider_message = payload && payload.message ? String(payload.message) : session.provider_message;
  session.paid_amount = payload && selcomService.normalizeAmount(payload.amount) ? selcomService.normalizeAmount(payload.amount) : session.paid_amount;
  session.provider_payload = payload || null;
  session.callback_received_at = new Date();
  if (nextStatus === "verified" && !session.verified_at) {
    session.verified_at = new Date();
  }
  await session.save();
  return session;
}

async function ensureSelcomPaymentVerified(session, transid) {
  if (session.status === "verified" || session.status === "completed" || session.verified_at) {
    return session;
  }

  const result = await selcomService.queryTransaction(transid);
  if (String(result.resultcode) === "000") {
    return applySelcomProviderUpdate(session, {
      transid: transid,
      result: result.result,
      resultcode: result.resultcode,
      message: result.message,
      reference: result.reference,
      payment_status: "COMPLETED",
      amount: session.amount
    });
  }

  if (String(result.resultcode) !== "111") {
    await applySelcomProviderUpdate(session, {
      transid: transid,
      result: result.result,
      resultcode: result.resultcode,
      message: result.message,
      reference: result.reference,
      payment_status: result.result || "FAILED",
      amount: session.amount
    });
  }

  throw new Error(result.message || "Payment has not been verified yet");
}

function hasSelcomSignatureHeaders(headers) {
  return Boolean(
    headers &&
      headers.authorization &&
      headers["digest-method"] &&
      headers.digest &&
      headers.timestamp &&
      headers["signed-fields"]
  );
}

async function findSelcomSessionFromPayload(payload) {
  const orderId = String(payload && payload.order_id || "").trim();
  const providerTransId = String(payload && payload.transid || "").trim();

  if (orderId) {
    let session = await SelcomPaymentSession.findOne({
      $or: [
        { transid: orderId },
        { order_id: orderId }
      ]
    }).exec();
    if (session) {
      return session;
    }
  }

  if (providerTransId) {
    return SelcomPaymentSession.findOne({
      $or: [
        { transid: providerTransId },
        { order_id: providerTransId }
      ]
    }).exec();
  }

  return null;
}

function doesCallbackAmountMatchSession(session, payload) {
  const callbackAmount = selcomService.normalizeAmount(payload && payload.amount);
  if (!callbackAmount) {
    return true;
  }

  return Math.abs(Number(session.amount || 0) - Number(callbackAmount)) <= 0.01;
}

function getOtpPurpose(req) {
  return req.body.purpose || "signup";
}

function buildPhoneParts(rawPhoneNumber) {
  const normalizedPhoneNumber = smsService.normalizePhoneNumber(rawPhoneNumber);
  if (!normalizedPhoneNumber) {
    return null;
  }

  let countryCode = 255;
  let nationalNumber = normalizedPhoneNumber;
  if (normalizedPhoneNumber.startsWith("255") && normalizedPhoneNumber.length > 3) {
    nationalNumber = normalizedPhoneNumber.slice(3);
  }

  if (!nationalNumber || Number.isNaN(Number(nationalNumber))) {
    return null;
  }

  return {
    normalizedPhoneNumber: normalizedPhoneNumber,
    countryCode: countryCode,
    nationalNumber: Number(nationalNumber)
  };
}

function hashOtp(phoneNumber, purpose, otp) {
  return crypto
    .createHash("sha256")
    .update(`${config.secret}|${purpose}|${phoneNumber}|${otp}`)
    .digest("hex");
}

async function verifyOtpForPurpose(phoneNumber, purpose, otp) {
  const otpVerification = await OtpVerification.findOne({
    phone_number: phoneNumber,
    purpose: purpose,
    consumed: false
  })
    .sort({
      createdAt: -1
    })
    .exec();

  if (!otpVerification) {
    return {
      ok: false,
      message: "OTP not found. Please request a new OTP"
    };
  }

  if (otpVerification.expires_at <= new Date()) {
    return {
      ok: false,
      message: "OTP has expired. Please request a new OTP"
    };
  }

  if (otpVerification.attempt_count >= OTP_MAX_ATTEMPTS) {
    return {
      ok: false,
      message: "Maximum OTP attempts exceeded. Please request a new OTP"
    };
  }

  const hashedOtp = hashOtp(phoneNumber, purpose, otp);
  if (hashedOtp !== otpVerification.otp_hash) {
    await OtpVerification.updateOne(
      {
        _id: otpVerification._id
      },
      {
        $inc: {
          attempt_count: 1
        }
      }
    ).exec();

    return {
      ok: false,
      message: "Invalid OTP"
    };
  }

  return {
    ok: true,
    otpVerification: otpVerification
  };
}

/* signup as user */
router.post("/signup", async function (req, res) {
  if (!req.body.email || !req.body.password) {
    senderr(res);
  } else {
    req.body.email = req.body.email.toLowerCase();
    User.count(
      {
        email: req.body.email
      },
      function (err, count) {
        if (count > 0) {
          res.json({
            status: "false",
            message: "Email already exists"
          });
        } else {
          let imagename = crypto.randomBytes(6).toString("hex") + ".jpeg";
          if (typeof req.body.imageurl != "undefined") {
            req.body.profile_image = imagename;
          }
          let newUser = new User(req.body);
          newUser.save(function (err) {
            if (err) {
              senderr(res);
            } else {
              if (typeof req.body.imageurl != "undefined") {
                let options = {
                  url: req.body.imageurl,
                  dest: userassets + imagename
                };
                download
                  .image(options)
                  .then(({ filename, image }) => {
                    res.json({
                      status: "true",
                      message: "Your account has been created, please login to your account."
                    });
                  })
                  .catch(err => {
                    res.json({
                      status: "true",
                      message: "Your account has been created, please login to your account."
                    });
                  });
              } else {
                res.json({
                  status: "true",
                  message: "Your account has been created, please login to your account."
                });
              }
            }
          });
        }
      }
    );
  }
});

/* signin as user */
router.post("/signin", function (req, res) {
  console.log("signin api is calling");
  req.body.email = req.body.email.toLowerCase();
  User.findOne(
    {
      email: req.body.email
    },
   
    function (err, user) {
      console.log(err);
      if (!user) {
        //console.log(err);
        res.json({
          status: "false",
          message: "Email not registered"
        });
      } else {
        if (user.deletion_status === 1) {
          res.json({
            status: "error",
            message: 'Account has been deleted successfully'
          });
        }else{
          user.comparePassword(req.body.password, function (err, isMatch) {
            if (isMatch && !err) {
              /* authenticate with token */
              let userObj = user.toObject();
              userObj.role = "user";
              let signintoken = jwt.sign(userObj, config.secret);
              if (typeof req.body.country_code != "undefined" && typeof req.body.phone_number != "undefined") {
                /* save the otp details */
                user.country_code = req.body.country_code;
                user.phone_number = req.body.phone_number;
                user.save();
              }
              let profile_image = user.profile_image;
              if (typeof user.profile_image == "undefined") {
                let profile_image = "user.png";
              }
              let walletamount = Math.round(user.walletmoney * 100) / 100;
              let result = {
                status: "true",
                role: user.role,
                user_id: user._id,
                full_name: user.full_name,
                email: user.email,
                password: req.body.password,
                country_code: user.country_code,
                phone_number: user.phone_number,
                user_image: base_url + "/gallery/users/" + profile_image,
                token: "JWT " + signintoken,
                emergency_contact: user.emergency_contact,
                walletmoney: walletamount
              };
              res.json(result);
              console.log("result");
        console.log(result);
            } else {
              res.json({
                status: "false",
                message: "Incorrect username or password"
              });
            }
          });
        }
        
      }
    }
  );
});

/* user profile */
router.get("/profile/:userid", function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!user) {
      res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else {
      User.findOne(
        {
          _id: req.params.userid
        },
        function (err, user) {
          if (err) throw err;
          if (!user) {
            res.json({
              status: "false",
              message: "No users found."
            });
          } else {
            let profile_image = user.profile_image;
            if (typeof user.profile_image == "undefined") {
              let profile_image = "user.png";
            }
            let result = {};
            result.status = "true";
            result.user_id = user._id;
            result.full_name = user.full_name;
            result.email = user.email;
            result.user_image = base_url + "/gallery/users/" + profile_image;
            result.country_code = user.country_code;
            result.phone_number = user.phone_number;
            result.invite_url = "URL";
            result.walletmoney = 0;
            if (typeof user.walletmoney != "undefined" && user.walletmoney != null) {
              result.walletmoney = Math.round(user.walletmoney * 100) / 100;
            }
            (result.emergency_contact = user.emergency_contact ? user.emergency_contact : []), res.json(result);
          }
        }
      );
    }
  })(req, res);
});

/* help pages */
router.get("/helppages", function (req, res) {
  Help.count(function (err, count) {
    if (err) senderr(res);
    else {
      Help.find(
        {
          type: "user"
        },
        function (err, helps) {
          if (!err) {
            res.json({
              status: "true",
              result: helps
            });
          } else {
            senderr(res);
          }
        }
      );
    }
  });
});

/* notifications */
router.get("/notifications/:userid", function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!user) {
      res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else {
      Notifications.count(
        {
          notify_to: req.params.userid
        },
        function (err, count) {
          if (count > 0) {
            Notifications.find({
              notify_to: req.params.userid
            }).sort({
              _id: -1
            })
              .exec(function (err, notifications) {
                if (!err) {
                  res.json({
                    status: "true",
                    result: notifications
                  });
                } else {
                  senderr(res);
                }
              });
          } else {
            res.json({
              status: "false",
              message: "No notifications found"
            });
          }
        }
      );
    }
  })(req, res);
});

/* reset password */
router.post("/resetpassword", function (req, res, next) {
  async.waterfall(
    [
      function (done) {
        crypto.randomBytes(8, function (err, buf) {
          let token = buf.toString("hex");
          done(err, token);
        });
      },
      function (token, done) {
        User.findOne(
          {
            email: req.body.email
          },
          function (err, user) {
            if (!user) {
              res.json({
                status: "false",
                message: "No account with that email address exists."
              });
            } else{
              if(user.deletion_status===1){
                res.json({
                  status: "error",
                  message: "Account Deleted."
                });
              }else {
                user.password = token;
                user.save(function (err) {
                  let mailOptions = {
                    to: req.body.email, // list of receivers
                    subject: "Password Changed !", // Subject line
                    html: "Your new password : " + token // html body
                  };
                  Admin.findOne(function (err, admin) {
                    let transporter = nodemailer.createTransport({
                      host: admin.smptHost,
                      port: admin.smtpPort,
                      secure: false,
                      auth: {
                        user: admin.smtpUsername,
                        pass: admin.smtpPassword
                      }
                    });
                    // send mail with defined transport object
                    transporter.sendMail(mailOptions, (error, info) => {
                      if (error) {
                        senderr(res);
                      } else {
                        res.json({
                          status: "true",
                          message: "Your Password has been reset successfully. Kindly check your registered mail now"
                        });
                      }
                    });
                  });
                });
              }
            }            
          }
        );
      }
    ],
    function (err) {
      if (err) {
        senderr(res);
      }
    }
  );
});

/* phone OTP */
router.post("/getotp", async function (req, res) {
  const rawPhoneNumber = req.body.phone_number;
  const purpose = getOtpPurpose(req);
  if (!rawPhoneNumber) {
    return res.json({
      status: "false",
      message: "Phone number is required"
    });
  }

  const normalizedPhoneNumber = smsService.normalizePhoneNumber(rawPhoneNumber);
  if (!normalizedPhoneNumber) {
    return res.json({
      status: "false",
      message: "Invalid phone number"
    });
  }

  const phoneParts = buildPhoneParts(rawPhoneNumber);
  if (!phoneParts) {
    return res.json({
      status: "false",
      message: "Invalid phone number"
    });
  }

  if (purpose === FORGOT_PASSWORD_OTP_PURPOSE) {
    const existingUser = await User.findOne({
      country_code: phoneParts.countryCode,
      phone_number: phoneParts.nationalNumber,
      deletion_status: 0
    }).exec();

    if (!existingUser) {
      return res.json({
        status: "false",
        message: "Phone number not registered"
      });
    }
  }

  const otp = randomstring.generate({
    length: 6,
    charset: "numeric"
  });
  const message = `Your CABI verification code is ${otp}`;

  const smsResult = await smsService.sendSms(normalizedPhoneNumber, message);
  if (!smsResult.success && !smsResult.skipped) {
    return res.json({
      status: "false",
      message: "Failed to send OTP",
      error: smsResult.error || smsResult.response || null
    });
  }

  try {
    await OtpVerification.deleteMany({
      phone_number: phoneParts.normalizedPhoneNumber,
      purpose: purpose,
      verified: false,
      consumed: false
    }).exec();

    let otpVerification = new OtpVerification({
      phone_number: phoneParts.normalizedPhoneNumber,
      country_code: phoneParts.countryCode,
      purpose: purpose,
      otp_hash: hashOtp(phoneParts.normalizedPhoneNumber, purpose, otp),
      expires_at: moment()
        .add(OTP_EXPIRY_MINUTES, "minutes")
        .toDate(),
      sms_enabled: !smsResult.skipped
    });
    await otpVerification.save();
  } catch (error) {
    return senderr(res);
  }

  return res.json({
    status: "true",
    message: smsResult.skipped ? "OTP generated successfully" : "OTP sent successfully",
    otp: otp,
    phone_number: phoneParts.normalizedPhoneNumber,
    sms_enabled: !smsResult.skipped,
    expires_in: OTP_EXPIRY_MINUTES * 60
  });
});

router.post("/verifyotp", async function (req, res) {
  const rawPhoneNumber = req.body.phone_number;
  const otp = String(req.body.otp || "");
  const purpose = getOtpPurpose(req);

  if (!rawPhoneNumber || !otp) {
    return res.json({
      status: "false",
      message: "Phone number and OTP are required"
    });
  }

  const phoneParts = buildPhoneParts(rawPhoneNumber);
  if (!phoneParts) {
    return res.json({
      status: "false",
      message: "Invalid phone number"
    });
  }

  try {
    const verificationResult = await verifyOtpForPurpose(
      phoneParts.normalizedPhoneNumber,
      purpose,
      otp
    );

    if (!verificationResult.ok) {
      return res.json({
        status: "false",
        message: verificationResult.message
      });
    }

    const otpVerification = verificationResult.otpVerification;

    if (otpVerification.verified) {
      return res.json({
        status: "true",
        message: "OTP already verified",
        phone_number: phoneParts.normalizedPhoneNumber
      });
    }

    await OtpVerification.updateOne(
      {
        _id: otpVerification._id
      },
      {
        $set: {
          verified: true,
          verified_at: new Date()
        }
      }
    ).exec();

    return res.json({
      status: "true",
      message: "OTP verified successfully",
      phone_number: phoneParts.normalizedPhoneNumber
    });
  } catch (error) {
    return senderr(res);
  }
});

router.post("/resetpasswordbyotp", async function (req, res) {
  const rawPhoneNumber = req.body.phone_number;
  const otp = String(req.body.otp || "");
  const newPassword = String(req.body.new_password || "");

  if (!rawPhoneNumber || !otp || !newPassword) {
    return res.json({
      status: "false",
      message: "Phone number, OTP and new password are required"
    });
  }

  const phoneParts = buildPhoneParts(rawPhoneNumber);
  if (!phoneParts) {
    return res.json({
      status: "false",
      message: "Invalid phone number"
    });
  }

  try {
    const user = await User.findOne({
      country_code: phoneParts.countryCode,
      phone_number: phoneParts.nationalNumber
    }).exec();

    if (!user) {
      return res.json({
        status: "false",
        message: "Phone number not registered"
      });
    }

    if (user.deletion_status === 1) {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    }

    const verificationResult = await verifyOtpForPurpose(
      phoneParts.normalizedPhoneNumber,
      FORGOT_PASSWORD_OTP_PURPOSE,
      otp
    );

    if (!verificationResult.ok) {
      return res.json({
        status: "false",
        message: verificationResult.message
      });
    }

    user.password = newPassword;
    await user.save();

    await OtpVerification.updateOne(
      {
        _id: verificationResult.otpVerification._id
      },
      {
        $set: {
          verified: true,
          verified_at: new Date(),
          consumed: true,
          consumed_at: new Date()
        }
      }
    ).exec();

    return res.json({
      status: "true",
      message: "Password changed successfully"
    });
  } catch (_error) {
    return senderr(res);
  }
});

/* upload user profile image */
let storage = multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, userassets);
  },
  filename: function (req, file, callback) {
    crypto.pseudoRandomBytes(16, function (err, raw) {
      if (err) return callback(err);
      callback(null, raw.toString("hex") + path.extname(file.originalname));
    });
  }
});

router.post("/uploadprofileimage", function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!user) {
      res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else {
      let upload = multer({
        storage: storage,
        fileFilter: function (req, file, callback) {
          let ext = path.extname(file.originalname);
          if (ext !== ".png" && ext !== ".jpg" && ext !== ".jpeg") {
            return callback(res.end("Only images are allowed"), null);
          }
          callback(null, true);
        }
      }).single("userImage");
      upload(req, res, function (err) {
        User.findOne(
          {
            _id: req.body.user_id
          },
          function (err, user) {
            if (user && typeof user.profile_image != "undefined") {
              fs.unlink(userassets + user.profile_image, function (error) {
                if (error) {
                  //console.log(err);
                  // senderr(res);
                }
              });
            }
            user.profile_image = res.req.file.filename;
            user.save();
            res.json({
              status: "true",
              user_image: base_url + "/gallery/users/" + res.req.file.filename,
              message: "Image uploaded successfully"
            });
          }
        );
      });
    }
  })(req, res);
});

/* change password */
router.post("/changepassword", function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, user) {
    if (err === "AccountDeleted") {
      res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!user) {
      res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else {
      if (!req.body.user_id || !req.body.newpassword) {
        senderr(res);
      } else {
        User.findOne(
          {
            _id: req.body.user_id
          },
          function (err, user) {
            if (!user) {
              senderr(res);
            }
            user.password = req.body.newpassword;
            user.save(function (err) {
              res.json({
                status: "true",
                message: "Password changed successfully"
              });
            });
          }
        );
      }
    }
  })(req, res);
}
);

/* update password */
router.post(
  "/updatepassword",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.old_password || !req.body.new_password || !req.body.user_id) {
          senderr(res);
        } else {
          User.findOne(
            {
              _id: req.body.user_id
            },
            function (err, user) {
              if (!user) {
                senderr(res);
              }
              user.comparePassword(req.body.old_password, function (err, isMatch) {
                if (isMatch && !err) {
                  user.password = req.body.new_password;
                  user.save(function (err) {
                    if (!err) {
                      res.json({
                        status: "true",
                        message: "Password changed successfully"
                      });
                    } else {
                      res.json({
                        status: "false",
                        message: "Something went wrong"
                      });
                    }
                  });
                } else {
                  res.json({
                    status: "false",
                    message: "Old password is incorrect"
                  });
                }
              });
            }
          );
        }
      }
    })(req, res);
  }
);

/* register a user device for notifications*/
router.post(
  "/pushsignin",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.device_token || !req.body.device_type || !req.body.device_id) {
          senderr(res);
        } else {
          UserDevices.count(
            {
              device_id: req.body.device_id
            },
            function (err, count) {
              if (count > 0) {
                UserDevices.findOneAndUpdate(
                  {
                    device_id: req.body.device_id
                  },
                  {
                    $set: req.body
                  }
                ).exec(function (err, userdevices) {
                  if (err) {
                    senderr(res);
                  } else {
                    res.json({
                      status: "true",
                      message: "Registered successfully"
                    });
                  }
                });
              } else {
                let newDevices = new UserDevices(req.body);
                newDevices.save();
                res.json({
                  status: "true",
                  message: "Registered successfully"
                });
              }
            }
          );
        }
      }
    })(req, res);
  }
);

/* register a webapp device for notifications */
router.post("/appsignin", function (req, res) {
  if (!req.body.user_id || !req.body.device_token) {
    senderr(res);
  } else {
    WebUsers.count(
      {
        user_id: req.body.user_id
      },
      function (err, count) {
        if (count > 0) {
          WebUsers.findOneAndUpdate(
            {
              user_id: req.body.user_id
            },
            {
              $set: req.body
            }
          ).exec(function (err, userdevices) {
            if (err) {
              senderr(res);
            } else {
              res.json({
                status: "true",
                message: "Registered successfully"
              });
            }
          });
        } else {
          let newDevices = new WebUsers(req.body);
          newDevices.save();
          res.json({
            status: "true",
            message: "Registered successfully"
          });
        }
      }
    );
  }
});

/* unregister a webapp device for notifications */
router.post("/appsignout", function (req, res) {
  if (!req.body.user_id) {
    senderr(res);
  } else {
    WebUsers.count(
      {
        user_id: req.body.user_id
      },
      function (err, count) {
        if (count > 0) {
          WebUsers.findOneAndRemove(
            {
              user_id: req.body.user_id
            },
            function (err, count) {
              res.json({
                status: "true",
                message: "Unregistered successfully"
              });
            }
          );
        } else {
          senderr(res);
        }
      }
    );
  }
});

/* send a test push to the authenticated user's registered devices */
router.post("/testpush", function (req, res) {
  passport.authenticate("jwt", { session: false }, async function (err, user) {
    if (err === "AccountDeleted") {
      return res.json({
        status: "error",
        message: "Account has been deleted successfully"
      });
    } else if (!user) {
      return res.json({
        status: "error",
        message: "Unauthorized access"
      });
    }

    try {
      const targetUserId = String(user._id);
      const message = String(req.body.message || "Test push notification from CABi API").trim();
      const admin = await Admin.findOne({}).sort({ _id: -1 }).exec();
      const mobileDevices = await UserDevices.find({ user_id: targetUserId }).exec();
      const webDevices = await WebUsers.find({ user_id: targetUserId }).exec();
      const mobileTokens = mobileDevices.map(rec => rec.device_token).filter(Boolean);
      const webTokens = webDevices.map(rec => rec.device_token).filter(Boolean);

      if (!mobileTokens.length && !webTokens.length) {
        return res.json({
          status: "false",
          message: "No registered device tokens found for this user"
        });
      }

      const data = {
        type: "testpush",
        message: message,
        user_id: targetUserId
      };

      const tasks = [];
      if (mobileTokens.length) {
        tasks.push(
          pushService.sendNotification({
            tokens: mobileTokens,
            message: message,
            data: data,
            mobile: true,
            siteName: admin && admin.siteName
          })
        );
      }

      if (webTokens.length) {
        tasks.push(
          pushService.sendNotification({
            tokens: webTokens,
            title: admin && admin.siteName ? admin.siteName : "CABi",
            message: message,
            data: data,
            web: true,
            siteName: admin && admin.siteName,
            icon: config.baseUrl + "/favicon.png"
          })
        );
      }

      await Promise.all(tasks);

      notifyTo({
        user_id: "0",
        notify_to: targetUserId,
        title: admin && admin.siteName ? admin.siteName : "CABi",
        message: message
      });

      return res.json({
        status: "true",
        message: "Test push notification queued successfully",
        mobile_tokens: mobileTokens.length,
        web_tokens: webTokens.length
      });
    } catch (error) {
      return res.json({
        status: "false",
        message: error && error.message ? error.message : "Unable to send test push notification"
      });
    }
  })(req, res);
});

/* unregister a user device for notifications*/
router.delete(
  "/pushsignout",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully',
          deleted_type:"user"
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.device_id) {
          senderr(res);
        } else {
          UserDevices.count(
            {
              device_id: req.body.device_id
            },
            function (err, count) {
              if (count > 0) {
                UserDevices.findOneAndRemove(
                  {
                    device_id: req.body.device_id
                  },
                  function (err, count) {
                    res.json({
                      status: "true",
                      message: "Unregistered successfully"
                    });
                  }
                );
              } else {
                senderr(res);
              }
            }
          );
        }
      }
    })(req, res);
  }
);

/* Available rides */
router.post("/grabrides" /* , passport.authenticate('jwt', {
  session: false
}), */, function (req, res) {
    //if (!req.body.user_id || !req.body.pickup_location || !req.body.pickup_lat || !req.body.pickup_lng || !req.body.drop_location || !req.body.drop_lat || !req.body.drop_lng || !req.body.distance) {
    if (!req.body.pickup_location ||!req.body.pickup_lat ||!req.body.pickup_lng || !req.body.drop_location ||
      !req.body.drop_lat ||
      !req.body.drop_lng ||
      !req.body.distance
    ) {
      senderr(res);
    } else {
      Admin.findOne(function (err, admin) {
        /* maximum distance coverage */
        let distance = parseFloat(req.body.distance).toFixed(2);
        let maxdistcoverage = parseInt(admin.distancePerCab);
        let maxdisperride = parseInt(admin.maxdisperride);
        if (distance > maxdisperride) {
          res.json({
            status: "false",
            message: "Sorry! Service not available in this location"
          });
        } else {
          let lon = parseFloat(req.body.pickup_lng);
          let lat = parseFloat(req.body.pickup_lat);
          /* mongo geonear api */
          let query = Driver.aggregate([
            {
              $geoNear: {
                near: {
                  type: "Point",
                  coordinates: [lon, lat]
                },
                maxDistance: maxdistcoverage * 1000,
                spherical: true,
                distanceField: "distance",
                query: {
                  live_status: "1",
                  approval: "1"
                }
              }
            },
            {
              $group: {
                _id: "$category_id",
                distance: {
                  $first: "$distance"
                },
                email: {
                  $first: "$email"
                },
                instant_location: {
                  $first: "$instant_location"
                }
              }
            },
            {
              $sort: {
                distance: 1
              }
            }
          ]);
          query.exec(function (err, driver) {
            if (err) {
              senderr(res);
            } else {
              console.log(driver);
              if (driver.length == 0) {
                res.json({
                  status: "false",
                  message: "Sorry! Service not available in this location"
                });
              } else {
                let availcat = [""];
                let distbycat = [];
                let instanthere = []; /* drivers instant location array  */
                for (let k = 0; k < driver.length; k++) {
                  let driverId = driver[k]._id;
                  let instant = driver[k].instant_location;
                  if (driverId != null) {
                    availcat.push(driverId);
                  }
                  distbycat[driverId] = distance;
                  instanthere.push(instant);
                }
                
                if (availcat.length > 0) {
                  Categories.find()
                    // .where('_id')
                    // .in(availcat)
                    .sort({
                      _id: 1
                    })
                    .exec(function (err, categories) {
                      if (!err) {
                        let available_rides = [];
                        let cat_det = [];
                        let categoryresult = {};
                        let available_rides_count = 0;
                        Commissions.find().exec(function (err, results) {
                          categories.forEach(function (c) {
                            let fareamount = totalFare(c, distbycat, admin.maxDistance);
                            let commissionamount = 0,
                              approxprice = 0;
                            let resultcount = results.length;
                            if (resultcount > 0) {
                              results.forEach(function (d) {
                                let dprice_from = parseFloat(d.price_from);
                                let dprice_to = parseFloat(d.price_to);
                                if (fareamount >= dprice_from && fareamount <= dprice_to) {
                                  commissionamount = parseFloat(fareamount) * (d.percentage / 100);
                                }
                              });
                            }
                            approxprice = parseFloat(fareamount) + parseFloat(commissionamount);
                            let profile_image = c.image;
                            if (typeof profile_image == "undefined") {
                              let profile_image = "category.png";
                            }
                            let categoryimage = base_url + "/imagegallery/" + profile_image;
                            let basePrice = roundCustomerPayableAmount(approxprice);
                            if (availcat.indexOf(String(c._id)) > 0) {
                              available_rides.push({
                                _id: c._id,
                                category_name: c.category_name,
                                image: categoryimage,
                                baseprice: basePrice,
                                reach_pickup: "2 mins",
                                available: "1"
                              });
                              available_rides_count++;
                            } else {
                              available_rides.push({
                                _id: c._id,
                                category_name: c.category_name,
                                image: categoryimage,
                                baseprice: "-",
                                reach_pickup: "2 mins",
                                available: "0"
                              });
                            }
                          });
                          categoryresult.status = "true";
                          categoryresult.count = available_rides_count;
                          categoryresult.available_ride = available_rides;
                          res.json(categoryresult);

                        });
                      } else {
                        senderr(res);
                      }
                    });
                } else {
                  res.json({
                    status: "false",
                    message: "Sorry! Service not available at this moment"
                  });
                }
              }
            }
          });
        }
      });
    }
  });

/* request a ride */
router.post(
  "/requestride",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (
          !req.body.user_id ||
          !req.body.category_id ||
          !req.body.payment_type ||
          !req.body.type ||
          !req.body.pickup_location ||
          !req.body.pickup_lat ||
          !req.body.pickup_lng ||
          !req.body.drop_location ||
          !req.body.drop_lat ||
          !req.body.drop_lng
        ) {
          senderr(res);
        } else {
          let timestamp = timeZone();
          let randomnumber = randomstring.generate({
            length: 4,
            charset: "numeric"
          });
          req.body.onride_otp = randomnumber.substr(0, 4);
          if (req.body.type == "schedule") {
            req.body.ridestatus = "scheduled";
          } else {
            req.body.ridestatus = "requested";
          }
          /* schedule utc time */
          if (req.body.schedule_time) {
            let scheduleTime = req.body.schedule_time - 19800;
            let dateString = moment.unix(scheduleTime).format("MM/DD/YYYY HH:mm:ss");
            req.body.schedule_utc_time = moment(dateString).toISOString();
          }
          req.body.ridestatusat = timestamp;
          let newRides = new Rides(req.body);
          newRides.save(function (err, rides) {
            if (!err) {
              res.json({
                status: "true",
                onride_id: newRides._id,
                onride_type: newRides.type
              });
            } else {
              senderr(res);
            }
          });
        }
      }
    })(req, res);
  }
);

/* confirm a ride */
router.post(
  "/confirmride",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        let translatedstring = "";
        if (!req.body.user_id || !req.body.onride_id || !req.body.is_notify) {
          senderr(res);
        } else {
          let querystring = {
            _id: req.body.onride_id,
            user_id: req.body.user_id
          };
          console.log("confirmride api is calling");
          let rideresult = {};
          Rides.findOne(querystring)
            .populate("driver_id")
            .exec(function (err, rides) {
              if (!err) {
                if (rides.ridestatus == "ontheway" || rides.ridestatus == "accepted" || rides.ridestatus == "onride") {
                  rideresult.status = "true";
                  rideresult.pickup_location = rides.pickup_location;
                  rideresult.pickup_lat = rides.pickup_lat;
                  rideresult.pickup_lng = rides.pickup_lng;
                  rideresult.drop_location = rides.drop_location;
                  rideresult.drop_lat = rides.drop_lat;
                  rideresult.drop_lng = rides.drop_lng;
                  rideresult.onride_otp = rides.onride_otp;
                  rideresult.driver_name = rides.driver_id.full_name;
                  if (typeof rides.driver_id.rating == "undefined") {
                    rides.driver_id.rating = "0";
                  }
                  let querystring = {
                    driver_id: rides.driver_id._id
                  };
                  rideresult.driver_mobile = rides.driver_id.phone_number;
                  rideresult.driver_id = rides.driver_id.batch_id;
                  rideresult.driver_userid = rides.driver_id._id;
                  rideresult.driver_image = base_url + "/gallery/drivers/" + rides.driver_id.profile_image;
                  Vehicles.findOne(
                    {
                      user_id: rides.driver_id._id
                    },
                    function (err, vehicles) {
                      if (!err) {
                        rideresult.driver_vehicle = vehicles.vehicle_name;
                        rideresult.driver_vehicleno = vehicles.vehicle_number;
                        let userids = [req.body.user_id];
                        
                        let notifed = req.body.is_notify; // remove notifications
                        if (notifed > 0) {
                          UserDevices.findOne({
                            user_id: req.body.user_id
                          }, function (err, userdevices) {
                            if (userdevices) {
                              let lang = userdevices.lang_type;
                              
                              let message = translationServer.langTranslate("YourridehasbeenacceptedKindlycontactyourdriver", lang);
                              let data = {
                                ride_id: rides._id,
                                type: "acceptride",
                                message: message
                              };
                              translatedstring = translationServer.langTranslate("YourridehasbeenacceptedKindlycontactyourdriver", lang);

                              userNotify(userids, translatedstring, data);


                            }

                          });

                        }
                        Reviews.count(querystring, function (err, count) {
                          if (count > 0) {
                            rideresult.driver_rating = parseFloat(rides.driver_id.rating / count).toFixed(1);
                            res.json(rideresult);
                          } else {
                            rideresult.driver_rating = "0";
                            res.json(rideresult);
                          }
                        });
                      } else {
                        senderr(res);
                      }
                    }
                  );
                } else if (rides.ridestatus == "scheduled") {
                  res.json({
                    status: "true",
                    message: "Your ride has been successfully scheduled"
                  });
                } else {
                  /* notify nearby drivers */
                  let lon = parseFloat(rides.pickup_lng);
                  let lat = parseFloat(rides.pickup_lat);
                  Admin.findOne(function (err, admin) {
                    let maxdistcoverage = parseInt(admin.distancePerCab);
                    /* mongo geonear api */
                    let query = Driver.aggregate([
                      {
                        $geoNear: {
                          near: {
                            type: "Point",
                            coordinates: [lon, lat]
                          },
                          maxDistance: maxdistcoverage * 1000,
                          spherical: true,
                          distanceField: "distance",
                          query: {
                            live_status: "1",
                            approval: "1",
                            category_id: rides.category_id
                          }
                        }
                      },
                      {
                        $sort: {
                          distance: 1
                        }
                      }
                    ]);
                    query.exec(function (err, driver) {
                      if (err) {
                        senderr(res);
                      } else {
                        console.log(driver.length);
                        if (driver.length == "0") {
                          res.json({
                            status: "false",
                            message: "Sorry! No Driver found nearby at this moment"
                          });
                        } else {
                          let availdrivers = [];
                          driver.forEach(function (d) {
                            availdrivers.push(d._id);
                          });


                          res.json({
                            status: "false",
                            message: "Searching"
                          });
                          /* notify nearby drivers */
                          if (rides.notify == 0) {
                            nearBy(availdrivers, rides._id);
                          }
                        }
                      }
                    });
                  });
                }
              } else {
                senderr(res);
              }
            });
        }
      }
    })(req, res);
  }
);

cron.schedule("* * * * *", function () {
  /* timestamp */
  let timestamp = scheduletimeZone();
  Rides.find({
    ridestatus: "scheduled",
    notify: 0,
    schedule_utc_time: { $lt: timestamp }
  })
    .populate("driver_id")
    .exec(function (err, schedulerides) {
      if (err) {
        console.error("Scheduled ride lookup failed:", err);
        return;
      }
      if (!Array.isArray(schedulerides) || schedulerides.length === 0) {
        return;
      }
      schedulerides.forEach(function (rides) {
        /* notify nearby drivers */
        let lon = parseFloat(rides.pickup_lng);
        let lat = parseFloat(rides.pickup_lat);
        if (isNaN(lon) || isNaN(lat)) {
          return;
        }
        Admin.findOne(function (err, admin) {
          if (err || !admin) {
            if (err) {
              console.error("Admin lookup failed:", err);
            }
            return;
          }
          let maxdistcoverage = parseInt(admin.distancePerCab);
          if (isNaN(maxdistcoverage) || maxdistcoverage <= 0) {
            maxdistcoverage = 1;
          }
          /* mongo geonear api */
          let query = Driver.aggregate([
            {
              $geoNear: {
                near: {
                  type: "Point",
                  coordinates: [lon, lat]
                },
                maxDistance: maxdistcoverage * 1000,
                spherical: true,
                distanceField: "distance",
                query: {
                  live_status: "1",
                  approval: "1",
                  category_id: rides.category_id
                }
              }
            },
            {
              $sort: {
                distance: 1
              }
            }
          ]);
          query.exec(function (err, driver) {
            if (err) {
              console.error("Nearby driver query failed:", err);
            } else {
              if (Array.isArray(driver) && driver.length > 0) {
                let availdrivers = [];
                driver.forEach(function (d) {
                  availdrivers.push(d._id);
                });
                /* notify nearby drivers */
                if (rides.notify == 0) {
                  schedulenearBy(availdrivers, rides);
                }
              }
            }
          });
        });
      });
    });
});

/* cancel a ride */
router.post(
  "/cancelride",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        let translatedstring = "";
        if (!req.body.user_id || !req.body.onride_id) {
          senderr(res);
        } else {
          let timestamp = timeZone();
          let querystring = {
            _id: req.body.onride_id
          };
          let ridestring = [
            {
              ridestatus: "ontheway"
            },
            {
              ridestatus: "accepted"
            },
            {
              ridestatus: "scheduled"
            }
          ];
          Rides.count(querystring)
            .or(ridestring)
            .exec(function (err, iscancelable) {
              if (iscancelable > 0) {
                Rides.findOneAndUpdate(querystring, {
                  $set: {
                    ridestatus: "cancelled",
                    ridestatusat: timestamp
                  }
                }).exec(function (err, reviews) {
                  if (err) {
                    senderr(res);
                  } else {
                    UserDevices.findOne({
                      user_id: reviews.user_id
                    }, function (err, userdevices) {
                      if (userdevices) {
                        let lang = userdevices.lang_type;
                        
                        let message = translationServer.langTranslate("Yourridehasbeencancelled", lang);
                        /* notify user */
                        let userids = [reviews.user_id];
                        let data = {
                          ride_id: reviews._id,
                          type: "cancelride",
                          message: message
                        };
                        translatedstring = translationServer.langTranslate("Yourridehasbeencancelled", lang);
                        userNotify(userids, translatedstring, data);
                      }
                    });
                    if (typeof reviews.driver_id != "undefined" || reviews.driver_id != null) {
                      let driverids = [reviews.driver_id];
                      freeDriver(reviews.driver_id);
                      DriverDevices.findOne({
                        user_id: reviews.driver_id
                      }, function (err, driverdevices) {
                        if (driverdevices) {
                          let driverlang = driverdevices.lang_type;
                        
                          let message = translationServer.langTranslate("Yourridehasbeencancelled", driverlang);
                          let data = {
                            ride_id: reviews._id,
                            type: "cancelride",
                            message: message
                          };
                          translatedstring = translationServer.langTranslate("Yourridehasbeencancelled", driverlang);
                          driverNotify(driverids, translatedstring, data);
                        }
                      });
                    }
                    /* notify user */
                    res.json({
                      status: "true",
                      message: "Your ride has been cancelled"
                    });
                  }
                });
              } else {
                res.json({
                  status: "false",
                  message: "Your ride is non-cancelable now"
                });
              }
            });
        }
      }
    })(req, res);
  }
);

/* user review a ride */
router.post(
  "/ridedetails",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.onride_id || !req.body.type) {
          senderr(res);
        } else {
          let querystring = {
            _id: req.body.onride_id,
            ridestatus: req.body.type
          };
          let rideresult = {};
          Rides.count(querystring, function (err, count) {
            if (count > 0) {
              Rides.findOne(querystring)
                .populate("category_id")
                .exec(function (err, rides) {
                  if (!err) {
                    rideresult.status = "true";
                    rideresult.category_name = rides.category_id.category_name;
                    let profile_image = rides.category_id.image;
                    if (typeof profile_image == "undefined") {
                      let profile_image = "category.png";
                    }
                    Reviews.findOne({
                      onride_id: req.body.onride_id
                    }).exec(function (err, reviews) {
                      if (reviews) {
                        rideresult.category_image = base_url + "/imagegallery/" + profile_image;
                        rideresult.pickup_location = rides.pickup_location;
                        rideresult.pickup_lat = rides.pickup_lat;
                        rideresult.pickup_lng = rides.pickup_lng;
                        rideresult.drop_location = rides.drop_location;
                        rideresult.drop_lat = rides.drop_lat;
                        rideresult.drop_lng = rides.drop_lng;
                        rideresult.approx_price = rides.baseprice;
                        rideresult.isreview = "true";
                        rideresult.review_message = reviews.review_message;
                        rideresult.rating = reviews.rating;
                        res.json(rideresult);
                      } else {
                        rideresult.category_image = base_url + "/imagegallery/" + profile_image;
                        rideresult.pickup_location = rides.pickup_location;
                        rideresult.pickup_lat = rides.pickup_lat;
                        rideresult.pickup_lng = rides.pickup_lng;
                        rideresult.drop_location = rides.drop_location;
                        rideresult.drop_lat = rides.drop_lat;
                        rideresult.drop_lng = rides.drop_lng;
                        rideresult.approx_price = rides.baseprice;
                        rideresult.isreview = "false";
                        res.json(rideresult);
                      }
                    });
                  } else {
                    senderr(res);
                  }
                });
            } else {
              senderr(res);
            }
          });
        }
      }
    })(req, res);
  }
);

/* ongoing ride */
router.post(
  "/ongoingrideindetail",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.onride_id) {
          senderr(res);
        } else {
          let ridestring = [
            {
              ridestatus: "onride"
            },
            {
              ridestatus: "ontheway"
            },
            {
              ridestatus: "accepted"
            }
          ];
          Rides.count({
            _id: req.body.onride_id
          })
            .or(ridestring)
            .exec(function (err, count) {
              if (count > 0) {
                Rides.findOne({
                  _id: req.body.onride_id
                })
                  .or(ridestring)
                  .populate("category_id")
                  .populate("driver_id")
                  .exec(function (err, rides) {
                    if (!err) {
                      Vehicles.findOne(
                        {
                          user_id: rides.driver_id._id
                        },
                        function (err, vehicles) {
                          if (!err) {
                            let vehicleinfo = {};
                            vehicleinfo.driver_vehicle = vehicles.vehicle_name;
                            vehicleinfo.driver_vehicleno = vehicles.vehicle_number;
                            Reviews.count(
                              {
                                driver_id: rides.driver_id._id
                              },
                              function (err, count) {
                                if (count > 0) {
                                  Admin.findOne(function (err, admin) {
                                    if (!err) {
                                      googledistance.apiKey = admin.googleMapKey;
                                      /* googleapi to calculate distance */
                                      /* let googleapi = googledistance.get(
                                        {
                                          origins: [rides.pickup_location],
                                          destinations: [rides.drop_location]
                                        },
                                        function(err, data) {
                                          if (!err) { */
                                      let ratings = parseFloat(rides.driver_id.rating / count).toFixed(1);
                                      res.json({
                                        status: "true",
                                        driver_ratings: ratings,
                                        vehicleinfo: vehicleinfo,
                                        distanceInfo: 15,//data[0],
                                        result: rides
                                      });
                                      /* } else {
                                        senderr(res);
                                      }
                                    }
                                  ); */
                                    } else {
                                      senderr(res);
                                    }
                                  });
                                } else {
                                  Admin.findOne(function (err, admin) {
                                    if (!err) {
                                      googledistance.apiKey = admin.googleMapKey;
                                      /* googleapi to calculate distance */
                                      /* let googleapi = googledistance.get(
                                        {
                                          origins: [rides.pickup_location],
                                          destinations: [rides.drop_location]
                                        },
                                        function(err, distanceInfo) {
                                          if (!err) { */
                                      res.json({
                                        status: "true",
                                        driver_ratings: "0",
                                        distanceInfo: 15,//distanceInfo[0],
                                        vehicleinfo: vehicleinfo,
                                        result: rides
                                      });
                                      
                                    } else {
                                      console.log("Error2:", err);
                                      senderr(res);
                                    }
                                  });
                                }
                              }
                            );
                          } else {
                            console.log("Error3:", err);
                            senderr(res);
                          }
                        }
                      );
                    } else {
                      console.log("Error4:", err);
                      senderr(res);
                    }
                  });
              } else {
                senderr(res);
              }
            });
        }
      }
    })(req, res);
  }
);

/* ongoing ride */
router.post(
  "/incompleterideindetail",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.onride_id) {
          senderr(res);
        } else {
          let ridestring = [
            {
              ridestatus: "cancelled"
            },
            {
              ridestatus: "scheduled"
            },
            {
              ridestatus: "scheduleridenotaccepted"
            }
          ];
          Rides.count(
            {
              _id: req.body.onride_id
            },
            function (err, count) {
              if (count > 0) {
                Rides.findOne({
                  _id: req.body.onride_id
                })
                  .or(ridestring)
                  .populate("category_id")
                  .populate("driver_id")
                  .exec(function (err, rides) {
                    if (!err) {
                      res.json({
                        status: "true",
                        result: rides
                      });
                    } else {
                      senderr(res);
                    }
                  });
              } else {
                senderr(res);
              }
            }
          );
        }
      }
    })(req, res);
  }
);

/* user's rides (or) booking history */
router.post(
  "/ridehistory",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.type) {
          senderr(res);
        } else {
          let ridestring = [
            {
              ridestatus: "onride"
            },
            {
              ridestatus: "ontheway"
            },
            {
              ridestatus: "scheduled"
            },
            {
              ridestatus: "accepted"
            }
          ];
          let rideresult = [],
            taxprice,
            statustime;
          if (req.body.type == "history") {
            ridestring = [
              {
                ridestatus: "cancelled"
              },
              {
                ridestatus: "completed"
              },
              {
                ridestatus: "scheduleridenotaccepted"
              }
            ];
          }
          Rides.find({
            user_id: req.body.user_id
          })
            .or(ridestring)
            .populate("category_id")
            .sort({
              _id: -1
            })
            .exec(function (err, rides) {
              if (!err) {
                if (rides.length == "0") {
                  res.json({
                    status: "false",
                    message: "No rides found"
                  });
                } else {
                  rides.forEach(function (c) {
                    if (typeof c.tax == "undefined" || c.tax == null) {
                      taxprice = 0;
                    } else {
                      taxprice = c.tax;
                    }
                    if (c.type == "schedule") {
                      statustime = parseInt(c.schedule_time);
                    } else {
                      statustime = c.ridestatusat;
                    }
                    if (typeof c.vehicle_no == "undefined" || c.vehicle_no == null) {
                      vehicle_no = "";
                    } else {
                      vehicle_no = c.vehicle_no;
                    }
                    let profile_image = c.category_id.image; //c.category_id.image;
                    if (typeof profile_image == "undefined") {
                      let profile_image = "category.png";
                    }
                    let categoryimage = base_url + "/imagegallery/" + profile_image;
                    let rideTotal = parseFloat(c.baseprice) + parseFloat(taxprice);
                    rideresult.push({
                      onride_id: c._id,
                      category_image: categoryimage,
                      category_name: c.category_id.category_name,
                      ride_status: c.ridestatus,
                      driver_id: c.driver_id,
                      total_price: roundCustomerPayableAmount(rideTotal),
                      vehicle_no: vehicle_no,
                      pickup_time: statustime
                    });
                  });
                  res.json({
                    status: "true",
                    result: rideresult
                  });
                }
              } else {
                senderr(res);
              }
            });
        }
      }
    })(req, res);
  }
);

/* complete ride details */
router.post(
  "/completeridedetails",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.onride_id) {
          senderr(res);
        } else {
          let querystring = {
            _id: req.body.onride_id
          };
          let ridestring = [
            {
              ridestatus: "completed"
            },
            {
              ridestatus: "onride"
            }
          ];
          let rideresult = {};
          Rides.count(querystring, function (err, count) {
            if (count > 0) {
              Rides.findOne(querystring)
                .or(ridestring)
                .populate("payment_id")
                .populate("driver_id")
                .populate("user_id")
                .populate("category_id")
                .exec(function (err, rides) {
                  if (!err) {
                    rideresult.status = "true";
                    rideresult.ridestatus = rides.ridestatus;
                    let profile_image = rides.category_id.image;
                    if (!profile_image) {
                      profile_image = "category.png";
                    }
                    rideresult.category_image = base_url + "/imagegallery/" + profile_image;
                    rideresult.category_name = rides.category_id.category_name;
                    rideresult.username = rides.user_id.full_name;
                    rideresult.driver_id = rides.driver_id._id;
                    rideresult.pickup_location = rides.pickup_location;
                    rideresult.pickup_lat = rides.pickup_lat;
                    rideresult.pickup_lng = rides.pickup_lng;
                    rideresult.drop_location = rides.drop_location;
                    rideresult.drop_lat = rides.drop_lat;
                    rideresult.drop_lng = rides.drop_lng;
                    rideresult.driver_name = rides.driver_id.full_name;
                    rideresult.driver_image = base_url + "/gallery/drivers/" + rides.driver_id.profile_image;
                    rideresult.ride_fare = rides.baseprice; /* commission included */
                    rideresult.basefare = rides.total; /* commission excluded */
                    rideresult.commissionamount = rides.commissionamount;
                    rideresult.ride_tax = rides.tax;
                    let rideTotal = parseFloat(rides.baseprice) + parseFloat(rides.tax);
                    rideresult.ride_total = roundCustomerPayableAmount(rideTotal);
                    rideresult.payment_type = rides.payment_type;
                    rideresult.pickup_time = parseInt(rides.ridestatusat);
                    rideresult.walletmoney = 0;
                    rideresult.vehicle_no = rides.vehicle_no;
                    rideresult.distance = rides.ridedistance;
                    rideresult.isreview = "false";
                    rideresult.ispayment = "false";
                    rideresult.drop_time = rides.ridestatusat;
                    rideresult.rideuserid = rides.user_id._id;
                    if (typeof rides.user_id.walletmoney != "undefined" && rides.user_id.walletmoney != null) {
                      rideresult.walletmoney = Math.round(rides.user_id.walletmoney * 100) / 100;
                    }
                    Reviews.findOne({
                      onride_id: req.body.onride_id
                    }).exec(function (err, reviews) {
                      if (!reviews) {
                        Payments.findOne({
                          onride_id: req.body.onride_id
                        }).exec(function (err, payments) {
                          if (!payments) {
                            res.json(rideresult);
                          } else {
                            rideresult.ispayment = "true";
                            rideresult.payment_type = payments.payment_type;
                            res.json(rideresult);
                          }
                        });
                      } else {
                        rideresult.isreview = "true";
                        rideresult.review_message = reviews.review_message;
                        rideresult.rating = reviews.rating;
                        Payments.findOne({
                          onride_id: req.body.onride_id
                        }).exec(function (err, payments) {
                          if (!payments) {
                            res.json(rideresult);
                          } else {
                            rideresult.ispayment = "true";
                            rideresult.payment_type = payments.payment_type;
                            res.json(rideresult);
                          }
                        });
                      }
                    });
                  } else {
                    senderr(res);
                  }
                });
            } else {
              senderr(res);
            }
          });
        }
      }
    })(req, res);
  }
);

/* get your client token  */
router.post(
  "/getclienttoken",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id) {
          senderr(res);
        } else {
          User.findOne(
            {
              _id: req.body.user_id
            },
            function (err, user) {
              if (typeof user.customer_id != "undefined" && user.customer_id != null) {
                let querystring = {
                  customerId: user.customer_id
                };
                Admin.findOne(function (err, admin) {
                  let gateway = braintree.connect({
                    environment:
                      admin.BraintreeStatus == "1" ? braintree.Environment.Production : braintree.Environment.Sandbox,
                    merchantId: admin.merchandId,
                    publicKey: admin.publicKey,
                    privateKey: admin.privateKey
                  });
                  gateway.clientToken.generate(querystring, function (err, response) {
                    if (response.success) {
                      res.json({
                        status: "true",
                        clientToken: response.clientToken
                      });
                    } else {
                      senderr(res);
                    }
                  });
                });
              } else {
                Admin.findOne(function (err, admin) {
                  let gateway = braintree.connect({
                    environment:
                      admin.BraintreeStatus == "1" ? braintree.Environment.Production : braintree.Environment.Sandbox,
                    merchantId: admin.merchandId,
                    publicKey: admin.publicKey,
                    privateKey: admin.privateKey
                  });
                  gateway.customer.create(
                    {
                      firstName: user.full_name,
                      email: user.email,
                      phone: user.phone_number
                    },
                    function (err, result) {
                      if (result.success) {
                        user.customer_id = result.customer.id;
                        user.save();
                        let querystring = {
                          customerId: result.customer.id
                        };
                        gateway.clientToken.generate(querystring, function (err, response) {
                          if (response.success) {
                            res.json({
                              status: "true",
                              clientToken: response.clientToken
                            });
                          } else {
                            senderr(res);
                          }
                        });
                      } else {
                        senderr(res);
                      }
                    }
                  );
                });
              }
            }
          );
        }
      }
    })(req, res);
  }
);

/* pay by card */
router.post(
  "/paybycard",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        let translatedstring = "";
        if (
          !req.body.user_id ||
          !req.body.amount ||
          !req.body.paynonce ||
          !req.body.onride_id ||
          !req.body.iswallet ||
          !req.body.basefare ||
          !req.body.commissionamount ||
          !req.body.tax ||
          !req.body.driver_id
        ) {
          senderr(res);
        } else {
          Payments.count(
            {
              onride_id: req.body.onride_id
            },
            function (err, count) {
              if (count > 0) {
                res.json({
                  status: "true",
                  message: "Payment has been done successfully"
                });
              } else {
                let querystring = {
                  _id: req.body.user_id
                }; /* find user details by userid */
                Admin.findOne(function (err, admin) {
                  User.findOne(querystring)
                    .exec()
                    .then(function (err, user) {
                      let gateway = braintree.connect({
                        environment:
                          admin.BraintreeStatus == "1" ? braintree.Environment.Production : braintree.Environment.Sandbox,
                        merchantId: admin.merchandId,
                        publicKey: admin.publicKey,
                        privateKey: admin.privateKey
                      });
                      gateway.transaction.sale(
                        {
                          amount: req.body.amount,
                          paymentMethodNonce: req.body.paynonce,
                          options: {
                            submitForSettlement: true
                          }
                        },
                        function (err, result) {
                          if (!err) {
                            if (result.success) {
                              let payObject = {
                                user_id: req.body.user_id,
                                onride_id: req.body.onride_id,
                                payment_type: "card",
                                ride_fare: result.transaction.amount,
                                transaction_id: result.transaction.id,
                                baseprice: req.body.basefare,
                                commissionamount: req.body.commissionamount,
                                tax: req.body.tax,
                                driver_id: req.body.driver_id,
                                paidbywallet: req.body.iswallet == "1" ? req.body.walletamount : 0
                              };
                              let newPayment = new Payments(payObject);
                              newPayment.save(function (err) {
                                if (!err) {
                                  if (req.body.iswallet == "1") {
                                    let paywalletObject = {
                                      user_id: req.body.user_id,
                                      onride_id: req.body.onride_id,
                                      amount: req.body.walletamount,
                                      type: "debit",
                                      transaction: "payride",
                                      updated_at: timeZone()
                                    };
                                    let newWallet = new Wallet(paywalletObject);
                                    newWallet.save(function (err) {
                                      if (!err) {
                                        User.update(
                                          {
                                            _id: req.body.user_id
                                          },
                                          {
                                            $inc: {
                                              walletmoney: -req.body.walletamount
                                            }
                                          },
                                          {
                                            new: true
                                          },
                                          function (err, doc) {
                                            if (!err) {
                                              let walletamount;
                                              if (typeof doc.walletmoney != "undefined") {
                                                walletamount = Math.round(doc.walletmoney * 100) / 100;
                                              } else {
                                                walletamount = 0;
                                              }
                                              let message = "Payment has been done successfully";
                                              let notifications = {
                                                user_id: "0",
                                                notify_to: req.body.user_id,
                                                title: "Payment Completed",
                                                message: message
                                              };
                                              notifyTo(notifications);
                                              Rides.findOne(
                                                {
                                                  _id: req.body.onride_id
                                                },
                                                function (err, rides) {
                                                  if (!rides) {
                                                    senderr(res);
                                                  } else {
                                                    let userids = [req.body.user_id];
                                                    let driverids = [rides.driver_id];

                                                    let drivernotifications = {
                                                      user_id: "0",
                                                      notify_to: rides.driver_id,
                                                      title: "Payment Completed",
                                                      message: message
                                                    };
                                                    notifyTo(drivernotifications);
                                                    UserDevices.findOne({
                                                      user_id: req.body.user_id
                                                    }, function (err, userdevices) {
                                                      if (userdevices) {
                                                        let lang = userdevices.lang_type;
                                                        console.log(lang);
                                                        let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                                                        let data = {
                                                          type: "payment",
                                                          message: message,
                                                          ride_id: rides._id
                                                        };
                                                        translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);


                                                        userNotify(userids, translatedstring, data);




                                                      }

                                                    });


                                                    DriverDevices.findOne({
                                                      user_id: rides.driver_id
                                                    }, function (err, driverdevices) {
                                                      if (driverdevices) {
                                                        let driverlang = driverdevices.lang_type;
                                                        console.log(driverlang);
                                                        let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);
                                                        let data = {
                                                          type: "payment",
                                                          message: message,
                                                          ride_id: rides._id
                                                        };
                                                        translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);


                                                        driverNotify(driverids, translatedstring, data);



                                                      }

                                                    });

                                                    res.json({
                                                      status: "true",
                                                      walletmoney: walletamount,
                                                      message: message
                                                    });
                                                  }
                                                }
                                              );
                                            } else {
                                              senderr(res);
                                            }
                                          }
                                        );
                                      } else {
                                        senderr(res);
                                      }
                                    });
                                  } else {
                                    let message = "Payment has been done successfully";
                                    let notifications = {
                                      user_id: "0",
                                      notify_to: req.body.user_id,
                                      title: "Payment Completed",
                                      message: message
                                    };
                                    notifyTo(notifications);
                                    Rides.findOne(
                                      {
                                        _id: req.body.onride_id
                                      },
                                      function (err, rides) {
                                        if (!rides) {
                                          senderr(res);
                                        } else {
                                          let userids = [req.body.user_id];
                                          let driverids = [rides.driver_id];

                                          let drivernotifications = {
                                            user_id: "0",
                                            notify_to: rides.driver_id,
                                            title: "Payment Completed",
                                            message: message
                                          };
                                          notifyTo(drivernotifications);
                                          UserDevices.findOne({
                                            user_id: req.body.user_id
                                          }, function (err, userdevices) {
                                            if (userdevices) {
                                              let lang = userdevices.lang_type;
                                              console.log(lang);
                                              let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                                              let data = {
                                                type: "payment",
                                                message: message,
                                                ride_id: rides._id
                                              };
                                              translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);

                                              userNotify(userids, translatedstring, data);




                                            }

                                          });


                                          DriverDevices.findOne({
                                            user_id: rides.driver_id
                                          }, function (err, driverdevices) {
                                            if (driverdevices) {
                                              let driverlang = driverdevices.lang_type;
                                              console.log(driverlang);
                                              let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);
                                              let data = {
                                                type: "payment",
                                                message: message,
                                                ride_id: rides._id
                                              };
                                              translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);
                                              driverNotify(driverids, translatedstring, data);



                                            }

                                          });

                                          res.json({
                                            status: "true",
                                            message: message
                                          });
                                        }
                                      }
                                    );
                                  }
                                } else {
                                  senderr(res);
                                }
                              });
                            } else {
                              senderr(res);
                            }
                          } else {
                            senderr(res);
                          }
                        }
                      );
                    });
                }).then(undefined, function (err) {
                  senderr(res);
                });
              }
            }
          );
        }
      }
    })(req, res);
  }
);

/* pay by cash or wallet */
router.post(
  "/paybycash",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        let translatedstring = "";
        if (
          !req.body.user_id ||
          !req.body.amount ||
          !req.body.onride_id ||
          !req.body.iswallet ||
          !req.body.basefare ||
          !req.body.commissionamount ||
          !req.body.tax ||
          !req.body.driver_id
        ) {
          senderr(res);
        } else {
          let paidby = "cash";
          if (req.body.amount == 0) {
            paidby = "wallet";
          }
          Payments.count(
            {
              onride_id: req.body.onride_id
            },
            function (err, count) {
              if (count > 0) {
                res.json({
                  status: "true",
                  message: "Payment has been done successfully"
                });
              } else {
                let payObject = {
                  user_id: req.body.user_id,
                  onride_id: req.body.onride_id,
                  payment_type: paidby,
                  ride_fare: req.body.amount,
                  baseprice: req.body.basefare,
                  commissionamount: req.body.commissionamount,
                  tax: req.body.tax,
                  driver_id: req.body.driver_id,
                  paidbywallet: req.body.iswallet == "1" ? req.body.walletamount : 0
                };
                let newPayment = new Payments(payObject);
                newPayment.save(function (err) {
                  if (!err) {
                    if (req.body.iswallet == "1") {
                      let paywalletObject = {
                        user_id: req.body.user_id,
                        onride_id: req.body.onride_id,
                        amount: req.body.walletamount,
                        type: "debit",
                        transaction: "payride",
                        updated_at: timeZone()
                      };
                      let newWallet = new Wallet(paywalletObject);
                      newWallet.save(function (err) {
                        if (!err) {
                          User.findOneAndUpdate(
                            {
                              _id: req.body.user_id
                            },
                            {
                              $inc: {
                                walletmoney: -req.body.walletamount
                              }
                            },
                            {
                              new: true
                            },
                            function (err, doc) {
                              if (!err) {
                                let walletamount;
                                if (typeof doc.walletmoney != "undefined") {
                                  walletamount = Math.round(doc.walletmoney * 100) / 100;
                                } else {
                                  walletamount = 0;
                                }
                                let message = "Payment has been done successfully";
                                let notifications = {
                                  user_id: "0",
                                  notify_to: req.body.user_id,
                                  title: "Payment Completed",
                                  message: message
                                };
                                notifyTo(notifications);
                                Rides.findOne(
                                  {
                                    _id: req.body.onride_id
                                  },
                                  function (err, rides) {
                                    if (!rides) {
                                      senderr(res);
                                    } else {
                                      let userids = [req.body.user_id];
                                      let driverids = [rides.driver_id];
                                      let drivernotifications = {
                                        user_id: "0",
                                        notify_to: rides.driver_id,
                                        title: "Payment Completed",
                                        message: message
                                      };
                                      notifyTo(drivernotifications);
                                      UserDevices.findOne({
                                        user_id: req.body.user_id
                                      }, function (err, userdevices) {
                                        if (userdevices) {
                                          let lang = userdevices.lang_type;
                                          console.log(lang);
                                          let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                                          let data = {
                                            type: "payment",
                                            message: message,
                                            ride_id: rides._id
                                          };
                                          translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                                          userNotify(userids, translatedstring, data);
                                        }
                                      });
                                      DriverDevices.findOne({
                                        user_id: rides.driver_id
                                      }, function (err, driverdevices) {
                                        if (driverdevices) {
                                          let driverlang = driverdevices.lang_type;
                                          console.log(driverlang);
                                          let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);
                                          let data = {
                                            type: "payment",
                                            message: message,
                                            ride_id: rides._id
                                          };
                                          translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);
                                          driverNotify(driverids, translatedstring, data);
                                        }
                                      });
                                      res.json({
                                        status: "true",
                                        walletmoney: walletamount,
                                        message: message
                                      });
                                    }
                                  }
                                );
                              } else {
                                senderr(res);
                              }
                            }
                          );
                        } else {
                          senderr(res);
                        }
                      });
                    } else {
                      let message = "Payment has been done successfully";
                      let notifications = {
                        user_id: "0",
                        notify_to: req.body.user_id,
                        title: "Payment Completed",
                        message: message
                      };
                      notifyTo(notifications);
                      Rides.findOne(
                        {
                          _id: req.body.onride_id
                        },
                        function (err, rides) {
                          if (!rides) {
                            senderr(res);
                          } else {
                            let userids = [req.body.user_id];
                            let driverids = [rides.driver_id];
                            let drivernotifications = {
                              user_id: "0",
                              notify_to: rides.driver_id,
                              title: "Payment Completed",
                              message: message
                            };
                            notifyTo(drivernotifications);
                            UserDevices.findOne({
                              user_id: req.body.user_id
                            }, function (err, userdevices) {
                              if (userdevices) {
                                let lang = userdevices.lang_type;
                                console.log(lang);
                                let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                                let data = {
                                  type: "payment",
                                  message: message,
                                  ride_id: rides._id
                                };
                                translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", lang);
                                userNotify(userids, translatedstring, data);
                              }
                            });
                            DriverDevices.findOne({
                              user_id: rides.driver_id
                            }, function (err, driverdevices) {
                              if (driverdevices) {
                                let driverlang = driverdevices.lang_type;
                                console.log(driverlang);
                                let message = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);
                                let data = {
                                  type: "payment",
                                  message: message,
                                  ride_id: rides._id
                                };
                                translatedstring = translationServer.langTranslate("Paymenthasbeendonesuccessfully", driverlang);
                                driverNotify(driverids, translatedstring, data);
                              }
                            });
                            res.json({
                              status: "true",
                              message: message
                            });
                          }
                        }
                      );
                    }
                  } else {
                    senderr(res);
                  }
                });
              }
            }
          );
        }
      }
    })(req, res);
  }
);

/* add money to wallet */
router.post(
  "/addmoney",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        let translatedstring = "";
        if (!req.body.user_id || !req.body.amount || !req.body.paynonce) {
          senderr(res);
        } else {
          let querystring = {
            _id: req.body.user_id
          }; /* find user details by userid */
          Admin.findOne(function (err, admin) {
            let gateway = braintree.connect({
              environment: admin.BraintreeStatus == "1" ? braintree.Environment.Production : braintree.Environment.Sandbox,
              merchantId: admin.merchandId,
              publicKey: admin.publicKey,
              privateKey: admin.privateKey
            });
            User.findOne(querystring)
              .exec()
              .then(function (err, user) {
                gateway.transaction.sale(
                  {
                    amount: req.body.amount,
                    paymentMethodNonce: req.body.paynonce,
                    options: {
                      submitForSettlement: true
                    }
                  },
                  function (err, result) {
                    if (!err) {
                      if (result.success) {
                        let payObject = {
                          user_id: req.body.user_id,
                          amount: result.transaction.amount,
                          transaction_id: result.transaction.id,
                          type: "credit",
                          transaction: "addmoney",
                          updated_at: timeZone()
                        };
                        let newWallet = new Wallet(payObject);
                        newWallet.save(function (err) {
                          if (!err) {
                            User.findOneAndUpdate(
                              {
                                _id: req.body.user_id
                              },
                              {
                                $inc: {
                                  walletmoney: result.transaction.amount
                                }
                              },
                              {
                                new: true
                              },
                              function (err, doc) {
                                if (!err) {
                                  let message = "Amount credited to your wallet successfully";
                                  let walletamount = Math.round(doc.walletmoney * 100) / 100;
                                  let notifications = {
                                    user_id: "0",
                                    notify_to: req.body.user_id,
                                    title: "Wallet Credited",
                                    message: "Your wallet has been credited & wallet balance is " + walletamount
                                  };
                                  notifyTo(notifications);
                                  let userids = [req.body.user_id];
                                  UserDevices.findOne({
                                    user_id: req.body.user_id
                                  }, function (err, userdevices) {
                                    if (userdevices) {

                                      let lang = userdevices.lang_type;
                                      translatedstring = translationServer.langTranslate("Amountcreditedtoyourwalletsuccessfully", lang);
                                      let data = {
                                        type: "payment",
                                        message: translatedstring
                                      };
                                      userNotify(userids, translatedstring, data);
                                    }

                                  });

                                  res.json({
                                    status: "true",
                                    walletmoney: walletamount,
                                    message: message
                                  });
                                } else {
                                  senderr(res);
                                }
                              }
                            );
                          } else {
                            senderr(res);
                          }
                        });
                      } else {
                        senderr(res);
                      }
                    } else {
                      senderr(res);
                    }
                  }
                );
              });
          }).then(undefined, function (err) {
            senderr(res);
          });
        }
      }
    })(req, res);
  }
);

/* create selcom hosted checkout */
router.post(
  "/getselcomurl",
  function (req, res) {
    passport.authenticate("jwt", { session: false }, async function (err, user) {
      if (err === "AccountDeleted") {
        return res.json({
          status: "error",
          message: "Account has been deleted successfully"
        });
      } else if (!user) {
        return res.json({
          status: "error",
          message: "Unauthorized access"
        });
      } else if (!req.body.user_id || !req.body.amount) {
        return senderr(res);
      } else if (String(user._id) !== String(req.body.user_id)) {
        return res.json({
          status: "false",
          message: "Unauthorized access"
        });
      } else if (!selcomService.isConfigured()) {
        return res.json({
          status: "false",
          message: "Selcom payment is not configured"
        });
      }

      try {
        const amount = selcomService.normalizeAmount(req.body.amount);
        if (!amount) {
          return res.json({
            status: "false",
            message: "Invalid payment amount"
          });
        }

        const transid = selcomService.generateTransId();
        const returnUrl = selcomService.buildReturnUrl(transid);
        const checkout = await selcomService.createOrder({
          transid: transid,
          amount: amount,
          user: user,
          userId: req.body.user_id,
          returnUrl: returnUrl,
          remarks: "CABi payment"
        });

        await SelcomPaymentSession.findOneAndUpdate(
          { transid: transid },
          {
            transid: transid,
            order_id: checkout.orderId,
            user_id: String(req.body.user_id),
            actor_type: "user",
            amount: amount,
            status: "pending",
            verified_at: null,
            consumed_at: null,
            expires_at: new Date(Date.now() + 30 * 60 * 1000)
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
          }
        ).exec();

        return res.json({
          status: "true",
          message: "Payment URL generated successfully",
          payment_url: checkout.paymentUrl,
          return_url: returnUrl,
          transid: transid
        });
      } catch (error) {
        return res.json({
          status: "false",
          message: error && error.message ? error.message : "Unable to create Selcom payment"
        });
      }
    })(req, res);
  }
);

/* verify selcom transaction from redirect url */
router.post("/selcom/callback", async function (req, res) {
  console.log("Selcom callback received:", JSON.stringify({
    headers: req.headers || {},
    body: req.body || {}
  }));

  const orderId = String(req.body && req.body.order_id || "").trim();
  const providerTransId = String(req.body && req.body.transid || "").trim();
  if (!orderId && !providerTransId) {
    return res.status(400).json({
      status: "false",
      message: "Missing Selcom transaction identifiers"
    });
  }

  try {
    const session = await findSelcomSessionFromPayload(req.body || {});
    if (!session) {
      return res.status(404).json({
        status: "false",
        message: "Payment session not found"
      });
    }

    const callbackHasSignature = hasSelcomSignatureHeaders(req.headers || {});
    if (callbackHasSignature) {
      if (!selcomService.verifyWebhookRequest(req.headers, req.body || {})) {
        return res.status(401).json({
          status: "false",
          message: "Invalid Selcom callback signature"
        });
      }

      await applySelcomProviderUpdate(session, req.body || {});
    } else {
      if (!doesCallbackAmountMatchSession(session, req.body || {})) {
        return res.status(409).json({
          status: "false",
          message: "Selcom callback amount does not match the payment session"
        });
      }

      await applySelcomProviderUpdate(session, Object.assign({}, req.body || {}, {
        order_id: orderId || session.order_id || session.transid,
        transid: providerTransId || session.reference || session.transid,
        amount: req.body && req.body.amount ? req.body.amount : session.amount
      }));
    }

    return res.json({
      status: "true",
      message: "Selcom callback processed successfully",
      transid: session.transid,
      order_id: session.order_id,
      provider_transid: providerTransId || null,
      payment_status: session.payment_status,
      session_status: session.status
    });
  } catch (error) {
    return res.status(500).json({
      status: "false",
      message: error && error.message ? error.message : "Unable to process Selcom callback"
    });
  }
});

router.get("/verifyselcom/:transid", async function (req, res) {
  const transid = String(req.params.transid || "").trim();
  if (!transid) {
    return senderr(res);
  }

  try {
    const session = await SelcomPaymentSession.findOne({
      transid: transid,
      actor_type: "user"
    }).exec();

    if (!session) {
      return res.json({
        status: "false",
        message: "Payment session not found"
      });
    }

    if (session.status === "verified" || session.status === "completed") {
      return res.json({
        status: "true",
        message: "Payment verified successfully",
        transid: transid,
        paidamount: String(session.paid_amount || session.amount)
      });
    }

    if (session.expires_at && session.expires_at.getTime() < Date.now()) {
      return res.json({
        status: "false",
        message: "Payment session has expired"
      });
    }

    const result = await selcomService.queryTransaction(transid);
    if (String(result.resultcode) === "000") {
      await applySelcomProviderUpdate(session, {
        transid: transid,
        result: result.result,
        resultcode: result.resultcode,
        message: result.message,
        reference: result.reference,
        payment_status: "COMPLETED",
        amount: session.amount
      });

      return res.json({
        status: "true",
        message: result.message || "Payment verified successfully",
        transid: transid,
        paidamount: String(session.paid_amount || session.amount)
      });
    }

    if (String(result.resultcode) !== "111") {
      await applySelcomProviderUpdate(session, {
        transid: transid,
        result: result.result,
        resultcode: result.resultcode,
        message: result.message,
        reference: result.reference,
        payment_status: result.result || "FAILED",
        amount: session.amount
      });
    }

    return res.json({
      status: "false",
      message: result.message || "Payment is still pending"
    });
  } catch (error) {
    return res.json({
      status: "false",
      message: error && error.message ? error.message : "Unable to verify Selcom payment"
    });
  }
});

/* finalize verified selcom payment */
router.post(
  "/paybyselcom",
  function (req, res) {
    passport.authenticate("jwt", { session: false }, async function (err, user) {
      if (err === "AccountDeleted") {
        return res.json({
          status: "error",
          message: "Account has been deleted successfully"
        });
      } else if (!user) {
        return res.json({
          status: "error",
          message: "Unauthorized access"
        });
      } else if (!req.body.user_id || !req.body.amount || !req.body.paynonce || !req.body.type) {
        return senderr(res);
      } else if (String(user._id) !== String(req.body.user_id)) {
        return res.json({
          status: "false",
          message: "Unauthorized access"
        });
      }

      try {
        const transid = String(req.body.paynonce).trim();
        const amount = selcomService.normalizeAmount(req.body.amount);
        const session = await SelcomPaymentSession.findOne({
          transid: transid,
          user_id: String(req.body.user_id),
          actor_type: "user"
        }).exec();

        if (!session) {
          return res.json({
            status: "false",
            message: "Payment session not found"
          });
        }

        if (session.consumed_at) {
          const currentUser = await User.findById(req.body.user_id).exec();
          const walletamount =
            currentUser && typeof currentUser.walletmoney !== "undefined"
              ? Math.round(Number(currentUser.walletmoney || 0) * 100) / 100
              : 0;

          return res.json({
            status: "true",
            walletmoney: walletamount,
            message: "Payment has been done successfully"
          });
        }

        if (session.status !== "verified" && !session.verified_at) {
          try {
            await ensureSelcomPaymentVerified(session, transid);
          } catch (verifyError) {
            return res.json({
              status: "false",
              message: verifyError && verifyError.message ? verifyError.message : "Payment has not been verified yet"
            });
          }
        }

        if (!amount || Math.abs(Number(session.amount) - Number(amount)) > 0.01) {
          return res.json({
            status: "false",
            message: "Payment amount mismatch"
          });
        }

        if (req.body.type === "wallet") {
          let walletCredit = new Wallet({
            user_id: req.body.user_id,
            amount: amount,
            transaction_id: transid,
            type: "credit",
            transaction: "addmoney",
            updated_at: timeZone()
          });
          await walletCredit.save();

          const updatedUser = await User.findOneAndUpdate(
            { _id: req.body.user_id },
            {
              $inc: {
                walletmoney: amount
              }
            },
            {
              new: true
            }
          ).exec();

          session.status = "completed";
          session.consumed_at = new Date();
          await session.save();

          return res.json({
            status: "true",
            walletmoney: Math.round(Number((updatedUser && updatedUser.walletmoney) || 0) * 100) / 100,
            message: "Amount credited to your wallet successfully"
          });
        }

        if (
          req.body.type !== "ride" ||
          !req.body.onride_id ||
          !req.body.basefare ||
          !req.body.commissionamount ||
          !req.body.tax ||
          !req.body.driver_id ||
          typeof req.body.iswallet === "undefined"
        ) {
          return senderr(res);
        }

        const existingPayment = await Payments.countDocuments({
          onride_id: req.body.onride_id
        }).exec();

        if (existingPayment > 0) {
          session.status = "completed";
          session.consumed_at = session.consumed_at || new Date();
          await session.save();

          return res.json({
            status: "true",
            message: "Payment has been done successfully"
          });
        }

        let payObject = {
          user_id: req.body.user_id,
          onride_id: req.body.onride_id,
          payment_type: "selcom",
          ride_fare: amount,
          transaction_id: transid,
          baseprice: req.body.basefare,
          commissionamount: req.body.commissionamount,
          tax: req.body.tax,
          driver_id: req.body.driver_id,
          paidbywallet: req.body.iswallet == "1" ? Number(req.body.walletamount || 0) : 0
        };
        await new Payments(payObject).save();

        let walletamount;
        if (req.body.iswallet == "1") {
          let walletDebit = new Wallet({
            user_id: req.body.user_id,
            onride_id: req.body.onride_id,
            amount: req.body.walletamount,
            type: "debit",
            transaction: "payride",
            updated_at: timeZone()
          });
          await walletDebit.save();

          const updatedUser = await User.findOneAndUpdate(
            { _id: req.body.user_id },
            {
              $inc: {
                walletmoney: -Number(req.body.walletamount || 0)
              }
            },
            {
              new: true
            }
          ).exec();
          walletamount = Math.round(Number((updatedUser && updatedUser.walletmoney) || 0) * 100) / 100;
        }

        session.status = "completed";
        session.consumed_at = new Date();
        await session.save();

        let result = {
          status: "true",
          message: "Payment has been done successfully"
        };
        if (typeof walletamount !== "undefined") {
          result.walletmoney = walletamount;
        }

        return res.json(result);
      } catch (error) {
        return res.json({
          status: "false",
          message: error && error.message ? error.message : "Unable to complete Selcom payment"
        });
      }
    })(req, res);
  }
);

/* wallet history */
router.get(
  "/wallethistory/:userid",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else if (String(user._id) !== String(req.params.userid)) {
        res.json({
          status: "false",
          message: 'Unauthorized access'
        });
      } else {
        Wallet.count(
          {
            user_id: req.params.userid,
            wallet_for: "user"
          },
          function (err, count) {
            if (err) senderr(res);
            else {
              if (count > 0) {
                Wallet.find({
                  user_id: req.params.userid,
                  wallet_for: "user"
                })
                  .sort([["_id", -1]])
                  .exec(function (err, wallets) {
                    if (!err) {
                      res.json({
                        status: "true",
                        payment_list: wallets
                      });
                    } else {
                      res.json({
                        status: "false",
                        message: "No Wallet used"
                      });
                    }
                  });
              } else {
                res.json({
                  status: "false",
                  message: "No Wallet used"
                });
              }
            }
          }
        );
      }
    })(req, res);
  }
);

/* user review a ride */
router.post(
  "/review",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.onride_id) {
          senderr(res);
        } else {
          let querystring = {
            _id: req.body.onride_id,
            user_id: req.body.user_id
          };
          Reviews.count(
            {
              onride_id: req.body.onride_id
            },
            function (err, count) {
              if (count > 0) {
                Reviews.findOneAndUpdate(
                  {
                    onride_id: req.body.onride_id
                  },
                  {
                    $set: {
                      review_message: req.body.review_message,
                      rating: req.body.rating
                    }
                  }
                ).exec(function (err, reviews) {
                  if (err) {
                    senderr(res);
                  } else {
                    let query = Reviews.aggregate([
                      {
                        $match: {
                          driver_id: reviews.driver_id
                        }
                      },
                      {
                        $group: {
                          _id: "null",
                          ratings: {
                            $sum: "$rating"
                          }
                        }
                      }
                    ]);
                    query.exec(function (err, driver) {
                      if (err) {
                        senderr(res);
                      } else {
                        let rating = parseInt(driver[0].ratings);
                        let updateresult = {
                          rating: rating
                        };
                        Driver.findOneAndUpdate(
                          {
                            _id: reviews.driver_id
                          },
                          {
                            $set: updateresult
                          }
                        ).exec(function (err, drivers) {
                          if (err) {
                            senderr(res);
                          } else {
                            cetsSyncService.enqueueTripSync(req.body.onride_id, "trip_review_update").catch(function (syncError) {
                              console.error("CeTS trip review-update enqueue failed:", syncError);
                            });
                            res.json({
                              status: "true",
                              message: "Review Updated Successfully"
                            });
                          }
                        });
                      }
                    });
                  }
                });
              } else {
                Rides.findOne(querystring).exec(function (err, rides) {
                  if (!err) {
                    let reviewObject = {
                      user_id: req.body.user_id,
                      onride_id: req.body.onride_id,
                      review_message: req.body.review_message,
                      rating: req.body.rating,
                      driver_id: rides.driver_id
                    };
                    let newReview = new Reviews(reviewObject);
                    newReview.save(function (err, reviews) {
                      if (!err) {
                        if (req.body.rating == null) {
                          req.body.rating = 0;
                        }
                        Driver.update(
                          {
                            _id: rides.driver_id
                          },
                          {
                            $inc: {
                              rating: req.body.rating
                            }
                          },
                          {
                            new: true
                          },
                          function (err, doc) {
                            if (!err) {
                              cetsSyncService.enqueueTripSync(req.body.onride_id, "trip_review_create").catch(function (syncError) {
                                console.error("CeTS trip review-create enqueue failed:", syncError);
                              });
                              res.json({
                                status: "true",
                                message: "Review Updated Successfully"
                              });
                            } else {
                              senderr(res);
                            }
                          }
                        );
                      } else {
                        senderr(res);
                      }
                    });
                  } else {
                    senderr(res);
                  }
                });
              }
            }
          );
        }
      }
    })(req, res);
  }
);

/** message & contact admin */
router.post(
  "/contactus",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.name || !req.body.email || !req.body.subject || !req.body.message) {
          senderr(res);
        } else {
          Admin.findOne(function (err, admin) {
            let message = "Mail From: " + req.body.email;
            let mailOptions = {
              to: admin.email,
              subject: req.body.subject,
              html:
                "<i>Mail From " +
                req.body.name +
                "</i>" +
                "<br />" +
                req.body.message +
                "<br /><br />" +
                "you can contact him at this mail id " +
                req.body.email
            };
            let transporter = nodemailer.createTransport({
              host: admin.smptHost,
              port: admin.smtpPort,
              secure: false,
              auth: {
                user: admin.smtpUsername,
                pass: admin.smtpPassword
              }
            });
            // send mail with defined transport object
            transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                senderr(res);
              } else {
                res.json({
                  status: "true",
                  message: "Got your query. We will get back to you soon"
                });
              }
            });
          });
        }
      }
    })(req, res);
  }
);

/* edit name & edit country_code  & emergency contact*/
router.post(
  "/updateprofile",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id) {
          senderr(res);
        } else {
          if (typeof req.body.emergency_contact != "undefined") {
            req.body.emergency_contact = JSON.parse(req.body.emergency_contact);
          }
          User.findOneAndUpdate(
            {
              _id: req.body.user_id
            },
            {
              $set: req.body
            }
          ).exec(function (err, users) {
            if (err) {
              senderr(res);
            } else {
              res.json({
                status: "true",
                message: "User updated successfully"
              });
            }
          });
        }
      }
    })(req, res);
  }
);

/* edit name & edit country_code  & emergency contact*/
router.post("/updatephonenumber", function (req, res) {
  if (!req.body.user_id) {
    senderr(res);
  } else {
    let phoneUtil = require("google-libphonenumber").PhoneNumberUtil.getInstance();
    let number = phoneUtil.parseAndKeepRawInput(req.body.phoneNumber);
    let verified_phoneno = number.getNationalNumber();
    let verified_code = number.getCountryCode();
    User.findOneAndUpdate(
      {
        _id: req.body.user_id
      },
      {
        phone_number: verified_phoneno,
        country_code: verified_code
      }
    ).exec(function (err, userinfo) {
      if (err) {
        res.json({
          status: "false",
          message: "Something went to be wrong"
        });
      } else {
        res.json({
          status: "true",
          message: "Phone Number changed successfully"
        });
      }
    });
  }
});

/* app config */
router.get("/admindatas", function (req, res, next) {
  Admin.findOne(function (err, admin) {
    res.json({
      status: "true",
      currencycode: admin.currencyCode,
      currencysymbol: admin.currencySymbol,
      emergencycontact: admin.emergencyContact,
      androidstore: admin.androidUser,
      admin_enable_ads: admin.admin_enable_ads,
      ad_unit_id: admin.ad_unit_id
    });
  });
});

/* on ride not accepted */
router.post(
  "/nooneaccept",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id || !req.body.onride_id) {
          senderr(res);
        } else {
          let querystring = {
            _id: req.body.onride_id
          };
          Rides.findOne(querystring)
            .populate("user_id")
            .exec(function (err, rides) {
              if (!rides) {
                senderr(res);
              } else {
                rides.ridestatus = "ridenotaccepted";
                rides.ridestatusat = timeZone();
                rides.save();
                res.json({
                  status: "true",
                  message: "Status changed successfully"
                });
              }
            });
        }
      }
    })(req, res);
  }
);

/* To save place */
router.post(
  "/saveplace",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (req.body.type && req.body.type == "add") {
          if (
            !req.body.place_name ||
            !req.body.place_full_address ||
            !req.body.place_latitude ||
            !req.body.place_longitude ||
            !req.body.place_type ||
            !req.body.user_id ||
            !req.body.google_place_id
          ) {
            res.json({
              status: "false",
              message: "Please check the details"
            });
          } else {
            let timestamp = timeZone();
            let newplace = {
              user_id: req.body.user_id,
              place_name: req.body.place_name,
              place_full_address: req.body.place_full_address,
              place_latitude: req.body.place_latitude,
              place_longitude: req.body.place_longitude,
              place_type: req.body.place_type,
              google_place_id: req.body.google_place_id
            };
            Places.findOne(
              {
                user_id: req.body.user_id,
                google_place_id: req.body.google_place_id
              },
              function (err, place) {
                if (place == null) {
                  let newuserplace = new Places(newplace);
                  newuserplace.save(function (err) {
                    if (err) {
                      senderr(res);
                    } else {
                      res.json({
                        status: "true",
                        place_id: newuserplace._id,
                        message: "Saved successfully"
                      });
                    }
                  });
                } else {
                  res.json({
                    status: "false",
                    message: "Place already saved"
                  });
                }
              }
            );
          }
        } else if (req.body.type && req.body.type == "remove") {
          if (req.body.user_id && req.body.google_place_id) {
            Places.findOneAndRemove(
              {
                user_id: req.body.user_id,
                google_place_id: req.body.google_place_id
              },
              function (err, count) {
                if (err) {
                  senderr(res);
                } else {
                  res.json({
                    status: "true",
                    message: "Removed successfully"
                  });
                }
              }
            );
          } else {
            res.json({
              status: "false",
              message: "Please check the detail"
            });
          }
        } else {
          res.json({
            status: "false",
            message: "Please select add/remove"
          });
        }
      }
    })(req, res);
  }
);

/* user's savedplaces */
router.post(
  "/savedplaces",
  function (req, res) {
    passport.authenticate('jwt', { session: false }, function (err, user) {
      if (err === "AccountDeleted") {
        res.json({
          status: "error",
          message: 'Account has been deleted successfully'
        });
      } else if (!user) {
        res.json({
          status: "error",
          message: 'Unauthorized access'
        });
      } else {
        if (!req.body.user_id) {
          senderr(res);
        } else {
          let allplace = [];
          Places.find()
            .where("user_id")
            .in(req.body.user_id)
            .exec(function (err, place) {
              place.forEach(function (h) {
                allplace.push({
                  place_id: h._id,
                  place_name: h.place_name,
                  place_full_address: h.place_full_address,
                  place_latitude: h.place_latitude,
                  place_longitude: h.place_longitude,
                  place_type: h.place_type,
                  google_place_id: h.google_place_id
                });
              });
              if (!err) {
                res.json({
                  status: "true",
                  saved_places: allplace
                });
              } else {
                res.json({
                  status: "false",
                  message: "Something went to be wrong"
                });
              }
            });
        }
      }
    })(req, res);
  }
);

/* account exists */
router.post("/checkaccountexists", function (req, res) {
  if (!req.body.email) {
    senderr(res);
  } else {
    User.count(
      {
        email: req.body.email
      },
      function (err, count) {
        if (count > 0) {
          res.json({
            status: "false",
            message: "Email already exists"
          });
        } else {
          res.json({
            status: "true",
            message: "New Account"
          });
        }
      }
    );
  }
});

/* all categories */
router.get("/allcategories", function (req, res) {
  Categories.find()
    .sort({
      _id: 1
    })
    .exec(function (err, categories) {
      if (categories && !err) {
        let availcategories = [];
        categories.forEach(function (c) {
          let categoryimage = base_url + "/imagegallery/" + c.image;
          availcategories.push({
            _id: c._id,
            category_name: c.category_name,
            image: categoryimage,
            baseprice: c.baseprice,
            reach_pickup: "2 mins",
            available: "0"
          });
        });
        res.json({
          status: "true",
          count: categories.length,
          categories: availcategories
        });
      } else {
        res.json({
          status: "false",
          message: "No categories found"
        });
      }
    });
});

/* all categories */
router.get("/allcategories", function (req, res) {
  Categories.find()
    .sort({
      _id: 1
    })
    .exec(function (err, categories) {
      if (categories && !err) {
        let availcategories = [];
        categories.forEach(function (c) {
          let categoryimage = base_url + "/imagegallery/" + c.image;
          availcategories.push({
            _id: c._id,
            category_name: c.category_name,
            image: categoryimage,
            baseprice: c.baseprice,
            reach_pickup: "2 mins",
            available: "0"
          });
        });
        res.json({
          status: "true",
          count: categories.length,
          categories: availcategories
        });
      } else {
        res.json({
          status: "false",
          message: "No categories found"
        });
      }
    });
});

/* all categories */
router.get("/lastridedetails/:user_id", function (req, res) {
  if (!req.params.user_id) {
    senderr(res);
  } else {
    let querystring = {
      user_id: req.params.user_id,
      ridestatus: "requested"
    };
    let rideresult = {};
    let allrides = [];
    Rides.count(querystring, function (err, count) {
      if (count > 0) {
        Rides.findOne(querystring)
          .populate("category_id")
          .sort({
            _id: -1
          })
          .limit(1)
          .exec(function (err, rides) {
            if (!err) {
              rideresult.ride_id = rides._id;
              rideresult.category_name = rides.category_id.category_name;
              let profile_image = rides.category_id.image;
              if (typeof profile_image == "undefined") {
                let profile_image = "category.png";
              }
              rideresult.category_image = base_url + "/imagegallery/" + profile_image;
              rideresult.pickup_location = rides.pickup_location;
              rideresult.pickup_lat = rides.pickup_lat;
              rideresult.pickup_lng = rides.pickup_lng;
              rideresult.drop_location = rides.drop_location;
              rideresult.drop_lat = rides.drop_lat;
              rideresult.drop_lng = rides.drop_lng;
              rideresult.approx_price = rides.category_id.baseprice;
              rideresult.notified = rides.notify;
              allrides.push(rideresult);
              res.json({ status: true, result: allrides });
            } else {
              senderr(res);
            }
          });
      } else {
        senderr(res);
      }
    });
  }
});

/* Audio Call Addon */
router.post("/makecall", function (req, res) {
  if (!req.body.sender_id || !req.body.receiver_id || !req.body.type || !req.body.user_type || !req.body.room_id || !req.body.platform || !req.body.timestamp) {
   
    senderr(res);
  } else {

    User.findOne({ _id: req.body.sender_id },
      function (err, user) {
       
        if (user && !err) {
          let profile_image = "user.png";
          if (typeof user.profile_image != "undefined") {
            profile_image = user.profile_image;
          }
          let data = {
            sender_id: req.body.sender_id,
            receiver_id: req.body.receiver_id,
            user_type: req.body.user_type,
            room_id: req.body.room_id,
            platform: req.body.platform,
            timestamp: req.body.timestamp,
            type: req.body.type,
            user_name: user.full_name,
            user_image: base_url + "/gallery/users/" + profile_image,
            message: "make_audio_call"
          };

          let userids = [req.body.receiver_id];

          if (req.body.user_type === "user") {
            driverNotification(userids, "Call Connected Successfully", data);
          }

          if (req.body.user_type === "driver") {
            userNotification(userids, "Call Connected Successfully", data);
          }

          console.log(JSON.stringify(data));

          res.json({
            status: "true",
            message: "Call Connected Successfully"
          });
        }
        else {
          console.log(err);
          senderr(res);
        }
      });
  }
});

router.post("/endcall", function (req, res) {
  if (!req.body.sender_id || !req.body.receiver_id || !req.body.type || !req.body.user_type || !req.body.room_id || !req.body.platform || !req.body.timestamp) {
    senderr(res);
  } else {

    let data = {
      sender_id: req.body.sender_id,
      receiver_id: req.body.receiver_id,
      user_type: req.body.user_type,
      room_id: req.body.room_id,
      platform: req.body.platform,
      timestamp: req.body.timestamp,
      type: req.body.type,
      message: "end_audio_call"
    };

    let userids = [req.body.receiver_id];

    if (req.body.user_type === "user") {
      driverNotification(userids, "Call Disconnected Successfully", data);
    }
    if (req.body.user_type === "driver") {
      userNotification(userids, "Call Disconnected Successfully", data);
    }

    res.json({
      status: "true",
      message: "Call Disconnected Successfully"
    });
  }
});

/* delete account */
router.post('/deleteaccount', function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, driver) {
    if (err === "AccountDeleted") {
      res.json({
        status: "error",
        message: 'Account has been deleted successfully'
      });
    } else if (!driver) {
      res.json({
        status: "error",
        message: 'Unauthorized access'
      });
    } else {

      let querystring = [{
        ridestatus: 'onride'
      }, {
        ridestatus: 'ontheway'
      }, {
        ridestatus: 'scheduled'
      }, {
        ridestatus: 'accepted'
      }];

      Rides.count({
        user_id: req.body.user_id
      }).or(querystring).sort({
        '_id': -1
      }).
        exec(function (err, totalRides) {
          if (!err) {
            if (totalRides > 0) {
              res.json({
                status: "false",
                message: "You're in ride. You can't delete this account"
              });
            } else {
              User.findOneAndUpdate({
                _id: req.body.user_id
              }, {
                $set: { "deletion_status": 1 }
              }).exec(function (err, driver) {
                if (err) {
                  res.json({
                    status: "false",
                    message: "Something went to be wrong"
                  });
                } else {
                  res.json({
                    status: "true",
                    message: "Account has been deleted successfully"
                  });
                }
              });
            }
          } else {
            senderr(res);
          }
        });

    }
  })(req, res);
});



/* web account deletion*/
router.post('/accountdelete', function (req, res) {
  passport.authenticate('jwt', { session: false }, function (err, driver) {
      let querystring = [{
        ridestatus: 'onride'
      }, {
        ridestatus: 'ontheway'
      }, {
        ridestatus: 'scheduled'
      }, {
        ridestatus: 'accepted'
      }];
      Rides.count({
        user_id: req.body.user_id
      }).or(querystring).sort({
        '_id': -1
      }).
        exec(function (err, totalRides) {
          if (!err) {
            if (totalRides > 0) {
              res.json({
                status: "error",
                message: "You're in ride. You can't delete this account"
              });
            } else {
              User.findOneAndUpdate({
                _id: req.body.user_id
              }, {
                $set: { "deletion_status": 1 }
              }).exec(function (err, user) {
                if (err) {
                  res.json({
                    status: "false",
                    message: "Something went to be wrong"
                  });
                } else {
                  res.json({
                    status: "true",
                    message: "Account has been deleted successfully"
                  });
                }
              });
            }
          } else {
            senderr(res);
          }
        });    
  })(req, res);
});



/* make driver available */
freeDriver = function (driverid) {
  Driver.findOne(
    {
      _id: driverid
    },
    function (err, driver) {
      if (!driver) {
        senderr(res);
      } else {
        driver.live_status = "1";
        driver.save(function (err) {

        });
      }
    }
  );
};

/* fare calculation based on distance */
totalFare = function (c, distbycat, maxdistancecab) {
  let categoryId = c._id;
  let maxdistancepercab = parseFloat(maxdistancecab);
  let distancebykm = parseFloat(distbycat[categoryId]).toFixed(2);
  let categorybase = parseFloat(c.baseprice);
  let categoryunit = parseFloat(c.unitprice);
  let totalfare, unitfare, unitdistance;
  if (distancebykm > maxdistancepercab) {
    unitdistance = Math.abs(distancebykm - maxdistancepercab);
    unitfare = parseFloat(categoryunit * unitdistance);
    basefare = parseFloat(categorybase);
    totalfare = parseFloat(unitfare + basefare).toFixed(2);
  } else {
    totalfare = parseFloat(categorybase).toFixed(2);
  }
  return totalfare;
};

/* Pushnotify */
driverNotify = function (driverIds, message, data) {
  DriverDevices.find({
    device_type: "0"
  })
    .where("user_id")
    .in(driverIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        sendnotifications.push(rec.device_token);
      });
      fireBaseDriver(sendnotifications, message, data);
    });
  /** ios pushnotifications */
  DriverDevices.find({
    device_type: "1"
  })
    .where("user_id")
    .in(driverIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        sendnotifications.push(rec.device_token);
      });
      fireBaseAndroidDriver(sendnotifications, message, data);
    });
};

/* Pushnotify */
userNotify = function (userIds, message, data) {
  UserDevices.find({
    device_type: "0"
  })
    .where("user_id")
    .in(userIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        sendnotifications.push(rec.device_token);
      });
      fireBase(sendnotifications, message, data);
    });

  /** ios pushnotifications */
  UserDevices.find({
    device_type: "1"
  })
    .where("user_id")
    .in(userIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        sendnotifications.push(rec.device_token);
      });
      fireBaseAndroid(sendnotifications, message, data);
    });

  /** web pushnotifications */
  WebUsers.find()
    .where("user_id")
    .in(userIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        sendnotifications.push(rec.device_token);
      });
      fireBaseWeb(sendnotifications, message, data);
    });
};

userNotification = function (userIds, message, data) {
  UserDevices.find().where("user_id").in(userIds).sort({ notified_at: -1 }).limit(1).exec(function (err, records) {
    let deviceTokens = [];
    let voipTokens = [];
    let devicePlatfoms = [];
    if (records.length > 0) {
      records.forEach(function (rec) {
        deviceTokens.push(rec.device_token);
        voipTokens.push(rec.voip_token);
        devicePlatfoms.push(rec.device_type);
      });

      if (devicePlatfoms.indexOf("0") >= 0) {
        iOSUser(voipTokens, data);
      } else {
        fireBaseAndroid(deviceTokens, message, data);
      }
    }
  });
};

driverNotification = function (userIds, message, data) {
  DriverDevices.find().where("user_id").in(userIds).sort({ notified_at: -1 }).limit(1).exec(function (err, records) {
    let deviceTokens = [];
    let devicePlatfoms = [];
    let voipTokens = [];
    if (records.length > 0) {
      records.forEach(function (rec) {
        deviceTokens.push(rec.device_token);
        devicePlatfoms.push(rec.device_type);
        voipTokens.push(rec.voip_token);
      });

      if (devicePlatfoms.indexOf("0") >= 0) {
        iOSDriver(voipTokens, data);
      } else {
        fireBaseAndroidDriver(deviceTokens, message, data);
      }
    }
  });
};

iOSUser = function (devicetoken, message_data) {
  let options = {};
  options.cert = fs.readFileSync("/home/cabso2.0.1/cabso_v2.0.1/server/voip/ck_rider.pem");
  options.key = fs.readFileSync("/home/cabso2.0.1/cabso_v2.0.1/server/voip/ck_rider.pem");
  options.passphrase = "CabsoRider";
  // options.production = false;
  options.production = true;
  let apnProvider = new apn.Provider(options);
  let notification = new apn.Notification();
  notification.payload = message_data;
  notification.badge = 1;
  notification.alert = message_data.message;
  apnProvider.send(notification, devicetoken).then(result => {
    console.log("iOS Pushnotification log" + JSON.stringify(result));
  });
};

iOSDriver = function (devicetoken, message_data) {
  let options = {};
  options.cert = fs.readFileSync("/home/cabso2.0.1/cabso_v2.0.1/server/voip/ck_driver.pem");
  options.key = fs.readFileSync("/home/cabso2.0.1/cabso_v2.0.1/server/voip/ck_driver.pem");
  options.passphrase = "CabsoDriver";
  // options.production = false;
  options.production = true;
  let apnProvider = new apn.Provider(options);
  let notification = new apn.Notification();
  notification.payload = message_data;
  notification.badge = 1;
  notification.alert = message_data.message;
  apnProvider.send(notification, devicetoken).then(result => {
    console.log("iOS Pushnotification log" + JSON.stringify(result));
  });
};


/* notify nearby  drivers*/
nearBy = function (driverIds, rideId) {
  Rides.findOne({
    _id: rideId
  }).exec(function (err, rides) {
    if (!err) {
      let message = "New Ride available";
      let translatedstring = "";

      DriverDevices.find({
        device_type: "0"
      })
        .where("user_id")
        .in(driverIds)
        .exec(function (err, records) {
          let sendnotifications = [];
          records.forEach(function (rec) {
            //   sendnotifications.push(rec.device_token);

            let lang = rec.lang_type;
            let data = {
              ride_id: rideId,
              pickup_location: rides.pickup_location,
              pickup_lat: rides.pickup_lat,
              pickup_lng: rides.pickup_lng,
              drop_location: rides.drop_location,
              drop_lat: rides.drop_lat,
              drop_lng: rides.drop_lng,
              message: translationServer.langTranslate("NewRideavailable", lang),
              type: "nearby"
            };
            translatedstring = translationServer.langTranslate("NewRideavailable", lang);

            fireBaseDriver([rec.device_token], translatedstring, data);
          });



        });
      /** ios pushnotifications */
      DriverDevices.find({
        device_type: "1"
      })
        .where("user_id")
        .in(driverIds)
        .exec(function (err, records) {
          let sendnotifications = [];
          records.forEach(function (rec) {
            let lang = rec.lang_type;
            let data = {
              ride_id: rideId,
              pickup_location: rides.pickup_location,
              pickup_lat: rides.pickup_lat,
              pickup_lng: rides.pickup_lng,
              drop_location: rides.drop_location,
              drop_lat: rides.drop_lat,
              drop_lng: rides.drop_lng,
              message: translationServer.langTranslate("NewRideavailable", lang),
              type: "nearby"
            };
            translatedstring = translationServer.langTranslate("NewRideavailable", lang);

            fireBaseAndroidDriver([rec.device_token], translatedstring, data);


          });

        });
      Rides.findOneAndUpdate(
        {
          _id: rideId
        },
        {
          $set: {
            notify: 1
          }
        }
      ).exec(function (err, rides) {
        if (err) {
          senderr(res);
        } else {
          //console.log("notifications updated to nearby drivers");
        }
      });
    }
  });
};

/* notify nearby  drivers*/
schedulenearBy = function (driverIds, rides) {
  let message = "New Ride available";
  let translatedstring = "";

  /** android pushnotifications */
  DriverDevices.find({
    device_type: "0"
  })
    .where("user_id")
    .in(driverIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        //    sendnotifications.push(rec.device_token);
        let lang = rec.lang_type;
        let data = {
          ride_id: rides._id,
          pickup_location: rides.pickup_location,
          pickup_lat: rides.pickup_lat,
          pickup_lng: rides.pickup_lng,
          drop_location: rides.drop_location,
          drop_lat: rides.drop_lat,
          drop_lng: rides.drop_lng,
          message: translationServer.langTranslate("NewRideavailable", lang),
          type: "nearby"
        };
        translatedstring = translationServer.langTranslate("NewRideavailable", lang);

        fireBaseDriver([rec.device_token], translatedstring, data);


      });
      //   fireBaseDriver(sendnotifications, message, data);
    });
  /** ios pushnotifications */
  DriverDevices.find({
    device_type: "1"
  })
    .where("user_id")
    .in(driverIds)
    .exec(function (err, records) {
      let sendnotifications = [];
      records.forEach(function (rec) {
        //   sendnotifications.push(rec.device_token);
        let lang = rec.lang_type;
        let data = {
          ride_id: rides._id,
          pickup_location: rides.pickup_location,
          pickup_lat: rides.pickup_lat,
          pickup_lng: rides.pickup_lng,
          drop_location: rides.drop_location,
          drop_lat: rides.drop_lat,
          drop_lng: rides.drop_lng,
          message: translationServer.langTranslate("NewRideavailable", lang),
          type: "nearby"
        };
        translatedstring = translationServer.langTranslate("NewRideavailable", lang);
        fireBaseAndroidDriver([rec.device_token], translatedstring, data);
      });
      //  fireBaseAndroidDriver(sendnotifications, message, data);
    });
  Rides.findOneAndUpdate(
    {
      _id: rides._id
    },
    {
      $set: {
        notify: 1,
        ridestatus: "scheduleridenotaccepted"
      }
    }
  ).exec(function (err, rides) {
    if (err) {
      senderr(res);
    } else {
      //console.log("notifications updated to nearby drivers");
    }
  });
};

/* send user notifications */
notifyTo = function (notifications) {
  notifications.notified_at = timeZone();
  let newNotifications = new Notifications(notifications);
  newNotifications.save();
};

/* firebase ios cloud messaging */
fireBase = function (devicetokens, messagetext, data) {
  Admin.findOne(function (err, admin) {
    pushService
      .sendNotification({
        tokens: devicetokens,
        message: messagetext,
        data: data,
        mobile: true,
        siteName: admin && admin.siteName
      })
      .catch(function (_error) {});
  });
};

/* firebase android cloud messaging */
fireBaseAndroid = function (devicetokens, messagetext, data) {
  Admin.findOne(function (err, admin) {
    pushService
      .sendNotification({
        tokens: devicetokens,
        message: messagetext,
        data: data,
        mobile: true,
        siteName: admin && admin.siteName
      })
      .catch(function (_error) {});
  });
};

/* firebase web cloud messaging */
fireBaseWeb = function (devicetokens, messagetext, data) {
  Admin.findOne(function (err, admin) {
    pushService
      .sendNotification({
        tokens: devicetokens,
        title: admin && admin.siteName,
        message: data && data.message ? data.message : messagetext,
        data: data,
        web: true,
        siteName: admin && admin.siteName,
        icon: config.baseUrl + "/favicon.png"
      })
      .catch(function (_error) {});
  });
};

/* jwt authentication  */
getToken = function (headers) {
  if (headers && headers.authorization) {
    return headers.authorization;
  } else {
    return null;
  }
};

/* error handlers */
senderr = function (res) {
  return res.json({
    status: "false",
    message: "Something went to be wrong"
  });
};

/* firebase ios cloud messaging */
fireBaseDriver = function (devicetokens, messagetext, data) {
  Admin.findOne(function (err, admin) {
    pushService
      .sendNotification({
        tokens: devicetokens,
        message: messagetext,
        data: data,
        mobile: true,
        siteName: admin && admin.siteName
      })
      .catch(function (_error) {});
  });
};

/* firebase android cloud messaging */
fireBaseAndroidDriver = function (devicetokens, messagetext, data) {
  Admin.findOne(function (err, admin) {
    pushService
      .sendNotification({
        tokens: devicetokens,
        message: messagetext,
        data: data,
        mobile: true,
        siteName: admin && admin.siteName
      })
      .catch(function (_error) {});
  });
};

/* time based on your region */
timeZone = function () {
  let selectedDate = new Date();
  selectedDate.setHours(selectedDate.getHours() + 5);
  selectedDate.setMinutes(selectedDate.getMinutes() + 30);
  let currentDate = selectedDate;
  let currentTime = currentDate.getTime();
  let localOffset = -1 * selectedDate.getTimezoneOffset() * 60000;
  let timestamp = Math.round(new Date(currentTime + localOffset).getTime() / 1000);
  return timestamp;
};

/* schedule time based on your region */
scheduletimeZone = function () {
  /*let selectedDate = new Date();
    selectedDate.setHours(selectedDate.getHours() + 5);
    selectedDate.setMinutes(selectedDate.getMinutes() + 40);
    let currentDate = selectedDate;
    let currentTime = currentDate.getTime();
    let localOffset = (-1) * selectedDate.getTimezoneOffset() * 60000;*/
  let timestamp = moment(new Date())
    .add(10, "minutes")
    .toISOString();
  return timestamp;
};

module.exports = router;
