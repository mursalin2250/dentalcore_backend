import { Router } from "express";
import { ROUTE_PATHS } from "../constants/api.js";
import {
  addPayment,
  createInvoice,
  getInvoice,
  getInvoiceByPatient,
  getInvoiceStats,
  listInvoices,
  removeInvoice,
  updateInvoice,
  voidPayment,
} from "../controllers/invoices.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { validate } from "../middleware/validate.js";
import {
  addPaymentSchema,
  createInvoiceSchema,
  invoiceIdSchema,
  listInvoicesSchema,
  updateInvoiceSchema,
  voidPaymentSchema,
} from "../validators/invoices.schemas.js";
import { objectIdField } from "../validators/fields.js";
import { z } from "zod";

const router = Router();
router.use(authenticate);

router.get(ROUTE_PATHS.STATS, getInvoiceStats);
router.get(ROUTE_PATHS.ROOT, validate(listInvoicesSchema), listInvoices);
router.post(ROUTE_PATHS.ROOT, validate(createInvoiceSchema), createInvoice);
router.get(
  "/patient/:id",
  validate({ params: z.object({ id: objectIdField }) }),
  getInvoiceByPatient,
);
router.get(ROUTE_PATHS.BY_ID, validate(invoiceIdSchema), getInvoice);
router.patch(ROUTE_PATHS.BY_ID, validate(updateInvoiceSchema), updateInvoice);
router.delete(ROUTE_PATHS.BY_ID, validate(invoiceIdSchema), removeInvoice);
router.post(`${ROUTE_PATHS.BY_ID}/payments`, validate(addPaymentSchema), addPayment);
router.post(
  `${ROUTE_PATHS.BY_ID}/payments/:paymentId/void`,
  validate(voidPaymentSchema),
  voidPayment,
);

export default router;
