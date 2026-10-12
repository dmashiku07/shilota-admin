const UAT_RADIUS_OPTIONS_KM = [1, 2, 3];

function normalizeActiveRadiusKm(value) {
  const radius = Number(value);
  return UAT_RADIUS_OPTIONS_KM.indexOf(radius) >= 0 ? radius : null;
}

function driverMatchesActiveRadius(driver) {
  const selectedRadius = normalizeActiveRadiusKm(driver && driver.active_radius_km);
  const effectiveRadiusKm = selectedRadius || 1;
  return Number(driver && driver.distance || 0) <= effectiveRadiusKm * 1000;
}

module.exports = { UAT_RADIUS_OPTIONS_KM, driverMatchesActiveRadius, normalizeActiveRadiusKm };
