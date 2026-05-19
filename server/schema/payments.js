var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

var PaymentsSchema = new Schema({
    status:{type:String},
    user_id: {
        type: String,
         ref:'User'
    },
    onride_id:{
        type: String,
        ref:'Rides'
    },
    driver_id:{
        type: String,
        ref:'Driver'
    },
    payment_type:{
        type: String,  /* cash or braintree or wallet */
   },
    
    ride_fare:{
        type:Number,
     },
    transaction_id:{
        type:String, 
    },
    baseprice:{
        type:Number,
    },
    tax:{
        type:Number,
         default:0
    },
    commissionamount:{
        type:Number,
         default:0
    },
    drop_time:{ type: Date, default: Date.now },
    settlement_id:{
        type: String,
        ref:'Driver'
    },
    paidbywallet:{ type:Number,default:0 },
    paid:{ type:Number,default:0 }
   
});



module.exports = mongoose.model('Payments', PaymentsSchema);