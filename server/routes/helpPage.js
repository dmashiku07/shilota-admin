var express = require('express');
var app = express();
var router = express.Router();

// Require Item model in our routes module
var Page = require('../models/helppage');
var User = require('../models/admin');

router.route('/').get(function (req, res) {
  Page.find({ type: 'driver' }).sort({ $natural: -1 })
    .exec(function (err, page) {
      if (err) {
        return res.json({ error: true, msg: "Unable to load records from database" });
      }
      else {
        res.json(page);
      }

    });
});

router.route('/viewUser').get(function (req, res) {
  Page.find({ type: 'user' }).sort({ $natural: -1 })
    .exec(function (err, page) {
      if (err) {
        return res.json({ error: true, msg: "Unable to load records from database" });
      }
      else {
        res.json(page);
      }

    });
});

router.route('/getpage').get(function (req, res) {
  Page.find({ limit: 1 }, function (err, page) {
    if (err) {
      // console.log(err);
    }
    else {
      res.json(page);
    }
  });
});

router.route('/add').post(function (req, res) {
  var page = new Page(req.body);
  if (page.pagetype == "PrivacyPolicy") {
    Page.find({ $and: [{ pagetype: page.pagetype }, { type: "driver" }] },
      function (err, page) {
        if (page.length) {
          return res.json({ error: true, msg: "Privacy Policy already exists" });
        } else {
          var page = new Page(req.body);
          page.title = page.title;
          page.content = page.content;
          page.pagetype = page.pagetype;
          page.status = page.status;
          page.type = page.type;
          page.save()
            .then(item => {
              return res.json({ success: true, msg: 'Help Page saved Successfully' });
            })
            .catch(err => {
              return res.json({ error: true, msg: "Help Page Not saved" });
            });
        }
      });
  }
  else if (page.pagetype == "Terms") {
    Page.find({ $and: [{ pagetype: page.pagetype }, { type: "driver" }] }, function (err, page) {
      if (page.length) {
        return res.json({ error: true, msg: "Terms & conditions already exists" });
      } else {
        var page = new Page(req.body);
        page.title = page.title;
        page.content = page.content;
        page.pagetype = page.pagetype;
        page.status = page.status;
        page.type = page.type;
        page.save()
          .then(item => {
            return res.json({ success: true, msg: 'Help Page saved Successfully' });
          })
          .catch(err => {
            return res.json({ error: true, msg: "Help Page Not saved" });
          });
      }
    });
  } else if (page.pagetype == "vehicleInspection") {
    Page.find({ $and: [{ pagetype: page.pagetype }, { type: "driver" }] }, function (err, page) {
      if (page.length) {
        return res.json({ error: true, msg: "Vehicle Inspection already exists" });
      } else {
        var page = new Page(req.body);
        page.title = page.title;
        page.content = page.content;
        page.pagetype = page.pagetype;
        page.status = page.status;
        page.type = page.type;
        page.save()
          .then(item => {
            return res.json({ success: true, msg: 'Help Page saved Successfully' });
          })
          .catch(err => {
            return res.json({ error: true, msg: "Help Page Not saved" });
          });
      }
    });
  } else if (page.pagetype == "securityDeposit") {
    Page.find({ $and: [{ pagetype: page.pagetype }, { type: "driver" }] }, function (err, page) {
      if (page.length) {
        return res.json({ error: true, msg: "Security Deposit already exists" });
      } else {
        var page = new Page(req.body);
        page.title = page.title;
        page.content = page.content;
        page.pagetype = page.pagetype;
        page.status = page.status;
        page.type = page.type;
        page.save()
          .then(item => {
            return res.json({ success: true, msg: 'Help Page saved Successfully' });
          })
          .catch(err => {
            return res.json({ error: true, msg: "Help Page Not saved" });
          });
      }
    });
  } else {
    var page = new Page(req.body);
    page.title = page.title;
    page.content = page.content;
    page.pagetype = page.pagetype;
    page.status = page.status;
    page.type = page.type;
    page.save()
      .then(item => {
        return res.json({ success: true, msg: 'Help Page saved Successfully' });
      })
      .catch(err => {
        return res.json({ error: true, msg: "Help Page Not saved" });
      });
  }
})

router.route('/addUser').post(function (req, res) {
  var page = new Page(req.body);
  if (page.pagetype == "PrivacyPolicy") {
    Page.find({ $and: [{ pagetype: page.pagetype }, { type: "user" }] },
      function (err, page) {
        if (page.length) {
          return res.json({ error: true, msg: "Privacy Policy already exists" });
        } else {
          var page = new Page(req.body);
          page.title = page.title;
          page.content = page.content;
          page.pagetype = page.pagetype;
          page.status = page.status;
          page.type = page.type;
          page.save()
            .then(item => {
              return res.json({ success: true, msg: 'Help Page saved Successfully' });
            })
            .catch(err => {
              return res.json({ error: true, msg: "Help Page Not saved" });
            });
        }
      });
  }
  else if (page.pagetype == "Terms") {
    Page.find({ $and: [{ pagetype: page.pagetype }, { type: "user" }] }, function (err, page) {
      if (page.length) {
        return res.json({ error: true, msg: "Terms & conditions already exists" });
      } else {
        var page = new Page(req.body);
        page.title = page.title;
        page.content = page.content;
        page.pagetype = page.pagetype;
        page.status = page.status;
        page.type = page.type;
        page.save()
          .then(item => {
            return res.json({ success: true, msg: 'Help Page saved Successfully' });
          })
          .catch(err => {
            return res.json({ error: true, msg: "Help Page Not saved" });
          });
      }
    });
  } else {
    var page = new Page(req.body);
    page.title = page.title;
    page.content = page.content;
    page.pagetype = page.pagetype;
    page.status = page.status;
    page.type = page.type;
    page.save()
      .then(item => {
        return res.json({ success: true, msg: 'Help Page saved Successfully' });
      })
      .catch(err => {
        return res.json({ error: true, msg: "Help Page Not saved" });
      });
  }
})

