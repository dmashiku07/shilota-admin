var express = require("express");
var router = express.Router();
var SubscriptionPlan = require("../schema/subscriptionplans");
var SubscriptionPlanFeature = require("../schema/subscriptionplanfeatures");
var Subscription = require("../schema/subscriptions");
var { logAuditFromRequest } = require("../services/auditLogService");
var {
  PASSENGER_FEATURE_DEFINITIONS,
  applySubscriptionPlanFields,
  buildPlanOrderUpdates,
  formatValidity,
  normalizePlanFeatures,
  setPlanActiveStatus,
  validateSubscriptionPlanPayload
} = require("../services/subscriptionPlanService");

function validationResponse(res, errors) {
  return res.json({
    status: "false",
    message: "Validation failed",
    errors: errors
  });
}

function formatPlan(plan, planFeatures, activeSubscriberCount) {
  return {
    _id: plan._id,
    customer_type: plan.customer_type,
    name: plan.name,
    description: plan.description,
    price: plan.price,
    currency: plan.currency,
    duration_unit: plan.duration_unit,
    duration_value: plan.duration_value,
    daily_ride_limit: plan.daily_ride_limit,
    is_unlimited: plan.is_unlimited,
    is_active: plan.is_active,
    display_order: plan.display_order,
    features: Array.isArray(planFeatures) ? planFeatures : [],
    active_subscriber_count: Number(activeSubscriberCount || 0),
    validity_label: formatValidity(plan),
    created_at: plan.created_at,
    updated_at: plan.updated_at
  };
}

function buildFeatureMap(features) {
  return (features || []).reduce(function (result, feature) {
    const key = String(feature.plan_id || "");
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push({
      feature_code: String(feature.feature_code || "").trim().toUpperCase(),
      feature_value: feature.feature_value
    });
    return result;
  }, {});
}

async function hydratePlans(plans) {
  var ids = (plans || []).map(function (plan) {
    return plan._id;
  });
  var features = await SubscriptionPlanFeature.find({
    plan_id: {
      $in: ids
    }
  }).sort({ feature_code: 1 }).exec();

  var subscriberCounts = await Subscription.aggregate([
    {
      $match: {
        plan_id: {
          $in: ids
        },
        status: "ACTIVE"
      }
    },
    {
      $group: {
        _id: "$plan_id",
        total: {
          $sum: 1
        }
      }
    }
  ]).exec();

  var featureMap = buildFeatureMap(features || []);
  var countMap = (subscriberCounts || []).reduce(function (result, row) {
    result[String(row._id)] = Number(row.total || 0);
    return result;
  }, {});

  return (plans || []).map(function (plan) {
    return formatPlan(plan, featureMap[String(plan._id)] || [], countMap[String(plan._id)] || 0);
  });
}

async function syncPlanFeatures(plan, payloadFeatures) {
  var normalizedFeatures = normalizePlanFeatures(payloadFeatures || []);

  await SubscriptionPlanFeature.deleteMany({
    plan_id: plan._id
  }).exec();

  if (normalizedFeatures.length === 0) {
    return [];
  }

  return SubscriptionPlanFeature.insertMany(
    normalizedFeatures.map(function (feature) {
      return {
        plan_id: plan._id,
        customer_type: plan.customer_type,
        feature_code: feature.feature_code,
        feature_value: feature.feature_value
      };
    })
  );
}

router.get("/meta/features", function (req, res) {
  return res.json({
    status: "true",
    data: Object.keys(PASSENGER_FEATURE_DEFINITIONS).map(function (code) {
      return {
        feature_code: code,
        label: PASSENGER_FEATURE_DEFINITIONS[code].label,
        type: PASSENGER_FEATURE_DEFINITIONS[code].type
      };
    })
  });
});

