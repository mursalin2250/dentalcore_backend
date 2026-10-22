import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/AppError.js";

// Use after authenticate: authorize(ROLES.ADMIN, ROLES.DOCTOR)
export const authorize = (...allowedRoles) => (req, _res, next) =>
  allowedRoles.includes(req.user?.role)
    ? next()
    : next(new AppError(MESSAGES.AUTH.FORBIDDEN, HTTP_STATUS.FORBIDDEN));
