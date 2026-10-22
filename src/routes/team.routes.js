import { Router } from "express";
import { ROUTE_PATHS } from "../constants/api.js";
import { ROLES } from "../constants/roles.js";
import {
  createMember,
  listMembers,
  removeMember,
  updateMember,
} from "../controllers/team.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { validate } from "../middleware/validate.js";
import {
  createMemberSchema,
  listMembersSchema,
  memberIdSchema,
  updateMemberSchema,
} from "../validators/team.schemas.js";

const router = Router();

// Everything under /team is Admin only.
router.use(authenticate, authorize(ROLES.ADMIN));

router.get(ROUTE_PATHS.ROOT, validate(listMembersSchema), listMembers);
router.post(ROUTE_PATHS.ROOT, validate(createMemberSchema), createMember);
router.patch(ROUTE_PATHS.BY_ID, validate(updateMemberSchema), updateMember);
router.delete(ROUTE_PATHS.BY_ID, validate(memberIdSchema), removeMember);

export default router;
