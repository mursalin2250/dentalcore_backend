import rateLimit from "express-rate-limit";
import { AUTH_RATE_LIMIT } from "../constants/auth.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/AppError.js";

export const authRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT.WINDOW_MS,
  limit: AUTH_RATE_LIMIT.MAX_REQUESTS,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, _res, next) =>
    next(new AppError(MESSAGES.GENERIC.TOO_MANY_REQUESTS, HTTP_STATUS.TOO_MANY_REQUESTS)),
});
