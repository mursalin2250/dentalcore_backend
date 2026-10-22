import { COOKIE_NAME } from "../constants/auth.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { USER_STATUSES } from "../constants/statuses.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { verifyToken } from "../utils/token.js";

const unauthenticated = () => new AppError(MESSAGES.AUTH.NOT_AUTHENTICATED, HTTP_STATUS.UNAUTHORIZED);

// Reads the JWT from the httpOnly cookie and loads the user on every request,
// so deactivating or deleting someone ends their session immediately.
export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw unauthenticated();

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw unauthenticated();
  }

  const user = await User.findById(payload.sub);
  if (!user || user.status !== USER_STATUSES.ACTIVE) throw unauthenticated();

  req.user = user;
  next();
});
