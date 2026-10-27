import { Router } from "express";
import { ROUTE_PATHS } from "../constants/api.js";
import {
  createDoctor,
  getDoctor,
  getDoctorStats,
  listDoctors,
  removeDoctor,
  updateDoctor,
} from "../controllers/doctors.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  createDoctorSchema,
  doctorIdSchema,
  listDoctorsSchema,
  updateDoctorSchema,
} from "../validators/doctors.schemas.js";

const router = Router();

router.use(authenticate);

router.get(ROUTE_PATHS.STATS, getDoctorStats);
router.get(ROUTE_PATHS.ROOT, validate(listDoctorsSchema), listDoctors);
router.post(ROUTE_PATHS.ROOT, validate(createDoctorSchema), createDoctor);
router.get(ROUTE_PATHS.BY_ID, validate(doctorIdSchema), getDoctor);
router.patch(ROUTE_PATHS.BY_ID, validate(updateDoctorSchema), updateDoctor);
router.delete(ROUTE_PATHS.BY_ID, validate(doctorIdSchema), removeDoctor);

export default router;
