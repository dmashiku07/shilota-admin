const timezone = require("../utils/timezone");
const Subscription = require("../schema/subscriptions");
const RideOffer = require("../schema/rideoffers");
const Rides = require("../schema/rides");
const Driver = require("../schema/driver");
const DriverDestinationBroadcast = require("../schema/driverdestinationbroadcasts");
const DriverDestinationJoinRequest = require("../schema/driverdestinationjoinrequests");
const Settlement = require("../schema/settlement");
const AuditLog = require("../schema/auditlogs");
const {
  expireDriverSubscriptions,
  resetDailyUsageCounters
} = require("./driverSubscriptionService");
const {
  expirePassengerSubscriptions
} = require("./passengerSubscriptionService");
const {
  expireDriverDestinationBroadcasts,
  reconcilePendingDestinationBroadcastPayments
} = require("./driverDestinationBroadcastService");

function startOfBusinessDay(date) {
  const parts = timezone.formatInTimezone(date, timezone.DEFAULT_TIMEZONE).slice(0, 10).split("-");
  return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 0, 0, 0, 0));
}

function endOfBusinessDay(date) {
  const start = startOfBusinessDay(date);
  start.setUTCDate(start.getUTCDate() + 1);
  return start;
}

async function buildRevenueSummary() {
  const subscriptionRevenue = await Subscription.aggregate([
    {
      $match: {
        payment_status: "PAID"
      }
    },
    {
      $group: {
        _id: "$customer_type",
        total_revenue: {
          $sum: "$price_snapshot"
        },
        count: {
          $sum: 1
        }
      }
    }
  ]).exec();

  const destinationRevenue = await DriverDestinationBroadcast.aggregate([
    {
      $group: {
        _id: "$payment_status",
        total_revenue: {
          $sum: {
            $cond: [{ $eq: ["$payment_status", "PAID"] }, "$broadcast_fee", 0]
          }
        },
        count: {
          $sum: 1
        }
      }
    }
  ]).exec();

  const legacyCommission = await Settlement.aggregate([
    {
      $group: {
        _id: null,
        total_revenue: {
          $sum: "$total_commissionAmt"
        },
        count: {
          $sum: 1
        }
      }
    }
  ]).exec();

  const driverSubscriptions = subscriptionRevenue.find(function (item) {
    return item._id === "DRIVER";
  });
  const passengerSubscriptions = subscriptionRevenue.find(function (item) {
    return item._id === "PASSENGER";
  });
  const paidDestinationRevenue = destinationRevenue.find(function (item) {
    return item._id === "PAID";
  });
  const legacy = legacyCommission && legacyCommission[0] ? legacyCommission[0] : null;

  return {
    driver_subscription_revenue: Number(driverSubscriptions && driverSubscriptions.total_revenue || 0),
    driver_subscription_count: Number(driverSubscriptions && driverSubscriptions.count || 0),
    passenger_subscription_revenue: Number(passengerSubscriptions && passengerSubscriptions.total_revenue || 0),
    passenger_subscription_count: Number(passengerSubscriptions && passengerSubscriptions.count || 0),
    driver_broadcast_revenue: Number(paidDestinationRevenue && paidDestinationRevenue.total_revenue || 0),
    driver_broadcast_paid_count: Number(paidDestinationRevenue && paidDestinationRevenue.count || 0),
    legacy_commission_revenue: Number(legacy && legacy.total_revenue || 0),
    legacy_commission_settlement_count: Number(legacy && legacy.count || 0)
  };
}

