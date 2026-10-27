export const INVOICE_NUMBER_PREFIX = "INV";
export const INVOICE_NUMBER_PAD = 6;
export const INVOICE_OVERDUE_DAYS = 30;

export const INVOICE_STATUSES = Object.freeze({
  PENDING: "pending",
  PAID: "paid",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
});
export const INVOICE_STATUS_VALUES = Object.freeze(Object.values(INVOICE_STATUSES));

export const PAYMENT_METHODS = Object.freeze({
  CASH: "cash",
  CARD: "card",
  BKASH: "bkash",
  NAGAD: "nagad",
  BANK: "bank",
  OTHER: "other",
});
export const PAYMENT_METHOD_VALUES = Object.freeze(Object.values(PAYMENT_METHODS));

export const LINE_ITEM_DESCRIPTION_MAX = 200;
export const MAX_LINE_ITEMS = 40;
export const INVOICE_NOTES_MAX = 2000;
export const INVOICE_TERMS_MAX = 2000;
export const PAYMENT_NOTE_MAX = 500;
export const VOID_REASON_MAX = 500;
export const PATIENT_NAME_MAX = 120;

export const CLINIC_DEFAULTS = Object.freeze({
  NAME: "DentalCore Clinic",
  CONTACT: "Clinic Admin",
  ADDRESS: "House 12, Road 5",
  CITY: "Dhaka",
  REGION: "Dhaka",
  POSTAL: "1205",
  COUNTRY: "Bangladesh",
});
