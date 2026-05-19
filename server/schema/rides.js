var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt-nodejs');

var RidesSchema = new Schema({
    status: { type: String },
    user_id: {
        type: String,
        required: true,
        ref: 'User'
    },
    type: {
        type: String, /* schedule / ridenow */
        required: true,
    },
    payment_type: {
        type: String, /* cash / payment / wallet */
        required: true,
    },
    category_id: {
        type: String,
        required: true,
        ref: 'Categories'
    },
    schedule_time: {
        type: Number,
    },
    schedule_utc_time: {
        type: String,
    },
    pickup_location: {
        type: String,
        required: true,
    },
    pickup_lat: {
        type: String,
        required: true,
    },
    pickup_lng: {
        type: String,
        required: true,
    },
    drop_location: {
        type: String,
        required: true,
    },
    drop_lat: {
        type: String,
        required: true,
    },
    drop_lng: {
        type: String,
        required: true,
    },
    onride_otp: {
        type: String,
    },
    driver_id: {
        type: String,
        ref: 'Driver'
    },
    ridestatus: {
        type: String, /* cancelled / completed / onride / ontheway / scheduled / accepted / requested */
    },
    ridestatusat: {
        type: String
    },
    ride_started_at: {
        type: Date,
    },
    ride_completed_at: {
        type: Date,
    },
    vehicle_no: {
        type: String,
    },
    baseprice: {
        type: Number
    },
    tax: {
        type: Number
    },
    commissionamount: {
        type: Number
    },
    total: {
        type: Number
    },
    review_id: {
        type: String,
        ref: 'Reviews'
    },
    payment_id: {
        type: String,
        ref: 'Payments'
    },
    notify: {
        type: Number, default: 0
    },
    ridedistance: {
        type: Number, default: 0
    },
    latra_reference_number: {
        type: String
    },
    cets_trip_ref: {
        type: String
    },
    cets_sync_status: {
        type: String
    },
    cets_last_synced_at: {
        type: Date
    },
    cets_last_sync_error: {
        type: String
    },
    cets_last_sync_response: {
        type: Object
    },
    created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Rides', RidesSchema);
