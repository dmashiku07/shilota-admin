var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

var NotificationSchema = new Schema({
    
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    user_id: {
        type: String,
        required: true
    },
    notify_to: {
        type: String,
        required: true
    },
    notified_at:{ type: String},
});

module.exports = mongoose.model('Notification', NotificationSchema);