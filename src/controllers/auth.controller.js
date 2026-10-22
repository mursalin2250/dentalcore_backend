import { DUMMY_PASSWORD_HASH } from "../constants/auth.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { ROLES } from "../constants/roles.js";
import { USER_STATUSES } from "../constants/statuses.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { comparePassword, hashPassword } from "../utils/password.js";
import { sendSuccess } from "../utils/response.js";
import { endSession, startSession } from "../utils/session.js";

// Public sign up only bootstraps the very first Admin; everyone else is added via Team.
// (Checked per request: fine for one server instance. Use the seed script when scaling out.)
export const register = asyncHandler(async (req, res) => {
  if (await User.exists({})) {
    throw new AppError(MESSAGES.AUTH.REGISTRATION_CLOSED, HTTP_STATUS.FORBIDDEN);
  }

  const { name, email, password } = req.validated.body;
  const user = await User.create({
    name,
    email,
    passwordHash: await hashPassword(password),
    role: ROLES.ADMIN,
    lastLoginAt: new Date(),
  });

  startSession(res, user);
  sendSuccess(res, { status: HTTP_STATUS.CREATED, data: { user }, message: MESSAGES.AUTH.REGISTERED });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password, remember } = req.validated.body;

  const user = await User.findOne({ email }).select("+passwordHash");
  // Always run a hash comparison so unknown emails take as long as wrong passwords.
  const passwordMatches = await comparePassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !passwordMatches) {
    throw new AppError(MESSAGES.AUTH.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
  }
  // Only reached with a correct password, so this does not reveal which emails exist.
  if (user.status !== USER_STATUSES.ACTIVE) {
    throw new AppError(MESSAGES.AUTH.ACCOUNT_INACTIVE, HTTP_STATUS.FORBIDDEN);
  }

  user.lastLoginAt = new Date();
  await user.save();

  startSession(res, user, { persistent: remember });
  sendSuccess(res, { data: { user }, message: MESSAGES.AUTH.LOGGED_IN });
});

export const logout = (_req, res) => {
  endSession(res);
  sendSuccess(res, { message: MESSAGES.AUTH.LOGGED_OUT });
};

export const getMe = (req, res) => {
  sendSuccess(res, { data: { user: req.user } });
};
