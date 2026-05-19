var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

var AmenitiesSchema = new Schema({
    name: {
        type: String,
        unique: true,
        required: true
    },
    image:{
        type:String,
    },
});

module.exports = mongoose.model('Amenities', AmenitiesSchema);