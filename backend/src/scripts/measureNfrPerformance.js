/**
 * QA-03 (NFR-01, NFR-02): tính p50 / p95 từ SỐ ĐO THẬT. Script không sinh hay ước lượng số nào: thiếu
 * dữ liệu thì báo thiếu, không bù. (Bản trước tự sinh thời gian bằng sin / cos / random và gõ cứng kết quả
 * k6 — đề xuất (ae) ngày 24/11/2026 — đã bỏ.)
 *
 *   # CV/JD ≤ 60 giây — đọc CVAnalysis.meta.processingTimeMs (N-11) trong DB
 *   node src/scripts/measureNfrPerformance.js cv [--since 2026-11-20] [--until 2026-11-25] [--limit 30]
 *
 *   # CV/JD từ log Render (dòng JSON `cv_analysis_timing`), cộng mọi lượt gọi Python của cùng analysisId
 *   node src/scripts/measureNfrPerformance.js cv --log render-backend.log [--limit 30]
 *
 *   # Avatar ≤ 130 giây — đọc log `avatar_video_timing` (N-11), tách video mới / đã cache
 *   node src/scripts/measureNfrPerformance.js avatar --log render-backend.log [--limit 20] [--provider elevenlabs]
 *   (`--provider`: chỉ lấy dòng của provider đó; dòng log trước AI-15 không có `provider` được tính là `did`. QA-08)
 *
 * Kết quả in ra bảng và ghi toàn bộ mẫu vào `docs/report/nfr-raw/<loại>-<thời điểm>.json` để kiểm lại.
 * DB khác .env: đặt TARGET_MONGO_URI. Không ghi gì vào DB.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import mongoose from "mongoose";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.resolve(__dirname, "../../../docs/report/nfr-raw");

export const TARGETS = Object.freeze({
  cv: { maxSeconds: 60, minSamples: 30 },
  avatarNew: { maxSeconds: 130, minSamples: 20 },
  avatarCached: { maxSeconds: 130, minSamples: 20 },
});

// ── Thống kê ────────────────────────────────────────────────────────────────────────────────

/** Phân vị kiểu nearest-rank (giá trị có thật trong mẫu, không nội suy). */
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
}

const r1 = (ms) => (ms === null ? null : Math.round(ms) / 1000);

/** @param {number[]} durationsMs */
export function summarize(durationsMs, { maxSeconds, minSamples }) {
  const n = durationsMs.length;
  if (!n) return { n: 0, enoughSamples: false, minSamples, maxSeconds };
  const over = durationsMs.filter((ms) => ms > maxSeconds * 1000).length;
  return {
    n,
    enoughSamples: n >= minSamples,
    minSamples,
    maxSeconds,
    minS: r1(Math.min(...durationsMs)),
    avgS: r1(durationsMs.reduce((s, v) => s + v, 0) / n),
    p50S: r1(percentile(durationsMs, 50)),
    p95S: r1(percentile(durationsMs, 95)),
    maxS: r1(Math.max(...durationsMs)),
    overTarget: over,
    pass: n >= minSamples && percentile(durationsMs, 95) <= maxSeconds * 1000,
  };
}

// ── Đọc log ─────────────────────────────────────────────────────────────────────────────────

/**
 * Dòng log JSON của `config/logger.js` (`{"ts","level","event",...}`). Log Render có thể chèn tiền tố
 * (thời gian, tên service) trước JSON: lấy từ dấu `{` đầu tiên. Dòng không phải JSON thì bỏ.
 */
export function parseLogLines(text, event) {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const start = line.indexOf("{");
    if (start < 0 || !line.includes(`"${event}"`)) continue;
    try {
      const row = JSON.parse(line.slice(start));
      if (row.event === event) out.push(row);
    } catch {
      /* dòng bị cắt hoặc không phải JSON */
    }
  }
  return out;
}

/**
 * CV từ log: mỗi lần phân tích có thể gọi Python nhiều bậc (suggestions → full → basic) cùng `analysisId`;
 * thời gian người dùng chờ = tổng các lượt. Chỉ lấy lần phân tích có ít nhất 1 lượt thành công.
 */
export function cvSamplesFromLog(rows) {
  const byId = new Map();
  for (const r of rows) {
    if (typeof r.durationMs !== "number") continue;
    const id = String(r.analysisId ?? `${r.ts}-${r.endpoint}`);
    const cur = byId.get(id) ?? { id, durationMs: 0, ok: false, calls: 0, endpoints: [], ts: r.ts };
    cur.durationMs += r.durationMs;
    cur.ok ||= Boolean(r.ok);
    cur.calls += 1;
    cur.endpoints.push(r.endpoint);
    byId.set(id, cur);
  }
  const all = [...byId.values()];
  return { samples: all.filter((s) => s.ok), failed: all.filter((s) => !s.ok).length };
}

/** Avatar từ log: tách video đã cache / video mới; video mới lỗi đếm riêng, không tính vào thời gian. */
/** Lọc dòng `avatar_video_timing` theo provider (AI-15); dòng cũ không có `provider` là D-ID. */
export function filterAvatarRowsByProvider(rows, provider) {
  if (!provider) return rows;
  return rows.filter((r) => (r.provider ?? "did") === provider);
}

export function avatarSamplesFromLog(rows) {
  const ok = rows.filter((r) => typeof r.durationMs === "number" && r.ok);
  return {
    cached: ok.filter((r) => r.fromCache),
    fresh: ok.filter((r) => !r.fromCache),
    failedFresh: rows.filter((r) => !r.ok && !r.fromCache).length,
  };
}

