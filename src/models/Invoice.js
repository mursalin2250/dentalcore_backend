import mongoose from "mongoose";
import {
  INVOICE_OVERDUE_DAYS,
  INVOICE_STATUSES,
  PAYMENT_METHOD_VALUES,
} from "../constants/billing.js";
import { demoFlag } from "./demoFlag.js";

const lineItemSchema = new mongoose.Schema(
  {
    description: { type: String, trim: true, default: "" },
    quantity: { type: Number, required: true, min: 0, default: 1, validate: Number.isInteger },
    rate: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
  },
  { _id: true },
);

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
    number: { type: String, trim: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", default: null },
    patientName: { type: String, trim: true, default: "" },
    patientPhone: { type: String, trim: true, default: "" },
    patientAddress: { type: String, trim: true, default: "" },
    doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", default: null },
    problem: { type: String, trim: true, default: "" },
    treatment: { type: String, trim: true, default: "" },
    lineItems: { type: [lineItemSchema], default: [] },
    discountMinor: { type: Number, min: 0, default: 0, validate: Number.isInteger },
    terms: { type: String, trim: true, default: "" },
    logoDataUrl: { type: String, default: "" },
    totalCost: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    amountPaid: { type: Number, required: true, min: 0, default: 0, validate: Number.isInteger },
    payments: { type: [paymentSchema], default: [] },
    dueDate: { type: Date, default: null },
    notes: { type: String, trim: true, default: "" },
    isCancelled: { type: Boolean, default: false },
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

invoiceSchema.index({ patient: 1 }, { unique: true, sparse: true });
invoiceSchema.index({ isCancelled: 1, updatedAt: -1 });
invoiceSchema.index({ "payments.paidAt": -1 });
invoiceSchema.index({ createdAt: -1 });

export function recomputePaid(invoice) {
  const paid = (invoice.payments || [])
    .filter((p) => !p.isVoided)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  invoice.amountPaid = paid;
  return paid;
}

export function deriveInvoiceStatus(invoice) {
  if (invoice.isCancelled) return INVOICE_STATUSES.CANCELLED;
  const due = Math.max(0, Number(invoice.totalCost) - Number(invoice.amountPaid));
  if (due <= 0) return INVOICE_STATUSES.PAID;
  const lastPayment = (invoice.payments || [])
    .filter((p) => !p.isVoided)
    .map((p) => new Date(p.paidAt).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => b - a)[0];
  const anchor = lastPayment || new Date(invoice.createdAt).getTime();
  const days = (Date.now() - anchor) / (24 * 60 * 60 * 1000);
  if (days > INVOICE_OVERDUE_DAYS) return INVOICE_STATUSES.OVERDUE;
  return INVOICE_STATUSES.PENDING;
}

function shapePerson(person) {
  if (!person) return null;
  if (typeof person !== "object") return { id: String(person) };
  const id = person.id || person._id;
  if (!id) return null;
  return {
    id: id.toString(),
    name: person.name || "",
    phone: person.phone || "",
    address: person.address || "",
  };
}

export function shapeInvoice(doc) {
  const json = typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };
  recomputePaid({ payments: json.payments, amountPaid: json.amountPaid });
  const amountPaid = (json.payments || [])
    .filter((p) => !p.isVoided)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalCost = Number(json.totalCost) || 0;
  const amountDue = Math.max(0, totalCost - amountPaid);
  const status = deriveInvoiceStatus({
    ...json,
    amountPaid,
    totalCost,
  });
  return {
    id: json.id,
    invoiceNumber: json.invoiceNumber || json.number,
    number: json.invoiceNumber || json.number,
    patient: shapePerson(json.patient),
    patientName: json.patientName || json.patient?.name || "",
    patientPhone: json.patientPhone || json.patient?.phone || "",
    patientAddress: json.patientAddress || json.patient?.address || "",
    doctor: shapePerson(json.doctor),
    problem: json.problem || "",
    treatment: json.treatment || "",
    lineItems: (json.lineItems || []).map((li) => ({
      id: (li.id || li._id)?.toString?.(),
      description: li.description || "",
      quantity: Number(li.quantity) || 0,
      rate: Number(li.rate) || 0,
    })),
    discountMinor: Number(json.discountMinor) || 0,
    terms: json.terms || "",
    logoDataUrl: json.logoDataUrl || "",
    totalCost,
    amountPaid,
    amountDue,
    status,
    payments: (json.payments || []).map((p) => ({
      id: (p.id || p._id)?.toString?.(),
      amount: Number(p.amount) || 0,
      method: p.method,
      paidAt: p.paidAt,
      note: p.note || "",
      isVoided: Boolean(p.isVoided),
      voidReason: p.voidReason || "",
      recordedBy: p.recordedBy?.name || null,
    })),
    dueDate: json.dueDate || null,
    notes: json.notes || "",
    isCancelled: Boolean(json.isCancelled),
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
  };
}

export const Invoice = mongoose.model("Invoice", invoiceSchema);
