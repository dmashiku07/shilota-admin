const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const SubscriptionPlan = require("../schema/subscriptionplans");
const {
  PASSENGER_FEATURE_DEFINITIONS,
  applySubscriptionPlanFields,
  buildPlanOrderUpdates,
  normalizePlanFeatures,
  setPlanActiveStatus,
  validateSubscriptionPlanPayload
} = require("../services/subscriptionPlanService");

const routeSource = fs.readFileSync(
  path.join(__dirname, "..", "routes", "subscriptionPlanRoutes.js"),
  "utf8"
);
const planViewTemplateSource = fs.readFileSync(
  path.join(__dirname, "..", "..", "src", "app", "views", "admin", "subscription-plans", "view", "subscription-plan-view.component.html"),
  "utf8"
);
const planViewComponentSource = fs.readFileSync(
  path.join(__dirname, "..", "..", "src", "app", "views", "admin", "subscription-plans", "view", "subscription-plan-view.component.ts"),
  "utf8"
);
const planAddTemplateSource = fs.readFileSync(
  path.join(__dirname, "..", "..", "src", "app", "views", "admin", "subscription-plans", "add", "subscription-plan-add.component.html"),
  "utf8"
);
const planEditTemplateSource = fs.readFileSync(
  path.join(__dirname, "..", "..", "src", "app", "views", "admin", "subscription-plans", "edit", "subscription-plan-edit.component.html"),
  "utf8"
);

test("driver package validation rejects invalid package terms", function () {
  let errors = validateSubscriptionPlanPayload({
    customer_type: "DRIVER",
    name: "Starter",
    price: -1,
    currency: "TZS",
    duration_unit: "WEEK",
    duration_value: 0,
    ride_credit_count: 0,
    is_unlimited: false,
    display_order: -1
  });

  assert.equal(errors.price, "Price must be zero or greater");
  assert.equal(errors.duration_value, "Duration value must be greater than zero");
  assert.equal(errors.ride_credit_count, "Driver package ride credits must be greater than zero");
  assert.equal(errors.display_order, "Display order must be zero or greater");
});

test("approved driver package keeps a total ride-credit allowance", function () {
  const plan = new SubscriptionPlan({});
  applySubscriptionPlanFields(plan, {
    customer_type: "DRIVER",
    name: "UAT Driver Package",
    description: "10 rides over 7 days",
    price: 10000,
    currency: "TZS",
    duration_unit: "WEEK",
    duration_value: 1,
    daily_ride_limit: null,
    ride_credit_count: 10,
    is_unlimited: false,
    is_active: true,
    display_order: 0
  });

  const validationError = plan.validateSync();
  assert.equal(validationError, undefined);
  assert.equal(plan.ride_credit_count, 10);
});

test("driver package service requires a total ride-credit allowance", function () {
  const plan = new SubscriptionPlan({
    customer_type: "DRIVER",
    name: "Package",
    description: "",
    price: 1000,
    currency: "TZS",
    duration_unit: "WEEK",
    duration_value: 1,
    daily_ride_limit: null,
    ride_credit_count: null,
    is_unlimited: false,
    is_active: true,
    display_order: 0
  });

  const errors = validateSubscriptionPlanPayload(plan.toObject());
  assert.equal(errors.ride_credit_count, "Driver package ride credits must be greater than zero");
});

test("driver plan admin UI labels rides as total bundle allowance", function () {
  assert.match(planViewTemplateSource, /Bundle rides/);
  assert.match(planViewComponentSource, /\+ ' rides'/);
  assert.doesNotMatch(planViewTemplateSource, /Rides \/ day/);
  assert.doesNotMatch(planViewComponentSource, /rides\/day/);

  assert.match(planAddTemplateSource, /Total completed rides in bundle/);
  assert.match(planEditTemplateSource, /Total completed rides in bundle/);
  assert.match(planAddTemplateSource, /total ride allowance for the whole plan period/i);
  assert.match(planEditTemplateSource, /total ride allowance for the whole plan period/i);
  assert.doesNotMatch(planAddTemplateSource, /Daily completed rides/);
  assert.doesNotMatch(planEditTemplateSource, /Daily completed rides/);
});

