import { z } from "zod";
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from "../constants/pagination.js";
import { MESSAGES } from "../constants/messages.js";
import { SEARCH_MAX_LENGTH } from "../constants/validation.js";
import { emailField, nameField, objectIdField } from "./fields.js";

const idParams = z.object({ id: objectIdField });

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => v === "" || emailField.safeParse(v).success, {
    message: MESSAGES.VALIDATION.EMAIL_INVALID,
  })
  .optional();

const phoneField = z.string().trim().max(20).optional();
const specialtyField = z.string().trim().max(100).optional();
const titleField = z.string().trim().max(100).optional();
const avatarUrlField = z.string().trim().max(2_000_000).optional().or(z.literal(""));

const doctorBodyBase = {
  name: nameField,
  specialty: specialtyField,
  title: titleField,
  phone: phoneField,
  email: optionalEmail,
  avatarUrl: avatarUrlField,
};

export const listDoctorsSchema = {
  query: z.object({
    search: z.string().trim().max(SEARCH_MAX_LENGTH, MESSAGES.VALIDATION.SEARCH_TOO_LONG).default(""),
    specialty: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  }),
};

export const createDoctorSchema = {
  body: z.object(doctorBodyBase),
};

export const updateDoctorSchema = {
  params: idParams,
  body: z
    .object({
      name: nameField.optional(),
      specialty: specialtyField,
      title: titleField,
      phone: phoneField,
      email: optionalEmail,
      avatarUrl: avatarUrlField,
    })
    .refine((changes) => Object.keys(changes).length > 0, { error: MESSAGES.VALIDATION.NO_CHANGES }),
};

export const doctorIdSchema = { params: idParams };
