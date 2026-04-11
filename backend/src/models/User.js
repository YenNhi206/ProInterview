import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    /** Liên kết Google Sign-In (sub từ ID token) */
    googleSub: { type: String, sparse: true, unique: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, required: true, trim: true },
    role: {
      type: String,
      enum: ["customer", "mentor"],
      default: "customer",
    },
    phone: { type: String, default: "" },
    position: { type: String, default: "" },
    school: { type: String, default: "" },
    field: { type: String, default: "" },
    avatar: String,
    expertise: [{ type: String }],
    experience: String,
    hourlyRate: Number,
    bio: String,
  },
  {
    collection: "users",
    timestamps: true,
    versionKey: false,
  }
);

export const User = mongoose.models.User ?? mongoose.model("User", userSchema);

export function toPublicUser(doc) {
  if (!doc) return null;
  const plain = doc.toObject ? doc.toObject() : { ...doc };
  const out = { ...plain };
  if (out._id) {
    out.id = out._id.toString();
    delete out._id;
  }
  delete out.passwordHash;
  delete out.googleSub;
  delete out.createdAt;
  delete out.updatedAt;
  return out;
}