async function buildSubscriptionSummary(now) {
  const expiringStart = now instanceof Date ? now : new Date();
  const expiringEnd = new Date(expiringStart.getTime() + (7 * 24 * 60 * 60 * 1000));

  const statusCounts = await Subscription.aggregate([
    {
      $group: {
        _id: {
          customer_type: "$customer_type",
          status: "$status"
        },
        count: {
          $sum: 1
        }
      }
    }
  ]).exec();

  const expiringCounts = await Subscription.aggregate([
    {
      $match: {
        status: "ACTIVE",
        expires_at: {
          $gte: expiringStart,
          $lte: expiringEnd
        }
      }
    },
    {
      $group: {
        _id: "$customer_type",
        count: {
          $sum: 1
        }
      }
    }
  ]).exec();

  const summary = {
    active_subscriptions: 0,
    expired_subscriptions: 0,
    expiring_subscriptions: 0,
    active_driver_subscriptions: 0,
    active_passenger_subscriptions: 0,
    expired_driver_subscriptions: 0,
    expired_passenger_subscriptions: 0,
    expiring_driver_subscriptions: 0,
    expiring_passenger_subscriptions: 0
  };

  (statusCounts || []).forEach(function (row) {
    const customerType = String(row._id && row._id.customer_type || "").toUpperCase();
    const status = String(row._id && row._id.status || "").toUpperCase();
    const count = Number(row.count || 0);
    if (status === "ACTIVE") {
      summary.active_subscriptions += count;
      if (customerType === "DRIVER") {
        summary.active_driver_subscriptions += count;
      } else if (customerType === "PASSENGER") {
        summary.active_passenger_subscriptions += count;
      }
    }
    if (status === "EXPIRED") {
      summary.expired_subscriptions += count;
      if (customerType === "DRIVER") {
        summary.expired_driver_subscriptions += count;
      } else if (customerType === "PASSENGER") {
        summary.expired_passenger_subscriptions += count;
      }
    }
  });

  (expiringCounts || []).forEach(function (row) {
    const customerType = String(row._id || "").toUpperCase();
    const count = Number(row.count || 0);
    summary.expiring_subscriptions += count;
    if (customerType === "DRIVER") {
      summary.expiring_driver_subscriptions += count;
    } else if (customerType === "PASSENGER") {
      summary.expiring_passenger_subscriptions += count;
    }
  });

  return summary;
}

async function buildSubscriptionsByPlan() {
  return Subscription.aggregate([
    {
      $group: {
        _id: {
          customer_type: "$customer_type",
          plan_name_snapshot: "$plan_name_snapshot",
          status: "$status"
        },
        subscriber_count: {
          $sum: 1
        },
        total_revenue: {
          $sum: {
            $cond: [{ $eq: ["$payment_status", "PAID"] }, "$price_snapshot", 0]
          }
        }
      }
    },
    {
      $sort: {
        "_id.customer_type": 1,
        "_id.plan_name_snapshot": 1,
        "_id.status": 1
      }
    }
  ]).exec();
}

async function buildCompletedRidesByDriverPlan() {
  return Rides.aggregate([
    {
      $match: {
        ridestatus: "completed",
        driver_id: {
          $nin: ["", null]
        }
      }
    },
    {
      $lookup: {
        from: "subscriptions",
        let: {
          driverId: "$driver_id",
          completedAt: "$ride_completed_at"
        },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$customer_type", "DRIVER"] },
                  { $eq: [{ $toString: "$driver_id" }, "$$driverId"] },
                  { $eq: ["$status", "ACTIVE"] },
                  { $lte: ["$starts_at", "$$completedAt"] },
                  { $gt: ["$expires_at", "$$completedAt"] }
                ]
              }
            }
          },
          {
            $sort: {
              expires_at: -1
            }
          },
          {
            $limit: 1
          }
        ],
        as: "subscription_snapshot"
      }
    },
    {
      $addFields: {
        ride_plan_name: {
          $ifNull: [
            {
              $arrayElemAt: ["$subscription_snapshot.plan_name_snapshot", 0]
            },
            "NO_ACTIVE_PLAN"
          ]
        }
      }
    },
    {
      $group: {
        _id: "$ride_plan_name",
        completed_rides: {
          $sum: 1
        },
        final_revenue: {
          $sum: {
            $ifNull: ["$final_ride_amount", "$final_agreed_price"]
          }
        }
      }
    },
    {
      $sort: {
        completed_rides: -1,
        _id: 1
      }
    }
  ]).exec();
}

