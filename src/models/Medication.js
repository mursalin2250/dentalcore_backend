import mongoose from "mongoose";
import {
  EXPIRY_FLAGS,
  EXPIRY_SOON_DAYS,
  MEDICATION_ITEM_TYPE_VALUES,
  MEDICATION_ITEM_TYPES,
  STOCK_STATUSES,
} from "../constants/inventory.js";
import { demoFlag } from "./demoFlag.js";

const medicationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, unique: true },
    itemType: {
      type: String,
      enum: MEDICATION_ITEM_TYPE_VALUES,
      default: MEDICATION_ITEM_TYPES.MEDICINE,
    },
    category: { type: String, trim: true, default: "Other" },
    unit: { type: String, trim: true, default: "pcs" },
    // Primary stock field (dashboard low-stock uses this).
    stock: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    reorderLevel: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    unitPrice: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    expiryDate: { type: Date, default: null },
    supplier: { type: String, trim: true, default: "" },
    isArchived: { type: Boolean, default: false },
    ...demoFlag,
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Legacy alias so any leftover code reading quantity still works.
medicationSchema.virtual("quantity").get(function quantity() {
  return this.stock;
});

medicationSchema.index({ name: 1 });
medicationSchema.index({ category: 1 });
medicationSchema.index({ stock: 1, reorderLevel: 1 });
medicationSchema.index({ isArchived: 1 });

export function deriveStockStatus(stock, reorderLevel) {
  if (stock <= 0) return STOCK_STATUSES.OUT_OF_STOCK;
  if (stock <= reorderLevel) return STOCK_STATUSES.LOW_STOCK;
  return STOCK_STATUSES.IN_STOCK;
}

export function deriveExpiryFlag(expiryDate, now = new Date()) {
  if (!expiryDate) return EXPIRY_FLAGS.NONE;
  const exp = new Date(expiryDate);
  if (Number.isNaN(exp.getTime())) return EXPIRY_FLAGS.NONE;
  if (exp.getTime() < now.getTime()) return EXPIRY_FLAGS.EXPIRED;
  const soon = new Date(now);
  soon.setDate(soon.getDate() + EXPIRY_SOON_DAYS);
  if (exp.getTime() <= soon.getTime()) return EXPIRY_FLAGS.EXPIRING_SOON;
  return EXPIRY_FLAGS.OK;
}

export function shapeMedication(doc) {
  if (!doc) return null;
  const json = typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };
  const id = (json.id || json._id)?.toString?.() || json._id?.toString?.();
  const stock = Number(json.stock ?? json.quantity ?? 0);
  const reorderLevel = Number(json.reorderLevel ?? 0);
  const unitPrice = Number(json.unitPrice ?? 0);
  return {
    id,
    name: json.name,
    sku: json.sku,
    itemType: json.itemType,
    category: json.category,
    unit: json.unit,
    stock,
    reorderLevel,
    unitPrice,
    totalCost: stock * unitPrice,
    status: deriveStockStatus(stock, reorderLevel),
    expiryDate: json.expiryDate || null,
    expiryFlag: deriveExpiryFlag(json.expiryDate),
    supplier: json.supplier || "",
    isArchived: Boolean(json.isArchived),
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

export const Medication = mongoose.model("Medication", medicationSchema);
