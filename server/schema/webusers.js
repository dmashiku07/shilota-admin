let mongoose = require('mongoose');
let Schema = mongoose.Schema;
let WebUsersSchema = new Schema({
    user_id: {
        type: String,
        required: true,
    },
    device_token: {
        type: String,
        required: true,
    },
    signed_at:{ type: Date, default: Date.now },
});
module.exports = mongoose.model('Webusers', WebUsersSchema);