test("activation and deactivation update plan state without changing pricing fields", function () {
  const plan = new SubscriptionPlan({
    customer_type: "DRIVER",
    name: "Weekly 10",
    description: "",
    price: 5000,
    currency: "TZS",
    duration_unit: "WEEK",
    duration_value: 1,
    daily_ride_limit: null,
    ride_credit_count: 10,
    is_unlimited: false,
    is_active: true,
    display_order: 1
  });

  setPlanActiveStatus(plan, false);
  assert.equal(plan.is_active, false);
  assert.equal(plan.price, 5000);

  setPlanActiveStatus(plan, true);
  assert.equal(plan.is_active, true);
  assert.equal(plan.ride_credit_count, 10);
});

test("reordering plans rewrites display order predictably", function () {
  const updates = buildPlanOrderUpdates(
    [
      { _id: "a", display_order: 0 },
      { _id: "b", display_order: 1 },
      { _id: "c", display_order: 2 }
    ],
    ["c", "a", "b"]
  );

  assert.deepStrictEqual(updates, [
    { id: "c", display_order: 0 },
    { id: "a", display_order: 1 },
    { id: "b", display_order: 2 }
  ]);
});

test("passenger plan validation rejects invalid feature values", function () {
  const errors = validateSubscriptionPlanPayload({
    customer_type: "PASSENGER",
    name: "Passenger Plus",
    price: 2500,
    currency: "TZS",
    duration_unit: "MONTH",
    duration_value: 1,
    display_order: 0,
    features: [
      {
        feature_code: "CAN_SET_RIDE_PRICE",
        feature_value: "yes"
      },
      {
        feature_code: "MAX_PRICE_BROADCASTS_PER_DAY",
        feature_value: -1
      }
    ]
  });

  assert.equal(errors["features.CAN_SET_RIDE_PRICE"], "Can set ride price must be true or false");
  assert.equal(errors["features.MAX_PRICE_BROADCASTS_PER_DAY"], "Max price broadcasts per day must be 0 or greater");
});

test("passenger plan features are normalized and deduplicated", function () {
  const normalized = normalizePlanFeatures([
    { feature_code: "can_set_ride_price", feature_value: "true" },
    { feature_code: "CAN_SET_RIDE_PRICE", feature_value: false },
    { feature_code: "PASSENGER_BROADCAST_RADIUS_KM", feature_value: "12" },
    { feature_code: "UNKNOWN", feature_value: true }
  ]);

  assert.deepStrictEqual(normalized, [
    { feature_code: "CAN_SET_RIDE_PRICE", feature_value: false },
    { feature_code: "PASSENGER_BROADCAST_RADIUS_KM", feature_value: 12 }
  ]);
});

test("passenger feature definition catalog exposes configured feature codes", function () {
  assert.ok(PASSENGER_FEATURE_DEFINITIONS.CAN_SET_RIDE_PRICE);
  assert.ok(PASSENGER_FEATURE_DEFINITIONS.CAN_BROADCAST_RIDE_REQUEST);
  assert.ok(PASSENGER_FEATURE_DEFINITIONS.PRIORITY_MATCHING);
  assert.ok(PASSENGER_FEATURE_DEFINITIONS.MAX_PRICE_BROADCASTS_PER_DAY);
  assert.ok(PASSENGER_FEATURE_DEFINITIONS.PASSENGER_BROADCAST_RADIUS_KM);
});

test("subscription plan routes expose activation, deactivation, reorder, and delete protection", function () {
  assert.match(routeSource, /router\.post\("\/:id\/activate"/);
  assert.match(routeSource, /router\.post\("\/:id\/deactivate"/);
  assert.match(routeSource, /router\.post\("\/reorder"/);
  assert.match(routeSource, /router\.get\("\/meta\/features"/);
  assert.match(routeSource, /referenced by subscriptions/);
});
