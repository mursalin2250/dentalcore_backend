import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { APPOINTMENT_STATUSES, PATIENT_STATUSES } from "../constants/statuses.js";
import { Appointment } from "../models/Appointment.js";
import { Doctor } from "../models/Doctor.js";
import { Patient } from "../models/Patient.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { sendSuccess } from "../utils/response.js";

function startOfToday(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfToday(date = new Date()) {
  const start = startOfToday(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function shapeDoctor(doc, extras = {}) {
  const json = typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };
  return { ...json, ...extras };
}

async function findDoctorOrThrow(id) {
  const doctor = await Doctor.findById(id);
  if (!doctor) throw new AppError(MESSAGES.DOCTOR.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  return doctor;
}

export const getDoctorStats = asyncHandler(async (_req, res) => {
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [total, specialtyAgg, patientsAssigned, appointmentsToday] = await Promise.all([
    Doctor.countDocuments(),
    Doctor.aggregate([
      { $match: { specialty: { $nin: ["", null] } } },
      { $group: { _id: "$specialty" } },
      { $count: "count" },
    ]),
    Patient.countDocuments({ doctor: { $ne: null } }),
    Appointment.countDocuments({
      startsAt: { $gte: todayStart, $lt: todayEnd },
      status: { $in: [APPOINTMENT_STATUSES.SCHEDULED, APPOINTMENT_STATUSES.IN_CHAIR] },
    }),
  ]);

  sendSuccess(res, {
    data: {
      total,
      specialties: specialtyAgg[0]?.count || 0,
      patientsAssigned,
      appointmentsToday,
    },
  });
});

export const listDoctors = asyncHandler(async (req, res) => {
  const { search, specialty, page, limit } = req.validated.query;

  const filter = {};
  if (specialty) filter.specialty = specialty;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: pattern }, { phone: pattern }, { email: pattern }, { specialty: pattern }, { title: pattern }];
  }

  const [doctors, total, specialtyValues] = await Promise.all([
    Doctor.find(filter)
      .sort({ name: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Doctor.countDocuments(filter),
    Doctor.distinct("specialty"),
  ]);

  const specialties = specialtyValues.filter(Boolean).sort();

  sendSuccess(res, {
    data: {
      doctors: doctors.map((d) => shapeDoctor(d)),
      specialties,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    },
  });
});

export const getDoctor = asyncHandler(async (req, res) => {
  const doctor = await findDoctorOrThrow(req.validated.params.id);
  const doctorId = doctor._id;
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [patients, inTreatment, appointmentsToday, treatedCount] = await Promise.all([
    Patient.find({ doctor: doctorId }).sort({ name: 1 }).lean(),
    Patient.countDocuments({ doctor: doctorId, status: PATIENT_STATUSES.IN_TREATMENT }),
    Appointment.countDocuments({
      doctor: doctorId,
      startsAt: { $gte: todayStart, $lt: todayEnd },
      status: { $in: [APPOINTMENT_STATUSES.SCHEDULED, APPOINTMENT_STATUSES.IN_CHAIR] },
    }),
    // Distinct patients who have completed at least one appointment with this doctor.
    Appointment.distinct("patient", {
      doctor: doctorId,
      status: APPOINTMENT_STATUSES.COMPLETED,
    }),
  ]);

  const patientIds = patients.map((p) => p._id);
  let lastVisitByPatient = {};
  if (patientIds.length > 0) {
    const visits = await Appointment.aggregate([
      {
        $match: {
          patient: { $in: patientIds },
          status: APPOINTMENT_STATUSES.COMPLETED,
        },
      },
      { $sort: { startsAt: -1 } },
      {
        $group: {
          _id: "$patient",
          lastVisit: { $first: "$startsAt" },
        },
      },
    ]);
    lastVisitByPatient = Object.fromEntries(
      visits.map((v) => [v._id.toString(), v.lastVisit]),
    );
  }

  sendSuccess(res, {
    data: {
      doctor: shapeDoctor(doctor),
      overview: {
        patientsTreated: treatedCount.length,
        inTreatment,
        appointmentsToday,
        patientsAssigned: patients.length,
      },
      patients: patients.map((p) => ({
        id: p._id.toString(),
        name: p.name,
        avatarUrl: p.avatarUrl || null,
        status: p.status,
        lastVisit: lastVisitByPatient[p._id.toString()] || null,
      })),
    },
  });
});

export const createDoctor = asyncHandler(async (req, res) => {
  const body = { ...req.validated.body };
  if (body.avatarUrl === "") body.avatarUrl = null;

  const doctor = await Doctor.create(body);

  sendSuccess(res, {
    status: HTTP_STATUS.CREATED,
    data: { doctor: shapeDoctor(doctor) },
    message: MESSAGES.DOCTOR.CREATED,
  });
});

export const updateDoctor = asyncHandler(async (req, res) => {
  const doctor = await findDoctorOrThrow(req.validated.params.id);
  const changes = { ...req.validated.body };
  if (changes.avatarUrl === "") changes.avatarUrl = null;

  Object.assign(doctor, changes);
  await doctor.save();

  sendSuccess(res, {
    data: { doctor: shapeDoctor(doctor) },
    message: MESSAGES.DOCTOR.UPDATED,
  });
});

export const removeDoctor = asyncHandler(async (req, res) => {
  const doctor = await findDoctorOrThrow(req.validated.params.id);

  // Unassign patients so the relationship stays consistent.
  await Patient.updateMany({ doctor: doctor._id }, { $set: { doctor: null } });
  await doctor.deleteOne();

  sendSuccess(res, {
    data: null,
    message: MESSAGES.DOCTOR.DELETED,
  });
});
