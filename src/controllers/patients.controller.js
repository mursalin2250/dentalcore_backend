import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { APPOINTMENT_STATUSES, PATIENT_STATUSES } from "../constants/statuses.js";
import { Appointment } from "../models/Appointment.js";
import { Invoice } from "../models/Invoice.js";
import { createStarterInvoiceForPatient } from "./invoices.controller.js";
import { Patient } from "../models/Patient.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { sendSuccess } from "../utils/response.js";

function startOfMonth(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfToday(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function endOfToday(date = new Date()) {
  const start = startOfToday(date);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000);
}

function ageFromDob(dateOfBirth) {
  if (!dateOfBirth) return null;
  const today = new Date();
  const born = new Date(dateOfBirth);
  let age = today.getFullYear() - born.getFullYear();
  const monthDiff = today.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) age -= 1;
  return age;
}

function shapePatient(doc, extras = {}) {
  const json = typeof doc.toJSON === "function" ? doc.toJSON() : { ...doc };
  if (json.doctor && typeof json.doctor === "object" && json.doctor._id) {
    json.doctor = {
      id: json.doctor._id.toString(),
      name: json.doctor.name,
      specialty: json.doctor.specialty || "",
      title: json.doctor.title || "",
      avatarUrl: json.doctor.avatarUrl || null,
    };
  } else if (json.doctor) {
    json.doctor = json.doctor.toString();
  }
  const treatmentCost = Number(json.treatmentCost) || 0;
  const amountPaid = Number(json.amountPaid) || 0;
  return {
    ...json,
    treatmentCost,
    amountPaid,
    dueAmount: Math.max(0, treatmentCost - amountPaid),
    age: ageFromDob(json.dateOfBirth),
    ...extras,
  };
}

