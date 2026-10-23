import mongoose from "mongoose";
import { APPOINTMENT_STATUS_VALUES, APPOINTMENT_STATUSES } from "../constants/statuses.js";
import { demoFlag } from "./demoFlag.js";

const noteSchema = new mongoose.Schema(
  {
    text: { type: String, required: true, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

// Field name stays `startsAt` so existing dashboard queries keep working.
const appointmentSchema = new mongoose.Schema(
  {
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
    startsAt: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 5, max: 480, default: 30 },
    reason: { type: String, trim: true, default: "" },
    status: { type: String, enum: APPOINTMENT_STATUS_VALUES, default: APPOINTMENT_STATUSES.PENDING },
    notes: { type: [noteSchema], default: [] },
    originalStartAt: { type: Date, default: null },
    treatment: { type: String, trim: true, default: "" },
    ...demoFlag,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        if (Array.isArray(ret.notes)) {
          ret.notes = ret.notes.map((n) => ({
            id: n._id?.toString?.() || n.id,
            text: n.text,
            createdBy: n.createdBy
              ? typeof n.createdBy === "object"
                ? { id: (n.createdBy._id || n.createdBy.id)?.toString?.(), name: n.createdBy.name }
                : n.createdBy.toString()
              : null,
            createdAt: n.createdAt,
          }));
        }
        return ret;
      },
    },
  },
);

appointmentSchema.index({ startsAt: 1, status: 1 });
appointmentSchema.index({ doctor: 1, startsAt: 1 });
appointmentSchema.index({ patient: 1, startsAt: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ createdAt: -1 });
appointmentSchema.index({ patient: 1, doctor: 1, status: 1 });

export const Appointment = mongoose.model("Appointment", appointmentSchema);
