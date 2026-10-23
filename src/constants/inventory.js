import { TIMEZONE } from "./locale.js";

export { TIMEZONE };

export const MEDICATION_ITEM_TYPES = Object.freeze({
  MEDICINE: "medicine",
  TOOL: "tool",
});
export const MEDICATION_ITEM_TYPE_VALUES = Object.freeze(Object.values(MEDICATION_ITEM_TYPES));

export const MEDICATION_CATEGORIES = Object.freeze([
  "Analgesic",
  "Antibiotic",
  "Anesthetic",
  "Antiseptic",
  "Consumable",
  "Instrument",
  "Other",
]);

export const MEDICATION_UNITS = Object.freeze([
  "pcs",
  "box",
  "bottle",
  "ml",
  "g",
  "pack",
  "tube",
  "units",
]);

export const STOCK_STATUSES = Object.freeze({
  OUT_OF_STOCK: "out_of_stock",
  LOW_STOCK: "low_stock",
  IN_STOCK: "in_stock",
});
export const STOCK_STATUS_VALUES = Object.freeze(Object.values(STOCK_STATUSES));

export const EXPIRY_FLAGS = Object.freeze({
  EXPIRED: "expired",
  EXPIRING_SOON: "expiring_soon",
  OK: "ok",
  NONE: "none",
});
export const EXPIRY_FLAG_VALUES = Object.freeze(Object.values(EXPIRY_FLAGS));

/** Days ahead for "expiring soon". */
export const EXPIRY_SOON_DAYS = 30;

export const STOCK_MOVEMENT_TYPES = Object.freeze({
  IN: "in",
  OUT: "out",
  ADJUST: "adjust",
});
export const STOCK_MOVEMENT_TYPE_VALUES = Object.freeze(Object.values(STOCK_MOVEMENT_TYPES));

export const STOCK_IN_REASONS = Object.freeze(["Purchase", "Return", "Transfer in", "Other"]);
export const STOCK_OUT_REASONS = Object.freeze(["Used", "Expired", "Damaged", "Transfer out", "Other"]);
export const STOCK_ADJUST_REASONS = Object.freeze(["Recount", "Correction", "Other"]);

export const MOVEMENT_REASONS = Object.freeze({
  [STOCK_MOVEMENT_TYPES.IN]: STOCK_IN_REASONS,
  [STOCK_MOVEMENT_TYPES.OUT]: STOCK_OUT_REASONS,
  [STOCK_MOVEMENT_TYPES.ADJUST]: STOCK_ADJUST_REASONS,
});

export const MEDICATION_NAME_MAX = 120;
export const MEDICATION_SKU_MAX = 40;
export const MEDICATION_SUPPLIER_MAX = 120;
export const MOVEMENT_NOTE_MAX = 500;
export const MOVEMENT_REFERENCE_MAX = 80;
export const SKU_PREFIX = "MED";

export const INVENTORY_STATS_WINDOW_DAYS = 30;
