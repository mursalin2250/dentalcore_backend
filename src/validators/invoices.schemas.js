import { z } from "zod";
import {
  INVOICE_NOTES_MAX,
  INVOICE_PROBLEM_MAX,
  INVOICE_STATUSES,
  INVOICE_STATUS_VALUES,
  INVOICE_TREATMENT_MAX,
  PAYMENT_METHOD_VALUES,
  PAYMENT_NOTE_MAX,
  VOID_REASON_MAX,
} from "../constants/billing.js";
import { MESSAGES } from "../constants/messages.js";
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from "../constants/pagination.js";
import { SEARCH_MAX_LENGTH } from "../constants/validation.js";
import { objectIdField } from "./fields.js";

const idParams = z.object({ id: objectIdField });
const nonNegInt = z.coerce.number().int().min(0);
const posInt = z.coerce.number().int().min(1);

export const listInvoicesSchema = {
  query: z.object({
    search: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
    status: z.enum(INVOICE_STATUS_VALUES).optional(),
    patient: objectIdField.optional(),
    doctor: objectIdField.optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    sort: z.string().trim().optional().default("-updatedAt"),
  }),
};

export const invoiceIdSchema = { params: idParams };

export const createInvoiceSchema = {
  body: z.object({
    patient: objectIdField,
    doctor: objectIdField.optional().nullable(),
    problem: z.string().trim().max(INVOICE_PROBLEM_MAX).optional().default(""),
    treatment: z.string().trim().max(INVOICE_TREATMENT_MAX).optional().default(""),
    totalCost: nonNegInt,
    dueDate: z.union([z.string(), z.literal(""), z.null()]).optional(),
    notes: z.string().trim().max(INVOICE_NOTES_MAX).optional().default(""),
  }),
};

export const updateInvoiceSchema = {
  params: idParams,
  body: z
    .object({
      doctor: objectIdField.optional().nullable(),
      problem: z.string().trim().max(INVOICE_PROBLEM_MAX).optional(),
      treatment: z.string().trim().max(INVOICE_TREATMENT_MAX).optional(),
      totalCost: nonNegInt.optional(),
      dueDate: z.union([z.string(), z.literal(""), z.null()]).optional(),
      notes: z.string().trim().max(INVOICE_NOTES_MAX).optional(),
      isCancelled: z.boolean().optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: MESSAGES.VALIDATION.NO_CHANGES }),
};

export const addPaymentSchema = {
  params: idParams,
  body: z.object({
    amount: z.coerce
      .number({ invalid_type_error: "Enter a valid amount." })
      .int("Amount must be a whole number.")
      .min(1, "Amount must be at least 1."),
    method: z.enum(["cash", "card", "bkash", "nagad", "bank", "other"], {
      errorMap: () => ({ message: "Choose a payment method." }),
    }),
    paidAt: z.union([z.string(), z.date(), z.literal("")]).optional(),
    note: z.string().trim().max(PAYMENT_NOTE_MAX).optional().default(""),
  }),
};

export const voidPaymentSchema = {
  params: z.object({ id: objectIdField, paymentId: objectIdField }),
  body: z.object({
    voidReason: z.string().trim().min(1).max(VOID_REASON_MAX),
  }),
};
