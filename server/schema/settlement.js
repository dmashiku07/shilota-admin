var mongoose = require('mongoose');
var Schema = mongoose.Schema;


var SettlementSchema = new Schema({
    
    driver_id:{
        type: String,
        required: true,
        ref:'Driver'
    },    
    total_ridefare:{
        type:Number,
    },
    total_commissionAmt:{
        type:Number,
    },
    total_tax:{
        type:Number,
    },
    total_earning:{
        type:Number,
    },
    payment_type:{
        type: String,
    },
    ride_count:{
        type:Number,
    },
    payment_status:{type:String},
    created_at: { type: Date, default: Date.now },
});



module.exports = mongoose.model('settlement', SettlementSchema);