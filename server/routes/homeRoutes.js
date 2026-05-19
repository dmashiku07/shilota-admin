
var express = require('express');
var app = express();
var router = express.Router();
var multer = require('multer');
var path = require('path')
var Home = require('../models/homeschema');
var fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './src/assets/uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now());
  }
});

var upload = multer({ storage: storage });




router.post('/upload', upload.single('image'), function (req, res, next) {
  var home = new Home(req.body);
  home.title=home.title;
  home.content=home.content;
  home.image=req.file.filename;
  home.status=1;
  home.type="home";
  home.save()
    .then(item => {
      return res.json({success: true, msg: 'Home Page Content added successfully'});  
    })
    .catch(err => {
      return res.json({error: true, msg: 'unable to save to database'});    
    });
});


router.post('/uploadDriver', upload.single('image'), function (req, res, next) {
  var home = new Home(req.body);
  home.title=home.title;
  home.content=home.content;
  home.image=req.file.filename;
  home.status=1;
  home.type="driver";
  home.save()
    .then(item => {
      return res.json({success: true, msg: 'Driver Page added successfully'});    
    })
    .catch(err => {
      return res.json({error: true, msg: 'unable to save to database'});    
    });
});



// Defined store route
router.route('/add').post(function (req, res) {
  var home = new Home(req.body);
  home.save()
    .then(item => {
     return res.json({success: true, msg: 'Content added successfully'});    
    })
    .catch(err => {
      return res.json({error: true, msg: 'unable to save to database'});    
    });
});


router.route('/').get(function (req, res) {
    Home.find({type:"home"},function (err, page){
    if(err){
      // console.log(err);
    }
    else {
      res.json(page);
    }
  });
});

router.route('/driverhome').get(function (req, res) {
  Home.find({type:"driver"},function (err, page){
  if(err){
    // console.log(err);
  }
  else {
    res.json(page);
  }
});
});


// Defined edit route
router.route('/edit/:id').get(function (req, res) {
  var id = req.params.id;
  Home.findById(id, function (err, page){
      res.json(page);
  });
});

router.route('/update/:id').post(function (req, res) {
  Home.findById(req.params.id, function(err, home) {
   if (!home)
     return next(new Error('Could not load Document'));
   else {
     home.title = req.body.title;
     home.content = req.body.content;
     home.save().then(home => {
      return res.json({success: true, msg: 'Content updated successfully'});      
     })
     .catch(err => {
      return res.json({error: true, msg: err});  
     });
   }
 });
});




 router.post('/updateImage/:id', upload.single('image'), function (req, res, next) {
  Home.findById(req.params.id, function(err, page) {

     if (!page)
      return next(new Error('Could not load Document'));
    else {
        var image = page.image;
      fs.unlink('./src/assets/uploads/'+image, (err) => {
        if (err) throw err;
       });
      page.title = req.body.title;
      page.content = req.body.content;
      page.image= req.file.filename;
      page.save().then(page => {
        return res.json({success: true, msg: 'Content updated successfully'}); 
      })
      .catch(err => {
        return res.json({error: true, msg: 'Content not updated'});  
      });
    }
  });
 });



// Defined delete | remove | destroy route
router.route('/delete/:id').get(function (req, res) {
    Home.findByIdAndRemove({_id: req.params.id}, function(err, page){
      if(err) res.json({error: true, msg: err});    
      else 
      return res.json({success: true, msg: 'Removed Successfully'});    
      });
});

module.exports = router;

