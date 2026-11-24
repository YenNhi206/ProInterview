/**
 * QA-04 (NFR-03): đo thời gian đối soát SePay trên giao dịch thật — từ lúc webhook đến tới lúc
 * đơn được xác nhận (Payment / đơn chuyển sang đã thanh toán). Chỉ đọc DB, không sinh số giả.
 *
 * Nguồn số liệu: `SepayWebhookEvent` status `processed`, lấy N bản ghi mới nhất (mặc định 20).
 * - Bản ghi có `processingMs` (sau QA-04): đo trực tiếp trong `handleSepayWebhook`.
 * - Bản ghi cũ chưa có `processingMs`: ước lượng `updatedAt − createdAt` (createdAt ghi ngay sau
 *   khi nhận, updatedAt ghi lúc chuyển `processed`), báo cáo ghi rõ là ước lượng.
 * - Thêm cột tham khảo "ngân hàng → webhook" từ `rawPayload.transactionDate` (giờ VN, chính xác
 *   tới giây). Đoạn này do SePay/ngân hàng quyết định, không thuộc NFR-03.
 *
 * Chạy (chỉ in kết quả):      npm run qa:sepay-reconcile
 * Ghi vào nfr-results.md:     npm run qa:sepay-reconcile:write
 * Số mẫu khác 20:             đặt SAMPLE_SIZE=30
 * Chỉ lấy giao dịch từ ngày:  đặt SINCE=2026-11-24
 * DB khác .env (production):  đặt TARGET_MONGO_URI, ví dụ PowerShell:
 *   $env:TARGET_MONGO_URI="mongodb+srv://..."; npm run qa:sepay-reconcile
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
import mongoose from "mongoose";

export const DEFAULT_SAMPLE_SIZE = 20;
/** Ngưỡng đề xuất cho "within seconds" (REQUIREMENTS NFR-03 còn ghi CẦN CHỐT). */
export const DEFAULT_TARGET_MS = 5000;
export const SECTION_START = "<!-- QA-04:start -->";
export const SECTION_END = "<!-- QA-04:end -->";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const NFR_RESULTS_PATH = resolve(__dirname, "../../../docs/report/nfr-results.md");

/** Phân vị theo nearest-rank (cùng cách với các mục QA khác). */
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

export function summarize(values) {
  if (!values.length) return { n: 0, min: null, p50: null, p95: null, max: null, avg: null };
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    n: values.length,
    min: Math.min(...values),
    p50: percentile(values, 50),
    p95: percentile(values, 95),
    max: Math.max(...values),
    avg: sum / values.length,
  };
}

/**
 * `transactionDate` SePay dạng "YYYY-MM-DD HH:mm:ss", giờ Việt Nam (UTC+7). Trả Date hoặc null.
 */
