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
    request_type: {
        type: String,
        default: 'STANDARD'
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
    service_type: {
        type: String,
        default: 'ride'
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
    ride_stops: {
        type: Array,
        default: []
    },
    pooling_opt_in: {
        type: Boolean,
        default: false
    },
    seats_requested: {
        type: Number,
        default: 1
    },
    pool_status: {
        type: String,
        default: 'solo'
    },
    pool_group_id: {
        type: String,
        default: ''
    },
    pool_group_size: {
        type: Number,
        default: 1
    },
    pool_discount_percent: {
        type: Number,
        default: 0
    },
    pool_zone_key: {
        type: String,
        default: ''
    },
    matched_pool_ride_ids: {
        type: [String],
        default: []
    },
    delivery_details: {
        type: Object,
        default: {}
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
    pricing_mode: {
        type: String,
        default: 'platform'
    },
    passenger_offered_price: {
        type: Number,
        default: null
    },
    broadcast_radius: {
        type: Number,
        default: null
    },
    broadcast_expires_at: {
        type: Date
    },
    accepted_offer_id: {
        type: String,
        ref: 'RideOffer',
        default: ''
    },
    final_agreed_currency: {
        type: String,
        default: 'TZS'
    },
    offer_expires_at: {
        type: Date
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
    final_ride_amount: {
        type: Number
    },
    final_agreed_price: {
        type: Number
    },
    payment_status: {
        type: String,
        default: 'unpaid'
    },
    payment_direct_to_driver: {
        type: Number,
        default: 0
    },
    payment_recorded_at: {
        type: Date
    },
    subscription_usage_counted_at: {
        type: Date
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
    schedule_reminder_notify: {
        type: Number,
        default: 0
    },
    schedule_reassign_count: {
        type: Number,
        default: 0
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
