import { Router } from "express";
import { ROUTE_PATHS } from "../constants/api.js";
import {
  addPrescription,
  bulkRemovePatients,
  createPatient,
  getPatient,
  getPatientStats,
  listPatients,
  removePatient,
  updatePatient,
} from "../controllers/patients.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  bulkRemovePatientsSchema,
  createPatientSchema,
  listPatientsSchema,
  patientIdSchema,
  updatePatientSchema,
  addPrescriptionSchema,
} from "../validators/patients.schemas.js";

const router = Router();

router.use(authenticate);

router.get(ROUTE_PATHS.STATS, getPatientStats);
router.get(ROUTE_PATHS.ROOT, validate(listPatientsSchema), listPatients);
router.post(ROUTE_PATHS.ROOT, validate(createPatientSchema), createPatient);
router.post(`${ROUTE_PATHS.BULK}/delete`, validate(bulkRemovePatientsSchema), bulkRemovePatients);
router.get(ROUTE_PATHS.BY_ID, validate(patientIdSchema), getPatient);
router.patch(ROUTE_PATHS.BY_ID, validate(updatePatientSchema), updatePatient);
router.delete(ROUTE_PATHS.BY_ID, validate(patientIdSchema), removePatient);
router.post(`${ROUTE_PATHS.BY_ID}/prescriptions`, validate(addPrescriptionSchema), addPrescription);

export default router;
