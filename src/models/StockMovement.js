import mongoose from "mongoose";
import { STOCK_MOVEMENT_TYPE_VALUES } from "../constants/statuses.js";
import { demoFlag } from "./demoFlag.js";

// Minimal model for the dashboard. It will be extended in the Stock Movement module phase.
const stockMovementSchema = new mongoose.Schema(
  {
    medication: { type: mongoose.Schema.Types.ObjectId, ref: "Medication", required: true },
    type: { type: String, enum: STOCK_MOVEMENT_TYPE_VALUES, required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    ...demoFlag,
  },
  { timestamps: true },
);

stockMovementSchema.index({ createdAt: -1 });

export const StockMovement = mongoose.model("StockMovement", stockMovementSchema);
