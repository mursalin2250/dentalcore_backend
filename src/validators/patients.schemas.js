import { z } from "zod";
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from "../constants/pagination.js";
import { MESSAGES } from "../constants/messages.js";
import {
  BLOOD_TYPE_VALUES,
  GENDER_VALUES,
  PATIENT_STATUS_VALUES,
} from "../constants/statuses.js";
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
const addressField = z.string().trim().max(200).optional();
const genderField = z.enum(GENDER_VALUES).optional().or(z.literal(""));
const bloodTypeField = z.enum(BLOOD_TYPE_VALUES).optional().or(z.literal(""));
const patientStatusField = z.enum(PATIENT_STATUS_VALUES);
const dateOfBirthField = z.coerce.date().nullable().optional().or(z.literal(""));
const doctorField = objectIdField.nullable().optional().or(z.literal(""));
const patientCodeField = z
  .string()
  .trim()
  .max(32)
  .regex(/^[A-Za-z0-9-]*$/, "Use letters, numbers and hyphens only.")
  .optional()
  .or(z.literal(""));
const textAreaField = z.string().trim().max(2000).optional();
const moneyField = z.coerce.number().int().min(0).optional();
const avatarUrlField = z.string().trim().max(500).optional().or(z.literal(""));

const patientBodyBase = {
  patientCode: patientCodeField,
  name: nameField,
  phone: phoneField,
  email: optionalEmail,
  address: addressField,
  gender: genderField,
  dateOfBirth: dateOfBirthField,
  bloodType: bloodTypeField,
  status: patientStatusField.optional(),
  doctor: doctorField,
  avatarUrl: avatarUrlField,
  problem: textAreaField,
  treatment: textAreaField,
  treatmentCost: moneyField,
  amountPaid: moneyField,
};

export const listPatientsSchema = {
  query: z.object({
    search: z.string().trim().max(SEARCH_MAX_LENGTH, MESSAGES.VALIDATION.SEARCH_TOO_LONG).default(""),
    status: patientStatusField.optional(),
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  }),
};

export const createPatientSchema = {
  body: z.object(patientBodyBase),
};

export const updatePatientSchema = {
  params: idParams,
  body: z
    .object({
      patientCode: patientCodeField,
      name: nameField.optional(),
      phone: phoneField,
      email: optionalEmail,
      address: addressField,
      gender: genderField,
      dateOfBirth: dateOfBirthField,
      bloodType: bloodTypeField,
      status: patientStatusField.optional(),
      doctor: doctorField,
      avatarUrl: avatarUrlField,
      problem: textAreaField,
      treatment: textAreaField,
      treatmentCost: moneyField,
      amountPaid: moneyField,
      dueAmount: moneyField,
    })
    .refine((changes) => Object.keys(changes).length > 0, { error: MESSAGES.VALIDATION.NO_CHANGES }),
};

export const patientIdSchema = { params: idParams };

export const bulkRemovePatientsSchema = {
  body: z.object({
    ids: z.array(objectIdField).min(1),
  }),
};

export const addPrescriptionSchema = {
  params: idParams,
  body: z.object({
    medicines: z.array(z.string().trim().max(200)).min(1),
  }),
};
