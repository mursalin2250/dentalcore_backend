import { z } from "zod";
import { DASHBOARD_RANGE_VALUES, DEFAULT_DASHBOARD_RANGE, LIST_LIMIT } from "../constants/dashboard.js";
import { MESSAGES } from "../constants/messages.js";

const { VALIDATION: V } = MESSAGES;

export const revenueSchema = {
  query: z.object({
    range: z.enum(DASHBOARD_RANGE_VALUES, { error: V.RANGE_INVALID }).default(DEFAULT_DASHBOARD_RANGE),
  }),
};

export const listSchema = {
  query: z.object({
    limit: z.coerce
      .number({ error: V.LIMIT_INVALID })
      .int(V.LIMIT_INVALID)
      .min(1, V.LIMIT_INVALID)
      .max(LIST_LIMIT.MAX, V.LIMIT_INVALID)
      .default(LIST_LIMIT.DEFAULT),
  }),
};
