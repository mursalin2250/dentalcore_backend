import { connectDb, disconnectDb } from "../config/db.js";
import { CURRENCY_MINOR_UNIT } from "../constants/locale.js";
import { MESSAGES } from "../constants/messages.js";
import { APPOINTMENT_STATUSES, PATIENT_STATUSES, GENDERS, BLOOD_TYPE_VALUES, INVOICE_STATUSES, STOCK_MOVEMENT_TYPES } from "../constants/statuses.js";
import { Appointment } from "../models/Appointment.js";
import { Doctor } from "../models/Doctor.js";
import { Invoice } from "../models/Invoice.js";
import { Medication } from "../models/Medication.js";
import { Patient } from "../models/Patient.js";
import { StockMovement } from "../models/StockMovement.js";
import { addDays, startOfDay } from "../utils/dates.js";

// Safe to re-run: it deletes only rows flagged isDemo, then recreates them.
// To try the doctor view, set Doctor.user to a doctor User's _id.

const HISTORY_DAYS = 365;
const FUTURE_DAYS = 7;
const PATIENT_COUNT = 240;
const SLOTS_PER_DOCTOR_PER_DAY = [2, 3, 4];
const FRIDAY = 5; // clinic day off
const VISIT_MINUTES = 45;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 18;

const FIRST_NAMES = ["Nabila", "Rahim", "Parvez", "Bilal", "Tasnim", "Mehedi", "Sadia", "Arif", "Farhana", "Kamrul", "Nusrat", "Imtiaz", "Rumana", "Shafiq", "Jannat", "Tanvir", "Sumaiya", "Rakib", "Mim", "Habib"];
const LAST_NAMES = ["Chowdhury", "Kabir", "Zaman", "Rahman", "Ahmed", "Hossain", "Islam", "Uddin", "Akter", "Khan", "Sarker", "Talukder", "Mia", "Begum"];

const DOCTORS = [
  ["Imran Hossain", "Prosthodontics", "BDS, FCPS", "01711000001"],
  ["Farzana Rahman", "Endodontics", "BDS, MS", "01711000002"],
  ["Sabbir Ahmed", "General Dentistry", "BDS", "01711000003"],
  ["Hasan Mahmud", "Oral Surgery", "BDS, FCPS", "01711000004"],
  ["Nusrat Jahan", "Orthodontics", "BDS, PhD", "01711000005"],
  ["Tareq Aziz", "Periodontics", "BDS, MS", "01711000006"],
  ["Mahbuba Sultana", "Pediatric Dentistry", "BDS", "01711000007"],
  ["Rashed Karim", "Cosmetic Dentistry", "BDS, DDS", "01711000008"],
];

// [name, unit, quantity, reorderLevel]. Several sit at or below the reorder level.
const MEDICATIONS = [
  ["Lidocaine 2%", "cartridges", 38, 60],
  ["Articaine 4%", "cartridges", 22, 40],
  ["Amoxicillin 500mg", "capsules", 410, 150],
  ["Ibuprofen 400mg", "tablets", 520, 200],
  ["Metronidazole 400mg", "tablets", 64, 100],
  ["Chlorhexidine 0.2%", "bottles", 9, 12],
  ["Composite resin A2", "syringes", 26, 10],
  ["Dental floss", "boxes", 48, 20],
  ["Disposable gloves (M)", "boxes", 7, 15],
  ["Etching gel", "syringes", 18, 8],
  ["Alginate impression", "bags", 14, 6],
  ["Surgical masks", "boxes", 31, 12],
];

// [treatment, price in BDT]
const TREATMENTS = [
  ["Check-up", 500],
  ["Scaling and polish", 2500],
  ["Filling", 3500],
  ["Root canal review", 1500],
  ["Root canal treatment", 12000],
  ["Crown fit", 15000],
  ["Extraction", 2000],
  ["Wisdom tooth consult", 800],
  ["Teeth whitening", 9000],
  ["Orthodontic adjustment", 3000],
];

