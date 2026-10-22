import mongoose from "mongoose";
import { env } from "../config/env.js";
import { HTTP_STATUS, MONGO_DUPLICATE_KEY_CODE } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/AppError.js";

// Turns known library errors into AppErrors. Returns null for anything unexpected.
function toAppError(err) {
  if (err instanceof AppError) return err;

  // Body-parser errors
  if (err.type === "entity.parse.failed") {
    return new AppError(MESSAGES.GENERIC.INVALID_JSON, HTTP_STATUS.BAD_REQUEST);
  }
  if (err.type === "entity.too.large") {
    return new AppError(MESSAGES.GENERIC.BODY_TOO_LARGE, HTTP_STATUS.PAYLOAD_TOO_LARGE);
  }

  // Mongoose errors
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.fromEntries(Object.entries(err.errors).map(([field, e]) => [field, e.message]));
    return new AppError(MESSAGES.GENERIC.VALIDATION_FAILED, HTTP_STATUS.BAD_REQUEST, errors);
  }
  if (err instanceof mongoose.Error.CastError) {
    return new AppError(MESSAGES.GENERIC.INVALID_ID, HTTP_STATUS.BAD_REQUEST);
  }
  if (err.code === MONGO_DUPLICATE_KEY_CODE) {
    const isEmail = Boolean(err.keyPattern?.email);
    const message = isEmail ? MESSAGES.TEAM.EMAIL_TAKEN : MESSAGES.GENERIC.DUPLICATE_VALUE;
    return new AppError(message, HTTP_STATUS.CONFLICT, isEmail ? { email: message } : null);
  }

  return null;
}

// Express recognises error handlers by their 4 arguments, so `_next` must stay.
export function errorHandler(err, _req, res, _next) {
  const appError = toAppError(err);

  if (!appError) {
    console.error(err);
    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      data: null,
      message: MESSAGES.GENERIC.SERVER_ERROR,
      // Stack traces are for local debugging only.
      ...(!env.isProduction && { stack: err.stack }),
    });
  }

  res.status(appError.statusCode).json({
    success: false,
    data: null,
    message: appError.message,
    ...(appError.errors && { errors: appError.errors }),
  });
}
