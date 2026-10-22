import mongoose from "mongoose";
import { demoFlag } from "./demoFlag.js";

// Minimal model for the dashboard. It will be extended in the Medications module phase.
const medicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    unit: { type: String, trim: true, default: "units" },
    quantity: { type: Number, required: true, min: 0, validate: Number.isInteger },
    reorderLevel: { type: Number, required: true, min: 0, validate: Number.isInteger },
    ...demoFlag,
  },
  { timestamps: true },
);

medicationSchema.index({ quantity: 1 });

export const Medication = mongoose.model("Medication", medicationSchema);
