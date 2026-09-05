const crypto = require("crypto");
const config = require("../config");

function buildIceServers(userId) {
  const servers = [
    { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }
  ];
  const turn = config.turn || {};
  if (!turn.sharedSecret || !Array.isArray(turn.urls) || turn.urls.length === 0) {
    return servers;
  }
  const expiresAt = Math.floor(Date.now() / 1000) + turn.ttlSeconds;
  const username = `${expiresAt}:${String(userId || "shilota")}`;
  const credential = crypto
    .createHmac("sha1", turn.sharedSecret)
    .update(username)
    .digest("base64");
  servers.push({ urls: turn.urls, username, credential });
  return servers;
}

module.exports = { buildIceServers };
