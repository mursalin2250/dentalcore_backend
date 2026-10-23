import { HTTP_STATUS } from "../constants/httpStatus.js";
import { TIMEZONE } from "../constants/locale.js";
import { MESSAGES } from "../constants/messages.js";
import { ROLES } from "../constants/roles.js";
import {
  APPOINTMENT_STATUSES,
  BLOCKING_APPOINTMENT_STATUSES,
  FINAL_APPOINTMENT_STATUSES,
} from "../constants/statuses.js";
import { DEFAULT_DURATION_MINUTES } from "../constants/validation.js";
import { Appointment } from "../models/Appointment.js";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { addDays, addMonths, startOfDay, startOfMonth } from "../utils/dates.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { sendSuccess } from "../utils/response.js";

function endsAt(startsAt, durationMinutes) {
  return new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
}

function shapeNote(n) {
  const createdBy = n.createdBy;
  return {
    id: n._id?.toString?.() || n.id,
    text: n.text,
    createdAt: n.createdAt,
    createdBy:
      createdBy && typeof createdBy === "object"
        ? { id: (createdBy._id || createdBy.id)?.toString?.(), name: createdBy.name || "" }
        : createdBy
          ? createdBy.toString()
          : null,
  };
}

function shapeAppointment(doc) {
  const json = typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };
  const mapRef = (ref, fields = ["name"]) => {
    if (!ref) return null;
    if (typeof ref !== "object") return ref.toString();
    const id = (ref.id || ref._id)?.toString?.();
    const out = { id };
    for (const f of fields) out[f] = ref[f] ?? "";
    if (ref.avatarUrl !== undefined) out.avatarUrl = ref.avatarUrl || null;
    if (ref.specialty !== undefined) out.specialty = ref.specialty || "";
    return out;
  };
  return {
    ...json,
    id: json.id || json._id?.toString?.(),
    patient: mapRef(json.patient, ["name", "avatarUrl"]),
    doctor: mapRef(json.doctor, ["name", "specialty", "avatarUrl"]),
    notes: Array.isArray(json.notes)
      ? json.notes.map(shapeNote).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      : [],
  };
}

async function findAppointmentOrThrow(id) {
  const appointment = await Appointment.findById(id)
    .populate("patient", "name avatarUrl doctor")
    .populate("doctor", "name specialty avatarUrl")
    .populate("notes.createdBy", "name");
  if (!appointment) throw new AppError(MESSAGES.APPOINTMENT.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  return appointment;
}

async function assertNoConflict({ doctorId, startsAt, durationMinutes, excludeId }) {
  const end = endsAt(startsAt, durationMinutes);
  const filter = {
    doctor: doctorId,
    status: { $in: BLOCKING_APPOINTMENT_STATUSES },
    startsAt: { $lt: end },
  };
  if (excludeId) filter._id = { $ne: excludeId };
  const candidates = await Appointment.find(filter).select("startsAt durationMinutes").lean();
  const conflict = candidates.some((c) => {
    const cEnd = endsAt(new Date(c.startsAt), c.durationMinutes || DEFAULT_DURATION_MINUTES);
    return cEnd > startsAt;
  });
  if (conflict) throw new AppError(MESSAGES.APPOINTMENT.CONFLICT, HTTP_STATUS.CONFLICT);
}

function parseClinicDate(yyyyMmDd) {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return startOfDay(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)));
}

export const getAppointmentStats = asyncHandler(async (req, res) => {
  const dateStr = req.validated.query.date;
  const dayStart = dateStr ? parseClinicDate(dateStr) : startOfDay();
  const dayEnd = addDays(dayStart, 1);
  const base = { startsAt: { $gte: dayStart, $lt: dayEnd } };
  const [todayTotal, pending, completed, doctorsPresent] = await Promise.all([
    Appointment.countDocuments(base),
    Appointment.countDocuments({ ...base, status: APPOINTMENT_STATUSES.PENDING }),
    Appointment.countDocuments({ ...base, status: APPOINTMENT_STATUSES.COMPLETED }),
    Appointment.distinct("doctor", { ...base, status: { $ne: APPOINTMENT_STATUSES.CANCELLED } }),
  ]);
  sendSuccess(res, {
    data: { todayTotal, pending, completed, doctorsPresentToday: doctorsPresent.length },
  });
});

