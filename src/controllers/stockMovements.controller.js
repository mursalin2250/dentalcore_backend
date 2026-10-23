import {
  INVENTORY_STATS_WINDOW_DAYS,
  STOCK_MOVEMENT_TYPES,
} from "../constants/inventory.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { TIMEZONE } from "../constants/locale.js";
import { Medication } from "../models/Medication.js";
import { StockMovement, shapeStockMovement } from "../models/StockMovement.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { startOfDay, addDays } from "../utils/dates.js";
import { sendSuccess } from "../utils/response.js";

function daysAgo(n) {
  const d = startOfDay();
  return addDays(d, -n);
}

export const getStockMovementStats = asyncHandler(async (_req, res) => {
  const todayStart = startOfDay();
  const todayEnd = addDays(todayStart, 1);
  const windowStart = daysAgo(INVENTORY_STATS_WINDOW_DAYS);

  const [movementsToday, inAgg, outAgg, adjustmentsCount] = await Promise.all([
    StockMovement.countDocuments({ createdAt: { $gte: todayStart, $lt: todayEnd } }),
    StockMovement.aggregate([
      { $match: { type: STOCK_MOVEMENT_TYPES.IN, createdAt: { $gte: windowStart } } },
      { $group: { _id: null, units: { $sum: "$quantity" } } },
    ]),
    StockMovement.aggregate([
      { $match: { type: STOCK_MOVEMENT_TYPES.OUT, createdAt: { $gte: windowStart } } },
      { $group: { _id: null, units: { $sum: "$quantity" } } },
    ]),
    StockMovement.countDocuments({
      type: STOCK_MOVEMENT_TYPES.ADJUST,
      createdAt: { $gte: windowStart },
    }),
  ]);

  sendSuccess(res, {
    data: {
      movementsToday,
      stockInUnits: inAgg[0]?.units ?? 0,
      stockOutUnits: outAgg[0]?.units ?? 0,
      adjustmentsCount,
    },
  });
});

export const listStockMovements = asyncHandler(async (req, res) => {
  const { search, type, medication, from, to, page, limit } = req.validated.query;
  const filter = {};
  if (type) filter.type = type;
  if (medication) filter.medication = medication;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    const meds = await Medication.find({ $or: [{ name: pattern }, { sku: pattern }] })
      .select("_id")
      .lean();
    filter.medication = { $in: meds.map((m) => m._id) };
  }

  const [rows, total] = await Promise.all([
    StockMovement.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("medication", "name sku unit stock unitPrice")
      .populate("performedBy", "name")
      .lean(),
    StockMovement.countDocuments(filter),
  ]);

  sendSuccess(res, {
    data: {
      movements: rows.map(shapeStockMovement),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

export const createStockMovement = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const med = await Medication.findById(body.medication);
  if (!med || med.isArchived) throw new AppError(MESSAGES.MEDICATION.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

  const stockBefore = med.stock;
  let quantity;
  let stockAfter;
  let filter = { _id: med._id };

  if (body.type === STOCK_MOVEMENT_TYPES.IN) {
    quantity = body.quantity;
    stockAfter = stockBefore + quantity;
  } else if (body.type === STOCK_MOVEMENT_TYPES.OUT) {
    quantity = body.quantity;
    if (quantity > stockBefore) {
      throw new AppError(MESSAGES.STOCK.INSUFFICIENT, HTTP_STATUS.BAD_REQUEST);
    }
    stockAfter = stockBefore - quantity;
    // Race-safe: only succeed if stock is still enough.
    filter = { _id: med._id, stock: { $gte: quantity } };
  } else {
    // Adjust: counted quantity is the new stock level.
    const counted = body.countedQuantity ?? 0;
    stockAfter = counted;
    quantity = Math.abs(counted - stockBefore) || 1;
  }

  const updated = await Medication.findOneAndUpdate(
    filter,
    { $set: { stock: stockAfter } },
    { new: true },
  );
  if (!updated) {
    throw new AppError(MESSAGES.STOCK.INSUFFICIENT, HTTP_STATUS.CONFLICT);
  }

  let movement;
  try {
    movement = await StockMovement.create({
      medication: med._id,
      type: body.type,
      quantity,
      stockBefore,
      stockAfter,
      reason: body.reason,
      note: body.note || "",
      reference: body.reference || "",
      performedBy: req.user?._id || null,
    });
  } catch (err) {
    // Roll back stock if movement insert fails.
    await Medication.findByIdAndUpdate(med._id, { $set: { stock: stockBefore } });
    throw err;
  }

  await movement.populate([
    { path: "medication", select: "name sku unit stock unitPrice" },
    { path: "performedBy", select: "name" },
  ]);

  sendSuccess(res, {
    status: HTTP_STATUS.CREATED,
    message: MESSAGES.STOCK.CREATED,
    data: { movement: shapeStockMovement(movement), medication: { id: updated._id.toString(), stock: updated.stock } },
  });
});
