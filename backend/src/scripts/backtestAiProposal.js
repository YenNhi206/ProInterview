/**
 * AI-04: backtest đề xuất cải tiến AI trên bộ 20 câu chuẩn AI-01 và 10 câu trả lời cũ, in độ lệch
 * so với điểm chuẩn của bản trước và bản sau. Kết quả ghi vào `AIImprovementProposal.backtest`.
 *
 *   node src/scripts/backtestAiProposal.js <proposalId>    # một đề xuất (chạy lại được)
 *   node src/scripts/backtestAiProposal.js --pending       # mọi đề xuất `proposed` chưa có backtest
 *
 * Gọi LLM thật (khoảng 12 lần cho một đề xuất). DB khác .env: đặt TARGET_MONGO_URI.
 */
import { pathToFileURL } from "node:url";
import mongoose from "mongoose";

const pct = (v) => (Number.isFinite(v) ? `${Math.round(v * 100)}%` : "—");
const num = (v) => (Number.isFinite(v) ? String(v) : "—");

export function formatBacktest(proposalId, bt) {
  if (bt.status !== "done") return `[${proposalId}] ${bt.status}: ${bt.error || bt.reason || ""}`;
  const line = (label, s) =>
    `  ${label.padEnd(18)} lệch TB ${num(s.mae).padEnd(6)} lệch có dấu ${num(s.bias).padEnd(6)} trùng mức ${pct(s.exact).padEnd(5)} lệch ≤1 ${pct(s.within1)} (n=${s.n})`;
  return [
    `[${proposalId}] ${bt.beforeVersion} → ${bt.afterVersion} · bộ ${bt.dataset} · kết luận: ${bt.verdict} (Δ lệch TB ${num(bt.maeDelta)})`,
    line(`AI-01 trước`, bt.gold.before),
    line(`AI-01 sau`, bt.gold.after),
    `  Câu cũ: ${bt.old.count} câu (${bt.old.withReference} có điểm moderator), thay đổi TB giữa hai bản ${num(bt.old.meanAbsChange)}`,
    ...(bt.old.withReference ? [line("Câu cũ trước", bt.old.before), line("Câu cũ sau", bt.old.after)] : []),
  ].join("\n");
}

async function main() {
  await import("../config/loadEnv.js");
  const arg = process.argv[2];
  if (!arg) {
    console.error("Cách dùng: node src/scripts/backtestAiProposal.js <proposalId|--pending>");
    process.exit(1);
  }
  const uri = process.env.TARGET_MONGO_URI?.trim() || process.env.MONGO_URI;
  if (!uri) {
    console.error("Thiếu MONGO_URI (hoặc TARGET_MONGO_URI).");
    process.exit(1);
  }
  const { connectDatabase } = await import("../db/connect.js");
  const { runBacktest, backtestPendingProposals } = await import("../services/aiImprovementBacktestService.js");
  await connectDatabase(uri);
  const results = arg === "--pending"
    ? await backtestPendingProposals()
    : [{ proposalId: arg, backtest: await runBacktest(arg) }];
  if (!results.length) console.log("Không có đề xuất nào cần backtest.");
  for (const r of results) console.log(formatBacktest(String(r.proposalId), r.backtest));
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
