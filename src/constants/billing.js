export const INVOICE_NUMBER_PREFIX = "INV";
export const INVOICE_NUMBER_PAD = 6;

export const INVOICE_STATUSES = Object.freeze({
  PENDING: "pending",
  PAID: "paid",
  OVERDUE: "overdue",
  CANCELLED: "cancelled",
});
export const INVOICE_STATUS_VALUES = Object.freeze(Object.values(INVOICE_STATUSES));

/** Days after last payment (or creation) before unpaid balance is overdue. */
export const INVOICE_OVERDUE_DAYS = 30;

export const PAYMENT_METHODS = Object.freeze({
  CASH: "cash",
  CARD: "card",
  BKASH: "bkash",
  NAGAD: "nagad",
  BANK: "bank",
  OTHER: "other",
});
export const PAYMENT_METHOD_VALUES = Object.freeze(Object.values(PAYMENT_METHODS));

export const INVOICE_PROBLEM_MAX = 500;
export const INVOICE_TREATMENT_MAX = 500;
export const INVOICE_NOTES_MAX = 2000;
export const PAYMENT_NOTE_MAX = 500;
export const VOID_REASON_MAX = 500;
