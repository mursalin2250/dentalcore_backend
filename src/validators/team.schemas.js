import { z } from "zod";
import { DEFAULT_LIMIT, DEFAULT_PAGE, MAX_LIMIT } from "../constants/pagination.js";
import { MESSAGES } from "../constants/messages.js";
import { SEARCH_MAX_LENGTH } from "../constants/validation.js";
import { emailField, nameField, objectIdField, passwordField, roleField, statusField } from "./fields.js";

const idParams = z.object({ id: objectIdField });

export const listMembersSchema = {
  query: z.object({
    search: z.string().trim().max(SEARCH_MAX_LENGTH, MESSAGES.VALIDATION.SEARCH_TOO_LONG).default(""),
    role: roleField.optional(),
    page: z.coerce.number().int().min(1).default(DEFAULT_PAGE),
    limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
  }),
};

export const createMemberSchema = {
  // `password` is the temporary password the admin hands to the new member.
  body: z.object({ name: nameField, email: emailField, role: roleField, password: passwordField }),
};

export const updateMemberSchema = {
  params: idParams,
  body: z
    .object({ name: nameField.optional(), role: roleField.optional(), status: statusField.optional() })
    .refine((changes) => Object.keys(changes).length > 0, { error: MESSAGES.VALIDATION.NO_CHANGES }),
};

export const memberIdSchema = { params: idParams };
