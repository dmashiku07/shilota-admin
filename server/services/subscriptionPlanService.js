const PLAN_CUSTOMER_TYPES = ["DRIVER", "PASSENGER"];
const PLAN_DURATION_UNITS = ["DAY", "WEEK", "MONTH"];
const PASSENGER_FEATURE_DEFINITIONS = {
  CAN_SET_RIDE_PRICE: {
    label: "Can set ride price",
    type: "boolean"
  },
  CAN_BROADCAST_RIDE_REQUEST: {
    label: "Can broadcast ride request",
    type: "boolean"
  },
  PRIORITY_MATCHING: {
    label: "Priority matching",
    type: "boolean"
  },
  MAX_PRICE_BROADCASTS_PER_DAY: {
    label: "Max price broadcasts per day",
    type: "number",
    min: 0
  },
  PASSENGER_BROADCAST_RADIUS_KM: {
    label: "Passenger broadcast radius (km)",
    type: "number",
    min: 0
  }
};

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInteger(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeUpperText(value) {
  return normalizeText(value).toUpperCase();
}

function normalizeBoolean(value, fallback) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") {
      return true;
    }
    if (normalized === "false" || normalized === "0") {
      return false;
    }
  }
  if (typeof value === "number") {
    return value === 1;
  }
  return fallback;
}

function normalizeNullableNumber(value) {
  if (value === "" || value === null || typeof value === "undefined") {
    return null;
  }
  return toNumber(value);
}

function normalizeFeatureCode(value) {
  return normalizeUpperText(value);
}

function normalizeFeatureValue(value) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized === "") {
      return "";
    }
    if (normalized.toLowerCase() === "true") {
      return true;
    }
    if (normalized.toLowerCase() === "false") {
      return false;
    }
    const numberValue = toNumber(normalized);
    if (numberValue !== null && normalized === String(numberValue)) {
      return numberValue;
    }
    return normalized;
  }
  const parsedNumber = toNumber(value);
  if (parsedNumber !== null) {
    return parsedNumber;
  }
  return value;
}

function normalizePlanFeatures(features) {
  if (!Array.isArray(features)) {
    return [];
  }

  const deduped = {};
  features.forEach(function (feature) {
    const featureCode = normalizeFeatureCode(feature && feature.feature_code);
    if (!featureCode || !PASSENGER_FEATURE_DEFINITIONS[featureCode]) {
      return;
    }
    deduped[featureCode] = {
      feature_code: featureCode,
      feature_value: normalizeFeatureValue(feature && feature.feature_value)
    };
  });

  return Object.keys(deduped).sort().map(function (featureCode) {
    return deduped[featureCode];
  });
}

function validatePassengerPlanFeatures(features) {
  const errors = {};
  normalizePlanFeatures(features).forEach(function (feature) {
    const definition = PASSENGER_FEATURE_DEFINITIONS[feature.feature_code];
    if (!definition) {
      return;
    }
    if (definition.type === "boolean" && typeof feature.feature_value !== "boolean") {
      errors["features." + feature.feature_code] = definition.label + " must be true or false";
    }
    if (definition.type === "number") {
      if (typeof feature.feature_value !== "number" || Number.isNaN(feature.feature_value)) {
        errors["features." + feature.feature_code] = definition.label + " must be a number";
      } else if (typeof definition.min === "number" && feature.feature_value < definition.min) {
        errors["features." + feature.feature_code] = definition.label + " must be " + definition.min + " or greater";
      }
    }
  });
  return errors;
}

