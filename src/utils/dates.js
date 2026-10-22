import { BUCKET_UNITS } from "../constants/dashboard.js";
import { TIMEZONE_OFFSET_MINUTES } from "../constants/locale.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const OFFSET_MS = TIMEZONE_OFFSET_MINUTES * 60 * 1000;

// Shift a UTC instant so its UTC fields read as clinic-local time.
const toLocal = (date) => new Date(date.getTime() + OFFSET_MS);
const fromLocalUtc = (ms) => new Date(ms - OFFSET_MS);

export const addDays = (date, days) => new Date(date.getTime() + days * DAY_MS);

// Midnight (clinic time) at the start of the day containing `date`.
export const startOfDay = (date = new Date()) =>
  fromLocalUtc(Math.floor(toLocal(date).getTime() / DAY_MS) * DAY_MS);

// First moment of the clinic-time month containing `date`.
export const startOfMonth = (date = new Date()) => {
  const local = toLocal(date);
  return fromLocalUtc(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1));
};

// `date` must be a month start. Negative `months` go back.
export const addMonths = (date, months) => {
  const local = toLocal(date);
  return fromLocalUtc(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + months, 1));
};

// "2026-10-20" (day) or "2026-10" (month): the same key MongoDB's $dateToString produces.
export const bucketKey = (date, unit) => {
  const iso = toLocal(date).toISOString();
  return unit === BUCKET_UNITS.DAY ? iso.slice(0, 10) : iso.slice(0, 7);
};
