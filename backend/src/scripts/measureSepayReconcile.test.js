/**
 * QA-04: hàm thuần của script đo đối soát SePay (không cần DB).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildRow,
  parseSepayTransactionDate,
  percentile,
  renderSection,
  summarize,
  upsertSection,
  verdict,
  SECTION_START,
  SECTION_END,
} from "./measureSepayReconcile.js";

const T0 = new Date("2026-11-24T03:00:00.000Z"); // 10:00:00 giờ VN

function event(overrides = {}) {
  return {
    sepayId: "1",
    entityType: "booking",
    transferAmount: 200000,
    createdAt: T0,
    updatedAt: new Date(T0.getTime() + 900),
    rawPayload: {},
    ...overrides,
  };
}

describe("QA-04 measureSepayReconcile", () => {
  it("percentile nearest-rank, mảng rỗng trả null", () => {
    const values = Array.from({ length: 20 }, (_, i) => (i + 1) * 100);
    assert.equal(percentile(values, 50), 1000);
    assert.equal(percentile(values, 95), 1900);
    assert.equal(percentile([], 95), null);
    assert.equal(percentile([7], 95), 7);
  });

  it("summarize tính min/p50/p95/max/avg", () => {
    const s = summarize([300, 100, 200]);
    assert.deepEqual({ n: s.n, min: s.min, p50: s.p50, max: s.max, avg: s.avg }, { n: 3, min: 100, p50: 200, max: 300, avg: 200 });
    assert.equal(summarize([]).n, 0);
  });

  it("transactionDate SePay đọc theo giờ Việt Nam; sai dạng trả null", () => {
    assert.equal(parseSepayTransactionDate("2026-11-24 10:00:00").toISOString(), "2026-11-24T03:00:00.000Z");
    assert.equal(parseSepayTransactionDate("24/11/2026"), null);
    assert.equal(parseSepayTransactionDate(undefined), null);
  });

  it("ưu tiên processingMs đo trực tiếp", () => {
    const row = buildRow(event({ processingMs: 420, receivedAt: T0 }));
    assert.equal(row.reconcileMs, 420);
    assert.equal(row.method, "direct");
  });

  it("bản ghi cũ không có processingMs: ước lượng updatedAt − createdAt", () => {
    const row = buildRow(event());
    assert.equal(row.reconcileMs, 900);
    assert.equal(row.method, "estimated");
  });

  it("ngân hàng → webhook từ transactionDate; lệch âm quá 1 giây thì bỏ", () => {
    const ok = buildRow(event({ receivedAt: new Date(T0.getTime() + 3500), processingMs: 10, rawPayload: { transactionDate: "2026-11-24 10:00:00" } }));
    assert.equal(ok.bankToWebhookMs, 3500);
    const rounding = buildRow(event({ receivedAt: new Date(T0.getTime() - 400), processingMs: 10, rawPayload: { transactionDate: "2026-11-24 10:00:00" } }));
    assert.equal(rounding.bankToWebhookMs, 0);
    const skewed = buildRow(event({ receivedAt: new Date(T0.getTime() - 5000), processingMs: 10, rawPayload: { transactionDate: "2026-11-24 10:00:00" } }));
    assert.equal(skewed.bankToWebhookMs, null);
  });

  it("kết luận: chưa đủ 20 mẫu thì không kết luận đạt", () => {
    assert.equal(verdict(summarize([]), {}), "Chưa có số đo trực tiếp");
    assert.equal(verdict(summarize([100, 200]), { sampleSize: 20 }), "Chưa đủ mẫu (2/20)");
    const twenty = Array.from({ length: 20 }, () => 800);
    assert.equal(verdict(summarize(twenty), { sampleSize: 20, targetMs: 5000 }), "Đạt");
    assert.equal(verdict(summarize(twenty), { sampleSize: 20, targetMs: 500 }), "Không đạt");
  });

  it("renderSection: thống kê và kết luận chỉ từ số đo trực tiếp; ước lượng ghi riêng", () => {
    const rows = [
      buildRow(event({ processingMs: 300 })),
      buildRow(event({ sepayId: "2", updatedAt: new Date(T0.getTime() + 177_000) })),
    ];
    const md = renderSection(rows, { sampleSize: 20, measuredAt: T0 });
    assert.ok(md.startsWith(SECTION_START) && md.endsWith(SECTION_END));
    assert.match(md, /Số giao dịch đo trực tiếp \| 1 \|/);
    assert.match(md, /\| p95 \| 300 ms \|/);
    assert.match(md, /Có 1 giao dịch ghi trước QA-04[\s\S]*p95 177\.00 s/);
    assert.match(md, /Chưa đủ mẫu \(1\/20\)/);
    assert.match(renderSection([buildRow(event())], { measuredAt: T0 }), /Chưa có số đo trực tiếp/);
    assert.match(renderSection([], { measuredAt: T0 }), /Chưa có giao dịch SePay nào/);
  });

  it("upsertSection thay đúng mục cũ, giữ nội dung khác; chưa có thì thêm cuối file", () => {
    const first = upsertSection("# NFR\n\nNội dung khác\n", `${SECTION_START}\ncũ\n${SECTION_END}`);
    assert.match(first, /Nội dung khác[\s\S]*cũ/);
    const second = upsertSection(`${first}\nĐuôi\n`, `${SECTION_START}\nmới\n${SECTION_END}`);
    assert.doesNotMatch(second, /cũ/);
    assert.match(second, /Nội dung khác[\s\S]*mới[\s\S]*Đuôi/);
    assert.equal(second.split(SECTION_START).length, 2);
  });
});