async function findPatientOrThrow(id) {
  const patient = await Patient.findById(id).populate("doctor", "name specialty title avatarUrl");
  if (!patient) throw new AppError(MESSAGES.PATIENT.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  return patient;
}

// Next free clinic ID: P-00001, P-00002, …
async function nextPatientCode() {
  const latest = await Patient.findOne({ patientCode: { $regex: /^P-\d+$/i } })
    .sort({ patientCode: -1 })
    .select("patientCode")
    .lean();
  const nextNum = latest ? Number(latest.patientCode.replace(/^P-/i, "")) + 1 : 1;
  return `P-${String(nextNum).padStart(5, "0")}`;
}

export const getPatientStats = asyncHandler(async (_req, res) => {
  const monthStart = startOfMonth();
  const todayStart = startOfToday();
  const todayEnd = endOfToday();

  const [total, newThisMonth, inTreatment, appointmentsToday] = await Promise.all([
    Patient.countDocuments(),
    Patient.countDocuments({ createdAt: { $gte: monthStart } }),
    Patient.countDocuments({ status: PATIENT_STATUSES.IN_TREATMENT }),
    Appointment.countDocuments({
      startsAt: { $gte: todayStart, $lt: todayEnd },
      status: { $in: [APPOINTMENT_STATUSES.SCHEDULED, APPOINTMENT_STATUSES.IN_CHAIR] },
    }),
  ]);

  sendSuccess(res, {
    data: { total, newThisMonth, inTreatment, appointmentsToday },
  });
});

export const listPatients = asyncHandler(async (req, res) => {
  const { search, status, page, limit } = req.validated.query;

  const filter = {};
  if (status) filter.status = status;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { name: pattern },
      { phone: pattern },
      { email: pattern },
      { patientCode: pattern },
    ];
  }

  const [patients, total] = await Promise.all([
    Patient.find(filter)
      .populate("doctor", "name specialty title avatarUrl")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Patient.countDocuments(filter),
  ]);

  const ids = patients.map((p) => p._id);
  const visitStats = ids.length
    ? await Appointment.aggregate([
        {
          $match: {
            patient: { $in: ids },
            status: APPOINTMENT_STATUSES.COMPLETED,
          },
        },
        { $sort: { startsAt: -1 } },
        {
          $group: {
            _id: "$patient",
            lastVisit: { $first: "$startsAt" },
            visitCount: { $sum: 1 },
          },
        },
      ])
    : [];

  const visitById = Object.fromEntries(
    visitStats.map((row) => [row._id.toString(), row]),
  );

  sendSuccess(res, {
    data: {
      patients: patients.map((p) => {
        const visit = visitById[p._id.toString()];
        return shapePatient(p, {
          lastVisit: visit?.lastVisit || null,
          visitCount: visit?.visitCount || 0,
        });
      }),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

export const getPatient = asyncHandler(async (req, res) => {
  const patient = await findPatientOrThrow(req.validated.params.id);

  const [visitAgg, visits, payments, anyAppointment] = await Promise.all([
    Appointment.aggregate([
      {
        $match: {
          patient: patient._id,
          status: APPOINTMENT_STATUSES.COMPLETED,
        },
      },
      { $sort: { startsAt: -1 } },
      {
        $group: {
          _id: null,
          lastVisit: { $first: "$startsAt" },
          visitCount: { $sum: 1 },
        },
      },
    ]),
    Appointment.find({ patient: patient._id })
      .populate("doctor", "name specialty title")
      .sort({ startsAt: -1 })
      .select("startsAt status treatment doctor")
      .lean(),
    Invoice.find({ patient: patient._id })
      .sort({ createdAt: -1 })
      .select("number totalAmount status paidAt createdAt")
      .lean(),
    Appointment.exists({ patient: patient._id }),
  ]);

  // After the first appointment, admitted patients move to in treatment.
  if (anyAppointment && patient.status === PATIENT_STATUSES.ADMITTED) {
    patient.status = PATIENT_STATUSES.IN_TREATMENT;
    await patient.save();
  }

  const visit = visitAgg[0];

  // Paid invoices reduce the outstanding balance alongside the stored amountPaid.
  const paidFromInvoices = payments
    .filter((inv) => inv.status === "paid")
    .reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
  const amountPaid = Math.max(Number(patient.amountPaid) || 0, paidFromInvoices);

  sendSuccess(res, {
    data: {
      patient: shapePatient(
        { ...patient.toJSON(), amountPaid },
        {
          lastVisit: visit?.lastVisit || null,
          visitCount: visit?.visitCount || 0,
        },
      ),
      visits: visits.map((v) => ({
        id: v._id.toString(),
        startsAt: v.startsAt,
        status: v.status,
        treatment: v.treatment || "",
        doctor:
          v.doctor && typeof v.doctor === "object"
            ? { id: v.doctor._id.toString(), name: v.doctor.name, specialty: v.doctor.specialty || "" }
            : null,
      })),
      payments: payments.map((inv) => ({
        id: inv._id.toString(),
        number: inv.number,
        totalAmount: inv.totalAmount,
        status: inv.status,
        paidAt: inv.paidAt,
        createdAt: inv.createdAt,
      })),
    },
  });
});

export const createPatient = asyncHandler(async (req, res) => {
  const body = { ...req.validated.body };

  if (body.patientCode) {
    body.patientCode = body.patientCode.trim().toUpperCase();
    if (await Patient.exists({ patientCode: body.patientCode })) {
      throw new AppError(MESSAGES.PATIENT.CODE_TAKEN, HTTP_STATUS.CONFLICT, {
        patientCode: MESSAGES.PATIENT.CODE_TAKEN,
      });
    }
  } else {
    body.patientCode = await nextPatientCode();
  }

  if (body.avatarUrl === "") body.avatarUrl = null;
  if (body.doctor === "") body.doctor = null;
  body.treatmentCost = Math.max(0, Number(body.treatmentCost) || 0);
  body.amountPaid = Math.max(0, Number(body.amountPaid) || 0);
  if (body.amountPaid > body.treatmentCost) body.amountPaid = body.treatmentCost;

  const patient = await Patient.create(body);
  await createStarterInvoiceForPatient(patient);
  const populated = await Patient.findById(patient._id).populate("doctor", "name specialty title avatarUrl");
  sendSuccess(res, {
    status: HTTP_STATUS.CREATED,
    data: { patient: shapePatient(populated, { lastVisit: null, visitCount: 0 }) },
    message: MESSAGES.PATIENT.CREATED,
  });
});

export const updatePatient = asyncHandler(async (req, res) => {
  const patient = await findPatientOrThrow(req.validated.params.id);
  const changes = { ...req.validated.body };

  if (changes.patientCode !== undefined) {
    const code = changes.patientCode ? changes.patientCode.trim().toUpperCase() : "";
    if (code && code !== patient.patientCode) {
      if (await Patient.exists({ patientCode: code, _id: { $ne: patient._id } })) {
        throw new AppError(MESSAGES.PATIENT.CODE_TAKEN, HTTP_STATUS.CONFLICT, {
          patientCode: MESSAGES.PATIENT.CODE_TAKEN,
        });
      }
      changes.patientCode = code;
    } else if (!code) {
      delete changes.patientCode;
    }
  }

  if (changes.avatarUrl === "") changes.avatarUrl = null;
  if (changes.doctor === "") changes.doctor = null;

  // Allow editing due: amountPaid = treatmentCost - dueAmount.
  if (changes.dueAmount !== undefined) {
    const cost =
      changes.treatmentCost !== undefined
        ? Number(changes.treatmentCost)
        : Number(patient.treatmentCost) || 0;
    const due = Math.max(0, Number(changes.dueAmount) || 0);
    changes.amountPaid = Math.max(0, cost - due);
    delete changes.dueAmount;
  }
  if (changes.treatmentCost !== undefined) {
    changes.treatmentCost = Math.max(0, Number(changes.treatmentCost) || 0);
  }
  if (changes.amountPaid !== undefined) {
    changes.amountPaid = Math.max(0, Number(changes.amountPaid) || 0);
  }

  Object.assign(patient, changes);
  await patient.save();
  const populated = await Patient.findById(patient._id).populate("doctor", "name specialty title avatarUrl");

  const visitAgg = await Appointment.aggregate([
    {
      $match: {
        patient: patient._id,
        status: APPOINTMENT_STATUSES.COMPLETED,
      },
    },
    { $sort: { startsAt: -1 } },
    {
      $group: {
        _id: null,
        lastVisit: { $first: "$startsAt" },
        visitCount: { $sum: 1 },
      },
    },
  ]);
  const visit = visitAgg[0];

  sendSuccess(res, {
    data: {
      patient: shapePatient(populated, {
        lastVisit: visit?.lastVisit || null,
        visitCount: visit?.visitCount || 0,
      }),
    },
    message: MESSAGES.PATIENT.UPDATED,
  });
});

export const removePatient = asyncHandler(async (req, res) => {
  const patient = await findPatientOrThrow(req.validated.params.id);
  await patient.deleteOne();
  sendSuccess(res, { message: MESSAGES.PATIENT.REMOVED });
});

export const bulkRemovePatients = asyncHandler(async (req, res) => {
  const { ids } = req.validated.body;
  const result = await Patient.deleteMany({ _id: { $in: ids } });
  sendSuccess(res, {
    data: { deletedCount: result.deletedCount },
    message: MESSAGES.PATIENT.REMOVED_MANY(result.deletedCount),
  });
});

export const addPrescription = asyncHandler(async (req, res) => {
  const patient = await findPatientOrThrow(req.validated.params.id);
  const medicines = req.validated.body.medicines
    .map((m) => m.trim())
    .filter(Boolean);

  if (medicines.length === 0) {
    throw new AppError(MESSAGES.PATIENT.MEDICINE_REQUIRED, HTTP_STATUS.BAD_REQUEST, {
      medicines: MESSAGES.PATIENT.MEDICINE_REQUIRED,
    });
  }

  patient.prescriptions.push({ medicines, createdAt: new Date() });
  await patient.save();

  const populated = await Patient.findById(patient._id).populate(
    "doctor",
    "name specialty title avatarUrl",
  );

  const visitAgg = await Appointment.aggregate([
    {
      $match: {
        patient: patient._id,
        status: APPOINTMENT_STATUSES.COMPLETED,
      },
    },
    { $sort: { startsAt: -1 } },
    {
      $group: {
        _id: null,
        lastVisit: { $first: "$startsAt" },
        visitCount: { $sum: 1 },
      },
    },
  ]);
  const visit = visitAgg[0];

  sendSuccess(res, {
    status: HTTP_STATUS.CREATED,
    data: {
      patient: shapePatient(populated, {
        lastVisit: visit?.lastVisit || null,
        visitCount: visit?.visitCount || 0,
      }),
    },
    message: MESSAGES.PATIENT.PRESCRIPTION_ADDED,
  });
});
