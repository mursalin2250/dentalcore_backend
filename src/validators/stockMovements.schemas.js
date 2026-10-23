import { z } from "zod";
import {
  MOVEMENT_NOTE_MAX,
  MOVEMENT_REFERENCE_MAX,
  STOCK_MOVEMENT_TYPE_VALUES,
} from "../constants/inventory.js";
import { MESSAGES } from "../constants/messages.js";
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from "../constants/pagination.js";
import { SEARCH_MAX_LENGTH } from "../constants/validation.js";
import { objectIdField } from "./fields.js";

export const listStockMovementsSchema = {
  query: z.object({
    search: z.string().trim().max(SEARCH_MAX_LENGTH).optional(),
    type: z.enum(STOCK_MOVEMENT_TYPE_VALUES).optional(),
    medication: objectIdField.optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  }),
};

export const createStockMovementSchema = {
  body: z.object({
    medication: objectIdField,
    type: z.enum(STOCK_MOVEMENT_TYPE_VALUES),
    quantity: z.coerce.number().int().min(1).optional(),
    countedQuantity: z.coerce.number().int().min(0).optional(),
    reason: z.string().trim().min(1),
    note: z.string().trim().max(MOVEMENT_NOTE_MAX).optional().default(""),
    reference: z.string().trim().max(MOVEMENT_REFERENCE_MAX).optional().default(""),
  }).superRefine((body, ctx) => {
    if (body.type === "adjust") {
      if (body.countedQuantity === undefined || body.countedQuantity === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter the counted quantity.", path: ["countedQuantity"] });
      }
    } else if (!body.quantity || body.quantity < 1) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a positive quantity.", path: ["quantity"] });
    }
  }),
};
