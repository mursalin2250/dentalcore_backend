import {
  ACTIVITY_ROLES,
  ACTIVITY_TYPES,
  BUCKET_UNITS,
  CARD_ROLES,
  DASHBOARD_CARDS,
  RANGE_SPECS,
} from "../constants/dashboard.js";
import { CURRENCY, TIMEZONE } from "../constants/locale.js";
import { ROLES } from "../constants/roles.js";
import {
  APPOINTMENT_STATUSES,
  INVOICE_STATUSES,
  OPEN_APPOINTMENT_STATUSES,
} from "../constants/statuses.js";
import { Appointment } from "../models/Appointment.js";
import { Doctor } from "../models/Doctor.js";
import { Invoice } from "../models/Invoice.js";
import { Medication } from "../models/Medication.js";
import { Patient } from "../models/Patient.js";
import { StockMovement } from "../models/StockMovement.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { addDays, addMonths, bucketKey, startOfDay, startOfMonth } from "../utils/dates.js";
import { percentChange } from "../utils/percentChange.js";
import { sendSuccess } from "../utils/response.js";

const LOW_STOCK_FILTER = { isArchived: { $ne: true }, $expr: { $lte: ["$stock", "$reorderLevel"] } };

const canSee = (card, user) => CARD_ROLES[card].includes(user.role);
const idOf = (doc) => doc._id.toString();

// Doctors only see their own visits. A doctor with no linked Doctor record matches
// nothing (doctor is required on appointments, so `null` never matches).
async function getAppointmentScope(user) {
  if (user.role !== ROLES.DOCTOR) return {};
  const doctor = await Doctor.findOne({ user: user._id }).select("_id").lean();
  return { doctor: doctor?._id ?? null };
}

async function sumPaidInvoices(from, to) {
  const [row] = await Invoice.aggregate([
    { $match: { status: INVOICE_STATUSES.PAID, paidAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, total: { $sum: "$totalAmount" } } },
  ]);
  return row?.total ?? 0;
}

const compare = (value, previous) => ({ value, previous, changePercent: percentChange(value, previous) });

export const getSummary = asyncHandler(async (req, res) => {
  const { user } = req;
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const monthStart = startOfMonth(now);
  const lastMonthStart = addMonths(monthStart, -1);
  // Compare month-to-date with the same number of days last month, so early in the month it is fair.
  const lastMonthEnd = new Date(
    Math.min(lastMonthStart.getTime() + (now - monthStart), monthStart.getTime()),
  );

  const scope = await getAppointmentScope(user);
  const countAppointments = (from, to) =>
    Appointment.countDocuments({
      ...scope,
      startsAt: { $gte: from, $lt: to },
      status: { $ne: APPOINTMENT_STATUSES.CANCELLED },
    });
  const only = (card, query) => (canSee(card, user) ? query() : null);

  const [patientsNow, patientsAtMonthStart, apptsToday, apptsYesterday, revenueNow, revenuePrev, lowStock] =
    await Promise.all([
      only(DASHBOARD_CARDS.PATIENTS, () => Patient.countDocuments()),
      only(DASHBOARD_CARDS.PATIENTS, () => Patient.countDocuments({ createdAt: { $lt: monthStart } })),
      countAppointments(today, tomorrow),
      countAppointments(yesterday, today),
      only(DASHBOARD_CARDS.REVENUE, () => sumPaidInvoices(monthStart, now)),
      only(DASHBOARD_CARDS.REVENUE, () => sumPaidInvoices(lastMonthStart, lastMonthEnd)),
      Medication.countDocuments(LOW_STOCK_FILTER),
    ]);

  const cards = { [DASHBOARD_CARDS.APPOINTMENTS]: compare(apptsToday, apptsYesterday) };
  if (patientsNow !== null) cards[DASHBOARD_CARDS.PATIENTS] = compare(patientsNow, patientsAtMonthStart);
  if (revenueNow !== null) cards[DASHBOARD_CARDS.REVENUE] = compare(revenueNow, revenuePrev);
  cards[DASHBOARD_CARDS.LOW_STOCK] = { value: lowStock };

  sendSuccess(res, { data: { currency: CURRENCY, cards } });
});

