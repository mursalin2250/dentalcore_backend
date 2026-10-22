import mongoose from "mongoose";
import { INVOICE_STATUS_VALUES, INVOICE_STATUSES } from "../constants/statuses.js";
import { demoFlag } from "./demoFlag.js";

// Minimal model for the dashboard. It will be extended in the Billing module phase.
const invoiceSchema = new mongoose.Schema(
  {
    number: { type: String, required: true, unique: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    // Integer poisha (see CURRENCY_MINOR_UNIT), never floats.
    totalAmount: { type: Number, required: true, min: 0, validate: Number.isInteger },
    status: { type: String, enum: INVOICE_STATUS_VALUES, default: INVOICE_STATUSES.PENDING },
    paidAt: { type: Date, default: null },
    ...demoFlag,
  },
  { timestamps: true },
);

invoiceSchema.index({ status: 1, paidAt: -1 });

export const Invoice = mongoose.model("Invoice", invoiceSchema);
