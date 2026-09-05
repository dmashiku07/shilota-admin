const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const config = require("../config");
const { buildIceServers } = require("../services/turnService");

test("TURN REST credentials are time-limited HMAC credentials", function () {
  const previousTurn = config.turn;
  config.turn = {
    urls: ["turn:turn.example.test:3478?transport=udp"],
    sharedSecret: "test-secret",
    ttlSeconds: 3600
  };
  try {
    const servers = buildIceServers("user-123");
    assert.equal(servers.length, 2);
    assert.match(servers[1].username, /^\d+:user-123$/);
    const expected = crypto
      .createHmac("sha1", "test-secret")
      .update(servers[1].username)
      .digest("base64");
    assert.equal(servers[1].credential, expected);
  } finally {
    config.turn = previousTurn;
  }
});
