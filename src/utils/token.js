import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const ALGORITHM = "HS256";

export function signToken(userId) {
  const token = jwt.sign({}, env.JWT_SECRET, {
    subject: String(userId),
    expiresIn: env.JWT_EXPIRES_IN,
    algorithm: ALGORITHM,
  });
  const { exp } = jwt.decode(token);
  return { token, expiresAt: exp * 1000 };
}

// Throws if the token is invalid or expired.
export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, { algorithms: [ALGORITHM] });
}
