import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { REQUEST_PARTS } from "../constants/api.js";
import { AppError } from "../utils/AppError.js";

// zod issues -> { field: message } (first message per field).
function toAppError(zodError) {
  const errors = {};
  let rootMessage;
  for (const issue of zodError.issues) {
    const field = issue.path.join(".");
    if (field) errors[field] ??= issue.message;
    else rootMessage ??= issue.message;
  }
  return new AppError(rootMessage ?? MESSAGES.GENERIC.VALIDATION_FAILED, HTTP_STATUS.BAD_REQUEST, errors);
}

// validate({ body, query, params }) -> parsed values land on req.validated.
export const validate = (schemas) => (req, _res, next) => {
  const validated = {};
  for (const part of Object.values(REQUEST_PARTS)) {
    if (!schemas[part]) continue;
    const input = part === REQUEST_PARTS.BODY ? (req.body ?? {}) : req[part];
    const result = schemas[part].safeParse(input);
    if (!result.success) return next(toAppError(result.error));
    validated[part] = result.data;
  }
  req.validated = validated;
  next();
};
