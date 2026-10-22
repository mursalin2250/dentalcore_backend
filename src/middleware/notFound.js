import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/AppError.js";

export const notFound = (_req, _res, next) =>
  next(new AppError(MESSAGES.GENERIC.ROUTE_NOT_FOUND, HTTP_STATUS.NOT_FOUND));