async function buildDriversAtDailyLimits(now) {
  const todayKey = timezone.formatInTimezone(now || new Date(), timezone.DEFAULT_TIMEZONE).slice(0, 10);
  const subscriptions = await Subscription.find({
    customer_type: "DRIVER",
    status: "ACTIVE",
    is_unlimited_snapshot: {
      $ne: true
    },
    ride_count_date: todayKey
  }).exec();

  const limited = (subscriptions || []).filter(function (subscription) {
    return Number(subscription.rides_used_today || 0) >= Number(subscription.daily_limit_snapshot || 0);
  });

  const driverIds = limited.map(function (subscription) {
    return subscription.driver_id;
  }).filter(Boolean);
  const drivers = await Driver.find({
    _id: {
      $in: driverIds
    }
  }).select("_id full_name email phone_number live_status").exec();
  const driverMap = (drivers || []).reduce(function (result, driver) {
    result[String(driver._id)] = driver;
    return result;
  }, {});

  return limited.map(function (subscription) {
    const driver = driverMap[String(subscription.driver_id)];
    return {
      subscription_id: subscription._id,
      driver_id: subscription.driver_id,
      driver_name: driver ? driver.full_name : "",
      driver_email: driver ? driver.email : "",
      driver_phone_number: driver ? driver.phone_number : "",
      plan_name_snapshot: subscription.plan_name_snapshot,
      rides_used_today: Number(subscription.rides_used_today || 0),
      daily_limit_snapshot: Number(subscription.daily_limit_snapshot || 0),
      remaining_rides: 0,
      ride_count_date: subscription.ride_count_date,
      driver_live_status: driver ? driver.live_status : null
    };
  });
}

async function buildNormalRideOfferStatistics() {
  const standardRideIds = await Rides.find({
    request_type: "STANDARD"
  }).select("_id").exec();
  const rideIds = standardRideIds.map(function (ride) {
    return String(ride._id);
  });

  const rows = await RideOffer.aggregate([
    {
      $match: {
        ride_request_id: {
          $in: rideIds
        }
      }
    },
    {
      $group: {
        _id: "$status",
        count: {
          $sum: 1
        },
        average_price: {
          $avg: "$offered_price"
        }
      }
    }
  ]).exec();

  const result = {
    total_standard_requests: rideIds.length,
    total_offers: 0,
    accepted_offers: 0,
    rejected_offers: 0,
    withdrawn_offers: 0,
    expired_offers: 0,
    pending_offers: 0,
    average_offer_price: 0
  };

  let weightedPrice = 0;
  (rows || []).forEach(function (row) {
    const status = String(row._id || "").toUpperCase();
    const count = Number(row.count || 0);
    const average = Number(row.average_price || 0);
    result.total_offers += count;
    weightedPrice += average * count;
    if (status === "ACCEPTED") {
      result.accepted_offers = count;
    } else if (status === "REJECTED") {
      result.rejected_offers = count;
    } else if (status === "WITHDRAWN") {
      result.withdrawn_offers = count;
    } else if (status === "EXPIRED") {
      result.expired_offers = count;
    } else if (status === "PENDING") {
      result.pending_offers = count;
    }
  });
  result.average_offer_price = result.total_offers > 0 ? Number((weightedPrice / result.total_offers).toFixed(2)) : 0;
  return result;
}

