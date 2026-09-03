var mongoose = require("mongoose");
var Schema = mongoose.Schema;
var bcrypt = require("bcrypt-nodejs");

var UserSchema = new Schema({
  full_name: {
    type: String,
    required: true,
    min: 3
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    unique: true,
    required: true
  },
  country_code: {
    type: Number
  },
  phone_number: {
    type: Number
  },
  phone_verified: {
    type: Boolean,
    default: false
  },
  phone_verified_at: {
    type: Date,
    default: null
  },
  role: {
    type: String,
    default: "user"
  },
  emergency_contact: Object,
  profile_image: { type: String, default: "user.png" },
  profile_image_updated_at: { type: Date, default: null },
  customer_id: { type: String },
  walletmoney: {
    type: Number,
    default: 0
  },
  deletion_status: {
    type: Number,
    default: 0
  },
  current_lat: {
    type: Number,
    default: null
  },
  current_lng: {
    type: Number,
    default: null
  },
  current_location: {
    type: String,
    default: ""
  },
  loc: {
    type: [Number],
    index: {
      type: "2dsphere",
      sparse: true
    }
  },
});

UserSchema.pre("save", function(next) {
  var user = this;
  if (this.isModified("password") || this.isNew) {
    bcrypt.genSalt(10, function(err, salt) {
      if (err) {
        return next(err);
      }
      bcrypt.hash(user.password, salt, null, function(err, hash) {
        if (err) {
          return next(err);
        }
        user.password = hash;
        next();
      });
    });
  } else {
    return next();
  }
});

UserSchema.methods.comparePassword = function(passw, cb) {
  bcrypt.compare(passw, this.password, function(err, isMatch) {
    if (err) {
      return cb(err);
    }
    cb(null, isMatch);
  });
};

module.exports = mongoose.model("User", UserSchema);
