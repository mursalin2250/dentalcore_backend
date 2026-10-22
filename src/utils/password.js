import bcrypt from "bcryptjs";
import { SALT_ROUNDS } from "../constants/auth.js";

export const hashPassword = (plain) => bcrypt.hash(plain, SALT_ROUNDS);
export const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);