async function buildPassengerPriceBroadcastStatistics() {
  const broadcasts = await Rides.find({
    request_type: "PASSENGER_PRICE_BROADCAST"
  }).select("_id ridestatus accepted_offer_id passenger_offered_price").exec();
  const broadcastIds = broadcasts.map(function (ride) {
    return String(ride._id);
  });

  const offerBreakdown = await RideOffer.aggregate([
    {
      $match: {
        ride_request_id: {
          $in: broadcastIds
        }
      }
    },
    {
      $group: {
        _id: "$offer_type",
        count: {
          $sum: 1
        }
      }
    }
  ]).exec();

  const stats = {
    total_broadcasts: broadcasts.length,
    completed_broadcasts: broadcasts.filter(function (item) { return item.ridestatus === "completed"; }).length,
    accepted_broadcasts: broadcasts.filter(function (item) { return !!item.accepted_offer_id; }).length,
    accept_passenger_price_offers: 0,
    driver_counter_offers: 0,
    driver_direct_offers: 0
  };

  (offerBreakdown || []).forEach(function (row) {
    const type = String(row._id || "").toUpperCase();
    if (type === "ACCEPT_PASSENGER_PRICE") {
      stats.accept_passenger_price_offers = Number(row.count || 0);
    } else if (type === "DRIVER_COUNTER_OFFER") {
      stats.driver_counter_offers = Number(row.count || 0);
    } else if (type === "DRIVER_DIRECT_OFFER") {
      stats.driver_direct_offers = Number(row.count || 0);
    }
  });

  return stats;
}

async function buildDriverDestinationBroadcastConversion() {
  const summaryRows = await DriverDestinationBroadcast.aggregate([
    {
      $group: {
        _id: "$status",
        count: {
          $sum: 1
        },
        revenue: {
          $sum: {
            $cond: [{ $eq: ["$payment_status", "PAID"] }, "$broadcast_fee", 0]
          }
        }
      }
    }
  ]).exec();

  const joinRows = await DriverDestinationJoinRequest.aggregate([
    {
      $group: {
        _id: "$status",
        count: {
          $sum: 1
        }
      }
    }
  ]).exec();

  const result = {
    total_broadcasts: 0,
    active_broadcasts: 0,
    full_broadcasts: 0,
    completed_broadcasts: 0,
    expired_broadcasts: 0,
    paid_broadcast_revenue: 0,
    pending_join_requests: 0,
    accepted_join_requests: 0,
    rejected_join_requests: 0,
    cancelled_join_requests: 0,
    expired_join_requests: 0
  };

  (summaryRows || []).forEach(function (row) {
    const status = String(row._id || "").toUpperCase();
    const count = Number(row.count || 0);
    result.total_broadcasts += count;
    result.paid_broadcast_revenue += Number(row.revenue || 0);
    if (status === "ACTIVE") {
      result.active_broadcasts = count;
    } else if (status === "FULL") {
      result.full_broadcasts = count;
    } else if (status === "COMPLETED") {
      result.completed_broadcasts = count;
    } else if (status === "EXPIRED") {
      result.expired_broadcasts = count;
    }
  });

  (joinRows || []).forEach(function (row) {
    const status = String(row._id || "").toUpperCase();
    const count = Number(row.count || 0);
    if (status === "PENDING") {
      result.pending_join_requests = count;
    } else if (status === "ACCEPTED") {
      result.accepted_join_requests = count;
    } else if (status === "REJECTED") {
      result.rejected_join_requests = count;
    } else if (status === "CANCELLED") {
      result.cancelled_join_requests = count;
    } else if (status === "EXPIRED") {
      result.expired_join_requests = count;
    }
  });

  return result;
}

async function buildRecentAuditLogs(limit) {
  const items = await AuditLog.find({})
    .sort({ created_at: -1 })
    .limit(Math.min(Math.max(Number(limit || 20), 1), 100))
    .exec();
  return items || [];
}

