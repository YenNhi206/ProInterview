/**
 * AI-01: bộ dữ liệu 20 câu chuẩn hợp lệ, phiếu chấm khớp dữ liệu, tổng hợp điểm và độ lệch đúng.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadAnswers, parseCsv, parseGrades, median, krippendorffAlphaInterval, aggregateGrades, renderSheet, templateCsv,
} from "./ai01Benchmark.js";
import { isValidCompetencyKey, getFramework } from "../services/competencyFramework.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const data = loadAnswers();
const ids = data.items.map((it) => it.id);

describe("AI-01: bộ dữ liệu", () => {
  it("đúng 20 câu, id không trùng, key năng lực có trong bộ tiêu chí, có câu hỏi và transcript", () => {
    assert.equal(data.items.length, 20);
    assert.equal(new Set(ids).size, 20);
    for (const it of data.items) {
      assert.ok(isValidCompetencyKey(it.competencyId), it.id);
      assert.ok(it.question.trim().length > 20, it.id);
      assert.ok(it.transcript.trim().length > 0, it.id);
    }
  });

  it("phiếu chấm và file mẫu trong repo khớp dữ liệu (chạy npm run ai01:sheet sau khi sửa answers.json)", () => {
    const fw = getFramework();
    const sheet = renderSheet(data, { fw, byKey: new Map(fw.competencies.map((c) => [c.key, c])) });
    const committed = readFileSync(path.resolve(__dirname, "../../../docs/plan/ai01/PHIEU_CHAM.md"), "utf8");
    assert.equal(committed.replace(/\r\n/g, "\n"), sheet);
    const tpl = readFileSync(path.resolve(__dirname, "../data/ai01/grades/_mau.csv"), "utf8");
    assert.equal(tpl.replace(/\r\n/g, "\n"), templateCsv(data));
  });
});

describe("AI-01: đọc phiếu chấm", () => {
  const csv = (rows) => ["id,level,note", ...rows].join("\n");
  const full = (level = 2) => ids.map((id) => `${id},${level},`);

  it("đọc được ghi chú có dấu phẩy, BOM, CRLF", () => {
    const rows = full();
    rows[0] = `${ids[0]},3,"Đủ STAR, nhưng thiếu số liệu"`;
    const g = parseGrades(`﻿${csv(rows).replace(/\n/g, "\r\n")}`, ids, "van");
    assert.deepEqual(g.get(ids[0]), { level: 3, note: "Đủ STAR, nhưng thiếu số liệu" });
    assert.equal(g.size, 20);
    assert.deepEqual(parseCsv('a,"b ""c"""\n'), [["a", 'b "c"']]);
  });

  it("từ chối mức 5, mức thập phân, ô trống, câu thiếu, câu trùng, id lạ", () => {
    const withRow = (i, value) => { const r = full(); r[i] = value; return csv(r); };
    assert.throws(() => parseGrades(withRow(0, `${ids[0]},5,`), ids, "a"), /0–4/);
    assert.throws(() => parseGrades(withRow(0, `${ids[0]},2.5,`), ids, "a"), /0–4/);
    assert.throws(() => parseGrades(withRow(0, `${ids[0]},,`), ids, "a"), /0–4/);
    assert.throws(() => parseGrades(csv(full().slice(1)), ids, "a"), /Chưa chấm 1 câu/);
    assert.throws(() => parseGrades(csv([...full(), `${ids[0]},1,`]), ids, "a"), /hai lần/);
    assert.throws(() => parseGrades(withRow(0, "ai01-99,1,"), ids, "a"), /không có trong bộ câu/);
    assert.throws(() => parseGrades("ma,muc\nx,1", ids, "a"), /"id" và "level"/);
  });
});

describe("AI-01: tổng hợp", () => {
  it("median, alpha: đồng ý hoàn toàn = 1, ngẫu nhiên lệch thì < 1", () => {
    assert.equal(median([1, 3, 2]), 2);
    assert.equal(median([1, 2, 3, 4]), 2.5);
    assert.equal(krippendorffAlphaInterval([[1, 1], [3, 3], [0, 0]]), 1);
    const a = krippendorffAlphaInterval([[1, 2], [3, 3], [0, 1], [4, 2]]);
    assert.ok(a > 0 && a < 1, String(a));
  });

  it("điểm chuẩn = trung vị; câu lệch ≥ 2 mức cần bàn; độ lệch từng người", () => {
    const items = [{ id: "x1", competencyId: "teamwork" }, { id: "x2", competencyId: "teamwork" }];
    const g = (pairs) => new Map(pairs.map(([id, level]) => [id, { level, note: "" }]));
    const r = aggregateGrades(items, {
      an: g([["x1", 3], ["x2", 1]]),
      binh: g([["x1", 3], ["x2", 1]]),
      chi: g([["x1", 4], ["x2", 3]]),
    });
    assert.deepEqual(r.graders, ["an", "binh", "chi"]);
    assert.equal(r.items[0].gold, 3);
    assert.equal(r.items[1].gold, 1);
    assert.equal(r.items[1].needsDiscussion, true);
    assert.deepEqual(r.stats.needsDiscussion, ["x2"]);
    // 6 cặp: x1 (0,1,1), x2 (0,2,2) → trùng 2/6, ≤1 mức 4/6, lệch TB 1.
    assert.equal(r.stats.exactAgreement, 0.333);
    assert.equal(r.stats.withinOneLevel, 0.667);
    assert.equal(r.stats.meanAbsPairDiff, 1);
    assert.deepEqual(r.stats.graderBias.chi, { meanSigned: 1.5, meanAbs: 1.5 });
    assert.deepEqual(r.stats.goldDistribution, { 1: 1, 3: 1 });
  });

  it("cần ít nhất 2 người chấm", () => {
    assert.throws(() => aggregateGrades([{ id: "x1" }], { an: new Map([["x1", { level: 1, note: "" }]]) }), /ít nhất 2/);
  });
});
