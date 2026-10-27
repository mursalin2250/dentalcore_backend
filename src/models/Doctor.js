import mongoose from "mongoose";
import { NAME_MAX_LENGTH } from "../constants/validation.js";
import { demoFlag } from "./demoFlag.js";

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: NAME_MAX_LENGTH },
    specialty: { type: String, trim: true, default: "" },
    // Degree / designation (e.g. "BDS, FCPS").
    title: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    avatarUrl: { type: String, default: null },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    ...demoFlag,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  },
);

doctorSchema.index({ name: 1 });
doctorSchema.index({ specialty: 1 });
doctorSchema.index({ createdAt: -1 });

export const Doctor = mongoose.model("Doctor", doctorSchema);
