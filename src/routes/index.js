import { Router } from "express";
import { ROUTE_PATHS } from "../constants/api.js";
import authRoutes from "./auth.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import healthRoutes from "./health.routes.js";
import teamRoutes from "./team.routes.js";
import patientsRoutes from "./patients.routes.js";
import doctorsRoutes from "./doctors.routes.js";
import appointmentsRoutes from "./appointments.routes.js";
import medicationsRoutes from "./medications.routes.js";
import stockMovementsRoutes from "./stockMovements.routes.js";

const router = Router();

router.use(ROUTE_PATHS.HEALTH, healthRoutes);
router.use(ROUTE_PATHS.AUTH, authRoutes);
router.use(ROUTE_PATHS.TEAM, teamRoutes);
router.use(ROUTE_PATHS.DASHBOARD, dashboardRoutes);
router.use(ROUTE_PATHS.PATIENTS, patientsRoutes);
router.use(ROUTE_PATHS.DOCTORS, doctorsRoutes);
router.use(ROUTE_PATHS.APPOINTMENTS, appointmentsRoutes);
router.use(ROUTE_PATHS.MEDICATIONS, medicationsRoutes);
router.use(ROUTE_PATHS.STOCK_MOVEMENTS, stockMovementsRoutes);

export default router;