function validateSubscriptionPlanPayload(payload) {
  const errors = {};
  const customerType = normalizeUpperText(payload.customer_type);
  const name = normalizeText(payload.name);
  const price = toNumber(payload.price);
  const currency = normalizeUpperText(payload.currency);
  const durationUnit = normalizeUpperText(payload.duration_unit);
  const durationValue = toInteger(payload.duration_value, null);
  const dailyRideLimit = normalizeNullableNumber(payload.daily_ride_limit);
  const rideCreditCount = normalizeNullableNumber(payload.ride_credit_count);
  const isUnlimited = normalizeBoolean(payload.is_unlimited, false);
  const displayOrder = toInteger(payload.display_order, 0);

  if (PLAN_CUSTOMER_TYPES.indexOf(customerType) === -1) {
    errors.customer_type = "Customer type must be DRIVER or PASSENGER";
  }
  if (!name) {
    errors.name = "Plan name is required";
  }
  if (price === null || price < 0) {
    errors.price = "Price must be zero or greater";
  }
  if (!currency) {
    errors.currency = "Currency is required";
  }
  if (PLAN_DURATION_UNITS.indexOf(durationUnit) === -1) {
    errors.duration_unit = "Duration unit must be DAY, WEEK or MONTH";
  }
  if (!Number.isInteger(durationValue) || durationValue <= 0) {
    errors.duration_value = "Duration value must be greater than zero";
  }
  if (!Number.isInteger(displayOrder) || displayOrder < 0) {
    errors.display_order = "Display order must be zero or greater";
  }
  if (customerType === "DRIVER") {
    if (!Number.isInteger(rideCreditCount) || rideCreditCount <= 0) {
      errors.ride_credit_count = "Driver package ride credits must be greater than zero";
    }
  }
  if (isUnlimited && dailyRideLimit !== null && dailyRideLimit <= 0) {
    errors.daily_ride_limit = "Unlimited plans may omit the bundle ride limit or use a positive number";
  }
  if (customerType === "PASSENGER") {
    Object.assign(errors, validatePassengerPlanFeatures(payload.features || []));
  }

  return errors;
}

function normalizeSubscriptionPlanPayload(payload) {
  const isUnlimited = normalizeBoolean(payload.is_unlimited, false);
  return {
    customer_type: normalizeUpperText(payload.customer_type),
    name: normalizeText(payload.name),
    description: normalizeText(payload.description),
    price: Number(toNumber(payload.price) || 0),
    currency: normalizeUpperText(payload.currency || "TZS"),
    duration_unit: normalizeUpperText(payload.duration_unit),
    duration_value: toInteger(payload.duration_value, 1),
    daily_ride_limit: isUnlimited ? null : normalizeNullableNumber(payload.daily_ride_limit),
    ride_credit_count: normalizeNullableNumber(payload.ride_credit_count),
    is_unlimited: isUnlimited,
    is_active: normalizeBoolean(payload.is_active, true),
    display_order: toInteger(payload.display_order, 0),
    features: normalizePlanFeatures(payload.features || [])
  };
}

function applySubscriptionPlanFields(plan, payload) {
  const normalized = normalizeSubscriptionPlanPayload(payload);
  plan.customer_type = normalized.customer_type;
  plan.name = normalized.name;
  plan.description = normalized.description;
  plan.price = normalized.price;
  plan.currency = normalized.currency;
  plan.duration_unit = normalized.duration_unit;
  plan.duration_value = normalized.duration_value;
  plan.daily_ride_limit = normalized.daily_ride_limit;
  plan.ride_credit_count = normalized.ride_credit_count;
  plan.is_unlimited = normalized.is_unlimited;
  plan.is_active = normalized.is_active;
  plan.display_order = normalized.display_order;
  return plan;
}

function setPlanActiveStatus(plan, isActive) {
  plan.is_active = !!isActive;
  return plan;
}

function buildPlanOrderUpdates(existingPlans, orderedIds) {
  const orderedIdList = Array.isArray(orderedIds)
    ? orderedIds.map(function (id) { return String(id || "").trim(); }).filter(Boolean)
    : [];
  const lookup = {};
  (existingPlans || []).forEach(function (plan) {
    lookup[String(plan._id)] = plan;
  });

  const reordered = [];
  orderedIdList.forEach(function (id) {
    if (lookup[id]) {
      reordered.push(lookup[id]);
      delete lookup[id];
    }
  });

  Object.keys(lookup)
    .map(function (id) { return lookup[id]; })
    .sort(function (left, right) {
      return Number(left.display_order || 0) - Number(right.display_order || 0);
    })
    .forEach(function (plan) {
      reordered.push(plan);
    });

  return reordered.map(function (plan, index) {
    return {
      id: String(plan._id),
      display_order: index
    };
  });
}

function formatValidity(plan) {
  const value = Number(plan && plan.duration_value || 0);
  const unit = String(plan && plan.duration_unit || "").toLowerCase();
  if (!value || !unit) {
    return "";
  }
  const suffix = value === 1 ? unit : unit + "s";
  return value + " " + suffix;
}

module.exports = {
  PLAN_CUSTOMER_TYPES,
  PLAN_DURATION_UNITS,
  PASSENGER_FEATURE_DEFINITIONS,
  applySubscriptionPlanFields,
  buildPlanOrderUpdates,
  formatValidity,
  normalizePlanFeatures,
  normalizeSubscriptionPlanPayload,
  setPlanActiveStatus,
  validatePassengerPlanFeatures,
  validateSubscriptionPlanPayload
};
