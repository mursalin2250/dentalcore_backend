import { HTTP_STATUS } from "../constants/httpStatus.js";
import { STOCK_MOVEMENT_TYPES } from "../constants/inventory.js";
import { MESSAGES } from "../constants/messages.js";
import { Medication, shapeMedication } from "../models/Medication.js";
import { StockMovement } from "../models/StockMovement.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { sendSuccess } from "../utils/response.js";

async function nextSku() {
  const count = await Medication.countDocuments({});
  return `MED-${String(count + 1).padStart(5, "0")}`;
}

async function findMedOrThrow(id) {
  const med = await Medication.findById(id);
  if (!med || med.isArchived) throw new AppError(MESSAGES.MEDICATION?.NOT_FOUND || "Medication not found.", HTTP_STATUS.NOT_FOUND);
  return med;
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
            $cond: [{ $and: [{ $gt: ["$quantity", 0] }, { $lte: ["$quantity", "$reorderLevel"] }] }, 1, 0],
          },
        },
        outOfStockCount: { $sum: { $cond: [{ $lte: ["$quantity", 0] }, 1, 0] } },
        inventoryValue: { $sum: { $multiply: ["$quantity", { $ifNull: ["$unitPrice", 0] }] } },
      },
    },
  ]);
  sendSuccess(res, {
    data: {
      totalItems: agg?.totalItems || 0,
      lowStockCount: agg?.lowStockCount || 0,
      outOfStockCount: agg?.outOfStockCount || 0,
      inventoryValue: agg?.inventoryValue || 0,
    },
  });
});

export const listMedications = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 12, sort = "-updatedAt" } = req.validated?.query || req.query;
  const filter = { isArchived: { $ne: true } };
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: pattern }, { sku: pattern }, { category: pattern }];
  }
  const skip = (Number(page) - 1) * Number(limit);
  const sortSpec = String(sort).startsWith("-") ? { [String(sort).slice(1)]: -1 } : { [sort]: 1 };

  let rows = await Medication.find(filter).sort(sortSpec).skip(skip).limit(Number(limit));
  let total = await Medication.countDocuments(filter);
  let medications = rows.map(shapeMedication);
  if (status) medications = medications.filter((m) => m.status === status);

  sendSuccess(res, {
    data: {
      medications,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) || 1 },
    },
  });
});

export const getMedication = asyncHandler(async (req, res) => {
  const med = await findMedOrThrow(req.validated.params.id);
  sendSuccess(res, { data: { medication: shapeMedication(med) } });
});

export const createMedication = asyncHandler(async (req, res) => {
  const body = { ...req.validated.body };
  if (!body.sku) body.sku = await nextSku();
  else {
    body.sku = String(body.sku).trim().toUpperCase();
    if (await Medication.exists({ sku: body.sku })) {
      throw new AppError("SKU already exists.", HTTP_STATUS.CONFLICT, { sku: "SKU already exists." });
    }
  }
  const initialStock = Math.max(0, Number(body.quantity) || 0);
  body.quantity = initialStock;
  body.unitPrice = Math.max(0, Number(body.unitPrice) || 0);
  body.reorderLevel = Math.max(0, Number(body.reorderLevel) || 0);

  const med = await Medication.create(body);

  if (initialStock > 0) {
    await StockMovement.create({
      medication: med._id,
      type: STOCK_MOVEMENT_TYPES.IN,
      quantity: initialStock,
      stockBefore: 0,
      stockAfter: initialStock,
      reason: "Initial stock",
      performedBy: req.user?._id || null,
    });
  }

  sendSuccess(res, {
    status: HTTP_STATUS.CREATED,
    data: { medication: shapeMedication(med) },
    message: "Medication created.",
  });
});

export const updateMedication = asyncHandler(async (req, res) => {
  const med = await findMedOrThrow(req.validated.params.id);
  const changes = { ...req.validated.body };
  // Stock is only changed via movements
  delete changes.quantity;
  if (changes.sku) {
    changes.sku = String(changes.sku).trim().toUpperCase();
    if (await Medication.exists({ sku: changes.sku, _id: { $ne: med._id } })) {
      throw new AppError("SKU already exists.", HTTP_STATUS.CONFLICT, { sku: "SKU already exists." });
    }
  }
  Object.assign(med, changes);
  await med.save();
  sendSuccess(res, { data: { medication: shapeMedication(med) }, message: "Medication updated." });
});

export const removeMedication = asyncHandler(async (req, res) => {
  const med = await findMedOrThrow(req.validated.params.id);
  const hasMovements = await StockMovement.exists({ medication: med._id });
  if (hasMovements) {
    med.isArchived = true;
    await med.save();
    sendSuccess(res, { message: "Medication archived (has movement history)." });
    return;
  }
  await med.deleteOne();
  sendSuccess(res, { message: "Medication deleted." });
});