router.get("/", async function (req, res) {
  var query = {};
  if (req.query.customer_type) {
    query.customer_type = String(req.query.customer_type).trim().toUpperCase();
  }
  if (req.query.is_active === "true") {
    query.is_active = true;
  } else if (req.query.is_active === "false") {
    query.is_active = false;
  }

  try {
    var plans = await SubscriptionPlan.find(query)
      .sort({ customer_type: 1, display_order: 1, created_at: 1 })
      .exec();
    return res.json({
      status: "true",
      data: await hydratePlans(plans)
    });
  } catch (_error) {
    return res.json({ status: "false", data: [], message: "Unable to load subscription plans" });
  }
});

router.get("/:id", async function (req, res) {
  try {
    var plan = await SubscriptionPlan.findById(req.params.id).exec();
    if (!plan) {
      return res.json({ status: "false", message: "Subscription plan not found" });
    }
    var hydratedPlans = await hydratePlans([plan]);
    return res.json({
      status: "true",
      data: hydratedPlans[0]
    });
  } catch (_error) {
    return res.json({ status: "false", message: "Subscription plan not found" });
  }
});

router.post("/", async function (req, res) {
  var errors = validateSubscriptionPlanPayload(req.body || {});
  if (Object.keys(errors).length > 0) {
    return validationResponse(res, errors);
  }

  try {
    var plan = new SubscriptionPlan({});
    applySubscriptionPlanFields(plan, req.body || {});
    var savedPlan = await plan.save();
    await syncPlanFeatures(savedPlan, req.body && req.body.features);
    await logAuditFromRequest(req, {
      action: "subscription_plan.created",
      target_type: "subscription_plan",
      target_id: savedPlan._id,
      metadata: {
        customer_type: savedPlan.customer_type,
        name: savedPlan.name,
        price: savedPlan.price,
        duration_unit: savedPlan.duration_unit,
        duration_value: savedPlan.duration_value,
        daily_ride_limit: savedPlan.daily_ride_limit,
        is_unlimited: savedPlan.is_unlimited,
        is_active: savedPlan.is_active
      }
    });
    var hydratedPlans = await hydratePlans([savedPlan]);
    return res.json({
      status: "true",
      message: "Subscription plan created successfully",
      data: hydratedPlans[0]
    });
  } catch (err) {
    if (err && err.name === "ValidationError") {
      return validationResponse(res, { save: err.message });
    }
    return res.json({ status: "false", message: "Unable to create subscription plan" });
  }
});

router.put("/:id", async function (req, res) {
  var errors = validateSubscriptionPlanPayload(req.body || {});
  if (Object.keys(errors).length > 0) {
    return validationResponse(res, errors);
  }

  try {
    var plan = await SubscriptionPlan.findById(req.params.id).exec();
    if (!plan) {
      return res.json({ status: "false", message: "Subscription plan not found" });
    }

    applySubscriptionPlanFields(plan, req.body || {});
    var savedPlan = await plan.save();
    await syncPlanFeatures(savedPlan, req.body && req.body.features);
    await logAuditFromRequest(req, {
      action: "subscription_plan.updated",
      target_type: "subscription_plan",
      target_id: savedPlan._id,
      metadata: {
        customer_type: savedPlan.customer_type,
        name: savedPlan.name,
        price: savedPlan.price,
        duration_unit: savedPlan.duration_unit,
        duration_value: savedPlan.duration_value,
        daily_ride_limit: savedPlan.daily_ride_limit,
        is_unlimited: savedPlan.is_unlimited,
        is_active: savedPlan.is_active
      }
    });
    var hydratedPlans = await hydratePlans([savedPlan]);
    return res.json({
      status: "true",
      message: "Subscription plan updated successfully",
      data: hydratedPlans[0]
    });
  } catch (saveErr) {
    if (saveErr && saveErr.name === "ValidationError") {
      return validationResponse(res, { save: saveErr.message });
    }
    return res.json({ status: "false", message: "Unable to update subscription plan" });
  }
});

