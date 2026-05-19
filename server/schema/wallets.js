var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

var WalletsSchema = new Schema({
    status:{type:String},
    user_id: {
        type: String,
        required: true,
    },
    amount:{
        type:Number,
        required: true,
    },
    type:{
        type:String,
        required: true, /* credit (or) debit */
    },
    transaction_id:{
        type:String,
    },
    transaction:{
        type:String,
        required: true, /* payride (or) addmoney */
    },
    wallet_for: {
        type: String,
        default: "user",
    },
    onride_id:{
        type: String,
    },
    updated_at:{ type: String },
});

module.exports = mongoose.model('Wallet', WalletsSchema);
