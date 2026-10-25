import {
  INVOICE_NUMBER_PAD,
  INVOICE_NUMBER_PREFIX,
  INVOICE_OVERDUE_DAYS,
  INVOICE_STATUSES,
} from "../constants/billing.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { Doctor } from "../models/Doctor.js";
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
import { sendSuccess } from "../utils/response.js";

async function nextInvoiceNumber() {
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
    .populate("patient", "name")
    .populate("doctor", "name")
    .populate("payments.recordedBy", "name")
    .populate("payments.voidedBy", "name");
  if (!invoice) throw new AppError(MESSAGES.INVOICE.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  return invoice;
}

function parseDate(value) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Mongo match fragments for derived status (never stored). */
export function statusMatch(status, now = new Date()) {
  const overdueAnchor = new Date(now.getTime() - INVOICE_OVERDUE_DAYS * 24 * 60 * 60 * 1000);
  if (status === INVOICE_STATUSES.CANCELLED) return { isCancelled: true };
  if (status === INVOICE_STATUSES.PAID) {
    return {
      isCancelled: { $ne: true },
      $expr: { $lte: [{ $subtract: ["$totalCost", "$amountPaid"] }, 0] },
    };
  }
  if (status === INVOICE_STATUSES.OVERDUE) {
    return {
      isCancelled: { $ne: true },
      $expr: { $gt: [{ $subtract: ["$totalCost", "$amountPaid"] }, 0] },
      $or: [
        {
          $and: [
            { "payments.0": { $exists: true } },
            {
              $expr: {
                $lt: [
                  {
                    $max: {
                      $map: {
                        input: {
                          $filter: {
                            input: { $ifNull: ["$payments", []] },
                            as: "p",
                            cond: { $ne: ["$$p.isVoided", true] },
                          },
                        },
                        as: "p",
                        in: "$$p.paidAt",
                      },
                    },
                  },
                  overdueAnchor,
                ],
              },
            },
          ],
        },
        {
          $and: [
            { $or: [{ payments: { $size: 0 } }, { payments: { $exists: false } }] },
            { createdAt: { $lt: overdueAnchor } },
          ],
        },
      ],
    };
  }
  if (status === INVOICE_STATUSES.PENDING) {
    return {
      isCancelled: { $ne: true },
      $expr: { $gt: [{ $subtract: ["$totalCost", "$amountPaid"] }, 0] },
    };
  }
  return {};
}

export const getInvoiceStats = asyncHandler(async (_req, res) => {
  const now = new Date();
  const invoices = await Invoice.find({}).select("totalCost amountPaid isCancelled payments createdAt").lean();
  let pending = 0;
  let paid = 0;
  let overdue = 0;
  let cancelled = 0;
  let outstanding = 0;
  let collected = 0;
  for (const inv of invoices) {
    const status = deriveInvoiceStatus(inv, now);
    const due = Math.max(0, Number(inv.totalCost || 0) - Number(inv.amountPaid || 0));
    if (status === INVOICE_STATUSES.CANCELLED) cancelled += 1;
    else if (status === INVOICE_STATUSES.PAID) {
      paid += 1;
      collected += Number(inv.amountPaid || 0);
    } else if (status === INVOICE_STATUSES.OVERDUE) {
      overdue += 1;
      outstanding += due;
    } else {
      pending += 1;
      outstanding += due;
    }
  }
  sendSuccess(res, {
    data: {
      total: invoices.length,
      pending,
      paid,
      overdue,
      cancelled,
      outstanding,
      collected,
    },
  });
});

export const listInvoices = asyncHandler(async (req, res) => {
  const { search, status, patient, doctor, from, to, page, limit, sort } = req.validated.query;
  const filter = {};
  if (patient) filter.patient = patient;
  if (doctor) filter.doctor = doctor;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  if (status) Object.assign(filter, statusMatch(status));
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    const patients = await Patient.find({ name: pattern }).select("_id").lean();
    filter.$or = [
      { invoiceNumber: pattern },
      { number: pattern },
      { patient: { $in: patients.map((p) => p._id) } },
      { problem: pattern },
      { treatment: pattern },
    ];
  }

  const sortKey = sort || "-updatedAt";
  const sortSpec = sortKey.startsWith("-") ? { [sortKey.slice(1)]: -1 } : { [sortKey]: 1 };

  const [rows, total] = await Promise.all([
    Invoice.find(filter)
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("patient", "name")
      .populate("doctor", "name")
      .lean(),
    Invoice.countDocuments(filter),
  ]);

  sendSuccess(res, {
    data: {
      invoices: rows.map(shapeInvoice),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

export const getInvoice = asyncHandler(async (req, res) => {
  const invoice = await findInvoiceOrThrow(req.validated.params.id);
  sendSuccess(res, { data: { invoice: shapeInvoice(invoice) } });
});

export const getInvoiceByPatient = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOne({ patient: req.validated.params.id })
    .populate("patient", "name")
    .populate("doctor", "name")
    .populate("payments.recordedBy", "name")
    .populate("payments.voidedBy", "name");
  sendSuccess(res, { data: { invoice: invoice ? shapeInvoice(invoice) : null } });
});

export const createInvoice = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const patient = await Patient.findById(body.patient).select("_id");
  if (!patient) throw new AppError(MESSAGES.PATIENT.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

  const existing = await Invoice.findOne({ patient: body.patient });
  if (existing) throw new AppError(MESSAGES.INVOICE.PATIENT_HAS_INVOICE, HTTP_STATUS.CONFLICT);

  if (body.doctor) {
    const doctor = await Doctor.findById(body.doctor).select("_id");
    if (!doctor) throw new AppError(MESSAGES.DOCTOR.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  const invoiceNumber = await nextInvoiceNumber();
  const totalCost = body.totalCost ?? 0;
  const invoice = await Invoice.create({
    invoiceNumber,
    number: invoiceNumber,
    patient: body.patient,
    doctor: body.doctor || null,
    problem: body.problem || "",
    treatment: body.treatment || "",
    totalCost,
    totalAmount: totalCost,
    amountPaid: 0,
    payments: [],
    dueDate: parseDate(body.dueDate),
    notes: body.notes || "",
    isCancelled: false,
    status: INVOICE_STATUSES.PENDING,
  });

  const populated = await findInvoiceOrThrow(invoice._id);
  sendSuccess(res, {
    status: HTTP_STATUS.CREATED,
    message: MESSAGES.INVOICE.CREATED,
    data: { invoice: shapeInvoice(populated) },
  });
});

export const updateInvoice = asyncHandler(async (req, res) => {
  const invoice = await findInvoiceOrThrow(req.validated.params.id);
  const changes = { ...req.validated.body };
  if ("dueDate" in changes) changes.dueDate = parseDate(changes.dueDate);
  if ("totalCost" in changes) {
    changes.totalAmount = changes.totalCost;
  }
  if (changes.doctor) {
    const doctor = await Doctor.findById(changes.doctor).select("_id");
    if (!doctor) throw new AppError(MESSAGES.DOCTOR.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }
  Object.assign(invoice, changes);
  recomputePaid(invoice);
  invoice.status = deriveInvoiceStatus(invoice);
  await invoice.save();
  const populated = await findInvoiceOrThrow(invoice._id);
  sendSuccess(res, {
    message: MESSAGES.INVOICE.UPDATED,
    data: { invoice: shapeInvoice(populated) },
  });
});

export const addPayment = asyncHandler(async (req, res) => {
  const invoice = await findInvoiceOrThrow(req.validated.params.id);
  if (invoice.isCancelled) throw new AppError(MESSAGES.INVOICE.CANCELLED, HTTP_STATUS.BAD_REQUEST);

  const amount = Number(req.validated.body.amount);
  recomputePaid(invoice);
  const due = Math.max(0, Number(invoice.totalCost) - Number(invoice.amountPaid));
  if (due <= 0) {
    throw new AppError(MESSAGES.INVOICE.ALREADY_PAID || "This invoice is already fully paid.", HTTP_STATUS.BAD_REQUEST);
  }
  if (amount > due) {
    throw new AppError(MESSAGES.INVOICE.PAYMENT_EXCEEDS_DUE, HTTP_STATUS.BAD_REQUEST);
  }

  invoice.payments.push({
    amount,
    method: req.validated.body.method,
    paidAt: parseDate(req.validated.body.paidAt) || new Date(),
    note: req.validated.body.note || "",
    recordedBy: req.user?._id || null,
  });
  recomputePaid(invoice);
  invoice.status = deriveInvoiceStatus(invoice);
  await invoice.save();
  const populated = await findInvoiceOrThrow(invoice._id);
  sendSuccess(res, {
    status: HTTP_STATUS.CREATED,
    message: MESSAGES.INVOICE.PAYMENT_ADDED,
    data: { invoice: shapeInvoice(populated) },
  });
});

export const voidPayment = asyncHandler(async (req, res) => {
  const invoice = await findInvoiceOrThrow(req.validated.params.id);
  const payment = invoice.payments.id(req.validated.params.paymentId);
  if (!payment) throw new AppError(MESSAGES.INVOICE.PAYMENT_NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  if (payment.isVoided) throw new AppError(MESSAGES.INVOICE.PAYMENT_ALREADY_VOIDED, HTTP_STATUS.BAD_REQUEST);

  payment.isVoided = true;
  payment.voidReason = req.validated.body.voidReason;
  payment.voidedBy = req.user?._id || null;
  payment.voidedAt = new Date();
  recomputePaid(invoice);
  invoice.status = deriveInvoiceStatus(invoice);
  await invoice.save();
  const populated = await findInvoiceOrThrow(invoice._id);
  sendSuccess(res, {
    message: MESSAGES.INVOICE.PAYMENT_VOIDED,
    data: { invoice: shapeInvoice(populated) },
  });
});

export const removeInvoice = asyncHandler(async (req, res) => {
  const invoice = await findInvoiceOrThrow(req.validated.params.id);
  if (invoice.payments?.some((p) => !p.isVoided)) {
    invoice.isCancelled = true;
    invoice.status = INVOICE_STATUSES.CANCELLED;
    await invoice.save();
    sendSuccess(res, { message: MESSAGES.INVOICE.CANCELLED_MSG, data: { invoice: shapeInvoice(invoice) } });
    return;
  }
  await invoice.deleteOne();
  sendSuccess(res, { message: MESSAGES.INVOICE.DELETED, data: { deleted: true } });
});
