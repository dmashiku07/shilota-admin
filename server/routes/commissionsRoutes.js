var express = require('express');
var app = express();
var router = express.Router();

// Require Item model in our routes module
var Tax = require('../schema/commissions');


router.route('/').get(function (req, res) {
    Tax.find(function (err, tax){
     if(err){
      return res.json({error: true, msg: 'Could not load Document'});
     }
     else {
       res.json(tax);
     }
   });
 });


 router.route('/add').post(function (req, res) {
  var tax = new Tax(req.body);
  tax.save()
    .then(item => {
      return res.json({success: true, msg: 'Commissions added successfully'});      
    })
    .catch(err => {
      return res.json({error: true, msg: "Commissions not added"});
    });
});

router.route('/edit/:id').get(function (req, res) {
  var id = req.params.id;
  Tax.findById(id, function (err, tax){
      res.json(tax);
  });
});

router.route('/update/:id').post(function (req, res) {
  Tax.findById(req.params.id, function(err, tax) {
    if (!tax)
      return next(new Error('Could not load Document'));
    else {
      tax.price_from = req.body.price_from;
      tax.price_to = req.body.price_to;
      tax.percentage = req.body.percentage;
      tax.save().then(tax => {
        return res.json({success: true, msg: 'Commissions updated successfully'});      
      })
      .catch(err => {
        return res.json({error: true, msg: 'Commissions title already exists'});   
           
      });
    }
  });
});


router.route('/delete/:id').get(function (req, res) {
  Tax.findByIdAndRemove({_id: req.params.id}, function(err, banner){
       if(err) res.json({error: true, msg: "Commissions not deleted"}); 
       else 
       return res.json({success: true, msg: 'Removed Successfully'});      

   });
});

 module.exports = router;