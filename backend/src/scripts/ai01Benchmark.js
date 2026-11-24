/**
 * AI-01: bộ 20 câu trả lời chuẩn — tạo phiếu chấm và tổng hợp điểm chuẩn từ điểm của cả nhóm.
 *
 *   node src/scripts/ai01Benchmark.js sheet       # sinh docs/plan/ai01/PHIEU_CHAM.md + grades/_mau.csv
 *   node src/scripts/ai01Benchmark.js aggregate   # đọc grades/*.csv → gold.json, in độ lệch giữa người chấm
 *
 * Mỗi người chấm một file `backend/src/data/ai01/grades/<ten>.csv` (cột id, level, note), mức nguyên 0–4
 * theo thang LP-01 (mức 5 chỉ xét qua nhiều câu nên không dùng cho một câu trả lời).
 * Điểm chuẩn = trung vị các người chấm. Độ lệch: Krippendorff alpha (interval), tỉ lệ trùng khớp,
 * tỉ lệ lệch ≤ 1 mức, lệch tuyệt đối trung bình giữa từng cặp, độ lệch riêng của từng người so với chuẩn.
 * Không cần DB, không gọi LLM.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const AI01_DIR = path.resolve(__dirname, "../data/ai01");
const GRADES_DIR = path.join(AI01_DIR, "grades");
const SHEET_PATH = path.resolve(__dirname, "../../../docs/plan/ai01/PHIEU_CHAM.md");
const COMPETENCIES_PATH = path.resolve(__dirname, "../config/competencies.json");

export const MAX_SINGLE_ANSWER_LEVEL = 4;
/** Khoảng (max − min) từ mức này trở lên thì câu cần cả nhóm bàn lại. */
export const DISCUSS_RANGE = 2;
const TEMPLATE_FILE = "_mau.csv";

export function loadAnswers(dir = AI01_DIR) {
  return JSON.parse(readFileSync(path.join(dir, "answers.json"), "utf8"));
}

// ── CSV ─────────────────────────────────────────────────────────────────────────────────────

/** Tách CSV có hỗ trợ ô trong ngoặc kép ("a, b", "" là dấu nháy). Bỏ BOM, dòng trống. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const src = String(text).replace(/^﻿/, "");
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/**
 * Đọc phiếu của một người chấm. Thiếu câu, trùng câu, id lạ, mức không phải số nguyên 0–4 → ném lỗi
 * tiếng Việt nêu đúng dòng.
 * @returns {Map<string, { level: number, note: string }>}
 */
export function parseGrades(text, itemIds, grader = "?") {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error(`[${grader}] File rỗng.`);
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idCol = header.indexOf("id");
  const levelCol = header.indexOf("level");
  const noteCol = header.indexOf("note");
  if (idCol < 0 || levelCol < 0) throw new Error(`[${grader}] Dòng đầu phải có cột "id" và "level".`);

  const known = new Set(itemIds);
  const out = new Map();
  rows.slice(1).forEach((r, i) => {
    const line = i + 2;
    const id = String(r[idCol] ?? "").trim();
    const raw = String(r[levelCol] ?? "").trim();
    if (!known.has(id)) throw new Error(`[${grader}] Dòng ${line}: id "${id}" không có trong bộ câu.`);
    if (out.has(id)) throw new Error(`[${grader}] Dòng ${line}: câu ${id} bị chấm hai lần.`);
    const level = Number(raw);
    if (raw === "" || !Number.isInteger(level) || level < 0 || level > MAX_SINGLE_ANSWER_LEVEL) {
      throw new Error(`[${grader}] Dòng ${line} (${id}): mức "${raw}" phải là số nguyên 0–${MAX_SINGLE_ANSWER_LEVEL}.`);
    }
    out.set(id, { level, note: noteCol >= 0 ? String(r[noteCol] ?? "").trim() : "" });
  });
  const missing = itemIds.filter((id) => !out.has(id));
  if (missing.length) throw new Error(`[${grader}] Chưa chấm ${missing.length} câu: ${missing.join(", ")}.`);
  return out;
}

// ── Thống kê ────────────────────────────────────────────────────────────────────────────────

export function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Krippendorff alpha, metric interval, dữ liệu đủ (mọi người chấm mọi câu).
 * alpha = 1 − Do/De; Do: bất đồng trong cùng câu, De: bất đồng kỳ vọng trên toàn bộ giá trị.
 * Mọi giá trị giống hệt nhau (De = 0) → 1.
 * @param {number[][]} units  mỗi phần tử là các mức của một câu
 */
