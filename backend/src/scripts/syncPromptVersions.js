/**
 * AI-02: đồng bộ bảng PromptVersion với code và dữ liệu cũ. Chạy lại nhiều lần không tạo bản trùng.
 *
 * 1. Bản mặc định trong code (`prompts/`): chưa có thì tạo kèm template đầy đủ; chỉ bật `active`
 *    khi key chưa có bản active nào (không ghi đè version đã được activate sau này).
 *    Đã có mà template khác code → CẢNH BÁO, không ghi đè: dấu hiệu sửa chữ prompt trong code mà
 *    không tạo version mới.
 * 2. Chuỗi promptVersion đã ghi trong DB (session, QuestionBank) mà chưa có bản ghi → tạo với
 *    `template: null`, `legacy: true`, `active: false`, giữ nguyên tên.
 *
 * Tên không bắt đầu bằng `seed` vì script seed bị `_devOnlyGuard` chặn ở production.
 * Chạy thử (không ghi DB): npm run db:sync-prompt-versions:dry · Chạy thật: npm run db:sync-prompt-versions
 * DB khác .env (production): đặt TARGET_MONGO_URI, ví dụ PowerShell:
 *   $env:TARGET_MONGO_URI="mongodb+srv://..."; npm run db:sync-prompt-versions:dry
 */
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import { PromptVersion } from "../models/PromptVersion.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { QuestionBank } from "../models/QuestionBank.js";
import { PROMPT_REGISTRY } from "../prompts/index.js";
import { clearPromptCache } from "../services/promptVersionService.js";

const LEGACY_NOTE = "Chuỗi cũ tìm thấy trong dữ liệu (AI-02), không còn nội dung prompt";
const SEED_NOTE = "Bản mặc định trong code lúc chạy sync (AI-02)";

/** Mọi chuỗi promptVersion đã ghi trong DB, kèm key suy từ chỗ ghi. */
export async function discoverStoredVersions() {
  const pool = { orgId: null };
  const company = { orgId: { $ne: null } }; // câu công ty (CO-04) sinh bằng prompt company_question_gen
  const [questionVersions, feedbackVersions, bankGenerated, bankProvenance, orgGenerated, orgProvenance] = await Promise.all([
    InterviewSession.distinct("questions.promptVersion"),
    InterviewSession.distinct("feedback.promptVersion"),
    QuestionBank.distinct("generatedBy.promptVersion", pool),
    QuestionBank.distinct("provenance.promptVersion", pool),
    QuestionBank.distinct("generatedBy.promptVersion", company),
    QuestionBank.distinct("provenance.promptVersion", company),
  ]);
  const found = new Map(); // version → key
  const add = (list, key) => {
    for (const v of list) {
      if (typeof v === "string" && v.trim() && !found.has(v)) found.set(v, key);
    }
  };
  add(feedbackVersions, "evaluation");
  add([...questionVersions, ...bankGenerated, ...bankProvenance], "question_gen");
  add([...orgGenerated, ...orgProvenance], "company_question_gen");
  return found;
}

export async function syncPromptVersions({ dryRun = false, log = console.log } = {}) {
  if (!dryRun) await PromptVersion.init(); // bảo đảm index unique đã có trước khi ghi (dry run không tạo index)
  const summary = { created: [], activated: [], legacyCreated: [], mismatched: [], conflicts: [] };

  for (const [key, entry] of Object.entries(PROMPT_REGISTRY)) {
    const { version, template, fewShotExamples } = entry.default;
    const existing = await PromptVersion.findOne({ version }).lean();
    const hasActive = await PromptVersion.exists({ key, active: true });

    if (existing) {
      if (existing.key !== key) {
        summary.conflicts.push(version);
        log(`[PromptVersion] ⚠ version ${version} đã thuộc key "${existing.key}", không phải "${key}"`);
        continue;
      }
      if (!isDeepStrictEqual(existing.template, JSON.parse(JSON.stringify(template)))) {
        summary.mismatched.push(version);
        log(`[PromptVersion] ⚠ ${key}/${version}: template trong DB khác code. Không ghi đè. Sửa chữ prompt phải tạo version mới.`);
      }
      if (!hasActive) {
        log(`[PromptVersion] ${key}: chưa có bản active → bật ${version}`);
        if (!dryRun) await PromptVersion.updateOne({ _id: existing._id }, { $set: { active: true, activatedAt: new Date() } });
        summary.activated.push(version);
      }
      continue;
    }

    log(`[PromptVersion] tạo ${key}/${version}${hasActive ? "" : " (active)"}`);
    if (!dryRun) {
      await PromptVersion.updateOne(
        { version },
        {
          $setOnInsert: {
            key, version, template, fewShotExamples, legacy: false,
            active: !hasActive, activatedAt: hasActive ? null : new Date(), note: SEED_NOTE,
          },
        },
        { upsert: true },
      );
    }
    summary.created.push(version);
    if (!hasActive) summary.activated.push(version);
  }

  const stored = await discoverStoredVersions();
  for (const [version, key] of stored) {
    const existing = await PromptVersion.findOne({ version }).select("key").lean();
    if (existing) {
      if (existing.key !== key) log(`[PromptVersion] ⚠ chuỗi ${version} trong dữ liệu ${key} nhưng bản ghi thuộc key "${existing.key}"`);
      continue;
    }
    log(`[PromptVersion] chuỗi cũ ${key}/${version} → legacy`);
    if (!dryRun) {
      await PromptVersion.updateOne(
        { version },
        { $setOnInsert: { key, version, template: null, fewShotExamples: [], legacy: true, active: false, note: LEGACY_NOTE } },
        { upsert: true },
      );
    }
    summary.legacyCreated.push(version);
  }

  if (!dryRun) clearPromptCache();
  const all = await PromptVersion.find({}, { key: 1, version: 1, active: 1, legacy: 1 }).sort({ key: 1, version: 1 }).lean();
  log(`[PromptVersion] hiện có: ${all.map((d) => `${d.key}/${d.version}${d.active ? "*" : ""}${d.legacy ? " (legacy)" : ""}`).join(", ") || "(trống)"}`);
  return summary;
}

async function main() {
  // Nạp .env chỉ khi chạy từ dòng lệnh: import module này (test) không bị .env ghi đè biến môi trường.
  await import("../config/loadEnv.js");
  // loadEnv dùng dotenv override:true → muốn chạy DB khác (production) thì đặt TARGET_MONGO_URI.
  const uri = process.env.TARGET_MONGO_URI?.trim() || process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI (hoặc TARGET_MONGO_URI).");
    process.exit(1);
  }
  const host = uri.replace(/^mongodb(\+srv)?:\/\/([^@/]*@)?/, "").split(/[/?]/)[0];
  console.log(`[PromptVersion] kết nối tới: ${host}${process.env.TARGET_MONGO_URI ? " (TARGET_MONGO_URI)" : " (MONGO_URI trong .env)"}`);
  // PowerShell nuốt `--` nên dùng script :dry; npm đặt npm_config_dry_run khi cờ rơi vào npm.
  const dryRun =
    process.argv.includes("--dry-run") || process.env.DRY_RUN === "1" || process.env.npm_config_dry_run === "true";
  await connectDatabase(uri);
  const s = await syncPromptVersions({ dryRun });
  console.log(`${dryRun ? "DRY RUN (không ghi DB)" : "Đã đồng bộ"}: tạo ${s.created.length}, bật ${s.activated.length}, legacy ${s.legacyCreated.length}, lệch template ${s.mismatched.length}.`);
  await mongoose.disconnect();
  if (s.mismatched.length || s.conflicts.length) process.exitCode = 2;
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
