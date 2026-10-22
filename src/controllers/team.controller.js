import { HTTP_STATUS } from "../constants/httpStatus.js";
import { MESSAGES } from "../constants/messages.js";
import { ROLES } from "../constants/roles.js";
import { USER_STATUSES } from "../constants/statuses.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { escapeRegex } from "../utils/escapeRegex.js";
import { hashPassword } from "../utils/password.js";
import { sendSuccess } from "../utils/response.js";

async function findMemberOrThrow(id) {
  const member = await User.findById(id);
  if (!member) throw new AppError(MESSAGES.TEAM.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  return member;
}

// Someone other than `memberId` must remain an active admin.
async function assertAnotherActiveAdmin(memberId) {
  const others = await User.countDocuments({
    role: ROLES.ADMIN,
    status: USER_STATUSES.ACTIVE,
    _id: { $ne: memberId },
  });
  if (others === 0) throw new AppError(MESSAGES.TEAM.LAST_ADMIN, HTTP_STATUS.CONFLICT);
}

const isActiveAdmin = (member) =>
  member.role === ROLES.ADMIN && member.status === USER_STATUSES.ACTIVE;

export const listMembers = asyncHandler(async (req, res) => {
  const { search, role, page, limit } = req.validated.query;

  const filter = {};
  if (role) filter.role = role;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: pattern }, { email: pattern }];
  }

  const [members, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  sendSuccess(res, {
    data: {
      members,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    },
  });
});

export const createMember = asyncHandler(async (req, res) => {
  const { name, email, role, password } = req.validated.body;

  if (await User.exists({ email })) {
    throw new AppError(MESSAGES.TEAM.EMAIL_TAKEN, HTTP_STATUS.CONFLICT, {
      email: MESSAGES.TEAM.EMAIL_TAKEN,
    });
  }

  const member = await User.create({ name, email, role, passwordHash: await hashPassword(password) });
  sendSuccess(res, { status: HTTP_STATUS.CREATED, data: { member }, message: MESSAGES.TEAM.CREATED });
});

export const updateMember = asyncHandler(async (req, res) => {
  const changes = req.validated.body;
  const member = await findMemberOrThrow(req.validated.params.id);

  const isSelf = member.id === req.user.id;
  if (isSelf && changes.status === USER_STATUSES.INACTIVE) {
    throw new AppError(MESSAGES.TEAM.CANNOT_DEACTIVATE_SELF, HTTP_STATUS.FORBIDDEN);
  }

  const losesAdminAccess =
    (changes.role !== undefined && changes.role !== ROLES.ADMIN) ||
    changes.status === USER_STATUSES.INACTIVE;
  if (isActiveAdmin(member) && losesAdminAccess) await assertAnotherActiveAdmin(member.id);

  Object.assign(member, changes);
  await member.save();

  sendSuccess(res, { data: { member }, message: MESSAGES.TEAM.UPDATED });
});

export const removeMember = asyncHandler(async (req, res) => {
  const member = await findMemberOrThrow(req.validated.params.id);

  if (member.id === req.user.id) {
    throw new AppError(MESSAGES.TEAM.CANNOT_REMOVE_SELF, HTTP_STATUS.FORBIDDEN);
  }
  if (isActiveAdmin(member)) await assertAnotherActiveAdmin(member.id);

  await member.deleteOne();
  sendSuccess(res, { message: MESSAGES.TEAM.REMOVED });
});