export function krippendorffAlphaInterval(units) {
  const pairable = units.filter((u) => u.length >= 2);
  const all = pairable.flat();
  const n = all.length;
  if (n < 2) return null;
  let doSum = 0;
  for (const u of pairable) {
    let s = 0;
    for (let i = 0; i < u.length; i += 1) for (let j = 0; j < u.length; j += 1) if (i !== j) s += (u[i] - u[j]) ** 2;
    doSum += s / (u.length - 1);
  }
  const Do = doSum / n;
  let deSum = 0;
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) if (i !== j) deSum += (all[i] - all[j]) ** 2;
  const De = deSum / (n * (n - 1));
  return De === 0 ? 1 : 1 - Do / De;
}

/**
 * @param {{ id: string, competencyId: string }[]} items
 * @param {Record<string, Map<string, { level: number, note: string }>>} gradesByGrader
 */
export function aggregateGrades(items, gradesByGrader) {
  const graders = Object.keys(gradesByGrader).sort();
  if (graders.length < 2) throw new Error("Cần ít nhất 2 người chấm để tính độ lệch.");

  let pairs = 0;
  let exact = 0;
  let within1 = 0;
  let absSum = 0;
  const graderDev = Object.fromEntries(graders.map((g) => [g, { signed: 0, abs: 0 }]));

  const rows = items.map((item) => {
    const levels = Object.fromEntries(graders.map((g) => [g, gradesByGrader[g].get(item.id).level]));
    const values = Object.values(levels);
    const gold = median(values);
    for (let i = 0; i < values.length; i += 1) {
      for (let j = i + 1; j < values.length; j += 1) {
        const d = Math.abs(values[i] - values[j]);
        pairs += 1;
        absSum += d;
        if (d === 0) exact += 1;
        if (d <= 1) within1 += 1;
      }
    }
    for (const g of graders) {
      graderDev[g].signed += levels[g] - gold;
      graderDev[g].abs += Math.abs(levels[g] - gold);
    }
    const range = Math.max(...values) - Math.min(...values);
    return {
      id: item.id,
      competencyId: item.competencyId,
      gold,
      mean: round(values.reduce((s, v) => s + v, 0) / values.length, 2),
      range,
      needsDiscussion: range >= DISCUSS_RANGE,
      levels,
      notes: Object.fromEntries(graders.map((g) => [g, gradesByGrader[g].get(item.id).note]).filter(([, n]) => n)),
    };
  });

  const alpha = krippendorffAlphaInterval(rows.map((r) => Object.values(r.levels)));
  return {
    graders,
    stats: {
      itemCount: items.length,
      alphaInterval: alpha === null ? null : round(alpha),
      exactAgreement: round(exact / pairs),
      withinOneLevel: round(within1 / pairs),
      meanAbsPairDiff: round(absSum / pairs),
      needsDiscussion: rows.filter((r) => r.needsDiscussion).map((r) => r.id),
      goldDistribution: rows.reduce((acc, r) => ({ ...acc, [r.gold]: (acc[r.gold] ?? 0) + 1 }), {}),
      graderBias: Object.fromEntries(graders.map((g) => [g, {
        meanSigned: round(graderDev[g].signed / items.length, 2),
        meanAbs: round(graderDev[g].abs / items.length, 2),
      }])),
    },
    items: rows,
  };
}

// ── Lệnh ────────────────────────────────────────────────────────────────────────────────────

function competencyMeta() {
  const fw = JSON.parse(readFileSync(COMPETENCIES_PATH, "utf8"));
  return { fw, byKey: new Map(fw.competencies.map((c) => [c.key, c])) };
}

