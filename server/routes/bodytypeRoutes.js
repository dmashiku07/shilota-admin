var express = require('express');
var app = express();
var router = express.Router();

// Require Item model in our routes module
var Bodytypes = require('../schema/bodytypes');

router.route('/').get(function (req, res) {
    Bodytypes.find(function (err, type){
     if(err){
      return res.json({error: true, msg: 'Could not load Document'});
     }
     else {
       res.json(type);
     }
   });
 });

 router.route('/add').post(function (req, res) {
  var bodytype = new Bodytypes(req.body);
  bodytype.save()
    .then(item => {
      return res.json({success: true, msg: 'Bodytype added successfully'});      
    })
    .catch(err => {
      return res.json({error: true, msg: "Bodytype name already exists"});
    });
});

router.route('/delete/:id').get(function (req, res) {
  Bodytypes.findByIdAndRemove({_id: req.params.id}, function(err, bodytype){
    if(err) res.json({error: true, msg: err});    
    else 
    return res.json({success: true, msg: 'Removed Successfully'});    
    });
});

router.route('/edit/:id').get(function (req, res) {
  var id = req.params.id;
  Bodytypes.findById(id, function (err, bodytype){
      res.json(bodytype);
  });
});



router.route('/update/:id').post(function (req, res) {
  Bodytypes.findById(req.params.id, function(err, bodytype) {
   if (!bodytype)
     return next(new Error('Could not load Document'));
   else {
    bodytype.name = req.body.name;
    bodytype.save().then(bodytype => {
       return res.json({success: true, msg: 'Bodytype updated successfully'});      
     })
     .catch(err => {
       return res.json({error: true, msg: 'Bodytype name already exists'});   
          
     });
   }
 });
});

module.exports = router;