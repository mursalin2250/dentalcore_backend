import {
  INVOICE_NUMBER_PAD,
  INVOICE_NUMBER_PREFIX,
  INVOICE_STATUSES,
  PAYMENT_METHODS,
} from "../constants/billing.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import {
  Invoice,
  deriveInvoiceStatus,
  recomputePaid,
  shapeInvoice,
} from "../models/Invoice.js";
import { Patient } from "../models/Patient.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { computeInvoiceTotals } from "../utils/invoiceTotals.js";
import { sendSuccess } from "../utils/response.js";

export async function nextInvoiceNumber() {
  const count = await Invoice.countDocuments({});
  let n = count + 1;
  for (let i = 0; i < 30; i += 1) {
    const invoiceNumber = `${INVOICE_NUMBER_PREFIX}-${String(n).padStart(INVOICE_NUMBER_PAD, "0")}`;
    const exists = await Invoice.exists({ $or: [{ invoiceNumber }, { number: invoiceNumber }] });
    if (!exists) return invoiceNumber;
    n += 1;
  }
  return `${INVOICE_NUMBER_PREFIX}-${Date.now()}`;
}

async function findInvoiceOrThrow(id) {
  const invoice = await Invoice.findById(id)
    .populate("patient", "name phone address")
    .populate("doctor", "name")
    .populate("payments.recordedBy", "name");
  if (!invoice) throw new AppError(MESSAGES.INVOICE.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  return invoice;
}

function parseDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Create starter invoice when a patient is registered. */
export async function createStarterInvoiceForPatient(patient) {
  const existing = await Invoice.findOne({ patient: patient._id });
  if (existing) return existing;

  const treatmentCost = Math.max(0, Number(patient.treatmentCost) || 0);
  const amountPaid = Math.max(0, Number(patient.amountPaid) || 0);
  const treatmentLabel = (patient.treatment || "").trim() || "Consultation";
  const invoiceNumber = await nextInvoiceNumber();
  const lineItems = [{ description: treatmentLabel, quantity: 1, rate: treatmentCost }];
  const payments = [];
  if (amountPaid > 0) {
    payments.push({
      amount: amountPaid,
      method: PAYMENT_METHODS.CASH,
      paidAt: new Date(),
      note: "Initial payment on registration",
      isVoided: false,
    });
  }

  return Invoice.create({
    invoiceNumber,
    number: invoiceNumber,
    patient: patient._id,
    patientName: patient.name || "",
    patientPhone: patient.phone || "",
    patientAddress: patient.address || "",
    doctor: patient.doctor || null,
    problem: patient.problem || "",
    treatment: treatmentLabel,
    lineItems,
    discountMinor: 0,
    terms: "Please make payment by the due date.",
    totalCost: treatmentCost,
    totalAmount: treatmentCost,
    amountPaid,
    payments,
    notes: "",
    isCancelled: false,
    status: amountPaid >= treatmentCost && treatmentCost > 0 ? INVOICE_STATUSES.PAID : INVOICE_STATUSES.PENDING,
  });
}

export const getInvoiceStats = asyncHandler(async (_req, res) => {
  const invoices = await Invoice.find({ isCancelled: false }).select(
    "totalCost amountPaid payments createdAt isCancelled",
  );
  let outstanding = 0;
  let collected = 0;
  let pending = 0;
  let overdue = 0;
  for (const inv of invoices) {
    recomputePaid(inv);
    const status = deriveInvoiceStatus(inv);
    const due = Math.max(0, Number(inv.totalCost) - Number(inv.amountPaid));
    outstanding += due;
    collected += Number(inv.amountPaid) || 0;
    if (status === INVOICE_STATUSES.PENDING) pending += 1;
    if (status === INVOICE_STATUSES.OVERDUE) overdue += 1;
  }
  sendSuccess(res, {
    data: { outstanding, collected, pending, overdue },
  });
});

export const listInvoices = asyncHandler(async (req, res) => {
  const { search, status, patient, page, limit, sort } = req.validated.query;
  const filter = {};
  if (patient) filter.patient = patient;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    const patients = await Patient.find({ name: pattern }).select("_id").limit(50);
    filter.$or = [
      { invoiceNumber: pattern },
      { number: pattern },
      { patientName: pattern },
      { patient: { $in: patients.map((p) => p._id) } },
      { treatment: pattern },
    ];
  }

  const skip = (page - 1) * limit;
  const sortSpec = sort?.startsWith("-") ? { [sort.slice(1)]: -1 } : { [sort || "updatedAt"]: -1 };

  const [rows, total] = await Promise.all([
    Invoice.find(filter)
      .sort(sortSpec)
      .skip(skip)
      .limit(limit)
      .populate("patient", "name phone address")
      .populate("doctor", "name"),
    Invoice.countDocuments(filter),
  ]);

  let invoices = rows.map((r) => shapeInvoice(r));
  if (status) invoices = invoices.filter((i) => i.status === status);

  sendSuccess(res, {
    data: {
      invoices,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
    },
  });
});

export const getInvoice = asyncHandler(async (req, res) => {
  const invoice = await findInvoiceOrThrow(req.validated.params.id);
  sendSuccess(res, { data: { invoice: shapeInvoice(invoice) } });
});

