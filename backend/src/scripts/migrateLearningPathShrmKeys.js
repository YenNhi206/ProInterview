/**
 * LP-07/LP-20 sau LP-01: đổi key năng lực của danh sách tạm cũ (LP-20, `SHRM_COMPETENCIES`) sang key
 * của bộ tiêu chí chung `config/competencies.json`. Các key cũ không có trong bộ tiêu chí nên
 * chấm điểm (LP-13), `suggestOutcome` và hồ sơ năng lực (PR-06) không tra được.
 *
 * Chỉ sửa `LearningPathSession.shrmKeys`. Key lạ khác (không có trong bảng đổi) chỉ được liệt kê,
 * không tự xoá: báo nhóm để quyết định.
 * Chạy thử (không ghi DB): npm run db:migrate-lp-shrm-keys:dry · Chạy thật: npm run db:migrate-lp-shrm-keys
 * DB khác .env (production): đặt TARGET_MONGO_URI, ví dụ PowerShell:
 *   $env:TARGET_MONGO_URI="mongodb+srv://..."; npm run db:migrate-lp-shrm-keys:dry
 */
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import { LearningPathSession } from "../models/LearningPathSession.js";
import { isValidCompetencyKey } from "../services/competencyFramework.js";

/** Key tạm của LP-20 → key gần nhất trong bộ tiêu chí LP-01. */
export const LEGACY_LP20_KEY_MAP = Object.freeze({
  critical_thinking: "problem_solving",
  technical_knowledge: "technical_learning",
  decision_making: "data_driven_decision",
  planning_organizing: "planning_execution",
  initiative: "accountability",
  relationship_management: "stakeholder_management",
});

/** Đổi key cũ, bỏ trùng, giữ thứ tự. */
export function remapShrmKeys(keys) {
  return [...new Set((keys || []).map((k) => LEGACY_LP20_KEY_MAP[k] ?? k))];
}

export async function migrateLearningPathShrmKeys({ dryRun = false, log = console.log } = {}) {
  const legacyKeys = Object.keys(LEGACY_LP20_KEY_MAP);
  const affected = await LearningPathSession.find({ shrmKeys: { $in: legacyKeys } }).select("_id pathId shrmKeys").lean();
  log(`[LearningPathSession] buổi có key cũ LP-20: ${affected.length}`);

  let updated = 0;
  for (const s of affected) {
    const next = remapShrmKeys(s.shrmKeys);
    log(`  ${s._id} (lộ trình ${s.pathId}): ${JSON.stringify(s.shrmKeys)} → ${JSON.stringify(next)}`);
    if (!dryRun) {
      await LearningPathSession.updateOne({ _id: s._id }, { $set: { shrmKeys: next } });
      updated += 1;
    }
  }

  // Key lạ còn lại (không nằm trong bảng đổi) — chỉ báo cáo.
  const unknown = await LearningPathSession.aggregate([
    { $unwind: "$shrmKeys" },
    { $group: { _id: "$shrmKeys", count: { $sum: 1 } } },
  ]).then((rows) => rows.filter((r) => !isValidCompetencyKey(r._id, { allowDeprecated: true }) && !LEGACY_LP20_KEY_MAP[r._id]));
  if (unknown.length) {
    log(`[LearningPathSession] key lạ chưa xử lý: ${unknown.map((r) => `${r._id} (${r.count})`).join(", ")}`);
  }
  return { found: affected.length, updated, unknown: unknown.map((r) => r._id) };
}

async function main() {
  // Nạp .env chỉ khi chạy từ dòng lệnh: test import module này không bị .env ghi đè biến môi trường.
  await import("../config/loadEnv.js");
  // loadEnv dùng dotenv override:true → muốn chạy DB khác (production) thì đặt TARGET_MONGO_URI.
  const uri = process.env.TARGET_MONGO_URI?.trim() || process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI (hoặc TARGET_MONGO_URI).");
    process.exit(1);
  }
  const host = uri.replace(/^mongodb(\+srv)?:\/\/([^@/]*@)?/, "").split(/[/?]/)[0];
  console.log(`[LearningPathSession] kết nối tới: ${host}${process.env.TARGET_MONGO_URI ? " (TARGET_MONGO_URI)" : " (MONGO_URI trong .env)"}`);
  // PowerShell nuốt `--` nên dùng script :dry; npm đặt npm_config_dry_run khi cờ rơi vào npm.
  const dryRun =
    process.argv.includes("--dry-run") || process.env.DRY_RUN === "1" || process.env.npm_config_dry_run === "true";
  await connectDatabase(uri);
  const result = await migrateLearningPathShrmKeys({ dryRun });
  console.log(dryRun ? `DRY RUN hoàn tất (không ghi DB): ${result.found} buổi cần đổi.` : `Đã đổi key cho ${result.updated} buổi.`);
  await mongoose.disconnect();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (e) => {
    console.error(e);
    try {
      await mongoose.disconnect();
    } catch {}
    process.exit(1);
  });
}
