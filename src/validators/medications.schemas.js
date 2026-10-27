import { z } from "zod";
import {
  ITEM_TYPE_VALUES,
  MED_CATEGORY_MAX,
  MED_NAME_MAX,
  MED_SKU_MAX,
  MED_SUPPLIER_MAX,
  MED_UNIT_MAX,
} from "../constants/inventory.js";
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from "../constants/pagination.js";
import { SEARCH_MAX_LENGTH } from "../constants/validation.js";
import { objectIdField } from "./fields.js";

const idParams = z.object({ id: objectIdField });
const nonNegInt = z.coerce.number().int().min(0);

export const listMedicationsSchema = {
  query: z.object({
    search: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
    status: z.enum(["in", "low", "out"]).optional(),
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
    sort: z.string().trim().optional().default("-updatedAt"),
  }),
};

export const medicationIdSchema = { params: idParams };

export const createMedicationSchema = {
  body: z.object({
    name: z.string().trim().min(1).max(MED_NAME_MAX),
    sku: z.string().trim().max(MED_SKU_MAX).optional().or(z.literal("")),
    itemType: z.enum(["medicine", "tool"]).optional().default("medicine"),
    category: z.string().trim().max(MED_CATEGORY_MAX).optional().default(""),
    unit: z.string().trim().max(MED_UNIT_MAX).optional().default("pcs"),
    quantity: nonNegInt.optional().default(0),
    reorderLevel: nonNegInt.optional().default(0),
    unitPrice: nonNegInt.optional().default(0),
    expiryDate: z.union([z.string(), z.literal(""), z.null()]).optional(),
    supplier: z.string().trim().max(MED_SUPPLIER_MAX).optional().default(""),
  }),
};

export const updateMedicationSchema = {
  params: idParams,
  body: z
    .object({
      name: z.string().trim().min(1).max(MED_NAME_MAX).optional(),
      sku: z.string().trim().max(MED_SKU_MAX).optional(),
      itemType: z.enum(["medicine", "tool"]).optional(),
      category: z.string().trim().max(MED_CATEGORY_MAX).optional(),
      unit: z.string().trim().max(MED_UNIT_MAX).optional(),
      reorderLevel: nonNegInt.optional(),
      unitPrice: nonNegInt.optional(),
      expiryDate: z.union([z.string(), z.literal(""), z.null()]).optional(),
      supplier: z.string().trim().max(MED_SUPPLIER_MAX).optional(),
    })
    .refine((b) => Object.keys(b).length > 0, { message: "No changes provided." }),
};
