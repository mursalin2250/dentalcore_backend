import mongoose from "mongoose";
import { ITEM_TYPE_VALUES } from "../constants/inventory.js";
import { demoFlag } from "./demoFlag.js";

const medicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, uppercase: true, sparse: true, unique: true },
    itemType: { type: String, enum: ITEM_TYPE_VALUES, default: "medicine" },
    category: { type: String, trim: true, default: "" },
    unit: { type: String, trim: true, default: "pcs" },
    // `quantity` is the current stock — kept for dashboard low-stock queries.
    quantity: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    reorderLevel: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    unitPrice: { type: Number, min: 0, default: 0, validate: Number.isInteger }, // poisha
    expiryDate: { type: Date, default: null },
    supplier: { type: String, trim: true, default: "" },
    isArchived: { type: Boolean, default: false },
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

medicationSchema.index({ name: 1 });
medicationSchema.index({ category: 1 });
medicationSchema.index({ quantity: 1 });
medicationSchema.index({ isArchived: 1, updatedAt: -1 });

export function deriveStockStatus(med) {
  const qty = Number(med.quantity) || 0;
  const reorder = Number(med.reorderLevel) || 0;
  if (qty <= 0) return "out";
  if (qty <= reorder) return "low";
  return "in";
}

export function shapeMedication(doc) {
  const json = typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };
  const quantity = Number(json.quantity) || 0;
  const unitPrice = Number(json.unitPrice) || 0;
  return {
    id: json.id,
    name: json.name || "",
    sku: json.sku || "",
    itemType: json.itemType || "medicine",
    category: json.category || "",
    unit: json.unit || "pcs",
    quantity,
    stock: quantity,
    reorderLevel: Number(json.reorderLevel) || 0,
    unitPrice,
    totalPrice: quantity * unitPrice,
    expiryDate: json.expiryDate || null,
    supplier: json.supplier || "",
    isArchived: Boolean(json.isArchived),
    status: deriveStockStatus(json),
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

export const Medication = mongoose.model("Medication", medicationSchema);
