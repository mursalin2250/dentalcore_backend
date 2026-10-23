import { z } from "zod";
import {
  MEDICATION_CATEGORIES,
  MEDICATION_ITEM_TYPE_VALUES,
  MEDICATION_NAME_MAX,
  MEDICATION_SKU_MAX,
  MEDICATION_SUPPLIER_MAX,
  MEDICATION_UNITS,
  STOCK_STATUS_VALUES,
  EXPIRY_FLAG_VALUES,
} from "../constants/inventory.js";
import { MESSAGES } from "../constants/messages.js";
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from "../constants/pagination.js";
import { SEARCH_MAX_LENGTH } from "../constants/validation.js";
import { objectIdField } from "./fields.js";

const idParams = z.object({ id: objectIdField });

const nonNegInt = z.coerce.number().int().min(0);
const posInt = z.coerce.number().int().min(1);

export const listMedicationsSchema = {
  query: z.object({
    search: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
    category: z.string().trim().optional(),
    itemType: z.enum(MEDICATION_ITEM_TYPE_VALUES).optional(),
    status: z.enum(STOCK_STATUS_VALUES).optional(),
    expiry: z.enum(EXPIRY_FLAG_VALUES).optional(),
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    sort: z.string().trim().optional().default("-updatedAt"),
  }),
};

export const medicationIdSchema = { params: idParams };

export const createMedicationSchema = {
  body: z.object({
    name: z.string().trim().min(1, MESSAGES.VALIDATION.NAME_REQUIRED).max(MEDICATION_NAME_MAX),
    sku: z.string().trim().max(MEDICATION_SKU_MAX).optional().default(""),
    itemType: z.enum(MEDICATION_ITEM_TYPE_VALUES),
    category: z.string().trim().min(1),
    unit: z.string().trim().min(1),
    initialStock: nonNegInt.default(0),
    reorderLevel: nonNegInt.default(0),
    unitPrice: nonNegInt.default(0),
    expiryDate: z.union([z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)), z.literal(""), z.null()]).optional(),
    supplier: z.string().trim().max(MEDICATION_SUPPLIER_MAX).optional().default(""),
  }),
};

export const updateMedicationSchema = {
  params: idParams,
  body: z
    .object({
      name: z.string().trim().min(1).max(MEDICATION_NAME_MAX).optional(),
      sku: z.string().trim().min(1).max(MEDICATION_SKU_MAX).optional(),
      itemType: z.enum(MEDICATION_ITEM_TYPE_VALUES).optional(),
      category: z.string().trim().min(1).optional(),
      unit: z.string().trim().min(1).optional(),
      reorderLevel: nonNegInt.optional(),
      unitPrice: nonNegInt.optional(),
      expiryDate: z.union([z.string(), z.literal(""), z.null()]).optional(),
      supplier: z.string().trim().max(MEDICATION_SUPPLIER_MAX).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: MESSAGES.VALIDATION.NO_CHANGES }),
};