// Fixed seed: the same shape of data on every run.
function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = makeRandom(20261020);
const int = (min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (list) => list[Math.floor(random() * list.length)];
const stamp = (date) => ({ createdAt: date, updatedAt: date });

// insertMany with explicit createdAt/updatedAt kept as given.
const insert = (Model, docs) => Model.insertMany(docs, { timestamps: false });

function buildPatients(now) {
  const genderValues = Object.values(GENDERS);
  const statusValues = Object.values(PATIENT_STATUSES);
  return Array.from({ length: PATIENT_COUNT }, (_, index) => {
    const joined = addDays(now, -Math.floor(random() ** 1.5 * HISTORY_DAYS));
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    const ageYears = int(8, 75);
    const dob = addDays(now, -ageYears * 365 - int(0, 364));
    return {
      patientCode: `P-${String(index + 1).padStart(5, "0")}`,
      name: `${first} ${last}`,
      phone: `01${int(3, 9)}${String(int(0, 99999999)).padStart(8, "0")}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${int(1, 99)}@example.com`,
      address: `${int(1, 99)} ${pick(["Road", "Lane", "Avenue"])} ${int(1, 20)}, Dhaka`,
      gender: pick(genderValues),
      dateOfBirth: dob,
      bloodType: pick(BLOOD_TYPE_VALUES),
      status: pick(statusValues),
      problem: pick(["Tooth pain", "Bleeding gums", "Cavity", "Sensitivity", "Check-up", ""]),
      treatment: pick(["Root canal", "Cleaning", "Filling", "Extraction", "Observation", ""]),
      isDemo: true,
      ...stamp(joined),
    };
  });
}

function buildAppointments({ now, today, patients, doctors }) {
  const docs = [];
  for (let offset = -HISTORY_DAYS; offset <= FUTURE_DAYS; offset++) {
    const day = addDays(today, offset);
    if (new Date(day.getTime() + 12 * HOUR_MS).getUTCDay() === FRIDAY) continue;

    for (const doctor of doctors) {
      const slots = new Set();
      const wanted = pick(SLOTS_PER_DOCTOR_PER_DAY);
      while (slots.size < wanted) slots.add(int(DAY_START_HOUR * 2, DAY_END_HOUR * 2 - 1)); // half-hour slots

      for (const slot of slots) {
        const startsAt = new Date(day.getTime() + slot * 30 * MINUTE_MS);
        const endsAt = new Date(startsAt.getTime() + VISIT_MINUTES * MINUTE_MS);
        const [treatment] = pick(TREATMENTS);

        let status = APPOINTMENT_STATUSES.SCHEDULED;
        if (endsAt < now) {
          const roll = random();
          status =
            roll < 0.85 ? APPOINTMENT_STATUSES.COMPLETED : roll < 0.93 ? APPOINTMENT_STATUSES.CANCELLED : APPOINTMENT_STATUSES.NO_SHOW;
        } else if (startsAt <= now) {
          status = APPOINTMENT_STATUSES.IN_CHAIR;
        }

        // Booked a few days ahead, but never in the future.
        const bookedAt = new Date(Math.min(startsAt.getTime() - int(1, 7) * 24 * HOUR_MS, now.getTime() - int(1, 120) * MINUTE_MS));
        docs.push({
          patient: pick(patients)._id,
          doctor: doctor._id,
          startsAt,
          status,
          treatment,
          isDemo: true,
          ...stamp(bookedAt),
        });
      }
    }
  }
  return docs;
}

function buildInvoices(appointments) {
  const prices = new Map(TREATMENTS);
  return appointments
    .filter((a) => a.status === APPOINTMENT_STATUSES.COMPLETED)
    .map((a, index) => {
      const paidAt = new Date(a.startsAt.getTime() + VISIT_MINUTES * MINUTE_MS);
      const isPaid = random() < 0.95;
      return {
        // DEMO- prefix keeps these away from real invoice numbers.
        number: `DEMO-INV-${String(index + 1).padStart(6, "0")}`,
        patient: a.patient,
        totalAmount: prices.get(a.treatment) * CURRENCY_MINOR_UNIT,
        status: isPaid ? INVOICE_STATUSES.PAID : INVOICE_STATUSES.PENDING,
        paidAt: isPaid ? paidAt : null,
        isDemo: true,
        ...stamp(paidAt),
      };
    });
}

function buildStockMovements({ now, medications }) {
  const docs = [];
  for (const medication of medications) {
    for (let i = 0; i < 25; i++) {
      const isRestock = random() < 0.15;
      docs.push({
        medication: medication._id,
        type: isRestock ? STOCK_MOVEMENT_TYPES.IN : STOCK_MOVEMENT_TYPES.OUT,
        quantity: isRestock ? int(50, 200) : int(1, 20),
        isDemo: true,
        ...stamp(new Date(now.getTime() - int(5, 60 * 24 * 60) * MINUTE_MS)),
      });
    }
  }
  return docs;
}

async function seedDemo() {
  await connectDb();
  try {
    const models = [StockMovement, Invoice, Appointment, Medication, Doctor, Patient];
    await Promise.all(models.map((Model) => Model.deleteMany({ isDemo: true })));

    const now = new Date();
    const today = startOfDay(now);

    const patients = await insert(Patient, buildPatients(now));
    const doctors = await insert(
      Doctor,
      DOCTORS.map(([name, specialty, title = "", phone = ""]) => ({ name, specialty, title, phone, isDemo: true, ...stamp(now) })),
    );
    // Assign each patient a random doctor so details pages have an assigned doctor card.
    await Promise.all(
      patients.map((patient) => {
        patient.doctor = pick(doctors)._id;
        return patient.save();
      }),
    );
    const medications = await insert(
      Medication,
      MEDICATIONS.map(([name, unit, quantity, reorderLevel]) => ({
        name,
        unit,
        quantity,
        reorderLevel,
        isDemo: true,
        ...stamp(now),
      })),
    );

    const appointments = await insert(Appointment, buildAppointments({ now, today, patients, doctors }));
    const invoices = await insert(Invoice, buildInvoices(appointments));
    const movements = await insert(StockMovement, buildStockMovements({ now, medications }));

    console.log(
      MESSAGES.SEED.DEMO_DONE(
        [
          `${patients.length} patients`,
          `${doctors.length} doctors`,
          `${medications.length} medications`,
          `${appointments.length} appointments`,
          `${invoices.length} invoices`,
          `${movements.length} stock movements`,
        ].join(", "),
      ),
    );
  } finally {
    await disconnectDb();
  }
}

seedDemo().catch((error) => {
  console.error(error);
  process.exit(1);
});
