var express = require("express");
var app = express();
var router = express.Router();
var Rides = require("../schema/rides");
var Payments = require("../schema/payments");
var moment = require("moment");
var tomorrow;
var {
  buildPaginationResult,
  buildSort,
  getPaginationParams
} = require("../utils/pagination");

router.route("/rideindetail/:status").get(async function(req, res) {
  let querystring = { ridestatus: req.params.status };
  if (req.params.status === "0") {
    querystring = { ridestatus: { $ne: "" } };
  }
  try {
    let params = getPaginationParams(req, {
      defaultSortBy: "_id",
      allowedSortFields: ["_id", "created_at", "baseprice", "tax", "commissionamount", "ridestatus"]
    });
    let totalItems = await Rides.countDocuments(querystring).exec();
    let rides = await Rides.find(querystring)
      .sort(buildSort(params.sortBy, params.sortDir))
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .populate("category_id")
      .populate("user_id")
      .populate("driver_id")
      .exec();
    return res.json(buildPaginationResult(rides, totalItems, params));
  } catch (_error) {
    return res.json({
      error: true,
      msg: "Unable to load records from database"
    });
  }
});

router.route("/getDriverRide/:id").get(async function(req, res) {
  try {
    let params = getPaginationParams(req, {
      defaultSortBy: "_id",
      allowedSortFields: ["_id", "created_at", "pickup_location", "drop_location", "ridestatus"]
    });
    let match = { driver_id: req.params.id };
    if (req.query.status && req.query.status !== "undefined") {
      match.ridestatus = req.query.status;
    }
    let totalItems = await Rides.countDocuments(match).exec();
    let rides = await Rides.find(match)
      .sort(buildSort(params.sortBy, params.sortDir))
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .exec();
    return res.json(buildPaginationResult(rides, totalItems, params));
  } catch (_error) {
    return res.json({
      error: true,
      msg: "Unable to load records from database"
    });
  }
});

router.route("/getDriverRideCount/:id").get(function(req, res) {
  Rides.count({
    driver_id: req.params.id
  })
    .sort({
      $natural: -1
    })
    .exec(function(err, rides) {
      if (err) {
        return res.json({
          error: true,
          msg: "Unable to load records from database"
        });
      } else {
        res.json(rides);
      }
    });
});

router.route("/info/:id").get(function(req, res) {
  Rides.findById(req.params.id)
    .populate("category_id")
    .populate("user_id")
    .populate("driver_id")
    .exec(function(err, rides) {
      if (err) {
        return res.json({
          error: true,
          msg: "Unable to load records from database"
        });
      } else {
        console.log(rides);
        res.json(rides);
      }
    });
});

router.route("/ridepaymentinfo/:id").get(function(req, res) {
  Payments.findOne({
    onride_id: req.params.id
  }).exec(function(err, payments) {
    if (!payments) {
      res.json({
        status: "false",
        message: "Unable to load records from database"
      });
    } else {
      res.json({
        status: "true",
        result: payments
      });
    }
  });
});

router.route("/Driverinfo/:id").get(function(req, res) {
  Rides.findById({
    user_id: req.params.id
  }).exec(function(err, rides) {
    if (err) {
      return res.json({
        error: true,
        msg: "Unable to load records from database"
      });
    } else {
      res.json(rides);
    }
  });
});

router.route("/totalCount").get(function(req, res) {
  Rides.count(function(err, count) {
    if (err)
      return res.json({
        error: true,
        msg: "Ride not exists"
      });
    res.json(count);
  });
});

router.route("/currentRecords").get(function(req, res) {
  date = new Date();
  Rides.count(
    {
      $where:
        'this.created_at.toJSON().slice(0, 10) == "' +
        date.toJSON().slice(0, 10) +
        '"'
    },
    function(err, rides) {
      if (err)
        return res.json({
          error: true,
          msg: err
        });
      res.json(rides);
    }
  );
});