router.post("/:id/activate", async function (req, res) {
  try {
    var plan = await SubscriptionPlan.findById(req.params.id).exec();
    if (!plan) {
      return res.json({ status: "false", message: "Subscription plan not found" });
    }
    setPlanActiveStatus(plan, true);
    var savedPlan = await plan.save();
    await logAuditFromRequest(req, {
      action: "subscription_plan.activated",
      target_type: "subscription_plan",
      target_id: savedPlan._id,
      metadata: {
        customer_type: savedPlan.customer_type,
        name: savedPlan.name
      }
    });
    var hydratedPlans = await hydratePlans([savedPlan]);
    return res.json({
      status: "true",
      message: "Subscription plan activated successfully",
      data: hydratedPlans[0]
    });
  } catch (_error) {
    return res.json({ status: "false", message: "Unable to activate subscription plan" });
  }
});

router.post("/:id/deactivate", async function (req, res) {
  try {
    var plan = await SubscriptionPlan.findById(req.params.id).exec();
    if (!plan) {
      return res.json({ status: "false", message: "Subscription plan not found" });
    }
    setPlanActiveStatus(plan, false);
    var savedPlan = await plan.save();
    await logAuditFromRequest(req, {
      action: "subscription_plan.deactivated",
      target_type: "subscription_plan",
      target_id: savedPlan._id,
      metadata: {
        customer_type: savedPlan.customer_type,
        name: savedPlan.name
      }
    });
    var hydratedPlans = await hydratePlans([savedPlan]);
    return res.json({
      status: "true",
      message: "Subscription plan deactivated successfully",
      data: hydratedPlans[0]
    });
  } catch (_error) {
    return res.json({ status: "false", message: "Unable to deactivate subscription plan" });
  }
});

router.post("/reorder", async function (req, res) {
  var customerType = String(req.body.customer_type || "").trim().toUpperCase();
  if (!customerType) {
    return validationResponse(res, {
      customer_type: "Customer type is required for reordering"
    });
  }

  try {
    var plans = await SubscriptionPlan.find({ customer_type: customerType })
      .sort({ display_order: 1, created_at: 1 })
      .exec();
    var updates = buildPlanOrderUpdates(plans || [], req.body.ordered_ids || []);
    await Promise.all(
      updates.map(function (item) {
        return SubscriptionPlan.updateOne(
          { _id: item.id },
          { $set: { display_order: item.display_order } }
        ).exec();
      })
    );
    var updatedPlans = await SubscriptionPlan.find({ customer_type: customerType })
      .sort({ display_order: 1, created_at: 1 })
      .exec();
    await logAuditFromRequest(req, {
      action: "subscription_plan.reordered",
      target_type: "subscription_plan_order",
      target_id: customerType,
      metadata: {
        customer_type: customerType,
        ordered_ids: req.body.ordered_ids || []
      }
    });
    return res.json({
      status: "true",
      message: "Subscription plans reordered successfully",
      data: await hydratePlans(updatedPlans)
    });
  } catch (_error) {
    return res.json({ status: "false", message: "Unable to reorder subscription plans" });
  }
});

router.delete("/:id", function (req, res) {
  Subscription.findOne({ plan_id: req.params.id }).exec(function (subscriptionErr, subscription) {
    if (subscriptionErr) {
      return res.json({ status: "false", message: "Unable to delete subscription plan" });
    }
    if (subscription) {
      return res.json({
        status: "false",
        message: "Subscription plan cannot be deleted because it is referenced by subscriptions"
      });
    }

    SubscriptionPlan.findByIdAndDelete(req.params.id).exec(function (err, plan) {
      if (err || !plan) {
        return res.json({ status: "false", message: "Subscription plan not found" });
      }
      SubscriptionPlanFeature.deleteMany({ plan_id: plan._id }).exec();
      logAuditFromRequest(req, {
        action: "subscription_plan.deleted",
        target_type: "subscription_plan",
        target_id: plan._id,
        metadata: {
          customer_type: plan.customer_type,
          name: plan.name
        }
      });
      return res.json({
        status: "true",
        message: "Subscription plan deleted successfully"
      });
    });
  });
});

module.exports = router;
