var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

var DriverdevicesSchema = new Schema({
    user_id: {
        type: String,
        required: true,
    },
    device_token: {
        type: String,
        required: true,
        unique:true
    },
    voip_token: {
        type: String,
        required: false
    },
    device_type: {
        type: String,
        required: true,
    },
    lang_type: {
        type: String,
        required: true,
    },
    device_id: {
        type: String,
        required: true,
    },
    notified_at:{ type: Date, default: Date.now },
});

module.exports = mongoose.model('Driverdevices', DriverdevicesSchema);