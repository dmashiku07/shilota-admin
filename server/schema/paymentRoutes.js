var express = require('express');
var app = express();
var router = express.Router();
var Payment = require('../schema/payments');
var Driver = require('../schema/driver');



router.route('/').get(function (req, res) {
    Payment.find().sort({$natural:-1}).populate("user_id").populate("onride_id")
    .exec(function (err, payment) {
      if(err){
        return res.json({error: true, msg: "Unable to load records from database"});
       }
       else {
         res.json(payment);
       }
  
    }); 
  });

  router.route('/info/:id').get(function (req, res) {
    Payment.findById(req.params.id).populate("user_id").populate("onride_id")
    .exec(function (err, payment) {
      if(err){
        return res.json({error: true, msg: "Unable to load records from database"});
       }
       else {
         res.json(payment);
       }
  
    }); 
  });

  
router.route('/totalAmt').get(function (req, res) {
  Payment.aggregate([
  
     {
      "$group": {
        "_id": "$driver_id",
        total_fare: { $sum: "$ride_fare" },
        commission: { $sum: "$commissionamount" },
        tax: { $sum: "$tax" },
        earning: { $sum:{ $add: [ "$ride_fare", "$tax" ] }},
        "driverID": { "$first": "$driver_id" },
        count: { $sum: 1},
        "paid": { "$first": "$paid" },
      }
    },

    {
      $match: {
        paid: {
              $eq: 0
          }
      }


    }
  

  ]) .exec(function (err, payment) {
 
    Driver.populate( payment, { "path": "driverID" }, function(err,results) {
      if(err){
          return res.json({error: true, msg: "Unable to load records from database"});
         }
         else {
           res.json(results);
         }
  });
  }); 
});


router.route('/getRides/:id').get(function (req, res) {
  Payment.find({settlement_id:req.params.id}).populate("onride_id")
  .exec(function (err, result) {
    if(err){
      return res.json({error: true, msg: "Unable to load records from database"});
     }
     else {
       res.json(result);
     }

  }); 
});


  module.exports = router;