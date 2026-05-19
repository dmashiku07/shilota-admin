var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

var CategoriesSchema = new Schema({
    category_name:{
        type:String
    },
    category_desc:{
        type:String
    },
    bodytypes: {
        type: String,
        required: true,
    },
    amenities:{
        type:Object,
        required: true,
    },
    unitprice:{
        type:Number
    },
    baseprice:{
        type:Number
    },
    image:{
        type:String,
    },
    reach_pickup:{
        type:String,
        default:"2 Min"
    }
    
});

module.exports = mongoose.model('Categories', CategoriesSchema);