export const USER_STATUSES = Object.freeze({
  ACTIVE: "active",
  INACTIVE: "inactive",
});
export const USER_STATUS_VALUES = Object.freeze(Object.values(USER_STATUSES));

export const APPOINTMENT_STATUSES = Object.freeze({
  PENDING: "pending",
  CONFIRMED: "confirmed",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  NO_SHOW: "no_show",
  RESCHEDULED: "rescheduled",
});
export const APPOINTMENT_STATUS_VALUES = Object.freeze(Object.values(APPOINTMENT_STATUSES));
export const OPEN_APPOINTMENT_STATUSES = Object.freeze([
  APPOINTMENT_STATUSES.PENDING,
  APPOINTMENT_STATUSES.CONFIRMED,
]);
export const BLOCKING_APPOINTMENT_STATUSES = Object.freeze([
  APPOINTMENT_STATUSES.PENDING,
  APPOINTMENT_STATUSES.CONFIRMED,
  APPOINTMENT_STATUSES.RESCHEDULED,
]);
export const FINAL_APPOINTMENT_STATUSES = Object.freeze([
  APPOINTMENT_STATUSES.COMPLETED,
  APPOINTMENT_STATUSES.CANCELLED,
]);

export const INVOICE_STATUSES = Object.freeze({
  PENDING: "pending",
  PAID: "paid",
  CANCELLED: "cancelled",
});
export const INVOICE_STATUS_VALUES = Object.freeze(Object.values(INVOICE_STATUSES));
export const STOCK_MOVEMENT_TYPES = Object.freeze({
  IN: "in",
  OUT: "out",
  ADJUST: "adjust",
});
export const STOCK_MOVEMENT_TYPE_VALUES = Object.freeze(Object.values(STOCK_MOVEMENT_TYPES));
export const PATIENT_STATUSES = Object.freeze({
  ADMITTED: "admitted",
  IN_TREATMENT: "in_treatment",
  COMPLETED: "completed",
  INACTIVE: "inactive",
});
export const PATIENT_STATUS_VALUES = Object.freeze(Object.values(PATIENT_STATUSES));
export const GENDERS = Object.freeze({ MALE: "male", FEMALE: "female", OTHER: "other" });
export const GENDER_VALUES = Object.freeze(Object.values(GENDERS));
export const BLOOD_TYPES = Object.freeze({
  A_POS: "A+", A_NEG: "A-", B_POS: "B+", B_NEG: "B-",
  AB_POS: "AB+", AB_NEG: "AB-", O_POS: "O+", O_NEG: "O-",
});
export const BLOOD_TYPE_VALUES = Object.freeze(Object.values(BLOOD_TYPES));
