import { Router } from "express";
import { ROUTE_PATHS } from "../constants/api.js";
import { getMe, login, logout, register } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authRateLimiter } from "../middleware/rateLimiter.js";
import { validate } from "../middleware/validate.js";
import { loginSchema, registerSchema } from "../validators/auth.schemas.js";

const router = Router();

router.post(ROUTE_PATHS.REGISTER, authRateLimiter, validate(registerSchema), register);
router.post(ROUTE_PATHS.LOGIN, authRateLimiter, validate(loginSchema), login);
router.post(ROUTE_PATHS.LOGOUT, logout);
router.get(ROUTE_PATHS.ME, authenticate, getMe);

export default router;