export const getRevenue = asyncHandler(async (req, res) => {
  const { range } = req.validated.query;
  const { unit, count } = RANGE_SPECS[range];
  const isDaily = unit === BUCKET_UNITS.DAY;
  const step = (from, i) => (isDaily ? addDays(from, i) : addMonths(from, i));
  const first = isDaily
    ? addDays(startOfDay(), -(count - 1))
    : addMonths(startOfMonth(), -(count - 1));

  const rows = await Invoice.aggregate([
    { $match: { status: INVOICE_STATUSES.PAID, paidAt: { $gte: first } } },
    {
      $group: {
        _id: { $dateToString: { format: isDaily ? "%Y-%m-%d" : "%Y-%m", date: "$paidAt", timezone: TIMEZONE } },
        amount: { $sum: "$totalAmount" },
      },
    },
  ]);

  // Days or months with no payments still get a point, so the chart has no gaps.
  const amounts = new Map(rows.map((row) => [row._id, row.amount]));
  const series = Array.from({ length: count }, (_, i) => {
    const date = bucketKey(step(first, i), unit);
    return { date, amount: amounts.get(date) ?? 0 };
  });
  const total = series.reduce((sum, point) => sum + point.amount, 0);

  sendSuccess(res, { data: { range, unit, currency: CURRENCY, total, series } });
});

export const listUpcomingAppointments = asyncHandler(async (req, res) => {
  const { limit } = req.validated.query;
  const scope = await getAppointmentScope(req.user);

  const appointments = await Appointment.find({
    ...scope,
    status: { $in: OPEN_APPOINTMENT_STATUSES },
    startsAt: { $gte: startOfDay() },
  })
    .sort({ startsAt: 1 })
    .limit(limit)
    .populate("patient", "name")
    .populate("doctor", "name")
    .lean();

  const items = appointments.map((a) => ({
    id: idOf(a),
    startsAt: a.startsAt,
    status: a.status,
    treatment: a.treatment,
    patient: a.patient?.name ?? null,
    doctor: a.doctor?.name ?? null,
  }));
  sendSuccess(res, { data: { items } });
});

export const listLowStock = asyncHandler(async (req, res) => {
  const { limit } = req.validated.query;

  const medications = await Medication.find(LOW_STOCK_FILTER)
    .sort({ stock: 1, name: 1 })
    .limit(limit)
    .select("name unit stock reorderLevel")
    .lean();

  const items = medications.map((m) => ({
    id: idOf(m),
    name: m.name,
    unit: m.unit,
    quantity: m.stock,
    reorderLevel: m.reorderLevel,
  }));
  sendSuccess(res, { data: { items } });
});

// One query per activity type; each returns items in the same shape.
const ACTIVITY_SOURCES = {
  [ACTIVITY_TYPES.PATIENT_REGISTERED]: async (limit) => {
    const rows = await Patient.find().sort({ createdAt: -1 }).limit(limit).select("name createdAt").lean();
    return rows.map((p) => ({ id: idOf(p), at: p.createdAt, subject: p.name }));
  },
  [ACTIVITY_TYPES.APPOINTMENT_BOOKED]: async (limit, scope) => {
    const rows = await Appointment.find(scope)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("patient doctor startsAt createdAt")
      .populate("patient", "name")
      .populate("doctor", "name")
      .lean();
    return rows.map((a) => ({
      id: idOf(a),
      at: a.createdAt,
      subject: a.patient?.name ?? null,
      doctor: a.doctor?.name ?? null,
      startsAt: a.startsAt,
    }));
  },
  [ACTIVITY_TYPES.INVOICE_PAID]: async (limit) => {
    const rows = await Invoice.find({ status: INVOICE_STATUSES.PAID })
      .sort({ paidAt: -1 })
      .limit(limit)
      .select("patient totalAmount paidAt")
      .populate("patient", "name")
      .lean();
    return rows.map((i) => ({ id: idOf(i), at: i.paidAt, subject: i.patient?.name ?? null, amount: i.totalAmount }));
  },
  [ACTIVITY_TYPES.STOCK_MOVED]: async (limit) => {
    const rows = await StockMovement.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("medication type quantity createdAt")
      .populate("medication", "name")
      .lean();
    return rows.map((m) => ({
      id: idOf(m),
      at: m.createdAt,
      subject: m.medication?.name ?? null,
      movementType: m.type,
      quantity: m.stock,
    }));
  },
};

export const listActivity = asyncHandler(async (req, res) => {
  const { limit } = req.validated.query;
  const scope = await getAppointmentScope(req.user);
  const types = Object.values(ACTIVITY_TYPES).filter((type) => ACTIVITY_ROLES[type].includes(req.user.role));

  const lists = await Promise.all(
    types.map(async (type) => {
      const items = await ACTIVITY_SOURCES[type](limit, scope);
      return items.map((item) => ({ ...item, id: `${type}:${item.id}`, type }));
    }),
  );
  const items = lists.flat().sort((a, b) => b.at - a.at).slice(0, limit);

  sendSuccess(res, { data: { currency: CURRENCY, items } });
});
