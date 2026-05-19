var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var ReviewsSchema = new Schema({
    user_id: {
        type: String,
        required: true,
    },
    onride_id: {
        type: String,
        required: true,
        unique:true
    },
    review_message: {
        type: String,
    },
    rating: {
        type: Number,
    },
    driver_id: {
        type: String,
        required: true,
    },
    reviewed_at:{ type: Date, default: Date.now },
});

module.exports = mongoose.model('Reviews', ReviewsSchema);