export const createInvoice = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  let patientId = body.patient || null;
  let patientName = (body.patientName || "").trim();
  let patientPhone = (body.patientPhone || "").trim();
  let patientAddress = (body.patientAddress || "").trim();

  if (patientId) {
    const patient = await Patient.findById(patientId).select("_id name phone address");
    if (!patient) throw new AppError(MESSAGES.PATIENT.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
    patientName = patientName || patient.name || "";
    patientPhone = patientPhone || patient.phone || "";
    patientAddress = patientAddress || patient.address || "";
    const existing = await Invoice.findOne({ patient: patientId });
    if (existing) throw new AppError(MESSAGES.INVOICE.PATIENT_HAS_INVOICE, HTTP_STATUS.CONFLICT);
  }
  if (!patientId && !patientName) {
    throw new AppError("Enter a patient name or select a patient.", HTTP_STATUS.BAD_REQUEST);
  }

  const lineItems = body.lineItems || [];
  const totals = computeInvoiceTotals(lineItems, { discountMinor: body.discountMinor ?? 0 });
  const totalCost = lineItems.length > 0 ? totals.total : body.totalCost ?? 0;
  const invoiceNumber = await nextInvoiceNumber();

  const initialPayment = Math.max(0, Number(body.initialPayment) || 0);
  const payments = [];
  if (initialPayment > 0) {
    payments.push({
      amount: Math.min(initialPayment, totalCost || initialPayment),
      method: PAYMENT_METHODS.CASH,
      paidAt: new Date(),
      note: "Initial payment",
      recordedBy: req.user?._id || null,
      isVoided: false,
    });
  }

  const invoice = await Invoice.create({
    invoiceNumber,
    number: invoiceNumber,
    patient: patientId,
    patientName,
    patientPhone,
    patientAddress,
    doctor: body.doctor || null,
    problem: body.problem || "",
    treatment: body.treatment || lineItems.map((i) => i.description).filter(Boolean).join(", "),
    lineItems,
    discountMinor: body.discountMinor ?? 0,
    terms: body.terms || "",
    logoDataUrl: body.logoDataUrl || "",
    totalCost,
    totalAmount: totalCost,
    amountPaid: 0,
    payments,
    dueDate: parseDate(body.dueDate),
    notes: body.notes || "",
    isCancelled: false,
  });
  recomputePaid(invoice);
  await invoice.save();

  const populated = await findInvoiceOrThrow(invoice._id);
  sendSuccess(res, {
    status: HTTP_STATUS.CREATED,
    data: { invoice: shapeInvoice(populated) },
    message: MESSAGES.INVOICE.CREATED,
  });
});

export const updateInvoice = asyncHandler(async (req, res) => {
  const invoice = await findInvoiceOrThrow(req.validated.params.id);
  if (invoice.isCancelled) throw new AppError(MESSAGES.INVOICE.CANCELLED, HTTP_STATUS.BAD_REQUEST);
  const changes = { ...req.validated.body };

  if ("dueDate" in changes) changes.dueDate = parseDate(changes.dueDate);
  if (changes.lineItems) {
    const totals = computeInvoiceTotals(changes.lineItems, {
      discountMinor: changes.discountMinor ?? invoice.discountMinor ?? 0,
    });
    changes.totalCost = totals.total;
    changes.totalAmount = totals.total;
    if (!changes.treatment) {
      changes.treatment = changes.lineItems.map((i) => i.description).filter(Boolean).join(", ");
    }
  } else if ("totalCost" in changes) {
    changes.totalAmount = changes.totalCost;
  }

  Object.assign(invoice, changes);
  await invoice.save();
  const refreshed = await findInvoiceOrThrow(invoice._id);
  sendSuccess(res, {
    data: { invoice: shapeInvoice(refreshed) },
    message: MESSAGES.INVOICE.UPDATED,
  });
});

export const removeInvoice = asyncHandler(async (req, res) => {
  const invoice = await findInvoiceOrThrow(req.validated.params.id);
  await invoice.deleteOne();
  sendSuccess(res, { message: MESSAGES.INVOICE.DELETED });
});

export const addPayment = asyncHandler(async (req, res) => {
  const invoice = await findInvoiceOrThrow(req.validated.params.id);
  if (invoice.isCancelled) throw new AppError(MESSAGES.INVOICE.CANCELLED, HTTP_STATUS.BAD_REQUEST);

  const amount = Number(req.validated.body.amount);
  recomputePaid(invoice);
  const due = Math.max(0, Number(invoice.totalCost) - Number(invoice.amountPaid));
  if (due <= 0) throw new AppError(MESSAGES.INVOICE.ALREADY_PAID, HTTP_STATUS.BAD_REQUEST);
  if (amount > due) throw new AppError(MESSAGES.INVOICE.PAYMENT_EXCEEDS_DUE, HTTP_STATUS.BAD_REQUEST);

  invoice.payments.push({
    amount,
    method: req.validated.body.method,
    paidAt: parseDate(req.validated.body.paidAt) || new Date(),
    note: req.validated.body.note || "",
    recordedBy: req.user?._id || null,
    isVoided: false,
  });
  recomputePaid(invoice);
  await invoice.save();
  const refreshed = await findInvoiceOrThrow(invoice._id);
  sendSuccess(res, {
    data: { invoice: shapeInvoice(refreshed) },
    message: MESSAGES.INVOICE.PAYMENT_ADDED,
  });
});

export const voidPayment = asyncHandler(async (req, res) => {
  const invoice = await findInvoiceOrThrow(req.validated.params.id);
  const payment = invoice.payments.id(req.validated.params.paymentId);
  if (!payment) throw new AppError("Payment not found.", HTTP_STATUS.NOT_FOUND);
  payment.isVoided = true;
  payment.voidReason = req.validated.body.voidReason;
  payment.voidedBy = req.user?._id || null;
  payment.voidedAt = new Date();
  recomputePaid(invoice);
  await invoice.save();
  const refreshed = await findInvoiceOrThrow(invoice._id);
  sendSuccess(res, { data: { invoice: shapeInvoice(refreshed) }, message: MESSAGES.INVOICE.UPDATED });
});