export function parseSepayTransactionDate(raw) {
  const m = String(raw ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}+07:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Một dòng đo từ một SepayWebhookEvent (lean). */
export function buildRow(event) {
  const created = event.createdAt ? new Date(event.createdAt) : null;
  const updated = event.updatedAt ? new Date(event.updatedAt) : null;
  let reconcileMs = null;
  let method = "";
  if (Number.isFinite(event.processingMs) && event.processingMs >= 0) {
    reconcileMs = event.processingMs;
    method = "direct";
  } else if (created && updated && updated >= created) {
    reconcileMs = updated.getTime() - created.getTime();
    method = "estimated";
  }
  const arrived = event.receivedAt ? new Date(event.receivedAt) : created;
  const txDate = parseSepayTransactionDate(event.rawPayload?.transactionDate);
  let bankToWebhookMs = null;
  // transactionDate chỉ tới giây: cho phép lệch âm tối đa 1 giây do làm tròn.
  if (txDate && arrived) {
    const lag = arrived.getTime() - txDate.getTime();
    if (lag >= -1000) bankToWebhookMs = Math.max(0, lag);
  }
  return {
    sepayId: String(event.sepayId ?? ""),
    entityType: event.entityType || "",
    amount: Number(event.transferAmount) || 0,
    arrivedAt: arrived,
    reconcileMs,
    method,
    bankToWebhookMs,
  };
}

/** `stats` phải tính trên số đo trực tiếp; số ước lượng không đủ tin cậy để kết luận. */
export function verdict(stats, { sampleSize = DEFAULT_SAMPLE_SIZE, targetMs = DEFAULT_TARGET_MS } = {}) {
  if (!stats.n) return "Chưa có số đo trực tiếp";
  if (stats.n < sampleSize) return `Chưa đủ mẫu (${stats.n}/${sampleSize})`;
  return stats.p95 <= targetMs ? "Đạt" : "Không đạt";
}

const fmtMs = (v) => (v == null ? "—" : v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toFixed(2)} s`);
const fmtVnd = (v) => `${Math.round(v).toLocaleString("vi-VN")}đ`;
const fmtTime = (d) =>
  d ? d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false }) : "—";

/** Mục markdown QA-04 (kèm marker để chạy lại thay đúng mục này). */
export function renderSection(rows, {
  sampleSize = DEFAULT_SAMPLE_SIZE,
  targetMs = DEFAULT_TARGET_MS,
  dbHost = "",
  measuredAt = new Date(),
} = {}) {
  const valid = rows.filter((r) => r.reconcileMs != null);
  const directRows = valid.filter((r) => r.method === "direct");
  const estimatedRows = valid.filter((r) => r.method === "estimated");
  const stats = summarize(directRows.map((r) => r.reconcileMs));
  const est = summarize(estimatedRows.map((r) => r.reconcileMs));
  const bank = summarize(rows.map((r) => r.bankToWebhookMs).filter((v) => v != null));
  const direct = directRows.length;
  const estimated = estimatedRows.length;
  const byType = directRows.reduce((acc, r) => ({ ...acc, [r.entityType || "?"]: (acc[r.entityType || "?"] || 0) + 1 }), {});

  const lines = [
    SECTION_START,
    "## QA-04: Đối soát chuyển khoản SePay (NFR-03)",
    "",
    `> Đo bằng \`npm run qa:sepay-reconcile:write\` (\`backend/src/scripts/measureSepayReconcile.js\`), ngày ${fmtTime(measuredAt)}${dbHost ? `, DB \`${dbHost}\`` : ""}.`,
    "> Mốc đo: từ lúc `POST /api/payments/webhook/sepay` vào handler tới lúc đơn đã xác nhận và webhook ghi `processed`.",
    `> Ngưỡng đề xuất p95 ≤ ${fmtMs(targetMs)} (REQUIREMENTS ghi "CẦN CHỐT", nhóm cần chốt con số).`,
    "",
    "| Chỉ số | Giá trị |",
    "| --- | --- |",
    `| Số giao dịch đo trực tiếp | ${direct} |`,
    `| Theo loại đơn | ${Object.entries(byType).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"} |`,
    `| p50 | ${fmtMs(stats.p50)} |`,
    `| p95 | ${fmtMs(stats.p95)} |`,
    `| Max | ${fmtMs(stats.max)} |`,
    `| Trung bình | ${fmtMs(stats.avg)} |`,
    `| Tham khảo: ngân hàng → webhook (p50 / p95, ${bank.n} giao dịch) | ${fmtMs(bank.p50)} / ${fmtMs(bank.p95)} |`,
    `| Kết luận | **${verdict(stats, { sampleSize, targetMs })}** |`,
    "",
  ];
  if (estimated) {
    lines.push(
      `Có ${estimated} giao dịch ghi trước QA-04 (chưa có \`processingMs\`), ước lượng bằng \`updatedAt − createdAt\` của \`SepayWebhookEvent\`: p50 ${fmtMs(est.p50)}, p95 ${fmtMs(est.p95)}.`,
      "Số này không dùng để kết luận: nếu lần đầu webhook không khớp đơn và SePay gửi lại sau đó, khoảng chờ giữa hai lần bị tính gộp.",
      "",
    );
  }
  if (valid.length) {
    lines.push("| # | Thời điểm webhook | Loại đơn | Số tiền | Đối soát | Cách đo | Ngân hàng → webhook |", "| --- | --- | --- | --- | --- | --- | --- |");
    valid.forEach((r, i) => {
      lines.push(`| ${i + 1} | ${fmtTime(r.arrivedAt)} | ${r.entityType || "—"} | ${fmtVnd(r.amount)} | ${fmtMs(r.reconcileMs)} | ${r.method === "direct" ? "trực tiếp" : "ước lượng"} | ${fmtMs(r.bankToWebhookMs)} |`);
    });
    lines.push("");
  } else {
    lines.push("Chưa có giao dịch SePay nào ở trạng thái `processed` trong DB đã đo.", "");
  }
  lines.push(SECTION_END);
  return lines.join("\n");
}

