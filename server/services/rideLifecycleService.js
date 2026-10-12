const DRIVER_RIDE_TRANSITIONS = Object.freeze({
  accepted: "ontheway",
  ontheway: "onride",
  onride: "completed"
});

function normalizeRideStatus(value) {
  return String(value || "").trim().toLowerCase();
}

function requiredCurrentStatusForDriverTransition(nextStatus) {
  const requestedStatus = normalizeRideStatus(nextStatus);
  return Object.keys(DRIVER_RIDE_TRANSITIONS).find(function (currentStatus) {
    return DRIVER_RIDE_TRANSITIONS[currentStatus] === requestedStatus;
  }) || null;
}

function canDriverTransition(currentStatus, nextStatus) {
  return DRIVER_RIDE_TRANSITIONS[normalizeRideStatus(currentStatus)] === normalizeRideStatus(nextStatus);
}

module.exports = {
  DRIVER_RIDE_TRANSITIONS,
  canDriverTransition,
  normalizeRideStatus,
  requiredCurrentStatusForDriverTransition
};
