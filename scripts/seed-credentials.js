"use strict";

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const randomstring = require("randomstring");
const config = require("../server/config");
const Admin = require("../server/models/admin");
const User = require("../server/schema/user");
const Driver = require("../server/schema/driver");
const Vehicle = require("../server/schema/vehicles");
const Category = require("../server/schema/categories");

let seedConfig = {};

try {
  seedConfig = require("../server/seed.local");
} catch (_error) {
  seedConfig = require("../server/seed.local.example");
}

function requireField(value, name) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`Missing required seed field: ${name}`);
  }
}

async function seedAdmin(adminConfig) {
  requireField(adminConfig?.email, "admin.email");
  requireField(adminConfig?.username, "admin.username");
  requireField(adminConfig?.password, "admin.password");

  const existing = await Admin.findOne({
    $or: [{ email: adminConfig.email }, { username: adminConfig.username }]
  }).exec();
  if (existing) {
    return { status: "skipped", type: "admin", id: String(existing._id) };
  }

  const password = await bcrypt.hash(adminConfig.password, 10);
  const admin = await Admin.create({
    role: "admin",
    name: adminConfig.name || "Local Admin",
    email: adminConfig.email,
    username: adminConfig.username,
    password,
    currencyCode: "TZS",
    currencySymbol: "TSh",
    siteName: "CABi"
  });

  return { status: "created", type: "admin", id: String(admin._id) };
}

async function seedUser(userConfig) {
  requireField(userConfig?.full_name, "user.full_name");
  requireField(userConfig?.email, "user.email");
  requireField(userConfig?.password, "user.password");

  const existing = await User.findOne({ email: userConfig.email }).exec();
  if (existing) {
    return { status: "skipped", type: "user", id: String(existing._id) };
  }

  const user = new User({
    role: "user",
    full_name: userConfig.full_name,
    email: userConfig.email,
    password: userConfig.password,
    country_code: userConfig.country_code || 255,
    phone_number: userConfig.phone_number || 700000001,
    profile_image: "user.png"
  });

  await user.save();
  return { status: "created", type: "user", id: String(user._id) };
}

async function resolveDriverCategoryId(driverConfig) {
  if (driverConfig?.category_id) {
    return driverConfig.category_id;
  }

  const category = await Category.findOne().sort({ _id: 1 }).exec();
  if (!category) {
    throw new Error(
      "No category found. Create at least one category or set driver.category_id in server/seed.local.js"
    );
  }
  return String(category._id);
}

async function seedDriver(driverConfig) {
  requireField(driverConfig?.full_name, "driver.full_name");
  requireField(driverConfig?.email, "driver.email");
  requireField(driverConfig?.password, "driver.password");
  requireField(driverConfig?.lat, "driver.lat");
  requireField(driverConfig?.lon, "driver.lon");
  requireField(driverConfig?.location, "driver.location");

  const existing = await Driver.findOne({ email: driverConfig.email }).exec();
  if (existing) {
    return { status: "skipped", type: "driver", id: String(existing._id) };
  }

  const categoryId = await resolveDriverCategoryId(driverConfig);
  const batchId = `ID ${randomstring.generate({ length: 4, charset: "numeric" })}`;
  const driver = new Driver({
    full_name: driverConfig.full_name,
    email: driverConfig.email,
    password: driverConfig.password,
    country_code: driverConfig.country_code || "255",
    phone_number: driverConfig.phone_number || 700000999,
    lat: driverConfig.lat,
    lon: driverConfig.lon,
    location: driverConfig.location,
    instant_lat: String(driverConfig.lat),
    instant_lng: String(driverConfig.lon),
    last_lat: String(driverConfig.lat),
    last_lng: String(driverConfig.lon),
    instant_location: driverConfig.location,
    loc: [driverConfig.lon, driverConfig.lat],
    category_id: categoryId,
    live_status: "1",
    approval: "1",
    batch_id: batchId,
    completionStatus: 1,
    vehicle_inspection: "Complete",
    security_deposit: "Complete",
    vehicle_details: "Complete",
    payment_details: "Complete"
  });

  await driver.save();

  const vehicle = await Vehicle.create({
    user_id: String(driver._id),
    vehicle_name: driverConfig.vehicle_name || "Demo CABi",
    vehicle_number: driverConfig.vehicle_number || "T123 DEM",
    available_seats: driverConfig.available_seats || 4,
    status: "1",
    category: categoryId,
    completionStatus: "1"
  });

  driver.vehicle_id = String(vehicle._id);
  await driver.save();

  return { status: "created", type: "driver", id: String(driver._id) };
}

async function main() {
  mongoose.Promise = global.Promise;
  mongoose.set("useCreateIndex", true);
  mongoose.set("useFindAndModify", false);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const results = [];
  results.push(await seedAdmin(seedConfig.admin || {}));
  results.push(await seedUser(seedConfig.user || {}));
  results.push(await seedDriver(seedConfig.driver || {}));

  console.log(JSON.stringify({ ok: true, results }, null, 2));
  await mongoose.disconnect();
}

main().catch(async error => {
  console.error(error.message || error);
  try {
    await mongoose.disconnect();
  } catch (_error) {}
  process.exit(1);
});
