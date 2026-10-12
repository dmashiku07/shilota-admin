const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
// User Schema
const admin = mongoose.Schema ({
  name: {
    type: String,
  },
  email: {
    type: String,
  },
  username: {
    type: String,
  },
  password: {
    type: String,
  },
  logo:{
    type:String,
  },
  instagram: {
    type:String,
  },
  linkedin: {
    type: String,
  },
  googleplus: {
    type: String,
    require: true,
  },
  twitter: {
    type: String,
  },
  facebook: {
    type: String,
  },
  iosUser: {
    type: String,
  },
  iosDriver: {
    type: String,
  },
  androidUser: {
    type: String,
  },
  androidDriver: {
    type: String,
  },
  footer: {
    type: String,
  },

  apptitle: {
    type: String,
  },

  appcontent: {
    type: String,
  },
  phone: {
    type: Number,
  },
  smptHost: {
    type: String,
  },
  smtpPort: {
    type: String,
  },

  smtpUsername: {
    type: String,
  },

  smtpPassword: {
    type: String,
  },
  distancePerCab:{
    type:String,
  },
  BasePricePerKM:{
    type:String,
  },
  tax:{
    type:String,
  },
  maxDistance:{
    type:Number,
  },
  merchandId:{
    type:String,
  },
  publicKey:{
    type:String,
  },
  privateKey:{
    type:String,
  },
  BraintreeStatus:{
    type:Number,
  },
  currencyCode:{
    type:String,
  },
  currencySymbol:{
    type:String,
  },
  siteName: {
    type: String,
  },
  emergencyContact: {
    type: String,
  },
  googleMapKey: {
    type: String,
  },
  inspectionon: {
    type: String,
  },
  helppagesheader: {
    type: String,
  },
  admin_enable_ads: {
    type: String,
  },
  ad_unit_id: {
    type: String,
  },
  maxdisperride: {
    type: Number,
  },
  role: {
    type: String,
    default: "admin"
  },
  assigned_driver_ids: {
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Driver" }],
    default: []
  },
},
{
  collection: 'admin'
});

const User = module.exports = mongoose.model('Admin', admin);

module.exports.getUserById = function(id, callback) {
  User.findById(id, callback);
}

module.exports.getUserByUsername = function(username, callback) {
  const query = {username: username}
  User.findOne(query, callback);
}

module.exports.addUser = function(newUser, callback) {
  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(newUser.password, salt, (err, hash) => {
      if(err) throw err;
      newUser.password = hash;
      newUser.save(callback);
    });
  });
}

module.exports.comparePassword = function(candidatePassword, hash, callback) {
  bcrypt.compare(candidatePassword, hash, (err, isMatch) => {
    if(err) throw err;
    callback(null, isMatch);
  });
}
