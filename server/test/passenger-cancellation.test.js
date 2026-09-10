const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../apiroutes/api.js'), 'utf8');
const route = source.slice(source.indexOf('/* cancel a ride */'), source.indexOf('/* user review a ride */'));

function cancel(ride, options = {}) {
  let handler, response, notifications = 0;
  const matches = query => query._id === ride._id && query.user_id === ride.user_id &&
    (typeof query.ridestatus === 'string' ? query.ridestatus === ride.ridestatus : query.ridestatus.$in.includes(ride.ridestatus));
  vm.runInNewContext(route, {
    router: { post: (_, callback) => { handler = callback; } },
    passport: { authenticate: (_, __, callback) => () => callback(null, { _id: 'owner' }) },
    timeZone: () => 'now',
    Rides: {
      findOneAndUpdate: (query, update) => ({ exec: callback => {
        if (options.databaseError) return callback(new Error('database unavailable'));
        if (options.startedConcurrently) ride.ridestatus = 'onride';
        const previous = matches(query) ? { ...ride } : null;
        if (previous) Object.assign(ride, update.$set);
        callback(null, previous);
      } }),
      findOne: query => ({ exec: callback => callback(null, matches(query) ? ride : null) })
    },
    UserDevices: { findOne: (_, callback) => callback(null, null) },
    DriverDevices: { findOne: (_, callback) => callback(null, null) },
    setDriverAvailableIfEligible: () => { notifications++; },
    senderr: res => res.json({ status: 'error' }),
  });
  handler({ body: { user_id: 'owner', onride_id: 'ride' } }, { json: value => { response = value; } });
  return { response, notifications };
}

for (const status of ['requested', 'accepted', 'ontheway', 'scheduled']) {
  test(`passenger can cancel ${status} ride and retry`, () => {
    const ride = { _id: 'ride', user_id: 'owner', ridestatus: status };
    assert.equal(cancel(ride).response.status, 'true');
    assert.equal(ride.ridestatus, 'cancelled');
    assert.equal(ride.cancelled_by, 'user');
    assert.ok(ride.ride_cancelled_at);
    assert.equal(cancel(ride).response.status, 'true');
  });
}
for (const status of ['onride', 'completed']) {
  test(`cannot cancel ${status} ride`, () => {
    const ride = { _id: 'ride', user_id: 'owner', ridestatus: status };
    assert.equal(cancel(ride).response.status, 'false');
    assert.equal(ride.ridestatus, status);
  });
}
test('cannot cancel another passenger ride', () => {
  const ride = { _id: 'ride', user_id: 'someone-else', ridestatus: 'requested' };
  assert.equal(cancel(ride).response.status, 'false');
  assert.equal(ride.ridestatus, 'requested');
});
test('concurrent ride start prevents cancellation', () => {
  const ride = { _id: 'ride', user_id: 'owner', ridestatus: 'accepted' };
  assert.equal(cancel(ride, { startedConcurrently: true }).response.status, 'false');
  assert.equal(ride.ridestatus, 'onride');
});
test('database failures are returned as errors', () => {
  assert.equal(cancel({}, { databaseError: true }).response.status, 'error');
});
test('unassigned requests do not release an undefined driver', () => {
  assert.equal(cancel({ _id: 'ride', user_id: 'owner', ridestatus: 'requested' }).notifications, 0);
});

for (const status of ['ridenotaccepted', 'scheduleridenotaccepted']) {
  test(`cancelling an expired ${status} search succeeds without changing history`, () => {
    const ride = { _id: 'ride', user_id: 'owner', ridestatus: status };
    assert.equal(cancel(ride).response.status, 'true');
    assert.equal(ride.ridestatus, status);
    assert.equal(cancel(ride).notifications, 0);
  });
}
test('a requested ride remains cancellable regardless of search duration or subscription', () => {
  const ride = { _id: 'ride', user_id: 'owner', ridestatus: 'requested',
    subscription_status: 'active', created_at: '2020-01-01', offer_expires_at: '2020-01-01' };
  assert.equal(cancel(ride).response.status, 'true');
  assert.equal(ride.ridestatus, 'cancelled');
});
