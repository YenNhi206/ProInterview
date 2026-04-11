import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import { Mentor, mapSeedRowToMentorDoc, toPublicMentor } from "../models/Mentor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readSeedMentors() {
  const path = join(__dirname, "../data/mentorsSeed.json");
  return JSON.parse(readFileSync(path, "utf8"));
}

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

async function ensureSeeded() {
  const count = await Mentor.countDocuments();
  if (count === 0) {
    const rows = readSeedMentors();
    await Mentor.insertMany(rows.map(mapSeedRowToMentorDoc));
  }
}

const MONGO_ERR = "MongoDB chưa kết nối. Kiểm tra MONGO_URI trong .env và đã chạy mongod chưa.";

export async function listMentors() {
  if (!isMongoReady()) {
    return { ok: false, status: 503, error: MONGO_ERR };
  }
  await ensureSeeded();
  const mentors = await Mentor.find().lean();
  return {
    ok: true,
    mentors: mentors.map((m) => toPublicMentor(m)),
  };
}

export async function getMentorById(rawId) {
  if (!isMongoReady()) {
    return { ok: false, status: 503, error: MONGO_ERR };
  }
  await ensureSeeded();
  const or = [{ publicId: rawId }];
  if (mongoose.isValidObjectId(rawId)) {
    or.push({ _id: rawId });
  }
  const mentor = await Mentor.findOne({ $or: or }).lean();
  if (!mentor) {
    return { ok: false, status: 404, error: "Not found" };
  }
  return { ok: true, mentor: toPublicMentor(mentor) };
}
