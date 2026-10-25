import mongoose from "mongoose";
import {
  INVOICE_OVERDUE_DAYS,
  INVOICE_STATUSES,
  PAYMENT_METHOD_VALUES,
} from "../constants/billing.js";
import { demoFlag } from "./demoFlag.js";

const paymentSchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 1, validate: Number.isInteger },
    method: { type: String, enum: PAYMENT_METHOD_VALUES, required: true },
    paidAt: { type: Date, required: true, default: Date.now },
    note: { type: String, trim: true, default: "" },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    isVoided: { type: Boolean, default: false },
    voidReason: { type: String, trim: true, default: "" },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    voidedAt: { type: Date, default: null },
  },
  { _id: true },
);

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, trim: true },
    // Legacy alias kept in sync for older queries that still read `number`.
    number: { type: String, trim: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", default: null },
    problem: { type: String, trim: true, default: "" },
    treatment: { type: String, trim: true, default: "" },
    totalCost: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    amountPaid: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    payments: { type: [paymentSchema], default: [] },
    dueDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: "" },
    isCancelled: { type: Boolean, default: false },
    // Legacy fields kept for gradual migration / seed compatibility.
    totalAmount: { type: Number, min: 0, validate: Number.isInteger },
    status: { type: String, default: INVOICE_STATUSES.PENDING },
    paidAt: { type: Date, default: null },
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

invoiceSchema.index({ patient: 1 }, { unique: true });
invoiceSchema.index({ isCancelled: 1, updatedAt: -1 });
invoiceSchema.index({ "payments.paidAt": -1 });
invoiceSchema.index({ createdAt: -1 });

/** Recompute amountPaid from non-voided payments and sync legacy fields. */
export function recomputePaid(invoice) {
  const valid = (invoice.payments || []).filter((p) => !p.isVoided);
  const amountPaid = valid.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  invoice.amountPaid = amountPaid;
  const totalCost = Number(invoice.totalCost ?? invoice.totalAmount ?? 0);
  invoice.totalCost = totalCost;
  invoice.totalAmount = totalCost;
  invoice.number = invoice.invoiceNumber || invoice.number;
  const lastPay = valid.map((p) => new Date(p.paidAt).getTime()).filter((t) => !Number.isNaN(t));
  invoice.paidAt = lastPay.length ? new Date(Math.max(...lastPay)) : null;
  return amountPaid;
}

export function deriveInvoiceStatus(invoice, now = new Date()) {
  if (invoice.isCancelled) return INVOICE_STATUSES.CANCELLED;
  const totalCost = Number(invoice.totalCost ?? invoice.totalAmount ?? 0);
  const amountPaid = Number(invoice.amountPaid ?? 0);
  const amountDue = Math.max(0, totalCost - amountPaid);
  if (amountDue <= 0 && totalCost >= 0) return INVOICE_STATUSES.PAID;

  const valid = (invoice.payments || []).filter((p) => !p.isVoided && p.paidAt);
  let anchor = invoice.createdAt ? new Date(invoice.createdAt) : now;
  if (valid.length) {
    const times = valid.map((p) => new Date(p.paidAt).getTime());
    anchor = new Date(Math.max(...times));
  }
  const overdueMs = INVOICE_OVERDUE_DAYS * 24 * 60 * 60 * 1000;
  if (now.getTime() - anchor.getTime() > overdueMs) return INVOICE_STATUSES.OVERDUE;
  return INVOICE_STATUSES.PENDING;
}

function shapePerson(ref) {
  if (!ref) return null;
  if (typeof ref !== "object") return { id: ref.toString() };
  return {
    id: (ref.id || ref._id)?.toString?.(),
    name: ref.name,
  };
}

function shapePayment(p) {
  return {
    id: (p.id || p._id)?.toString?.(),
    amount: p.amount,
    method: p.method,
    paidAt: p.paidAt,
    note: p.note || "",
    recordedBy: shapePerson(p.recordedBy),
    isVoided: Boolean(p.isVoided),
    voidReason: p.voidReason || "",
    voidedBy: shapePerson(p.voidedBy),
    voidedAt: p.voidedAt || null,
  };
}

export function shapeInvoice(doc) {
  if (!doc) return null;
  const json = typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };
  const totalCost = Number(json.totalCost ?? json.totalAmount ?? 0);
  const amountPaid = Number(json.amountPaid ?? 0);
  const amountDue = Math.max(0, totalCost - amountPaid);
  const status = deriveInvoiceStatus({
    ...json,
    totalCost,
    amountPaid,
  });
  return {
    id: (json.id || json._id)?.toString?.(),
    invoiceNumber: json.invoiceNumber || json.number,
    number: json.invoiceNumber || json.number,
    patient: shapePerson(json.patient),
    doctor: shapePerson(json.doctor),
    problem: json.problem || "",
    treatment: json.treatment || "",
    totalCost,
    totalAmount: totalCost,
    amountPaid,
    amountDue,
    status,
    payments: (json.payments || []).map(shapePayment).sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt)),
    dueDate: json.dueDate || null,
    notes: json.notes || "",
    isCancelled: Boolean(json.isCancelled),
    paidAt: json.paidAt || null,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

export const Invoice = mongoose.model("Invoice", invoiceSchema);
