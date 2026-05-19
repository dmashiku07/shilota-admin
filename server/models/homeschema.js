var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// Define collection and schema for Items
var Home = new Schema({
  title: {
    type: String,
    required:true,
  },
  content: {
    type: String,
    required:true,
  },
  image: {
    type: String,
   },
  type: {
    type: String,
  },
  status:{
    type: Number,
  }
},{
    collection: 'home'
});

module.exports = mongoose.model('Home', Home);