import {
  EXPIRY_FLAGS,
  EXPIRY_SOON_DAYS,
  SKU_PREFIX,
  STOCK_MOVEMENT_TYPES,
  STOCK_STATUSES,
} from "../constants/inventory.js";
import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { Medication, deriveExpiryFlag, deriveStockStatus, shapeMedication } from "../models/Medication.js";
import { StockMovement } from "../models/StockMovement.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { sendSuccess } from "../utils/response.js";

async function nextSku() {
  const count = await Medication.countDocuments({});
  let attempt = count + 1;
  for (let i = 0; i < 20; i += 1) {
    const sku = `${SKU_PREFIX}-${String(attempt).padStart(4, "0")}`;
    const exists = await Medication.exists({ sku });
    if (!exists) return sku;
    attempt += 1;
  }
  return `${SKU_PREFIX}-${Date.now().toString(36).toUpperCase()}`;
}

function parseExpiry(value) {
  if (value === undefined || value === null || value === "") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const getMedicationStats = asyncHandler(async (_req, res) => {
  const [agg] = await Medication.aggregate([
    { $match: { isArchived: { $ne: true } } },
    {
      $group: {
        _id: null,
        totalItems: { $sum: 1 },
        lowStockCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: ["$stock", 0] },
                  { $lte: ["$stock", "$reorderLevel"] },
                ],
              },
              1,
              0,
            ],
          },
        },
        outOfStockCount: { $sum: { $cond: [{ $lte: ["$stock", 0] }, 1, 0] } },
        inventoryValue: { $sum: { $multiply: ["$stock", "$unitPrice"] } },
      },
    },
  ]);
  sendSuccess(res, {
    data: {
      totalItems: agg?.totalItems ?? 0,
      lowStockCount: agg?.lowStockCount ?? 0,
      outOfStockCount: agg?.outOfStockCount ?? 0,
      inventoryValue: agg?.inventoryValue ?? 0,
    },
  });
});

export const listMedications = asyncHandler(async (req, res) => {
  const { search, category, itemType, status, expiry, page, limit, sort } = req.validated.query;
  const filter = { isArchived: { $ne: true } };
  if (category) filter.category = category;
  if (itemType) filter.itemType = itemType;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: pattern }, { sku: pattern }];
  }
  if (status === STOCK_STATUSES.OUT_OF_STOCK) {
    filter.stock = { $lte: 0 };
  } else if (status === STOCK_STATUSES.LOW_STOCK) {
    filter.$expr = {
      $and: [{ $gt: ["$stock", 0] }, { $lte: ["$stock", "$reorderLevel"] }],
    };
  } else if (status === STOCK_STATUSES.IN_STOCK) {
    filter.$expr = { $gt: ["$stock", "$reorderLevel"] };
  }
  if (expiry === EXPIRY_FLAGS.EXPIRED) {
    filter.expiryDate = { $lt: new Date() };
  } else if (expiry === EXPIRY_FLAGS.EXPIRING_SOON) {
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + EXPIRY_SOON_DAYS);
    filter.expiryDate = { $gte: now, $lte: soon };
  } else if (expiry === EXPIRY_FLAGS.NONE) {
    filter.$or = [...(filter.$or ? [{ $or: filter.$or }] : []), { expiryDate: null }, { expiryDate: { $exists: false } }];
    delete filter.$or;
    filter.expiryDate = null;
  }

  const sortKey = sort || "-updatedAt";
  const sortSpec = sortKey.startsWith("-") ? { [sortKey.slice(1)]: -1 } : { [sortKey]: 1 };
  const [rows, total] = await Promise.all([
    Medication.find(filter)
      .sort(sortSpec)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Medication.countDocuments(filter),
  ]);

  sendSuccess(res, {
    data: {
      medications: rows.map(shapeMedication),
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

export const getMedication = asyncHandler(async (req, res) => {
  const med = await Medication.findById(req.validated.params.id).lean();
  if (!med || med.isArchived) throw new AppError(MESSAGES.MEDICATION.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  sendSuccess(res, { data: { medication: shapeMedication(med) } });
});

export const createMedication = asyncHandler(async (req, res) => {
  const body = req.validated.body;
  const sku = (body.sku || "").trim() || (await nextSku());
  const exists = await Medication.exists({ sku });
  if (exists) throw new AppError(MESSAGES.MEDICATION.SKU_TAKEN, HTTP_STATUS.CONFLICT);

  const initialStock = body.initialStock ?? 0;
  const med = await Medication.create({
    name: body.name,
    sku,
    itemType: body.itemType,
    category: body.category,
    unit: body.unit,
    stock: initialStock,
    reorderLevel: body.reorderLevel ?? 0,
    unitPrice: body.unitPrice ?? 0,
    expiryDate: parseExpiry(body.expiryDate),
    supplier: body.supplier || "",
  });

  if (initialStock > 0) {
    await StockMovement.create({
      medication: med._id,
      type: STOCK_MOVEMENT_TYPES.IN,
      quantity: initialStock,
      stockBefore: 0,
      stockAfter: initialStock,
      reason: "Purchase",
      note: "Initial stock on create",
      performedBy: req.user?._id || null,
    });
  }

  sendSuccess(res, {
    status: HTTP_STATUS.CREATED,
    message: MESSAGES.MEDICATION.CREATED,
    data: { medication: shapeMedication(med) },
  });
});

export const updateMedication = asyncHandler(async (req, res) => {
  const med = await Medication.findById(req.validated.params.id);
  if (!med || med.isArchived) throw new AppError(MESSAGES.MEDICATION.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

  const changes = { ...req.validated.body };
  if (changes.sku && changes.sku !== med.sku) {
    const taken = await Medication.exists({ sku: changes.sku, _id: { $ne: med._id } });
    if (taken) throw new AppError(MESSAGES.MEDICATION.SKU_TAKEN, HTTP_STATUS.CONFLICT);
  }
  if ("expiryDate" in changes) changes.expiryDate = parseExpiry(changes.expiryDate);
  // Never allow direct stock edits via this route.
  delete changes.stock;
  delete changes.initialStock;
  delete changes.quantity;

  Object.assign(med, changes);
  await med.save();
  sendSuccess(res, {
    message: MESSAGES.MEDICATION.UPDATED,
    data: { medication: shapeMedication(med) },
  });
});

export const removeMedication = asyncHandler(async (req, res) => {
  const med = await Medication.findById(req.validated.params.id);
  if (!med) throw new AppError(MESSAGES.MEDICATION.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

  const movementCount = await StockMovement.countDocuments({ medication: med._id });
  if (movementCount === 0) {
    await med.deleteOne();
    sendSuccess(res, { message: MESSAGES.MEDICATION.DELETED, data: { archived: false } });
    return;
  }
  med.isArchived = true;
  await med.save();
  sendSuccess(res, { message: MESSAGES.MEDICATION.ARCHIVED, data: { archived: true } });
});
