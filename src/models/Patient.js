import mongoose from "mongoose";
import {
  BLOOD_TYPE_VALUES,
  GENDER_VALUES,
  PATIENT_STATUS_VALUES,
  PATIENT_STATUSES,
} from "../constants/statuses.js";
import { NAME_MAX_LENGTH } from "../constants/validation.js";
import { demoFlag } from "./demoFlag.js";

const prescriptionSchema = new mongoose.Schema(
  {
    medicines: {
      type: [{ type: String, trim: true }],
      validate: [(arr) => arr.length >= 1, "At least one medicine is required."],
    },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const patientSchema = new mongoose.Schema(
  {
    patientCode: { type: String, trim: true, uppercase: true, sparse: true, unique: true },
    name: { type: String, required: true, trim: true, maxlength: NAME_MAX_LENGTH },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },
    gender: { type: String, enum: GENDER_VALUES, default: undefined },
    dateOfBirth: { type: Date, default: null },
    bloodType: { type: String, enum: BLOOD_TYPE_VALUES, default: undefined },
    status: { type: String, enum: PATIENT_STATUS_VALUES, default: PATIENT_STATUSES.ADMITTED },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", default: null },
    avatarUrl: { type: String, default: null },
    problem: { type: String, trim: true, default: "" },
    treatment: { type: String, trim: true, default: "" },
    // Money in minor units (poisha). dueAmount is derived: treatmentCost - amountPaid.
    treatmentCost: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    amountPaid: { type: Number, default: 0, min: 0, validate: Number.isInteger },
    prescriptions: { type: [prescriptionSchema], default: [] },
    ...demoFlag,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        if (Array.isArray(ret.prescriptions)) {
          ret.prescriptions = ret.prescriptions.map((rx) => ({
            id: rx._id?.toString?.() || rx.id,
            medicines: rx.medicines,
            createdAt: rx.createdAt,
          }));
        }
        return ret;
      },
    },
  },
);

patientSchema.index({ createdAt: -1 });
patientSchema.index({ name: 1 });
patientSchema.index({ status: 1 });
patientSchema.index({ doctor: 1 });

export const Patient = mongoose.model("Patient", patientSchema);
