var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var DriverLocalAreaSchema = new Schema({
  local_area_key: { type: String, required: true, unique: true, trim: true },
  label: { type: String, required: true, trim: true },
  allowed_radius_options_km: { type: [Number], enum: [1, 2, 3], default: [1, 2, 3] },
  is_active: { type: Boolean, default: true }
}, { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } });

module.exports = mongoose.model("DriverLocalArea", DriverLocalAreaSchema);
