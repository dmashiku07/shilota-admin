var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

var CommissionsSchema = new Schema({
    price_from: {
        type: Number,
        required: true,
    },
    price_to: {
        type: Number,
        required: true,
    },
    percentage:{
        type:Number,
        required: true,
    }
});

module.exports = mongoose.model('Commissions', CommissionsSchema);