router.route("/currentMonth").get(function(req, res) {
  date = new Date();
  // console.log(date.getMonth()-1)
  Rides.count(
    {
      $where: 'this.created_at.getMonth() == "' + date.getMonth() + '"'
    },
    function(err, rides) {
      if (err)
        return res.json({
          error: true,
          msg: err
        });
      res.json(rides);
    }
  );
});

router.route("/lastMonth").get(function(req, res) {
  date = new Date();
  // console.log(date.getMonth())
  Rides.find(
    {
      $where: 'this.created_at.getMonth() == "' + date.getMonth() + '"'
    },
    function(err, rides) {
      if (err)
        return res.json({
          error: true,
          msg: err
        });
      res.json(rides);
    }
  );
});

router.route("/latestRide").get(function(req, res) {
  Rides.find()
    .sort({
      $natural: -1
    })
    .limit(10)
    .populate("category_id")
    .populate("user_id")
    .populate("driver_id")
    .exec(function(err, ride) {
      if (err) {
        return res.json({
          error: true,
          msg: "Unable to load records from database"
        });
      } else {
        res.json(ride);
      }
    });
});

router.route("/cancel").get(function(req, res) {
  Rides.count({
    ridestatus: "cancelled"
  }).exec(function(err, rides) {
    if (err) {
      return res.json({
        error: true,
        msg: "Unable to load records from database"
      });
    } else {
      res.json(rides);
    }
  });
});

router.route("/completed").get(function(req, res) {
  Rides.count({
    ridestatus: "completed"
  }).exec(function(err, rides) {
    if (err) {
      return res.json({
        error: true,
        msg: "Unable to load records from database"
      });
    } else {
      res.json(rides);
    }
  });
});

router.route("/rideCounts").get(function(req, res) {
  Rides.count({
    ridestatus: "completed"
  }).exec(function(err, completedcount) {
    if (!err) {
      Rides.count({
        $or: [
          {
            ridestatus: "cancelled"
          },
          {
            ridestatus: "scheduleridenotaccepted"
          },
          {
            ridestatus: "ridenotaccepted"
          }
        ]
      }).exec(function(err, incompletedcount) {
        if (!err) {
          Rides.count({
            $or: [
              {
                ridestatus: "scheduled"
              }
            ]
          }).exec(function(err, scheduledcount) {
            if (!err) {
              res.json({
                status: "true",
                success_rides: completedcount,
                unsuccess_rides: incompletedcount,
                schedule_rides: scheduledcount
              });
            }else{
              return res.json({
                error: true,
                msg: "Unable to load records from database"
              });
            }
          });
        }
        else{
          return res.json({
            error: true,
            msg: "Unable to load records from database"
          });
        }
      });
    }else{
      return res.json({
        error: true,
        msg: "Unable to load records from database"
      });
    }
  });
});

router.route("/ontheway").get(function(req, res) {
  Rides.count({
    ridestatus: "ontheway"
  }).exec(function(err, rides) {
    if (err) {
      return res.json({
        error: true,
        msg: "Unable to load records from database"
      });
    } else {
      res.json(rides);
    }
  });
});

router.route("/scheduled").get(function(req, res) {
  Rides.count({
    ridestatus: "scheduled"
  }).exec(function(err, rides) {
    if (err) {
      return res.json({
        error: true,
        msg: "Unable to load records from database"
      });
    } else {
      res.json(rides);
    }
  });
});

router.route("/accepted").get(function(req, res) {
  Rides.count({
    ridestatus: "accepted"
  }).exec(function(err, rides) {
    if (err) {
      return res.json({
        error: true,
        msg: "Unable to load records from database"
      });
    } else {
      res.json(rides);
    }
  });
});
router.route("/ridenotaccepted").get(function(req, res) {
  console.log("----------ridenotaccepted--------------");
  Rides.count({
    ridestatus: "ridenotaccepted"
  }).exec(function(err, rides) {
    if (err) {
      return res.json({
        error: true,
        msg: "Unable to load records from database"
      });
    } else {
      res.json(rides);
    }
  });
});

module.exports = router;
