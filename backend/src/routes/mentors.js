import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import mongoose from "mongoose";
import { Mentor } from "../models/Mentor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readSeedMentors() {
  const path = join(__dirname, "../data/mentorsSeed.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

/** Chỉ dùng MongoDB — không có DB thì 503 */
function requireMongo(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      success: false,
      error: "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env và đã chạy mongod chưa.",
    });
    return false;
  }
  return true;
}

/** Nếu collection trống, nạp một lần từ file seed vào MongoDB */
async function ensureSeeded() {
  const count = await Mentor.countDocuments();
  if (count === 0) {
    await Mentor.insertMany(readSeedMentors());
  }
}

export const mentorsRouter = express.Router();

mentorsRouter.get("/", async (_req, res, next) => {
  try {
    if (!requireMongo(res)) return;
    await ensureSeeded();
    const mentors = await Mentor.find().lean();
    res.json({ success: true, mentors });
  } catch (err) {
    next(err);
  }
});

mentorsRouter.get("/:id", async (req, res, next) => {
  try {
    if (!requireMongo(res)) return;
    await ensureSeeded();
    const mentor = await Mentor.findOne({ id: req.params.id }).lean();
    if (!mentor) {
      return res.status(404).json({ success: false, error: "Not found" });
    }
    res.json({ success: true, mentor });
  } catch (err) {
    next(err);
  }
});
