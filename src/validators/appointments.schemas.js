import { z } from "zod";
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from "../constants/pagination.js";
import { MESSAGES } from "../constants/messages.js";
import { APPOINTMENT_STATUS_VALUES } from "../constants/statuses.js";
import {
  DEFAULT_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  MIN_DURATION_MINUTES,
  NOTE_MAX_LENGTH,
  REASON_MAX_LENGTH,
  SEARCH_MAX_LENGTH,
} from "../constants/validation.js";
import { objectIdField } from "./fields.js";

const idParams = z.object({ id: objectIdField });
const durationField = z.coerce.number().int().min(MIN_DURATION_MINUTES).max(MAX_DURATION_MINUTES).default(DEFAULT_DURATION_MINUTES);
const startsAtField = z.coerce.date({ error: "Enter a valid date and time." });
const reasonField = z.string().trim().max(REASON_MAX_LENGTH).optional().default("");
const statusField = z.enum(APPOINTMENT_STATUS_VALUES);

export const listAppointmentsSchema = {
  query: z.object({
    search: z.string().trim().max(SEARCH_MAX_LENGTH, MESSAGES.VALIDATION.SEARCH_TOO_LONG).default(""),
    status: statusField.optional(),
    doctor: objectIdField.optional().or(z.literal("")),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    sort: z.enum(["startsAt", "-startsAt", "createdAt", "-createdAt"]).default("-createdAt"),
  }),
};
export const appointmentStatsSchema = {
  query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }),
};
export const appointmentCalendarSchema = {
  query: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM.") }),
};
export const createAppointmentSchema = {
  body: z.object({
    patient: objectIdField,
    doctor: objectIdField,
    startsAt: startsAtField,
    durationMinutes: durationField,
    reason: reasonField,
    status: statusField.optional(),
    note: z.string().trim().max(NOTE_MAX_LENGTH).optional(),
  }),
};
export const updateAppointmentSchema = {
  params: idParams,
  body: z
    .object({
      patient: objectIdField.optional(),
      doctor: objectIdField.optional(),
      startsAt: startsAtField.optional(),
      durationMinutes: durationField.optional(),
      reason: reasonField,
      status: statusField.optional(),
      newStartsAt: startsAtField.optional(),
    })
    .refine((c) => Object.keys(c).length > 0, { error: MESSAGES.VALIDATION.NO_CHANGES }),
};
export const appointmentIdSchema = { params: idParams };
export const addAppointmentNoteSchema = {
  params: idParams,
  body: z.object({ text: z.string().trim().min(1).max(NOTE_MAX_LENGTH) }),
};
