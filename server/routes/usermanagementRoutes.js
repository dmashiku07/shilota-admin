var express = require("express");
var app = express();
var router = express.Router();
var User = require("../schema/user");
const UserDevices = require("../schema/userdevices");
const WebUsers = require("../schema/webusers");
const DriverDevices = require("../schema/driverdevices");
const Notifications = require("../schema/notification");
const Admin = require("../models/admin");
const config = require("../config");
const pushService = require("../services/pushService");
const {
  buildPaginationResult,
  buildSearchQuery,
  buildSort,
  getPaginationParams,
  mergeMatch
} = require("../utils/pagination");

// router.route('/').get(function (req, res) {
//     User.find(function (err, user){
//      if(err){
//       return res.json({error: true, msg: err});
//      }
//      else {
//        res.json(user);
//      }
//    });
//  });

router.route("/").get(async function(req, res) {
  try {
    const params = getPaginationParams(req, {
      defaultSortBy: "_id",
      allowedSortFields: ["_id", "full_name", "email", "phone_number"]
    });
    const match = mergeMatch(
      { deletion_status: 0 },
      buildSearchQuery(params.search, ["full_name", "email", "phone_number"])
    );

    const totalItems = await User.countDocuments(match).exec();
    const users = await User.find(match)
      .sort(buildSort(params.sortBy, params.sortDir))
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .exec();

    return res.json(buildPaginationResult(users, totalItems, params));
  } catch (_error) {
    return res.json({
      error: true,
      msg: "Unable to load records from database"
    });
  }
});

router.route("/latestUser").get(function(req, res) {
  User.find()
    .sort({ $natural: -1 })
    .limit(10)
    .exec(function(err, user) {
      if (err) {
        return res.json({
          error: true,
          msg: "Unable to load records from database"
        });
      } else {
        res.json(user);
      }
    });
});

router.route("/deactive/:id").post(function(req, res) {
  User.findById(req.params.id, function(err, user) {
    if (!user) return next(new Error("Could not load Document"));
    else {
      user.active = 0;
      user
        .save()
        .then(user => {
          return res.json({
            success: true,
            msg: "User Deactivated Successfully"
          });
        })
        .catch(err => {
          return res.json({ error: true, msg: "Error with Deactivation" });
        });
    }
  });
});

router.route("/active/:id").post(function(req, res) {
  User.findById(req.params.id, function(err, user) {
    if (!user) return next(new Error("Could not load Document"));
    else {
      user.active = 1;
      user
        .save()
        .then(user => {
          return res.json({
            success: true,
            msg: "User Activated Successfully"
          });
        })
        .catch(err => {
          return res.json({ error: true, msg: "Error with activation" });
        });
    }
  });
});

router.route("/info/:id").get(function(req, res) {
  User.findById(req.params.id, function(err, user) {
    res.json(user);
  });
});

router.route("/userCount").get(function(req, res) {
  User.count({"deletion_status" : 0},function(err, count) {
    if (err) return res.json({ error: true, msg: "User not exists" });
    res.json(count);
  });
});

router.route("/iosUser").get(function(req, res) {
  UserDevices.count({ device_type: 0 }).exec(function(err, user) {
    if (err) {
      return res.json({
        error: true,
        msg: "Unable to load records from database"
      });
    } else {
      res.json(user);
    }
  });
});

router.route("/andoridUser").get(function(req, res) {
  UserDevices.count({ device_type: 1 }).exec(function(err, user) {
    if (err) {
      return res.json({
        error: true,
        msg: "Unable to load records from database"
      });
    } else {
      res.json(user);
    }
  });
});

router.route("/webUser").get(function(req, res) {
  WebUsers.count().exec(function(err, user) {
    if (err) {
      return res.json({
        error: true,
        msg: "Unable to load records from database"
      });
    } else {
      res.json(user);
    }
  });
});

router.route("/deletedusers").get(async function (req, res) {
  try {
    const params = getPaginationParams(req, {
      defaultSortBy: "_id",
      allowedSortFields: ["_id", "full_name", "email", "phone_number"]
    });
    const match = mergeMatch(
      { deletion_status: 1 },
      buildSearchQuery(params.search, ["full_name", "email", "phone_number"])
    );

    const totalItems = await User.countDocuments(match).exec();
    const users = await User.find(match)
      .sort(buildSort(params.sortBy, params.sortDir))
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .exec();

    return res.json(buildPaginationResult(users, totalItems, params));
  } catch (_error) {
    return res.json({
      error: true,
      msg: "Unable to load records from database"
    });
  }
});

