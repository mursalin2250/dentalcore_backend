import { z } from "zod";
import { MOVEMENT_NOTE_MAX, MOVEMENT_REASON_MAX, STOCK_MOVEMENT_TYPE_VALUES } from "../constants/inventory.js";
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from "../constants/pagination.js";
import { SEARCH_MAX_LENGTH } from "../constants/validation.js";
import { objectIdField } from "./fields.js";

export const listStockMovementsSchema = {
  query: z.object({
    search: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
    type: z.enum(["in", "out", "adjust"]).optional(),
    medication: objectIdField.optional(),
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  }),
};

export const createStockMovementSchema = {
  body: z.object({
    medication: objectIdField,
    type: z.enum(["in", "out", "adjust"]),
    quantity: z.coerce.number().int().min(1),
    reason: z.string().trim().max(MOVEMENT_REASON_MAX).optional().default(""),
    note: z.string().trim().max(MOVEMENT_NOTE_MAX).optional().default(""),
  }),
};
