var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// Define collection and schema for Items
var Faq = new Schema({
  title: {
    type: String,
    unique: true,
    required:true,
  },
  content: {
    type: String,
    required:true,
  },
 status:{
    type: Number,
   }
},{
    collection: 'faq'
});

module.exports = mongoose.model('Faq', Faq);