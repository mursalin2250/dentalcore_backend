import mongoose from "mongoose";
import { NAME_MAX_LENGTH } from "../constants/validation.js";
import { demoFlag } from "./demoFlag.js";

const addressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    district: { type: String, trim: true, default: "" },
    postalCode: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const educationSchema = new mongoose.Schema(
  {
    institution: { type: String, trim: true, default: "" },
    degree: { type: String, trim: true, default: "" },
    fieldOfStudy: { type: String, trim: true, default: "" },
    completionYear: { type: Number, default: null },
  },
  { _id: false },
);

const certificationSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: "" },
    issuingBody: { type: String, trim: true, default: "" },
    issueYear: { type: Number, default: null },
    expiryYear: { type: Number, default: null },
  },
  { _id: false },
);

const doctorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: NAME_MAX_LENGTH },
    specialty: { type: String, trim: true, default: "" },
    // Degree / designation (e.g. "BDS, FCPS").
    title: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    avatarUrl: { type: String, default: null },
    address: { type: addressSchema, default: () => ({}) },
    education: { type: [educationSchema], default: [] },
    certifications: { type: [certificationSchema], default: [] },
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
        if (!ret.address) ret.address = { street: "", city: "", district: "", postalCode: "" };
        if (!Array.isArray(ret.education)) ret.education = [];
        if (!Array.isArray(ret.certifications)) ret.certifications = [];
        return ret;
      },
    },
  },
);

doctorSchema.index({ name: 1 });
doctorSchema.index({ specialty: 1 });
doctorSchema.index({ createdAt: -1 });

export const Doctor = mongoose.model("Doctor", doctorSchema);
