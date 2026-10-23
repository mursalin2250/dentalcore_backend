import { Router } from "express";
import { ROUTE_PATHS } from "../constants/api.js";
import {
  addAppointmentNote,
  createAppointment,
  getAppointment,
  getAppointmentCalendar,
  getAppointmentStats,
  listAppointments,
  removeAppointment,
  updateAppointment,
} from "../controllers/appointments.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  addAppointmentNoteSchema,
  appointmentCalendarSchema,
  appointmentIdSchema,
  appointmentStatsSchema,
  createAppointmentSchema,
  listAppointmentsSchema,
  updateAppointmentSchema,
} from "../validators/appointments.schemas.js";

const router = Router();
router.use(authenticate);
router.get(ROUTE_PATHS.STATS, validate(appointmentStatsSchema), getAppointmentStats);
router.get(ROUTE_PATHS.CALENDAR, validate(appointmentCalendarSchema), getAppointmentCalendar);
router.get(ROUTE_PATHS.ROOT, validate(listAppointmentsSchema), listAppointments);
router.post(ROUTE_PATHS.ROOT, validate(createAppointmentSchema), createAppointment);
router.get(ROUTE_PATHS.BY_ID, validate(appointmentIdSchema), getAppointment);
router.patch(ROUTE_PATHS.BY_ID, validate(updateAppointmentSchema), updateAppointment);
router.delete(ROUTE_PATHS.BY_ID, validate(appointmentIdSchema), removeAppointment);
router.post(`${ROUTE_PATHS.BY_ID}${ROUTE_PATHS.NOTES}`, validate(addAppointmentNoteSchema), addAppointmentNote);
export default router;
