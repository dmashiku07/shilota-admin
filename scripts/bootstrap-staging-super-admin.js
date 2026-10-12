"use strict";

const mongoose = require("mongoose");
const config = require("../server/config");
const Admin = require("../server/models/admin");
const { bootstrapStagingSuperAdmin } = require("../server/services/stagingSuperAdminBootstrap");

async function main() {
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  const result = await bootstrapStagingSuperAdmin({ Admin });
  // Intentionally do not print account identifiers or credentials.
  console.log(JSON.stringify({ ok: true, status: result.status }));
}

main()
  .catch(function (error) {
    console.error(error && error.message ? error.message : "Staging Super Admin bootstrap failed");
    process.exitCode = 1;
  })
  .finally(async function () {
    await mongoose.disconnect();
  });
