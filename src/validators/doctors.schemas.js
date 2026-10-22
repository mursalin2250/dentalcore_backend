import { z } from "zod";
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from "../constants/pagination.js";
import { MESSAGES } from "../constants/messages.js";
import {
  ADDRESS_FIELD_MAX,
  CERT_BODY_MAX,
  CERT_TITLE_MAX,
  EDUCATION_DEGREE_MAX,
  EDUCATION_FIELD_MAX,
  EDUCATION_INSTITUTION_MAX,
  MAX_CERTIFICATION_ITEMS,
  MAX_EDUCATION_ITEMS,
  POSTAL_CODE_MAX,
  SEARCH_MAX_LENGTH,
  YEAR_MAX,
  YEAR_MIN,
} from "../constants/validation.js";
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

const yearField = z
  .union([z.coerce.number().int().min(YEAR_MIN).max(YEAR_MAX), z.null(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? null : v));

const addressSchema = z
  .object({
    street: z.string().trim().max(ADDRESS_FIELD_MAX).optional().default(""),
    city: z.string().trim().max(ADDRESS_FIELD_MAX).optional().default(""),
    district: z.string().trim().max(ADDRESS_FIELD_MAX).optional().default(""),
    postalCode: z.string().trim().max(POSTAL_CODE_MAX).optional().default(""),
  })
  .optional();

const educationItemSchema = z.object({
  institution: z.string().trim().max(EDUCATION_INSTITUTION_MAX).default(""),
  degree: z.string().trim().max(EDUCATION_DEGREE_MAX).default(""),
  fieldOfStudy: z.string().trim().max(EDUCATION_FIELD_MAX).default(""),
  completionYear: yearField,
});

const certificationItemSchema = z.object({
  title: z.string().trim().max(CERT_TITLE_MAX).default(""),
  issuingBody: z.string().trim().max(CERT_BODY_MAX).default(""),
  issueYear: yearField,
  expiryYear: yearField,
});

const educationArray = z.array(educationItemSchema).max(MAX_EDUCATION_ITEMS).optional();
const certificationsArray = z.array(certificationItemSchema).max(MAX_CERTIFICATION_ITEMS).optional();

const doctorBodyBase = {
  name: nameField,
  specialty: specialtyField,
  title: titleField,
  phone: phoneField,
  email: optionalEmail,
  avatarUrl: avatarUrlField,
  address: addressSchema,
  education: educationArray,
  certifications: certificationsArray,
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
      address: addressSchema,
      education: educationArray,
      certifications: certificationsArray,
    })
    .refine((changes) => Object.keys(changes).length > 0, { error: MESSAGES.VALIDATION.NO_CHANGES }),
};

export const doctorIdSchema = { params: idParams };

export const listDoctorPatientsSchema = {
  params: idParams,
  query: z.object({
    search: z.string().trim().max(SEARCH_MAX_LENGTH, MESSAGES.VALIDATION.SEARCH_TOO_LONG).default(""),
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  }),
};
