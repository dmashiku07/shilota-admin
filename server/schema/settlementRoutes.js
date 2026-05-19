var express = require('express');
var app = express();
var router = express.Router();
var Payment = require('../schema/payments');
var Settlement = require('../schema/settlement');


router.route('/').get(function (req, res) {
    Settlement.find().sort({$natural:-1}).populate("driver_id")
    .exec(function (err, pay) {
      if(err){
        return res.json({error: true, msg: "Unable to load records from database"});
       }
       else {
         res.json(pay);
       }
  
    }); 
  });

router.route('/add').post(function (req, res) {
    var settlement = new Settlement(req.body);
    settlement.save(function(err, result) {
        if (err) throw err;
        Payment.update({
            driver_id : { $in : result.driver_id }      
          }, {
            $set : { settlement_id : result._id, paid:1 } 
          }, {
            multi : true                    
          }, function(err, paymentResult) {
            if (err) {
                return res.json({error: true, msg: "Error with Payment Updation"});   

            } else {
                return res.json({success: true, msg: 'Payment Updated Successfully'});               }
          });
      });
  });


  router.route('/totalCommission').get(function (req, res) {
    Settlement.aggregate([
    
       {
        "$group": {
          "_id": null,
          commission: { $sum: "$total_commissionAmt" },
        }
    },
]) .exec(function (err, amt) {
      if(err){
        return res.json({error: true, msg: "Unable to load records from database"});
       }
       else {
         res.json(amt);
       }
    }); 
  });



  router.route('/monCommission').get(function (req, res) {
    date = new Date();
    Settlement.aggregate([
    
       {
        "$group": {
          "_id": "$created_at.getDate()",
          commission: { $sum: "$total_commissionAmt" },
        },
       
    },

 

    
]) .exec(function (err, amt) {
      if(err){
        return res.json({error: true, msg: "Unable to load records from database"});
       }
       else {
         res.json(amt);
       }
    }); 
  });
  

module.exports = router;