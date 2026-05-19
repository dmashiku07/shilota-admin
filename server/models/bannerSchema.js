var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// Define collection and schema for Items
var Banner = new Schema({
  title: {
    type: String,
    required:true,
  },
  image: {
    type: String,
   },
  type: {
    type: String,
    unique: true,

  },
  status:{
    type: Number,
  }
},{
    collection: 'banner'
});

module.exports = mongoose.model('Banner', Banner);