import { Router } from "express";
import { ROUTE_PATHS } from "../constants/api.js";
import {
  createMedication,
  getMedication,
  getMedicationStats,
  listMedications,
  removeMedication,
  updateMedication,
} from "../controllers/medications.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  createMedicationSchema,
  listMedicationsSchema,
  medicationIdSchema,
  updateMedicationSchema,
} from "../validators/medications.schemas.js";

const router = Router();
router.use(authenticate);
router.get(ROUTE_PATHS.STATS, getMedicationStats);
router.get(ROUTE_PATHS.ROOT, validate(listMedicationsSchema), listMedications);
router.post(ROUTE_PATHS.ROOT, validate(createMedicationSchema), createMedication);
router.get(ROUTE_PATHS.BY_ID, validate(medicationIdSchema), getMedication);
router.patch(ROUTE_PATHS.BY_ID, validate(updateMedicationSchema), updateMedication);
router.delete(ROUTE_PATHS.BY_ID, validate(medicationIdSchema), removeMedication);
export default router;
