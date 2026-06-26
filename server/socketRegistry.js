const socketsByUser = new Map();

function ensureEntry(userId) {
  const key = String(userId || "").trim();
  if (!key) {
    return null;
  }
  if (!socketsByUser.has(key)) {
    socketsByUser.set(key, new Set());
  }
  return socketsByUser.get(key);
}

function registerSocket(userId, socket) {
  const entry = ensureEntry(userId);
  if (!entry || !socket) {
    return;
  }
  entry.add(socket);
}

function unregisterSocket(userId, socket) {
  const key = String(userId || "").trim();
  if (!key || !socketsByUser.has(key)) {
    return;
  }
  const entry = socketsByUser.get(key);
  entry.delete(socket);
  if (entry.size === 0) {
    socketsByUser.delete(key);
  }
}

function emitToUser(userId, event, payload) {
  const key = String(userId || "").trim();
  if (!key || !socketsByUser.has(key)) {
    return false;
  }
  let delivered = false;
  socketsByUser.get(key).forEach(function (socket) {
    if (socket && socket.connected) {
      socket.emit(event, payload);
      delivered = true;
    }
  });
  return delivered;
}

module.exports = {
  registerSocket,
  unregisterSocket,
  emitToUser
};
