const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../services/routeGeometryService'), 'utf8');
function service(responses) {
  const context = { module: { exports: {} }, require: name => name === 'request'
    ? { get: (options, callback) => callback(null, { statusCode: 200 }, responses.shift()) }
    : { findOne: () => ({ select: () => ({ lean: () => ({ exec: async () => ({ googleMapKey: 'test' }) }) }) }) }
  };
  vm.runInNewContext(source, context);
  return context.module.exports;
}
const payload = { pickup_lat: '-6.8', pickup_lng: '39.2', drop_lat: '-6.7', drop_lng: '39.3' };
const google = () => ({ routes: [{ overview_polyline: { points: 'encoded' }, legs: [
  { distance: { value: 1200 }, duration: { value: 180 } },
  { distance: { value: 2300 }, duration: { value: 240 } }
] }] });
test('road estimates include all route legs', async () => {
  const result = await service([google()]).getRoadRouteDetails(payload);
  assert.equal(result.encoded_polyline, 'encoded');
  assert.equal(result.distance_meters, 3500);
  assert.equal(result.duration_seconds, 420);
});
test('existing polyline-only callers remain compatible', async () => {
  assert.equal(await service([google()]).getRoadRoute(payload), 'encoded');
});
test('fallback routing supplies road distance and time', async () => {
  const result = await service([{ routes: [] }, { routes: [{ geometry: 'fallback', distance: 5000, duration: 600 }] }]).getRoadRouteDetails(payload);
  assert.equal(result.distance_meters, 5000);
  assert.equal(result.duration_seconds, 600);
});
test('unavailable routes fail rather than inventing estimates', async () => {
  await assert.rejects(service([{ routes: [] }, { routes: [] }, { routes: [] }]).getRoadRouteDetails(payload), /No driving route/);
});
