let express = require("express");
let app = express();
let router = express.Router();
let multer = require("multer");
let path = require("path");
// Require Item model in our routes module
let Amenities = require("../schema/amenities");
let fs = require("fs");

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, "./src/assets/uploads/");
  },
  filename: function(req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now());
  }
});

let amenitiesStorage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, "./src/assets/uploads/");
  },
  filename: function(req, file, cb) {
    let imagename = req.body.name.replace(" ", "");
    cb(null, imagename);
  }
});

let upload = multer({ storage: storage });

let amenitiesUpload = multer({ storage: amenitiesStorage });

router.route("/").get(function(req, res) {
  Amenities.find(function(err, type) {
    if (err) {
      return res.json({ error: true, msg: err });
    } else {
      res.json(type);
    }
  });
});

router.post("/add", amenitiesUpload.single("image"), function(req, res, next) {
  let amenities = new Amenities(req.body);
  amenities.name = amenities.name;
  amenities.image = req.file.filename.trim();
  amenities
    .save()
    .then(item => {
      return res.json({ success: true, msg: "Amenities added successfully" });
    })
    .catch(err => {
      console.log(err);
      return res.json({ error: true, msg: "Amenities Type Exists" });
    });
});

router.route("/edit/:id").get(function(req, res) {
  let id = req.params.id;
  Amenities.findById(id, function(err, amenities) {
    res.json(amenities);
  });
});

router.post("/update/:id", amenitiesUpload.single("image"), function(req, res, next) {
  Amenities.findById(req.params.id, function(err, amenities) {
    if (!amenities) return next(new Error("Could not load Document"));
    else {
      amenities.name = req.body.name;
      if (req.file) {
        amenities.image = req.file.filename;
      }
      amenities
        .save()
        .then(amenities => {
          return res.json({
            success: true,
            msg: "Amenities updated successfully"
          });
        })
        .catch(err => {
          console.log(err);
          return res.json({ error: true, msg: "Amenities not updated" });
        });
    }
  });
});

router.post("/updateImage/:id", upload.single("image"), function(
  req,
  res,
  next
) {
  Amenities.findById(req.params.id, function(err, amenities) {
    if (!amenities)
      return res.json({ error: true, msg: "Could not load document" });
    else {
      let image = amenities.image;
      fs.unlink("./src/assets/uploads/" + image, err => {
        if (err) throw err;
      });

      amenities.name = req.body.name;
      amenities.image = req.file.filename;
      amenities
        .save()
        .then(amenities => {
          return res.json({
            success: true,
            msg: "Amenities Updated Successfully"
          });
        })
        .catch(err => {
          return res.json({ error: true, msg: "Amenities not updated" });
        });
    }
  });
});

router.route("/delete/:id").get(function(req, res) {
  Amenities.findByIdAndRemove({ _id: req.params.id }, function(err, amenities) {
    if (err) res.json({ error: true, msg: "Amenities not deleted" });
    else return res.json({ success: true, msg: "Removed Successfully" });
  });
});

module.exports = router;
