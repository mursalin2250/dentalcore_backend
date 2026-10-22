import { Router } from "express";
import { ROUTE_PATHS } from "../constants/api.js";
import { CARD_ROLES, DASHBOARD_CARDS } from "../constants/dashboard.js";
import {
  getRevenue,
  getSummary,
  listActivity,
  listLowStock,
  listUpcomingAppointments,
} from "../controllers/dashboard.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import { listSchema, revenueSchema } from "../validators/dashboard.schemas.js";

const router = Router();

// Every role may open the dashboard; each handler narrows what that role sees.
router.use(authenticate);

router.get(ROUTE_PATHS.SUMMARY, getSummary);
router.get(
  ROUTE_PATHS.REVENUE,
  authorize(...CARD_ROLES[DASHBOARD_CARDS.REVENUE]),
  validate(revenueSchema),
  getRevenue,
);
router.get(ROUTE_PATHS.UPCOMING_APPOINTMENTS, validate(listSchema), listUpcomingAppointments);
router.get(ROUTE_PATHS.LOW_STOCK, validate(listSchema), listLowStock);
router.get(ROUTE_PATHS.ACTIVITY, validate(listSchema), listActivity);

export default router;