async function buildReportingOverview(now) {
  const comparisonDate = now instanceof Date ? now : new Date();
  await expireDriverSubscriptions(comparisonDate);
  await expirePassengerSubscriptions(comparisonDate);

  return {
    generated_at: comparisonDate,
    business_date: timezone.formatInTimezone(comparisonDate, timezone.DEFAULT_TIMEZONE).slice(0, 10),
    revenue: await buildRevenueSummary(),
    subscriptions: await buildSubscriptionSummary(comparisonDate),
    subscriptions_by_plan: await buildSubscriptionsByPlan(),
    completed_rides_by_driver_plan: await buildCompletedRidesByDriverPlan(),
    drivers_at_daily_limits: await buildDriversAtDailyLimits(comparisonDate),
    normal_ride_offers: await buildNormalRideOfferStatistics(),
    passenger_price_broadcasts: await buildPassengerPriceBroadcastStatistics(),
    driver_destination_broadcasts: await buildDriverDestinationBroadcastConversion()
  };
}

async function reconcileSubscriptionStatuses(now) {
  const comparisonDate = now instanceof Date ? now : new Date();
  await expireDriverSubscriptions(comparisonDate);
  await expirePassengerSubscriptions(comparisonDate);
  const expiredDrivers = await Subscription.countDocuments({
    customer_type: "DRIVER",
    status: "EXPIRED"
  }).exec();
  const expiredPassengers = await Subscription.countDocuments({
    customer_type: "PASSENGER",
    status: "EXPIRED"
  }).exec();
  return {
    expired_driver_subscriptions: expiredDrivers,
    expired_passenger_subscriptions: expiredPassengers
  };
}

async function reconcileDailyRideUsage(now) {
  const comparisonDate = now instanceof Date ? now : new Date();
  await resetDailyUsageCounters(comparisonDate);
  const start = startOfBusinessDay(comparisonDate);
  const end = endOfBusinessDay(comparisonDate);
  const rides = await Rides.aggregate([
    {
      $match: {
        ridestatus: "completed",
        ride_completed_at: {
          $gte: start,
          $lt: end
        },
        driver_id: {
          $nin: ["", null]
        }
      }
    },
    {
      $group: {
        _id: "$driver_id",
        completed_rides: {
          $sum: 1
        }
      }
    }
  ]).exec();

  for (const item of rides) {
    await Subscription.updateMany(
      {
        customer_type: "DRIVER",
        driver_id: item._id,
        ride_count_date: timezone.formatInTimezone(comparisonDate, timezone.DEFAULT_TIMEZONE).slice(0, 10)
      },
      {
        $set: {
          rides_used_today: Number(item.completed_rides || 0)
        }
      }
    ).exec();
  }

  return {
    reconciled_drivers: rides.length,
    business_date: timezone.formatInTimezone(comparisonDate, timezone.DEFAULT_TIMEZONE).slice(0, 10)
  };
}

async function reconcilePendingPayments(now) {
  await reconcilePendingDestinationBroadcastPayments(now instanceof Date ? now : new Date());
  const remaining = await DriverDestinationBroadcast.countDocuments({
    status: "PENDING_PAYMENT"
  }).exec();
  return {
    remaining_pending_destination_broadcasts: remaining
  };
}

async function reconcileExpiredOffers(now) {
  const comparisonDate = now instanceof Date ? now : new Date();
  const result = await RideOffer.updateMany(
    {
      status: "PENDING",
      expires_at: {
        $lte: comparisonDate
      }
    },
    {
      $set: {
        status: "EXPIRED"
      }
    }
  ).exec();
  return {
    expired_offer_updates: Number(result && (result.modifiedCount || result.nModified) || 0)
  };
}

async function reconcileExpiredBroadcasts(now) {
  const comparisonDate = now instanceof Date ? now : new Date();
  await expireDriverDestinationBroadcasts(comparisonDate);
  const count = await DriverDestinationBroadcast.countDocuments({
    status: "EXPIRED"
  }).exec();
  return {
    expired_broadcasts: count
  };
}

module.exports = {
  buildRecentAuditLogs,
  buildReportingOverview,
  reconcileDailyRideUsage,
  reconcileExpiredBroadcasts,
  reconcileExpiredOffers,
  reconcilePendingPayments,
  reconcileSubscriptionStatuses
};
