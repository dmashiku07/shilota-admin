var express = require("express");
var app = express();
var router = express.Router();

// Require Item model in our routes module
var Faq = require("../models/faqSchema");

router.route("/").get(function(req, res) {
  Faq.find(function(err, faq) {
    if (err) {
      return res.json({ error: true, msg: "Could not load Document" });
    } else {
      res.json(faq);
    }
  });
});

router.route("/add").post(function(req, res) {
  var faq = new Faq(req.body);
  faq
    .save()
    .then(item => {
      return res.json({ success: true, msg: "FAQ added successfully" });
    })
    .catch(err => {
      return res.json({ error: true, msg: "FAQ title already exists" });
    });
});

// Defined edit route
router.route("/edit/:id").get(function(req, res) {
  let id = req.params.id.split("-").join(" ");
  Faq.findOne({ title: { $regex: ".*" + id + ".*" } }, function(err, faq) {
    res.json(faq);
  });
});

router.route("/editfaq/:id").get(function(req, res) {
  Faq.findById(req.params.id, function(err, faq) {
    res.json(faq);
  });
});

router.route("/update/:id").post(function(req, res) {
  Faq.findById(req.params.id, function(err, faq) {
    if (!faq) return next(new Error("Could not load Document"));
    else {
      faq.title = req.body.title;
      faq.content = req.body.content;
      faq
        .save()
        .then(faq => {
          return res.json({ success: true, msg: "FAQ updated successfully" });
        })
        .catch(err => {
          return res.json({ error: true, msg: "FAQ title already exists" });
        });
    }
  });
});

// Defined delete | remove | destroy route
router.route("/delete/:id").get(function(req, res) {
  Faq.findByIdAndRemove({ _id: req.params.id }, function(err, faq) {
    if (err) res.json({ error: true, msg: err });
    else return res.json({ success: true, msg: "Removed Successfully" });
  });
});

router.route("/faqCount").get(function(req, res) {
  Faq.count(function(err, faq) {
    if (err) {
      return res.json({ error: true, msg: "Could not load Document" });
    } else {
      res.json(faq);
    }
  });
});

module.exports = router;
