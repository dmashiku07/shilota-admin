var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

var BodytypesSchema = new Schema({
    name: {
        type: String,
        unique: true,
        required: true
    },
});

module.exports = mongoose.model('Bodytypes', BodytypesSchema);