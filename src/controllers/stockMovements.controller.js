import { HTTP_STATUS } from "../constants/httpStatus.js";
import { STOCK_MOVEMENT_TYPES } from "../constants/inventory.js";
import { Medication } from "../models/Medication.js";
import { StockMovement, shapeStockMovement } from "../models/StockMovement.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const getStockMovementStats = asyncHandler(async (_req, res) => {
  const today = startOfToday();
  const ago30 = daysAgo(30);
  const [todayCount, in30, out30, adj30] = await Promise.all([
    StockMovement.countDocuments({ createdAt: { $gte: today } }),
    StockMovement.aggregate([
      { $match: { type: STOCK_MOVEMENT_TYPES.IN, createdAt: { $gte: ago30 } } },
      { $group: { _id: null, total: { $sum: "$quantity" } } },
    ]),
    StockMovement.aggregate([
      { $match: { type: STOCK_MOVEMENT_TYPES.OUT, createdAt: { $gte: ago30 } } },
      { $group: { _id: null, total: { $sum: "$quantity" } } },
    ]),
    StockMovement.countDocuments({ type: STOCK_MOVEMENT_TYPES.ADJUST, createdAt: { $gte: ago30 } }),
  ]);
  sendSuccess(res, {
    data: {
      movementsToday: todayCount,
      stockIn30d: in30[0]?.total || 0,
      stockOut30d: out30[0]?.total || 0,
      adjustments30d: adj30,
    },
  });
});

export const listStockMovements = asyncHandler(async (req, res) => {
  const { search, type, medication, page = 1, limit = 12 } = req.validated?.query || req.query;
  const filter = {};
  if (type) filter.type = type;
  if (medication) filter.medication = medication;

  const skip = (Number(page) - 1) * Number(limit);
  let query = StockMovement.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .populate("medication", "name sku unit unitPrice")
    .populate("performedBy", "name");

  const [rows, total] = await Promise.all([
    query,
    StockMovement.countDocuments(filter),
  ]);

  let movements = rows.map(shapeStockMovement);
  if (search) {
    const q = String(search).toLowerCase();
    movements = movements.filter((m) => (m.medication?.name || "").toLowerCase().includes(q));
  }

  sendSuccess(res, {
    data: {
      movements,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) || 1 },
    },
  });
});

export const createStockMovement = asyncHandler(async (req, res) => {
  const { medication: medId, type, quantity, reason, note } = req.validated.body;
  const qty = Math.max(1, Math.round(Number(quantity) || 0));

  const med = await Medication.findById(medId);
  if (!med || med.isArchived) throw new AppError("Medication not found.", HTTP_STATUS.NOT_FOUND);

  const before = Number(med.quantity) || 0;
  let after = before;

  if (type === STOCK_MOVEMENT_TYPES.IN) {
    after = before + qty;
  } else if (type === STOCK_MOVEMENT_TYPES.OUT) {
    if (qty > before) throw new AppError("Not enough stock for this stock out.", HTTP_STATUS.BAD_REQUEST);
    after = before - qty;
  } else if (type === STOCK_MOVEMENT_TYPES.ADJUST) {
    after = qty; // counted quantity becomes new stock
  } else {
    throw new AppError("Invalid movement type.", HTTP_STATUS.BAD_REQUEST);
  }

  // Atomic-ish update
  med.quantity = after;
  await med.save();

  const movement = await StockMovement.create({
    medication: med._id,
    type,
    quantity: type === STOCK_MOVEMENT_TYPES.ADJUST ? Math.abs(after - before) || qty : qty,
    stockBefore: before,
    stockAfter: after,
    reason: reason || "",
    note: note || "",
    performedBy: req.user?._id || null,
  });

  const populated = await StockMovement.findById(movement._id)
    .populate("medication", "name sku unit unitPrice")
    .populate("performedBy", "name");

  sendSuccess(res, {
    status: HTTP_STATUS.CREATED,
    data: { movement: shapeStockMovement(populated) },
    message: "Stock movement recorded.",
  });
});
