import { z } from "zod";
import { PASSWORD_RULES } from "../constants/auth.js";
import { ROLE_VALUES } from "../constants/roles.js";
import { USER_STATUS_VALUES } from "../constants/statuses.js";
import { MESSAGES } from "../constants/messages.js";
import {
  EMAIL_PATTERN,
  NAME_MAX_LENGTH,
  OBJECT_ID_PATTERN,
} from "../constants/validation.js";

const { VALIDATION: V } = MESSAGES;

export const nameField = z
  .string({ error: V.NAME_REQUIRED })
  .trim()
  .min(1, V.NAME_REQUIRED)
  .max(NAME_MAX_LENGTH, V.NAME_TOO_LONG);

export const emailField = z
  .string({ error: V.EMAIL_REQUIRED })
  .trim()
  .toLowerCase()
  .min(1, V.EMAIL_REQUIRED)
  .regex(EMAIL_PATTERN, V.EMAIL_INVALID);

export const passwordField = z
  .string({ error: V.PASSWORD_REQUIRED })
  .min(PASSWORD_RULES.MIN_LENGTH, V.PASSWORD_TOO_SHORT)
  .max(PASSWORD_RULES.MAX_LENGTH, V.PASSWORD_TOO_LONG);

export const roleField = z.enum(ROLE_VALUES, { error: V.ROLE_INVALID });
export const statusField = z.enum(USER_STATUS_VALUES, { error: V.STATUS_INVALID });
export const objectIdField = z.string({ error: V.ID_INVALID }).regex(OBJECT_ID_PATTERN, V.ID_INVALID);
