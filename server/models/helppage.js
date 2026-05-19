
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// Define collection and schema for Items
var Page = new Schema({
  title: {
    type: String,
    required:true,
  },
  content: {
    type: String,
    required:true,
  },
  status: {
      type:Number,
      required:true,
  },
  pagetype:{
    type: String,
    required:true,
  },
  type:{
    type: String,
    required:true,
  }
},{
    collection: 'pages'
});

module.exports = mongoose.model('Page', Page);


