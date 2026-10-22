import mongoose from "mongoose";
import { APPOINTMENT_STATUS_VALUES, APPOINTMENT_STATUSES } from "../constants/statuses.js";
import { demoFlag } from "./demoFlag.js";

// Minimal model for the dashboard. It will be extended in the Appointments module phase.
const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    startsAt: { type: Date, required: true },
    status: { type: String, enum: APPOINTMENT_STATUS_VALUES, default: APPOINTMENT_STATUSES.SCHEDULED },
    treatment: { type: String, trim: true, default: "" },
    ...demoFlag,
  },
  { timestamps: true },
);

appointmentSchema.index({ startsAt: 1, status: 1 });
appointmentSchema.index({ doctor: 1, startsAt: 1 });
appointmentSchema.index({ createdAt: -1 });
// Supports completed-visit counts for a doctor's patients without N+1.
appointmentSchema.index({ patient: 1, doctor: 1, status: 1 });

export const Appointment = mongoose.model("Appointment", appointmentSchema);
