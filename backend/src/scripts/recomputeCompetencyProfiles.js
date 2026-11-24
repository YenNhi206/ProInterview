/**
 * PR-06: gộp lại hồ sơ năng lực cho mọi ứng viên có nguồn (phỏng vấn AI completed, lộ trình, khóa học
 * hoàn thành) hoặc đã có CandidateProfile — thay dữ liệu gộp tạm của PR-07 (`technical_mastery`, 6 key khung).
 * Chạy 1 lần trên staging và production sau khi merge PR-06; chạy lại được (kết quả như nhau).
 *
 *   npm run db:recompute-competency-profiles:dry   # đếm, không ghi
 *   npm run db:recompute-competency-profiles
 *
 * DB khác .env: đặt TARGET_MONGO_URI. Hồ sơ không có bằng chứng nào vẫn được ghi lại thành danh sách rỗng
 * (xóa năng lực khung cũ).
 */
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import { CandidateProfile } from "../models/CandidateProfile.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { LearningPath } from "../models/LearningPath.js";
import { Enrollment } from "../models/Enrollment.js";
import { COMPETENCY_PROFILE_VERSION, recomputeCompetencyProfile } from "../services/competencyProfileService.js";

/** User cần gộp lại: có hồ sơ chưa ở phiên bản hiện hành, hoặc có nguồn mà chưa có hồ sơ. */
export async function usersToRecompute() {
  const [profiles, sessions, paths, enrollments] = await Promise.all([
    CandidateProfile.find({ competenciesVersion: { $ne: COMPETENCY_PROFILE_VERSION } }).distinct("userId"),
    InterviewSession.find({ status: "completed" }).distinct("userId"),
    LearningPath.find({}).distinct("candidateId"),
    Enrollment.find({ $or: [{ completedAt: { $ne: null } }, { progressPercent: { $gte: 100 } }] }).distinct("userId"),
  ]);
  const current = new Set((await CandidateProfile.find({ competenciesVersion: COMPETENCY_PROFILE_VERSION }).distinct("userId")).map(String));
  const ids = new Set(profiles.map(String));
  for (const id of [...sessions, ...paths, ...enrollments].map(String)) if (!current.has(id)) ids.add(id);
  return [...ids];
}

export async function recomputeAll({ dryRun = false, log = console.log } = {}) {
  const ids = await usersToRecompute();
  log(`[PR-06] ${ids.length} người dùng cần gộp lại hồ sơ năng lực${dryRun ? " (dry run, không ghi)" : ""}.`);
  if (dryRun) return { total: ids.length, done: 0, failed: 0 };
  let done = 0;
  let failed = 0;
  for (const id of ids) {
    try {
      const rows = await recomputeCompetencyProfile(id);
      // Hồ sơ cũ không còn nguồn nào: recompute không tạo / không đổi → xóa năng lực khung cũ.
      if (!rows.length) {
        await CandidateProfile.updateOne(
          { userId: id },
          { $set: { competencies: [], competenciesVersion: COMPETENCY_PROFILE_VERSION, competenciesComputedAt: new Date(), isVerified: false } },
        );
      }
      done += 1;
    } catch (err) {
      failed += 1;
      log(`  ✗ ${id}: ${err?.message}`);
    }
  }
  log(`[PR-06] Xong: ${done} thành công, ${failed} lỗi.`);
  return { total: ids.length, done, failed };
}

async function main() {
  // Nạp .env chỉ khi chạy từ dòng lệnh (test import file này không bị ghi đè biến môi trường).
  await import("../config/loadEnv.js");
  const uri = process.env.TARGET_MONGO_URI?.trim() || process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI (hoặc TARGET_MONGO_URI).");
    process.exit(1);
  }
  const host = uri.replace(/^mongodb(\+srv)?:\/\/([^@/]*@)?/, "").split(/[/?]/)[0];
  console.log(`[PR-06] kết nối tới: ${host}`);
  await connectDatabase(uri);
  await recomputeAll({ dryRun: process.argv.includes("--dry-run") });
  await mongoose.disconnect();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (e) => {
    console.error(e?.message || e);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });
}
