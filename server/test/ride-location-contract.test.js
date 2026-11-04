const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const chatSource = fs.readFileSync(
  path.join(__dirname, "..", "apiroutes", "chat.js"),
  "utf8"
);

test("assigned ride tracking authenticates identities and scopes updates to the ride", () => {
  assert.match(chatSource, /socket\.on\("watch-ride-location"/);
  assert.match(chatSource, /socket\.on\("share-ride-location"/);
  assert.match(chatSource, /jwt\.verify\(token, config\.secret\)/);
  assert.match(chatSource, /_id: rideId, user_id: identity\.userId/);
  assert.match(chatSource, /driver_id: identity\.userId/);
  assert.match(chatSource, /socket\.join\(rideLocationRoom\(ride\._id\)\)/);
  assert.match(chatSource, /io\.to\(rideLocationRoom\(ride\._id\)\)\.emit\("ride-driver-location"/);
});