/** Thay mục QA-04 giữa hai marker; chưa có thì thêm vào cuối file. */
export function upsertSection(doc, section) {
  const start = doc.indexOf(SECTION_START);
  const end = doc.indexOf(SECTION_END);
  if (start !== -1 && end > start) {
    return doc.slice(0, start) + section + doc.slice(end + SECTION_END.length);
  }
  const base = doc.replace(/\s+$/, "");
  return `${base}${base ? "\n\n---\n\n" : ""}${section}\n`;
}

export async function loadProcessedEvents({ limit = DEFAULT_SAMPLE_SIZE, since = null } = {}) {
  const { SepayWebhookEvent } = await import("../models/SepayWebhookEvent.js");
  const filter = { status: "processed" };
  if (since) filter.createdAt = { $gte: since };
  return SepayWebhookEvent.find(filter)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select("sepayId entityType transferAmount createdAt updatedAt receivedAt processedAt processingMs rawPayload.transactionDate")
    .lean();
}

async function main() {
  // Nạp .env trong main (không ở đầu file) để test import script không bị ghi đè biến môi trường.
  await import("../config/loadEnv.js");
  const { connectDatabase } = await import("../db/connect.js");
  const uri = process.env.TARGET_MONGO_URI?.trim() || process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI (hoặc TARGET_MONGO_URI).");
    process.exit(1);
  }
  const dbHost = uri.replace(/^mongodb(\+srv)?:\/\/([^@/]*@)?/, "").split(/[/?]/)[0];
  const sampleSize = Math.max(1, Number.parseInt(process.env.SAMPLE_SIZE, 10) || DEFAULT_SAMPLE_SIZE);
  const targetMs = Number(process.env.SEPAY_RECONCILE_TARGET_MS) || DEFAULT_TARGET_MS;
  const since = process.env.SINCE ? new Date(process.env.SINCE) : null;
  if (since && Number.isNaN(since.getTime())) {
    console.error(`SINCE không hợp lệ: ${process.env.SINCE} (dạng YYYY-MM-DD).`);
    process.exit(1);
  }
  const write = process.argv.includes("--write") || process.env.WRITE === "1";

  console.log(`[QA-04] kết nối tới: ${dbHost}${process.env.TARGET_MONGO_URI ? " (TARGET_MONGO_URI)" : " (MONGO_URI trong .env)"}`);
  await connectDatabase(uri);
  const events = await loadProcessedEvents({ limit: sampleSize, since });
  // Hiển thị theo thời gian tăng dần cho dễ đọc.
  const rows = events.map(buildRow).reverse();
  const section = renderSection(rows, { sampleSize, targetMs, dbHost });
  console.log(`\n${section}\n`);

  if (write) {
    const doc = existsSync(NFR_RESULTS_PATH) ? readFileSync(NFR_RESULTS_PATH, "utf8") : "";
    writeFileSync(NFR_RESULTS_PATH, upsertSection(doc, section), "utf8");
    console.log(`[QA-04] đã ghi mục QA-04 vào ${NFR_RESULTS_PATH}`);
  } else {
    console.log("[QA-04] chỉ in kết quả. Ghi vào nfr-results.md: npm run qa:sepay-reconcile:write");
  }
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
