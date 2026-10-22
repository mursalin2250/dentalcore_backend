import { z } from "zod";
import { MESSAGES } from "../constants/messages.js";
import { emailField, nameField, passwordField } from "./fields.js";

export const registerSchema = {
  body: z.object({ name: nameField, email: emailField, password: passwordField }),
};

export const loginSchema = {
  body: z.object({
    email: emailField,
    // Only "present" here: do not leak the password rules to someone guessing.
    password: z.string({ error: MESSAGES.VALIDATION.PASSWORD_REQUIRED }).min(1, MESSAGES.VALIDATION.PASSWORD_REQUIRED),
    remember: z.boolean().default(true),
  }),
};
