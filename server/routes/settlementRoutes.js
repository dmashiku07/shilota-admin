var express = require('express');
var app = express();
var router = express.Router();
var Payment = require('../schema/payments');
var Settlement = require('../schema/settlement');
var {
  buildPaginationResult,
  buildSort,
  getPaginationParams
} = require('../utils/pagination');


router.route('/').get(async function (req, res) {
  try {
    var params = getPaginationParams(req, {
      defaultSortBy: '_id',
      allowedSortFields: ['_id', 'created_at', 'total_commissionAmt', 'total_tax', 'total_earning', 'ride_count']
    });
    var totalItems = await Settlement.countDocuments({}).exec();
    var pay = await Settlement.find()
      .sort(buildSort(params.sortBy, params.sortDir))
      .skip((params.page - 1) * params.pageSize)
      .limit(params.pageSize)
      .populate("driver_id")
      .exec();

    return res.json(buildPaginationResult(pay, totalItems, params));
  } catch (_error) {
    return res.json({
      error: true,
      msg: "Unable to load records from database"
    });
  }
});

router.route('/add').post(function (req, res) {
  var settlement = new Settlement(req.body);

  settlement.save(function (err, result) {
    var criteria = {
      driver_id: result.driver_id,
      paid: 0
    };
    if (err) throw err;
    Payment.update(criteria, {
      $set: {
        settlement_id: result._id,
        paid: 1
      }
    }, {
      multi: true
    }, function (err, paymentResult) {
      if (err) {
        return res.json({
          error: true,
          msg: "Error with Payment Updation"
        });

      } else {
        return res.json({
          success: true,
          msg: 'Payment Updated Successfully'
        });
      }
    });
  });
});


router.route('/totalCommission').get(function (req, res) {
  Settlement.aggregate([{
    "$group": {
      "_id": null,
      commission: {
        $sum: "$total_commissionAmt"
      },
    }
  }, ]).exec(function (err, amt) {
    if (err) {

      return res.json({
        error: true,
        msg: "Unable to load records from database"
      });
    } else {
      let result = amt!= "" ? amt[0].commission : '';
      let revenue = result!= ""  ? result : '0.0';
      res.json(revenue);
    }
  });
});



router.route('/monCommission').get(function (req, res) {
  date = new Date();
  Settlement.aggregate([

    {
      "$group": {
        "_id": "$created_at.getDate()",
        commission: {
          $sum: "$total_commissionAmt"
        },
      },

    },




  ]).exec(function (err, amt) {
    if (err) {
      return res.json({
        error: true,
        msg: "Unable to load records from database"
      });
    } else {
      res.json(amt);
    }
  });
});


module.exports = router;
