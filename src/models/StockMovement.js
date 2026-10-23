import mongoose from "mongoose";
import { STOCK_MOVEMENT_TYPE_VALUES } from "../constants/inventory.js";
import { demoFlag } from "./demoFlag.js";

const stockMovementSchema = new mongoose.Schema(
  {
    medication: { type: mongoose.Schema.Types.ObjectId, ref: "Medication", required: true },
    type: { type: String, enum: STOCK_MOVEMENT_TYPE_VALUES, required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    stockBefore: { type: Number, required: true, min: 0, validate: Number.isInteger },
    stockAfter: { type: Number, required: true, min: 0, validate: Number.isInteger },
    reason: { type: String, required: true, trim: true },
    note: { type: String, trim: true, default: "" },
    reference: { type: String, trim: true, default: "" },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    ...demoFlag,
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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

stockMovementSchema.index({ medication: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1 });
stockMovementSchema.index({ createdAt: -1 });

export function shapeStockMovement(doc) {
  if (!doc) return null;
  const json = typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };
  const id = (json.id || json._id)?.toString?.();
  let medication = json.medication;
  let unitPrice = 0;
  if (medication && typeof medication === "object") {
    unitPrice = Number(medication.unitPrice ?? 0);
    medication = {
      id: (medication.id || medication._id)?.toString?.(),
      name: medication.name || "",
      sku: medication.sku || "",
      unit: medication.unit || "",
      stock: medication.stock,
      unitPrice,
    };
  } else if (medication) {
    medication = { id: medication.toString(), name: "", sku: "", unit: "", unitPrice: 0 };
  }
  let performedBy = json.performedBy;
  if (performedBy && typeof performedBy === "object") {
    performedBy = {
      id: (performedBy.id || performedBy._id)?.toString?.(),
      name: performedBy.name,
    };
  } else if (performedBy) {
    performedBy = { id: performedBy.toString() };
  }
  return {
    id,
    medication,
    type: json.type,
    quantity: json.quantity,
    stockBefore: json.stockBefore,
    stockAfter: json.stockAfter,
    reason: json.reason,
    note: json.note || "",
    reference: json.reference || "",
    performedBy,
    createdAt: json.createdAt,
    totalCost: Number(json.quantity || 0) * unitPrice,
  };
}

export const StockMovement = mongoose.model("StockMovement", stockMovementSchema);
