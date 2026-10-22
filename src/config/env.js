import "dotenv/config";
import { z } from "zod";
import {
  DEFAULT_JWT_EXPIRES_IN,
  DEFAULT_PORT,
  JWT_EXPIRES_IN_PATTERN,
  MIN_JWT_SECRET_LENGTH,
  NODE_ENVS,
} from "../constants/env.js";
import { MESSAGES } from "../constants/messages.js";

const schema = z.object({
  NODE_ENV: z.enum(Object.values(NODE_ENVS)).default(NODE_ENVS.DEVELOPMENT),
  PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  MONGO_URI: z.string().min(1),
  JWT_SECRET: z.string().min(MIN_JWT_SECRET_LENGTH, MESSAGES.ENV.SECRET_TOO_SHORT),
  JWT_EXPIRES_IN: z
    .string()
    .regex(JWT_EXPIRES_IN_PATTERN, MESSAGES.ENV.EXPIRES_IN_INVALID)
    .default(DEFAULT_JWT_EXPIRES_IN),
  // Reduced to its origin so it matches the browser's Origin header exactly.
  CLIENT_URL: z.url().transform((value) => new URL(value).origin),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

export function formatIssues(error) {
  return error.issues.map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`).join("\n");
}

// Fail fast: refuse to start with a missing or malformed config.
const result = schema.safeParse(process.env);
if (!result.success) {
  console.error(`${MESSAGES.ENV.INVALID}\n${formatIssues(result.error)}`);
  process.exit(1);
}

export const env = Object.freeze({
  ...result.data,
  isProduction: result.data.NODE_ENV === NODE_ENVS.PRODUCTION,
});