// router.route('/add').post(function (req, res) {
//   var page = new Page(req.body);
//     Page.find({pagetype :page.pagetype}, function(err, page) {   
//     if (pagetype=="PrivacyPolicy"){  
//       var page = new Page(req.body); 
//     page.title = page.title;
//     page.content = page.content;
//     page.pagetype=page.pagetype;
//     page.status=page.status;
//     page.save()
//     .then(item => {
//       return res.json({success: true, msg: 'Help Page saved Successfully'});      
//     })
//     .catch(err => {
//       return res.json({success: false, msg: "Help Page Not saved"});
//     });

//     }
//    else {
//        return res.json({success: false, msg: 'Page Type already exists'});   
//    }
//  });

//});

router.route('/delete/:id').get(function (req, res) {
  Page.findByIdAndRemove({ _id: req.params.id }, function (err, page) {
    if (err) res.json(err);
    else
      return res.json({ success: true, msg: 'Removed Successfully' });

  });
});

router.route('/terms').get(function (req, res) {
  Page.find({ $and: [{ pagetype: "Terms" }, { type: "user" }] }, function (err, page) {
    if (err) res.json(err);
    else
      res.json(page);
  });
});

router.route('/privacy').get(function (req, res) {
  Page.find({ $and: [{ pagetype: "PrivacyPolicy" }, { type: "user" }] }, function (err, page) {
    if (err) res.json(err);
    else
      res.json(page);
  });
});

router.route('/userHelp').get(function (req, res) {
  Page.find({ $and: [{ pagetype: "others" }, { type: "user" }] }, function (err, page) {
    if (err) res.json(err);
    else
      res.json(page);
  });
});

router.route('/termsDriver').get(function (req, res) {
  Page.find({ $and: [{ pagetype: "Terms" }, { type: "driver" }] }, function (err, page) {
    if (err) res.json(err);
    else
      res.json(page);
  });
});

router.route('/privacyDriver').get(function (req, res) {
  Page.find({ $and: [{ pagetype: "PrivacyPolicy" }, { type: "driver" }] }, function (err, page) {
    if (err) res.json(err);
    else
      res.json(page);
  });
});

router.route('/driverHelp').get(function (req, res) {
  Page.find({ $and: [{ pagetype: "others" }, { type: "driver" }] }, function (err, page) {
    if (err) res.json(err);
    else
      res.json(page);
  });
});

router.route('/securityDriver').get(function (req, res) {
  Page.find({ $and: [{ pagetype: "securityDeposit" }, { type: "driver" }] }, function (err, page) {
    if (err) res.json(err);
    else
      res.json(page);
  });
});

router.route('/inspectionDriver').get(function (req, res) {
  Page.find({ $and: [{ pagetype: "vehicleInspection" }, { type: "driver" }] }, function (err, page) {
    if (err) res.json(err);
    else
      res.json(page);
  });
});

router.route('/social').get(function (req, res) {
  User.findOne({ name: "admin" }, function (err, page) {
    res.json(page);
  });
});

router.route('/edit/:id').get(function (req, res) {
  var id = req.params.id.split('-').join(' ');
  Page.findOne({ title: { $regex: ".*" + id + ".*" } }, function (err, page) {
    res.json(page);
  });
});

router.route('/editdriverpage/:id').get(function (req, res) {
  Page.findById(req.params.id,function (err, page) {
    res.json(page);
  });
});

router.route('/update/:id').post(function (req, res) {
  Page.findById(req.params.id, function (err, page) {
    if (!page)
      return next(new Error('Could not load Document'));
    else {
      page.title = req.body.title;
      page.content = req.body.content;

      page.save().then(page => {
        return res.json({ success: true, msg: 'Help page updated successfully' });
      })
        .catch(err => {
          return res.json({ error: true, msg: 'Help page not updated' });
        });
    }
  });
});

router.route('/driverHelpCount').get(function (req, res) {
  Page.count({ type: "driver" }, function (err, page) {
    if (err) res.json(err);
    else
      res.json(page);
  });
});

router.route('/userHelpCount').get(function (req, res) {
  Page.count({ type: "user" }, function (err, page) {
    if (err) res.json(err);
    else
      res.json(page);
  });
});

router.route('/getDriverHelppage').get(function (req, res) {
  Page.find({ type: "driver" }).limit(1)
    .exec(function (err, page) {
      if (err) {
        return res.json({ error: true, msg: "Unable to load records from database" });
      }
      else {
        res.json(page);
      }

    });
});

module.exports = router;