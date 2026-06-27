"use strict";

const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || "Africa/Dar_es_Salaam";

function now() {
  return new Date();
}

function timestampSeconds(date) {
  const value = date instanceof Date ? date : now();
  return Math.floor(value.getTime() / 1000);
}

function isoAfterMinutes(minutes, date) {
  const base = date instanceof Date ? new Date(date.getTime()) : now();
  const safeMinutes = Number.isFinite(Number(minutes)) ? Number(minutes) : 0;
  base.setMinutes(base.getMinutes() + safeMinutes);
  return base.toISOString();
}

function formatInTimezone(date, timezone) {
  const value = date instanceof Date ? date : now();
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || DEFAULT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(value);
}

module.exports = {
  DEFAULT_TIMEZONE,
  formatInTimezone,
  isoAfterMinutes,
  timestampSeconds
};
