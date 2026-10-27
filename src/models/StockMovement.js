import mongoose from "mongoose";
import { STOCK_MOVEMENT_TYPE_VALUES } from "../constants/statuses.js";
import { demoFlag } from "./demoFlag.js";

const stockMovementSchema = new mongoose.Schema(
  {
    medication: { type: mongoose.Schema.Types.ObjectId, ref: "Medication", required: true },
    type: { type: String, enum: STOCK_MOVEMENT_TYPE_VALUES, required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    stockBefore: { type: Number, min: 0, default: 0, validate: Number.isInteger },
    stockAfter: { type: Number, min: 0, default: 0, validate: Number.isInteger },
    reason: { type: String, trim: true, default: "" },
    note: { type: String, trim: true, default: "" },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    ...demoFlag,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ medication: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });

export function shapeStockMovement(doc) {
  const json = typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };
  const med = json.medication && typeof json.medication === "object" ? json.medication : null;
  const unitPrice = med ? Number(med.unitPrice) || 0 : 0;
  const qty = Number(json.quantity) || 0;
  return {
    id: json.id,
    medication: med
      ? { id: (med.id || med._id)?.toString?.(), name: med.name || "", sku: med.sku || "", unit: med.unit || "pcs", unitPrice }
      : { id: String(json.medication), name: "", sku: "", unit: "pcs", unitPrice: 0 },
    type: json.type,
    quantity: qty,
    stockBefore: Number(json.stockBefore) || 0,
    stockAfter: Number(json.stockAfter) || 0,
    reason: json.reason || "",
    note: json.note || "",
    totalCost: qty * unitPrice,
    performedBy: json.performedBy?.name || null,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

export const StockMovement = mongoose.model("StockMovement", stockMovementSchema);
