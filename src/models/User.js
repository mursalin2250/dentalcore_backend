import mongoose from "mongoose";
import { ROLE_VALUES } from "../constants/roles.js";
import { USER_STATUS_VALUES, USER_STATUSES } from "../constants/statuses.js";
import { NAME_MAX_LENGTH } from "../constants/validation.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: NAME_MAX_LENGTH },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLE_VALUES, required: true },
    status: { type: String, enum: USER_STATUS_VALUES, default: USER_STATUSES.ACTIVE },
    avatarUrl: { type: String, default: null },
    lastLoginAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      // Public shape: `id` instead of `_id`, never the hash.
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  },
);

export const User = mongoose.model("User", userSchema);