const latest = (rows, limit) => [...rows].sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, limit);

// ── Lệnh ────────────────────────────────────────────────────────────────────────────────────

function argValue(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

async function cvFromDb({ since, until, limit }) {
  await import("../config/loadEnv.js");
  const { connectDatabase } = await import("../db/connect.js");
  const { CVAnalysis } = await import("../models/CVAnalysis.js");
  const uri = process.env.TARGET_MONGO_URI?.trim() || process.env.MONGO_URI;
  if (!uri) throw new Error("Thiếu MONGO_URI (hoặc TARGET_MONGO_URI).");
  console.log(`[QA-03] kết nối tới: ${uri.replace(/^mongodb(\+srv)?:\/\/([^@/]*@)?/, "").split(/[/?]/)[0]}`);
  await connectDatabase(uri);
  try {
    const range = { ...(since ? { $gte: new Date(since) } : {}), ...(until ? { $lt: new Date(until) } : {}) };
    const base = { "meta.processingTimeMs": { $type: "number" }, ...(Object.keys(range).length ? { createdAt: range } : {}) };
    const [done, failed] = await Promise.all([
      CVAnalysis.find({ ...base, status: "completed" }).sort({ createdAt: -1 }).limit(limit)
        .select("createdAt mode tier meta.processingTimeMs").lean(),
      CVAnalysis.countDocuments({ ...base, status: "failed" }),
    ]);
    return {
      source: "db:CVAnalysis.meta.processingTimeMs (thời gian lượt gọi Python cuối của mỗi lần phân tích)",
      failed,
      samples: done.map((d) => ({ id: String(d._id), ts: d.createdAt, mode: d.mode, tier: d.tier, durationMs: d.meta.processingTimeMs })),
    };
  } finally {
    await mongoose.disconnect();
  }
}

function report(kind, sections, extra) {
  mkdirSync(RAW_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(RAW_DIR, `${kind}-${stamp}.json`);
  writeFileSync(file, `${JSON.stringify({ kind, measuredAt: new Date().toISOString(), ...extra, sections }, null, 2)}\n`, "utf8");
  console.log("\n| Phép đo | Số mẫu | p50 (s) | p95 (s) | Max (s) | Vượt ngưỡng | Ngưỡng p95 | Kết quả |");
  console.log("|:--|--:|--:|--:|--:|--:|--:|:--|");
  for (const [name, s] of Object.entries(sections)) {
    const st = s.stats;
    const verdict = !st.n ? "KHÔNG CÓ DỮ LIỆU" : !st.enoughSamples ? `THIẾU MẪU (cần ${st.minSamples})` : st.pass ? "ĐẠT" : "KHÔNG ĐẠT";
    console.log(`| ${name} | ${st.n} | ${st.p50S ?? "—"} | ${st.p95S ?? "—"} | ${st.maxS ?? "—"} | ${st.overTarget ?? "—"} | ≤ ${st.maxSeconds} | ${verdict} |`);
  }
  console.log(`\nMẫu gốc: ${path.relative(process.cwd(), file)}`);
}

async function main() {
  const [kind, ...args] = process.argv.slice(2);
  const log = argValue(args, "--log");
  if (kind === "cv") {
    const limit = Number(argValue(args, "--limit") ?? TARGETS.cv.minSamples);
    let data;
    if (log) {
      const { samples, failed } = cvSamplesFromLog(parseLogLines(readFileSync(log, "utf8"), "cv_analysis_timing"));
      data = { source: `log:${path.basename(log)} cv_analysis_timing (cộng các lượt cùng analysisId)`, failed, samples: latest(samples, limit) };
    } else {
      data = await cvFromDb({ since: argValue(args, "--since"), until: argValue(args, "--until"), limit });
    }
    report("cv", { "CV/JD (NFR-01)": { stats: summarize(data.samples.map((s) => s.durationMs), TARGETS.cv), samples: data.samples } },
      { source: data.source, failedAnalyses: data.failed });
    return;
  }
  if (kind === "avatar") {
    if (!log) throw new Error("Avatar chỉ đo được từ log: thêm --log <file log backend>.");
    const limit = Number(argValue(args, "--limit") ?? TARGETS.avatarNew.minSamples);
    const provider = argValue(args, "--provider");
    const rows = filterAvatarRowsByProvider(parseLogLines(readFileSync(log, "utf8"), "avatar_video_timing"), provider);
    const { cached, fresh, failedFresh } = avatarSamplesFromLog(rows);
    const models = [...new Set(rows.map((r) => r.model).filter(Boolean))];
    const freshL = latest(fresh, limit);
    const cachedL = latest(cached, limit);
    report("avatar", {
      "Avatar câu mới (NFR-02)": { stats: summarize(freshL.map((r) => r.durationMs), TARGETS.avatarNew), samples: freshL },
      "Avatar câu đã cache (NFR-02)": { stats: summarize(cachedL.map((r) => r.durationMs), TARGETS.avatarCached), samples: cachedL },
    }, {
      source: `log:${path.basename(log)} avatar_video_timing`,
      failedFresh,
      ...(provider ? { provider } : {}),
      ...(models.length ? { models } : {}),
    });
    return;
  }
  console.error("Cách dùng: node src/scripts/measureNfrPerformance.js <cv|avatar> [--log file] [--since ngày] [--until ngày] [--limit n] [--provider did|elevenlabs]");
  process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async (err) => {
    console.error(err?.message || err);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  });
}