export const getAppointmentCalendar = asyncHandler(async (req, res) => {
  const [y, m] = req.validated.query.month.split("-").map(Number);
  const monthStart = startOfMonth(new Date(Date.UTC(y, m - 1, 15)));
  const monthEnd = addMonths(monthStart, 1);
  const rows = await Appointment.aggregate([
    { $match: { startsAt: { $gte: monthStart, $lt: monthEnd } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$startsAt", timezone: TIMEZONE } },
        count: { $sum: 1 },
      },
    },
  ]);
  sendSuccess(res, {
    data: { month: req.validated.query.month, days: Object.fromEntries(rows.map((r) => [r._id, r.count])) },
  });
});

export const listAppointments = asyncHandler(async (req, res) => {
  const { search, status, doctor, from, to, page, limit, sort } = req.validated.query;
  const filter = {};
  if (status) filter.status = status;
  if (doctor) filter.doctor = doctor;
  if (from || to) {
    filter.startsAt = {};
    if (from) filter.startsAt.$gte = from;
    if (to) filter.startsAt.$lt = to;
  }
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    const [patients, doctors] = await Promise.all([
      Patient.find({ name: pattern }).select("_id").lean(),
      Doctor.find({ name: pattern }).select("_id").lean(),
    ]);
    filter.$or = [
      { patient: { $in: patients.map((p) => p._id) } },
      { doctor: { $in: doctors.map((d) => d._id) } },
      { reason: pattern },
    ];
  }
  const sortSpec = sort.startsWith("-") ? { [sort.slice(1)]: -1 } : { [sort]: 1 };
  const [rows, total] = await Promise.all([
    Appointment.find(filter)
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("patient", "name avatarUrl")
      .populate("doctor", "name specialty avatarUrl")
      .populate("notes.createdBy", "name")
      .lean(),
    Appointment.countDocuments(filter),
  ]);
  sendSuccess(res, {
    data: {
      appointments: rows.map((r) => shapeAppointment(r)),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

export const getAppointment = asyncHandler(async (req, res) => {
  const appointment = await findAppointmentOrThrow(req.validated.params.id);
  sendSuccess(res, { data: { appointment: shapeAppointment(appointment) } });
});

export const createAppointment = asyncHandler(async (req, res) => {
  const body = { ...req.validated.body };
  const startsAt = new Date(body.startsAt);
  const durationMinutes = body.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  if (startsAt.getTime() < Date.now() - 60_000) {
    throw new AppError(MESSAGES.APPOINTMENT.PAST, HTTP_STATUS.BAD_REQUEST);
  }
  const [patient, doctor] = await Promise.all([
    Patient.findById(body.patient).select("_id"),
    Doctor.findById(body.doctor).select("_id"),
  ]);
  if (!patient) throw new AppError(MESSAGES.PATIENT.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  if (!doctor) throw new AppError(MESSAGES.DOCTOR.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  await assertNoConflict({ doctorId: body.doctor, startsAt, durationMinutes });
  const notes = [];
  if (body.note?.trim()) {
    notes.push({ text: body.note.trim(), createdBy: req.user._id, createdAt: new Date() });
  }
  const appointment = await Appointment.create({
    patient: body.patient,
    doctor: body.doctor,
    startsAt,
    durationMinutes,
    reason: body.reason || "",
    treatment: body.reason || "",
    status: body.status || APPOINTMENT_STATUSES.PENDING,
    notes,
  });
  const populated = await findAppointmentOrThrow(appointment._id);
  sendSuccess(res, {
    status: HTTP_STATUS.CREATED,
    data: { appointment: shapeAppointment(populated) },
    message: MESSAGES.APPOINTMENT.CREATED,
  });
});

export const updateAppointment = asyncHandler(async (req, res) => {
  const appointment = await findAppointmentOrThrow(req.validated.params.id);
  const changes = { ...req.validated.body };
  const isAdmin = req.user.role === ROLES.ADMIN;
  if (FINAL_APPOINTMENT_STATUSES.includes(appointment.status) && !isAdmin) {
    throw new AppError(MESSAGES.APPOINTMENT.FINAL, HTTP_STATUS.FORBIDDEN);
  }
  if (changes.status === APPOINTMENT_STATUSES.RESCHEDULED) {
    const newTime = changes.newStartsAt || changes.startsAt;
    if (!newTime) throw new AppError(MESSAGES.APPOINTMENT.RESCHEDULE_REQUIRES_TIME, HTTP_STATUS.BAD_REQUEST);
    const newStartsAt = new Date(newTime);
    if (newStartsAt.getTime() < Date.now() - 60_000) {
      throw new AppError(MESSAGES.APPOINTMENT.PAST, HTTP_STATUS.BAD_REQUEST);
    }
    if (!appointment.originalStartAt) changes.originalStartAt = appointment.startsAt;
    changes.startsAt = newStartsAt;
    delete changes.newStartsAt;
  } else if (changes.newStartsAt) {
    changes.startsAt = new Date(changes.newStartsAt);
    delete changes.newStartsAt;
  }
  if (changes.startsAt) {
    const next = new Date(changes.startsAt);
    if (
      next.getTime() < Date.now() - 60_000 &&
      next.getTime() !== new Date(appointment.startsAt).getTime()
    ) {
      throw new AppError(MESSAGES.APPOINTMENT.PAST, HTTP_STATUS.BAD_REQUEST);
    }
  }
  const nextDoctor = changes.doctor || appointment.doctor._id || appointment.doctor;
  const nextStarts = changes.startsAt ? new Date(changes.startsAt) : appointment.startsAt;
  const nextDuration = changes.durationMinutes ?? appointment.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  if (changes.doctor || changes.startsAt || changes.durationMinutes) {
    await assertNoConflict({
      doctorId: nextDoctor,
      startsAt: nextStarts,
      durationMinutes: nextDuration,
      excludeId: appointment._id,
    });
  }
  if (changes.reason !== undefined) changes.treatment = changes.reason;
  Object.assign(appointment, changes);
  await appointment.save();
  const populated = await findAppointmentOrThrow(appointment._id);
  sendSuccess(res, {
    data: { appointment: shapeAppointment(populated) },
    message: MESSAGES.APPOINTMENT.UPDATED,
  });
});

export const removeAppointment = asyncHandler(async (req, res) => {
  const appointment = await findAppointmentOrThrow(req.validated.params.id);
  if (FINAL_APPOINTMENT_STATUSES.includes(appointment.status) && req.user.role !== ROLES.ADMIN) {
    throw new AppError(MESSAGES.APPOINTMENT.FINAL, HTTP_STATUS.FORBIDDEN);
  }
  await appointment.deleteOne();
  sendSuccess(res, { data: null, message: MESSAGES.APPOINTMENT.DELETED });
});

export const addAppointmentNote = asyncHandler(async (req, res) => {
  const appointment = await findAppointmentOrThrow(req.validated.params.id);
  appointment.notes.push({
    text: req.validated.body.text,
    createdBy: req.user._id,
    createdAt: new Date(),
  });
  await appointment.save();
  const populated = await findAppointmentOrThrow(appointment._id);
  sendSuccess(res, {
    data: { appointment: shapeAppointment(populated) },
    message: MESSAGES.APPOINTMENT.NOTE_ADDED,
  });
});