export function renderSheet(data, { fw, byKey }) {
  const levels = fw.levels
    .map((l) => `| ${l.score} | ${l.label} | ${l.descriptor}${l.note ? ` *(${l.note})*` : ""} |`)
    .join("\n");
  const items = data.items.map((it, i) => {
    const c = byKey.get(it.competencyId);
    return [
      `### ${i + 1}. \`${it.id}\` — ${c?.nameVi ?? it.competencyId}`,
      "",
      `**Câu hỏi:** ${it.question}`,
      "",
      `**Năng lực cần thấy:** ${c?.definition ?? ""}`,
      "",
      `> ${it.transcript}`,
      "",
      "Mức: `___`  Ghi chú: ______________________________",
    ].join("\n");
  }).join("\n\n---\n\n");
  return `# AI-01: Phiếu chấm bộ 20 câu trả lời chuẩn

> File sinh tự động bằng \`node src/scripts/ai01Benchmark.js sheet\` từ \`backend/src/data/ai01/answers.json\` (${data.version}). Không sửa tay.

## Cách chấm

1. **Chấm độc lập.** Không bàn với nhau, không xem điểm của người khác, không đưa câu trả lời cho AI chấm hộ. Bàn bạc chỉ diễn ra sau khi mọi người đã nộp.
2. Chấm **mức nguyên 0–4** cho từng câu theo bảng dưới (thang LP-01, \`config/competencies.json\`). **Không dùng mức 5**: mức 5 cần "nhất quán ở nhiều tình huống", một câu trả lời đơn lẻ không xét được.
3. Chỉ chấm **năng lực của câu hỏi đó** (ghi ở tiêu đề mỗi câu). Câu trả lời hay nhưng không thể hiện năng lực được hỏi thì mức thấp.
4. Chú ý: "chúng em / nhóm em đã…" mà không nói rõ phần việc của bản thân thì chưa đạt mức 3; câu dài không có nghĩa là tốt, phải có ví dụ cụ thể; không trả lời hoặc lạc đề hoàn toàn là mức 0.
5. Ghi chú ngắn lý do cho câu mình phân vân (không bắt buộc với câu rõ ràng).
6. Điền vào bản sao của \`backend/src/data/ai01/grades/${TEMPLATE_FILE}\`, đặt tên \`<tên-không-dấu>.csv\` (ví dụ \`van.csv\`), giữ nguyên cột \`id,level,note\`. Ghi chú có dấu phẩy thì bọc trong ngoặc kép.
7. Gửi file cho Janet (hoặc tạo PR vào nhánh \`feat/AI-01-benchmark-answers\`). Janet chạy \`npm run ai01:aggregate\` để ra điểm chuẩn và độ lệch; câu lệch từ ${DISCUSS_RANGE} mức trở lên sẽ được cả nhóm bàn lại.

## Thang 6 mức (LP-01)

| Mức | Nhãn | Mô tả |
|:---:|:-----|:------|
${levels}

**Ngưỡng đạt:** mức ${fw.passThreshold}.

## 20 câu trả lời

${items}
`;
}

export function templateCsv(data) {
  return ["id,level,note", ...data.items.map((it) => `${it.id},,`)].join("\n") + "\n";
}

function sheetCommand() {
  const data = loadAnswers();
  mkdirSync(path.dirname(SHEET_PATH), { recursive: true });
  mkdirSync(GRADES_DIR, { recursive: true });
  writeFileSync(SHEET_PATH, renderSheet(data, competencyMeta()), "utf8");
  writeFileSync(path.join(GRADES_DIR, TEMPLATE_FILE), templateCsv(data), "utf8");
  console.log(`Đã ghi ${path.relative(process.cwd(), SHEET_PATH)} và grades/${TEMPLATE_FILE}.`);
}

function aggregateCommand() {
  const data = loadAnswers();
  const ids = data.items.map((it) => it.id);
  const files = readdirSync(GRADES_DIR).filter((f) => f.endsWith(".csv") && f !== TEMPLATE_FILE);
  const grades = {};
  for (const f of files) {
    const grader = path.basename(f, ".csv");
    grades[grader] = parseGrades(readFileSync(path.join(GRADES_DIR, f), "utf8"), ids, grader);
  }
  const result = aggregateGrades(data.items, grades);
  const out = { version: data.version, generatedAt: new Date().toISOString(), ...result };
  writeFileSync(path.join(AI01_DIR, "gold.json"), `${JSON.stringify(out, null, 2)}\n`, "utf8");

  const s = result.stats;
  console.log(`Người chấm (${result.graders.length}): ${result.graders.join(", ")}`);
  if (result.graders.length < 3) console.warn("⚠️  Nên có ít nhất 3 người chấm để điểm chuẩn ổn định.");
  console.log(`Krippendorff alpha (interval): ${s.alphaInterval}  · trùng khớp: ${(s.exactAgreement * 100).toFixed(0)}%  · lệch ≤ 1 mức: ${(s.withinOneLevel * 100).toFixed(0)}%  · lệch TB mỗi cặp: ${s.meanAbsPairDiff}`);
  console.log("Phân bố điểm chuẩn:", s.goldDistribution);
  console.log("Độ lệch từng người so với chuẩn (+ là chấm cao hơn):", s.graderBias);
  console.log(s.needsDiscussion.length ? `Cần bàn lại (lệch ≥ ${DISCUSS_RANGE} mức): ${s.needsDiscussion.join(", ")}` : "Không câu nào lệch ≥ 2 mức.");
  console.log("Đã ghi backend/src/data/ai01/gold.json.");
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === "sheet") return sheetCommand();
  if (cmd === "aggregate") return aggregateCommand();
  console.error("Cách dùng: node src/scripts/ai01Benchmark.js <sheet|aggregate>");
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
