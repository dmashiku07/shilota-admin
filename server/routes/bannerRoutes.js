var express = require('express');
var app = express();
var router = express.Router();
var multer = require('multer');
var path = require('path')
var Banner = require('../models/bannerSchema');
var fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './src/assets/banner/');
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now());
  }
});

var upload = multer({ storage: storage });



router.post('/add', upload.single('image'), function (req, res, next) {
  var banner = new Banner(req.body);
  banner.title=banner.title;
  banner.image=req.file.filename;
  banner.status=1;
  banner.type=banner.type;
  banner.save()
    .then(item => {
      return res.json({success: true, msg: 'Banner added successfully'});     
    })
    .catch(err => {
      return res.json({error: true, msg: 'Banner Type Exists'});     
    });
});

router.route('/').get(function (req, res) {
  Banner.find(function (err, banner){
  if(err){
    // console.log(err);
  }
  else {
   res.json(banner);
  }
});
});


router.route('/count').get(function (req, res) {
  Banner.count({},
    function(err, BannerCount) {
        if (err) {
          return res.json({error: true, msg:  "Banner Image not exists"});   
        } else {
            var data = {};
            data.count = BannerCount;
            res.json(data);
        }
    });
});

router.route('/userCount').get(function (req, res) {
  Banner.count({ type: "User"},
    function(err, BannerCount) {
        if (err) {
          return res.json({error: true, msg: "Banner Image not exists"});   
        } else {
            var data = {};
            data.count = BannerCount;
            res.json(data);
        }
    });
});


router.route('/driverCount').get(function (req, res) {
  Banner.count({ type: "Driver"},
    function(err, BannerCount) {
        if (err) {
          return res.json({error: true, msg: "Banner Image not exists"});   
        } else {
            var data = {};
            data.count = BannerCount;
            res.json(data);
        }
    });
});


router.route('/edit/:id').get(function (req, res) {
  var id = req.params.id;
  Banner.findById(id, function (err, banner){
      res.json(banner);
  });
});


router.route('/update/:id').post(function (req, res) {
  Banner.findById(req.params.id, function(err, banner) {
   if (!banner)
     return next(new Error('Could not load Document'));
   else {
    banner.title = req.body.title;
    banner.save().then(banner => {
       return res.json({success: true, msg: 'Banner updated successfully'});      
     })
     .catch(err => {
        return res.json({error: true, msg: 'Banner not updated'});  
     });
   }
 });
});




 router.post('/updateImage/:id', upload.single('image'), function (req, res, next) {
  Banner.findById(req.params.id, function(err, banner) {

     if (!banner)
     return res.json({error: true, msg: 'Could not load document'});  
    else {
        var image = banner.image;
      fs.unlink('./src/assets/banner/'+image, (err) => {
        if (err) throw err;
       });

       banner.title = req.body.title;
       banner.image= req.file.filename;
       banner.save().then(banner => {
        return res.json({success: true, msg: 'Banner Updated Successfully'});  
      })
      .catch(err => {
        return res.json({error: true, msg: 'Banner not updated'});  
      });
    }
  });
 });


 router.route('/user').get(function (req, res) {
  Banner.findOne({type:"User"}, function (err, banner){
      res.json(banner);
  });
});


router.route('/driver').get(function (req, res) {
  Banner.findOne({type:"Driver"}, function (err, banner){
      res.json(banner);
  });
});

router.route('/delete/:id').get(function (req, res) {
  Banner.findByIdAndRemove({_id: req.params.id}, function(err, banner){
       if(err) res.json({error: true, msg: "Banner not deleted"}); 
       else 
       return res.json({success: true, msg: 'Removed Successfully'});      

   });
});




module.exports = router;