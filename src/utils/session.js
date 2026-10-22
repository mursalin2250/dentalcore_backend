import { COOKIE_NAME, COOKIE_SAME_SITE } from "../constants/auth.js";
import { env } from "../config/env.js";
import { signToken } from "./token.js";

const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: env.isProduction ? "none" : "lax",
  path: "/",
});

// `persistent` false => session cookie that disappears when the browser closes.
export function startSession(res, user, { persistent = true } = {}) {
  const { token, expiresAt } = signToken(user.id);
  res.cookie(COOKIE_NAME, token, {
    ...cookieOptions(),
    ...(persistent && { expires: new Date(expiresAt) }),
  });
}

export function endSession(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions());
}
