import mongoose from "mongoose";

/**
 * Schema collection `mentors` — map 1:1 với object mentor trên frontend.
 * Trường `id` là business id (chuỗi), không dùng ObjectId của Mongo.
 */
const mentorSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    title: String,
    company: String,
    field: String,
    experience: { type: Number, min: 0 },
    rating: { type: Number, min: 0, max: 5 },
    reviews: { type: Number, min: 0 },
    price: { type: Number, min: 0 },
    avatar: String,
    tags: [{ type: String }],
    available: { type: Boolean, default: true },
    bio: String,
    specialties: [{ type: String }],
    companies: [{ type: String }],
    sessionsDone: { type: Number, min: 0 },
    responseTime: String,
  },
  {
    collection: "mentors",
    _id: false,
    versionKey: false,
  }
);

export const Mentor = mongoose.models.Mentor ?? mongoose.model("Mentor", mentorSchema);
