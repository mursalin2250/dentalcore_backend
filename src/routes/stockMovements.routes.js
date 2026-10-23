import { Router } from "express";
import { ROUTE_PATHS } from "../constants/api.js";
import {
  createStockMovement,
  getStockMovementStats,
  listStockMovements,
} from "../controllers/stockMovements.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  createStockMovementSchema,
  listStockMovementsSchema,
} from "../validators/stockMovements.schemas.js";

const router = Router();
router.use(authenticate);
router.get(ROUTE_PATHS.STATS, getStockMovementStats);
router.get(ROUTE_PATHS.ROOT, validate(listStockMovementsSchema), listStockMovements);
router.post(ROUTE_PATHS.ROOT, validate(createStockMovementSchema), createStockMovement);
export default router;
