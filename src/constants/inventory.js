export const STOCK_MOVEMENT_TYPES = Object.freeze({
  IN: "in",
  OUT: "out",
  ADJUST: "adjust",
});
export const STOCK_MOVEMENT_TYPE_VALUES = Object.freeze(Object.values(STOCK_MOVEMENT_TYPES));

export const ITEM_TYPES = Object.freeze({
  MEDICINE: "medicine",
  TOOL: "tool",
});
export const ITEM_TYPE_VALUES = Object.freeze(Object.values(ITEM_TYPES));

export const MED_NAME_MAX = 120;
export const MED_SKU_MAX = 40;
export const MED_CATEGORY_MAX = 60;
export const MED_UNIT_MAX = 20;
export const MED_SUPPLIER_MAX = 120;
export const MOVEMENT_REASON_MAX = 200;
export const MOVEMENT_NOTE_MAX = 500;

export const DEFAULT_UNITS = Object.freeze(["pcs", "box", "ml", "mg", "bottle", "pack"]);
