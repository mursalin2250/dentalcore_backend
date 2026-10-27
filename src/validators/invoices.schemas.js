import { z } from "zod";
import {
  INVOICE_NOTES_MAX,
  INVOICE_STATUS_VALUES,
  INVOICE_TERMS_MAX,
  LINE_ITEM_DESCRIPTION_MAX,
  MAX_LINE_ITEMS,
  PATIENT_NAME_MAX,
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

const lineItemSchema = z.object({
  description: z.string().trim().max(LINE_ITEM_DESCRIPTION_MAX).optional().default(""),
  quantity: z.coerce.number().int().min(0).default(1),
  rate: z.coerce.number().int().min(0).default(0),
});

export const listInvoicesSchema = {
  query: z.object({
    search: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
    status: z.enum(INVOICE_STATUS_VALUES).optional(),
    patient: objectIdField.optional(),
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    sort: z.string().trim().optional().default("-updatedAt"),
  }),
};

export const invoiceIdSchema = { params: idParams };

export const createInvoiceSchema = {
  body: z
    .object({
      patient: objectIdField.optional().nullable(),
      patientName: z.string().trim().max(PATIENT_NAME_MAX).optional().default(""),
      patientPhone: z.string().trim().max(40).optional().default(""),
      patientAddress: z.string().trim().max(300).optional().default(""),
      doctor: objectIdField.optional().nullable(),
      problem: z.string().trim().max(500).optional().default(""),
      treatment: z.string().trim().max(500).optional().default(""),
      lineItems: z.array(lineItemSchema).max(MAX_LINE_ITEMS).optional().default([]),
      discountMinor: nonNegInt.optional().default(0),
      terms: z.string().trim().max(INVOICE_TERMS_MAX).optional().default(""),
      logoDataUrl: z.string().max(2_000_000).optional().default(""),
      totalCost: nonNegInt.optional(),
      dueDate: z.union([z.string(), z.literal(""), z.null()]).optional(),
      notes: z.string().trim().max(INVOICE_NOTES_MAX).optional().default(""),
      initialPayment: nonNegInt.optional().default(0),
    })
    .superRefine((body, ctx) => {
      if (!body.patient && !(body.patientName || "").trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a patient name or select a patient.",
          path: ["patientName"],
        });
      }
    }),
};

export const updateInvoiceSchema = {
  params: idParams,
  body: z
    .object({
      patient: objectIdField.optional().nullable(),
      patientName: z.string().trim().max(PATIENT_NAME_MAX).optional(),
      patientPhone: z.string().trim().max(40).optional(),
      patientAddress: z.string().trim().max(300).optional(),
      doctor: objectIdField.optional().nullable(),
      problem: z.string().trim().max(500).optional(),
      treatment: z.string().trim().max(500).optional(),
      lineItems: z.array(lineItemSchema).max(MAX_LINE_ITEMS).optional(),
      discountMinor: nonNegInt.optional(),
      terms: z.string().trim().max(INVOICE_TERMS_MAX).optional(),
      logoDataUrl: z.string().max(2_000_000).optional(),
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
    amount: posInt,
    method: z.enum(["cash", "card", "bkash", "nagad", "bank", "other"]),
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
