const config = require("../config");

function toMoney(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.round(parsed * 100) / 100;
}

function isCommissionEnabled() {
  return config.featureFlags.commission_enabled !== false;
}

function calculateCommissionAmount(baseFare, commissionBands, commissionEnabled) {
  if (!commissionEnabled) {
    return 0;
  }

  const normalizedBaseFare = toMoney(baseFare);
  let commissionAmount = 0;

  (commissionBands || []).forEach(function (band) {
    const lowerBound = Number(band && band.price_from);
    const upperBound = Number(band && band.price_to);
    const percentage = Number(band && band.percentage);

    if (
      Number.isFinite(lowerBound) &&
      Number.isFinite(upperBound) &&
      Number.isFinite(percentage) &&
      normalizedBaseFare >= lowerBound &&
      normalizedBaseFare <= upperBound
    ) {
      commissionAmount = normalizedBaseFare * (percentage / 100);
    }
  });

  return toMoney(commissionAmount);
}

function calculateTaxAmount(baseFare, taxRate) {
  return toMoney(toMoney(baseFare) * (Number(taxRate || 0) / 100));
}

function getRideFinalAmount(ride, roundCustomerPayableAmount) {
  const explicitFinalAmount = Number(ride && ride.final_ride_amount);
  if (Number.isFinite(explicitFinalAmount) && explicitFinalAmount > 0) {
    return toMoney(explicitFinalAmount);
  }

  const quotedFare = toMoney(ride && ride.baseprice);
  const taxAmount = toMoney(ride && ride.tax);
  const rawTotal = quotedFare + taxAmount;
  if (typeof roundCustomerPayableAmount === "function") {
    return toMoney(roundCustomerPayableAmount(rawTotal));
  }

  return toMoney(rawTotal);
}

function applyRideCompletionFinancials(options) {
  const ride = options.ride;
  const baseFare = toMoney(options.baseFare);
  const taxAmount = calculateTaxAmount(baseFare, options.taxRate);
  const commissionEnabled =
    typeof options.commissionEnabled === "boolean"
      ? options.commissionEnabled
      : isCommissionEnabled();
  const commissionAmount = calculateCommissionAmount(
    baseFare,
    options.commissionBands,
    commissionEnabled
  );
  const quotedFare = toMoney(baseFare + commissionAmount);
  const roundFn = options.roundCustomerPayableAmount;
  const finalRideAmount = typeof roundFn === "function"
    ? toMoney(roundFn(quotedFare + taxAmount))
    : toMoney(quotedFare + taxAmount);

  ride.total = baseFare;
  ride.baseprice = quotedFare;
  ride.commissionamount = commissionAmount;
  ride.tax = taxAmount;
  ride.final_ride_amount = finalRideAmount;
  ride.payment_status = ride.payment_status || "unpaid";
  ride.payment_direct_to_driver = commissionEnabled ? 0 : 1;

  return {
    baseFare: baseFare,
    quotedFare: quotedFare,
    commissionAmount: commissionAmount,
    taxAmount: taxAmount,
    finalRideAmount: finalRideAmount,
    paymentDirectToDriver: ride.payment_direct_to_driver
  };
}

function markRidePaymentComplete(ride, paymentMethod, paidAt) {
  ride.payment_status = "paid";
  ride.payment_type = paymentMethod || ride.payment_type;
  ride.payment_recorded_at = paidAt || new Date();
  if (!isCommissionEnabled()) {
    ride.payment_direct_to_driver = 1;
  }
  return ride;
}

function markRidePaymentPending(ride, paymentMethod) {
  ride.payment_status = "unpaid";
  ride.payment_type = paymentMethod || ride.payment_type;
  if (!isCommissionEnabled()) {
    ride.payment_direct_to_driver = 1;
  }
  return ride;
}

function buildPaymentDocument(options) {
  const ride = options.ride;
  const paidAt = options.paidAt || new Date();
  const directToDriver = !isCommissionEnabled();

  return {
    status: "completed",
    user_id: String(options.userId),
    onride_id: String(ride._id),
    driver_id: String(options.driverId || ride.driver_id || ""),
    payment_type: String(options.paymentType || ride.payment_type || "cash"),
    ride_fare: getRideFinalAmount(ride, options.roundCustomerPayableAmount),
    transaction_id: options.transactionId || "",
    baseprice: toMoney(ride.total),
    tax: toMoney(ride.tax),
    commissionamount: toMoney(ride.commissionamount),
    paidbywallet: toMoney(options.paidByWallet),
    paid: directToDriver ? 1 : 0,
    payment_status: "paid",
    direct_to_driver: directToDriver ? 1 : 0,
    paid_at: paidAt,
    drop_time: paidAt
  };
}

function isLegacyCommissionRide(record) {
  return toMoney(record && record.commissionamount) > 0;
}

function isSettlementEligiblePayment(record) {
  return Number(record && record.direct_to_driver || 0) !== 1 && Number(record && record.paid || 0) === 0;
}

module.exports = {
  applyRideCompletionFinancials,
  buildPaymentDocument,
  calculateCommissionAmount,
  calculateTaxAmount,
  getRideFinalAmount,
  isCommissionEnabled,
  isLegacyCommissionRide,
  isSettlementEligiblePayment,
  markRidePaymentComplete,
  markRidePaymentPending,
  toMoney
};
