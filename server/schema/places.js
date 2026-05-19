var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

var PlacesSchema = new Schema({
  user_id: {
    type: String
  },
  place_name: {
    type: String
  },
  place_full_address: {
    type: String,
    required: true,
  },
  place_latitude: {
    type: Number
  },
  place_longitude: {
    type: Number
  },
  place_type: {
    type: String,
  },
  google_place_id: {
    type: String,
  }
});

module.exports = mongoose.model('Places', PlacesSchema);