router.route('/revokedeletion/:id').post(function (req, res) {
  User.findById(req.params.id, function (err, user) {
    if (!user)
      return next(new Error('Could not load Document'));
    else {
      user.deletion_status = 0;
      user.save().then(user => {
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

router.route("/pushNotify").post(function(req, res) {

  //  return res.json({
  //       error: true,
  //       msg: "This option won't work for Demo purpose"
  // });

  if (req.body.user == 0) {
    UserDevices.find({ device_type: "0" }).exec(function(err, records) {
      var isendnotifications = [];
      var iosids = [];
      var message = req.body.message;
      let data = { type: "admin", message: message };
      records.forEach(function(rec) {
        isendnotifications.push(rec.device_token);
        if (iosids.indexOf(rec.user_id) == -1) {
          iosids.push(rec.user_id);
          let notifications = {
            user_id: "0",
            notify_to: rec.user_id,
            title: "Admin",
            message: message
          };
          notifyTodevices(notifications);
        }
      });
      senduserios(isendnotifications, message, data);

      UserDevices.find({ device_type: "1" }).exec(function(err, records) {
        var asendnotifications = [];
        var androidids = [];
        var message = req.body.message;
        let data = { type: "admin", message: message };
        records.forEach(function(rec) {
          asendnotifications.push(rec.device_token);
          if (
            androidids.indexOf(rec.user_id) == -1 &&
            iosids.indexOf(rec.user_id) == -1
          ) {
            androidids.push(rec.user_id);
            let notifications = {
              user_id: "0",
              notify_to: rec.user_id,
              title: "Admin",
              message: message
            };
            notifyTodevices(notifications);
          }
        });
        senduserandroid(asendnotifications, message, data);
      });
    });

    WebUsers.find().exec(function(err, records) {
      let sendnotifications = [];
      records.forEach(function(rec) {
        sendnotifications.push(rec.device_token);
      });
      let data = { type: "admin", message: req.body.message };
      sendwebuserspush(sendnotifications, data.message, data);
    });

  } else if (req.body.user == 1) {
    DriverDevices.find({ device_type: "0" }).exec(function(err, records) {
      var disendnotifications = [];
      var iosids = [];
      var message = req.body.message;
      let data = { type: "admin", message: message };
      records.forEach(function(drecords) {
        disendnotifications.push(drecords.device_token);
        if (iosids.indexOf(drecords.user_id) == -1) {
          iosids.push(drecords.user_id);
          let drivernotifications = {
            user_id: "0",
            notify_to: drecords.user_id,
            title: "Admin",
            message: message
          };
          notifyTodrivers(drivernotifications);
        }
      });

      senddriverios(disendnotifications, message, data);

      DriverDevices.find({ device_type: "1" }).exec(function(err, records) {
        var dasendnotifications = [];
        var androidids = [];
        var message = req.body.message;
        let data = { type: "admin", message: message };
        records.forEach(function(driverrec) {
          dasendnotifications.push(driverrec.device_token);
          if (
            androidids.indexOf(driverrec.user_id) == -1 &&
            iosids.indexOf(driverrec.user_id) == -1
          ) {
            androidids.push(driverrec.user_id);
            let usernotifications = {
              user_id: "0",
              notify_to: driverrec.user_id,
              title: "Admin",
              message: message
            };
            notifyTodrivers(usernotifications);
          }
        });
        senddriverandroid(dasendnotifications, message, data);
      });
    });
  }
});

/* firebase ios cloud messaging */
senduserios = function(devicetokens, messagetext, data) {
  Admin.findOne(function(err, admin) {
    pushService
      .sendNotification({
        tokens: devicetokens,
        message: messagetext,
        data: data,
        mobile: true,
        siteName: admin && admin.siteName
      })
      .catch(function(_error) {});
  });
};

/* firebase android cloud messaging */
senduserandroid = function(devicetokens, messagetext, data) {
  Admin.findOne(function(err, admin) {
    pushService
      .sendNotification({
        tokens: devicetokens,
        message: messagetext,
        data: data,
        mobile: true,
        siteName: admin && admin.siteName
      })
      .catch(function(_error) {});
  });
};

/* firebase ios cloud messaging */
senddriverios = function(devicetokens, messagetext, data) {
  Admin.findOne(function(err, admin) {
    pushService
      .sendNotification({
        tokens: devicetokens,
        message: messagetext,
        data: data,
        mobile: true,
        siteName: admin && admin.siteName
      })
      .catch(function(_error) {});
  });
};

/* firebase android cloud messaging */
senddriverandroid = function(devicetokens, messagetext, data) {
  Admin.findOne(function(err, admin) {
    pushService
      .sendNotification({
        tokens: devicetokens,
        message: messagetext,
        data: data,
        mobile: true,
        siteName: admin && admin.siteName
      })
      .catch(function(_error) {});
  });
};

/* firebase web cloud messaging */
sendwebuserspush = function(devicetokens, messagetext, data) {
  Admin.findOne(function(err, admin) {
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
      .catch(function(_error) {});
  });
};

/* send user notifications */
notifyTodevices = function(notifications) {
  notifications.notified_at = timeZoneadmin();
  let newNotifications = new Notifications(notifications);
  newNotifications.save();
};

/* send user notifications */
notifyTodrivers = function(notifications) {
  notifications.notified_at = timeZoneadmin();
  let newNotifications = new Notifications(notifications);
  newNotifications.save();
};

/* time based on your region */
timeZoneadmin = function() {
  let selectedDate = new Date();
  selectedDate.setHours(selectedDate.getHours() + 5);
  selectedDate.setMinutes(selectedDate.getMinutes() + 30);
  let currentDate = selectedDate;
  let currentTime = currentDate.getTime();
  let localOffset = -1 * selectedDate.getTimezoneOffset() * 60000;
  let timestamp = Math.round(
    new Date(currentTime + localOffset).getTime() / 1000
  );
  return timestamp;
};

module.exports = router;
