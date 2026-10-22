import { ROLES } from "./roles.js";

export const DASHBOARD_RANGES = Object.freeze({
  LAST_7_DAYS: "7d",
  LAST_30_DAYS: "30d",
  LAST_12_MONTHS: "12m",
});
export const DASHBOARD_RANGE_VALUES = Object.freeze(Object.values(DASHBOARD_RANGES));
export const DEFAULT_DASHBOARD_RANGE = DASHBOARD_RANGES.LAST_7_DAYS;

export const BUCKET_UNITS = Object.freeze({ DAY: "day", MONTH: "month" });

// How the revenue chart is bucketed for each range.
export const RANGE_SPECS = Object.freeze({
  [DASHBOARD_RANGES.LAST_7_DAYS]: { unit: BUCKET_UNITS.DAY, count: 7 },
  [DASHBOARD_RANGES.LAST_30_DAYS]: { unit: BUCKET_UNITS.DAY, count: 30 },
  [DASHBOARD_RANGES.LAST_12_MONTHS]: { unit: BUCKET_UNITS.MONTH, count: 12 },
});

export const LIST_LIMIT = Object.freeze({ DEFAULT: 5, MAX: 20 });

export const DASHBOARD_CARDS = Object.freeze({
  PATIENTS: "patients",
  APPOINTMENTS: "appointments",
  REVENUE: "revenue",
  LOW_STOCK: "lowStock",
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));

// Who may see each KPI card (and the data behind it).
export const CARD_ROLES = Object.freeze({
  [DASHBOARD_CARDS.PATIENTS]: [ROLES.ADMIN, ROLES.RECEPTIONIST],
  [DASHBOARD_CARDS.APPOINTMENTS]: ALL_ROLES,
  [DASHBOARD_CARDS.REVENUE]: [ROLES.ADMIN],
  [DASHBOARD_CARDS.LOW_STOCK]: ALL_ROLES,
});

export const ACTIVITY_TYPES = Object.freeze({
  PATIENT_REGISTERED: "patient_registered",
  APPOINTMENT_BOOKED: "appointment_booked",
  INVOICE_PAID: "invoice_paid",
  STOCK_MOVED: "stock_moved",
});

// Who may see each kind of activity.
export const ACTIVITY_ROLES = Object.freeze({
  [ACTIVITY_TYPES.PATIENT_REGISTERED]: [ROLES.ADMIN, ROLES.RECEPTIONIST],
  [ACTIVITY_TYPES.APPOINTMENT_BOOKED]: ALL_ROLES,
  [ACTIVITY_TYPES.INVOICE_PAID]: [ROLES.ADMIN],
  [ACTIVITY_TYPES.STOCK_MOVED]: [ROLES.ADMIN, ROLES.RECEPTIONIST],
});
