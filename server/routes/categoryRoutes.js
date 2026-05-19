let express = require("express");
let app = express();
let router = express.Router();
let multer = require("multer");
let path = require("path");
let Category = require("../schema/categories");
let fs = require("fs");
let Bodytypes = require("../schema/bodytypes");
let Amenities = require("../schema/amenities");
let Vehicles = require("../schema/vehicles");

const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, "./src/assets/uploads/");
  },
  filename: function(req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now());
  }
});
let upload = multer({
  storage: storage
});

function normalizeAmenitiesInput(value) {
  if (Array.isArray(value)) {
    return value
      .map(function(item) {
        return String(item || "").trim();
      })
      .filter(Boolean)
      .join(",");
  }

  return String(value || "")
    .split(",")
    .map(function(item) {
      return item.trim();
    })
    .filter(Boolean)
    .join(",");
}

router.route("/").get(function(req, res) {
  Category.find(function(err, category) {
    if (err) {
      return res.json({
        error: true,
        msg: err
      });
    } else {
      res.json(category);
    }
  });
});

router.route("/bodytype").get(function(req, res) {
  Bodytypes.find(function(err, type) {
    if (err) {
      return res.json({
        error: true,
        msg: err
      });
    } else {
      res.json(type);
    }
  });
});

router.route("/amenities").get(function(req, res) {
  Amenities.find(function(err, type) {
    if (err) {
      return res.json({
        error: true,
        msg: err
      });
    } else {
      res.json(type);
    }
  });
});

router.post("/add", upload.single("image"), function(req, res, next) {
  let category = new Category(req.body);
  category.category_name = category.category_name;
  category.category_desc = category.category_desc;
  category.image = req.file.filename;
  category.bodytypes = category.bodytypes;
  category.amenities = normalizeAmenitiesInput(category.amenities);
  category.unitprice = category.unitprice;
  category.baseprice = category.baseprice;
  category.reach_pickup = category.reach_pickup;
  category
    .save()
    .then(item => {
      return res.json({
        success: true,
        msg: "Category added successfully"
      });
    })
    .catch(err => {
      return res.json({
        error: true,
        msg: "Category Type Exists"
      });
    });
});

router.post("/updateImage/:id", upload.single("image"), function(
  req,
  res,
  next
) {
  Category.findById(req.params.id, function(err, category) {
    if (!category) return next(new Error("Could not load Document"));
    else {
      category.image = req.file.filename;
      category
        .save()
        .then(category => {
          return res.json({
            success: true,
            msg: "Category image updated successfully"
          });
        })
        .catch(err => {
          return res.json({
            error: true,
            msg: "Category image not updated"
          });
        });
    }
  });
});

router.route("/edit/:id").get(function(req, res) {
  let id = req.params.id;
  Category.findById(id, function(err, category) {
    res.json(category);
  });
});

router.post("/update/:id", upload.single("image"), function(req, res, next) {
  Category.findById(req.params.id, function(err, category) {
    if (!category) return next(new Error("Could not load Document"));
    else {
      category.category_name = req.body.category_name;
      category.category_desc = req.body.category_desc;
      category.bodytypes = req.body.bodytypes;
      if (req.file) {
        category.image = req.file.filename;
      }
      category.amenities = normalizeAmenitiesInput(req.body.amenities);
      category.unitprice = req.body.unitprice;
      category.baseprice = req.body.baseprice;
      category
        .save()
        .then(category => {
          return res.json({
            success: true,
            msg: "Category updated successfully"
          });
        })
        .catch(err => {
          return res.json({
            error: true,
            msg: err
          });
        });
    }
  });
});

router.route("/delete/:id").get(function(req, res) {
  let cat_id = req.params.id;
  Vehicles.count({
    category: cat_id
  }).exec(function(err, usedcount) {
    if (usedcount > 0) {
      res.json({
        error: true,
        msg: "Category is used by vehicles"
      });
    } else {
      Category.findByIdAndRemove(
        {
          _id: req.params.id
        },
        function(err, banner) {
          if (err) {
            res.json({
              error: true,
              msg: "Category not deleted"
            });
          } else {
            return res.json({
              success: true,
              msg: "Category Deleted Successfully"
            });
          }
        }
      );
    }
  });
});
module.exports = router;
