function normalizeMoney(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function roundUpToStep(value, step) {
  const amount = normalizeMoney(value);
  const increment = Number(step);
  if (!Number.isFinite(increment) || increment <= 0) {
    return Math.round(amount * 100) / 100;
  }

  return Math.ceil(amount / increment) * increment;
}

function roundCustomerPayableAmount(value) {
  return roundUpToStep(value, 500);
}

module.exports = {
  roundCustomerPayableAmount,
  roundUpToStep
};
