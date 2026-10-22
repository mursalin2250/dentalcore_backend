import { Router } from "express";
import mongoose from "mongoose";
import { ROUTE_PATHS } from "../constants/api.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { AppError } from "../utils/AppError.js";
import { sendSuccess } from "../utils/response.js";

const router = Router();

router.get(ROUTE_PATHS.ROOT, (_req, res) => {
  if (mongoose.connection.readyState !== mongoose.STATES.connected) {
    throw new AppError(MESSAGES.HEALTH.DB_DOWN, HTTP_STATUS.SERVICE_UNAVAILABLE);
  }
  sendSuccess(res, { data: { uptime: Math.round(process.uptime()) } });
});

export default router;
