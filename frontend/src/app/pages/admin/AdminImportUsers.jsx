import { useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router";
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronLeft,
  Users,
  AlertTriangle,
  Download,
  Trash2,
  Play,
  RotateCcw,
} from "lucide-react";
import { adminApi } from "../../api/adminApi.js";

const FIELD_OPTIONS = [
  "IT / Công nghệ",
  "Marketing",
  "Tài chính / Kế toán",
  "Nhân sự",
  "Quản lý sản phẩm",
  "Thiết kế / UX",
  "Kinh doanh",
  "Vận hành",
  "Biên - Phiên dịch / Ngoại ngữ",
];

const DEFAULT_FIELD = "IT / Công nghệ";

const DRIVE_URL_RE = /^https?:\/\//i;

/** Đoán field chuẩn (1 trong 8) từ ngành học tự do trong Google Form. Admin vẫn sửa tay được. */
const FIELD_KEYWORD_MAP = [
  { field: "IT / Công nghệ", keywords: ["software", "information technology", "công nghệ", "computer", "developer", "engineering", "security", "data science", " ai", "programming", "kỹ thuật"] },
  { field: "Marketing", keywords: ["marketing", "truyền thông", "communication", "comunication", "public relation", "quan hệ công chúng"] },
  { field: "Tài chính / Kế toán", keywords: ["finance", "tài chính", "kế toán", "accounting", "banking", "ngân hàng"] },
  { field: "Nhân sự", keywords: ["human resource", "nhân sự"] },
  { field: "Quản lý sản phẩm", keywords: ["product manage", "quản lý sản phẩm", "product owner"] },
  { field: "Thiết kế / UX", keywords: ["design", "thiết kế", "graphic"] },
  { field: "Kinh doanh", keywords: ["business", "international business", "business administration", "ib", "ba", "kinh doanh", "sale", "thương mại", "analytics"] },
  { field: "Vận hành", keywords: ["operation", "vận hành", "logistics", "supply chain", "chuỗi cung ứng"] },
  { field: "Biên - Phiên dịch / Ngoại ngữ", keywords: ["ngôn ngữ anh", "ngôn ngữ", "ngoại ngữ", "english language", "foreign language", "linguistics", "biên phiên dịch", "phiên dịch", "translation and interpretation"] },
];

/** So khớp theo ranh giới từ, tránh khớp nhầm chuỗi con (vd. "it" bên trong "digital"). */
function keywordMatches(text, keyword) {
  const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(text);
}

/** Trả { field, confident }: confident=false nghĩa là KHÔNG khớp từ khóa nào, chỉ rơi vào mặc định —
 * phân tích CV với field này gần như chắc chắn ra điểm rất thấp/0 vì kỹ năng CV không liên quan field. */
function guessField(rawMajor) {
  const s = String(rawMajor || "").trim();
  if (!s) return { field: DEFAULT_FIELD, confident: false };
  for (const { field, keywords } of FIELD_KEYWORD_MAP) {
    if (keywords.some((k) => keywordMatches(s, k))) return { field, confident: true };
  }
  return { field: DEFAULT_FIELD, confident: false };
}

/**
 * Parse raw CSV text into array of objects.
 * Header dò linh hoạt theo từ khóa — hỗ trợ cả CSV mẫu tự tạo (email,name,filename,field)
 * lẫn CSV xuất thẳng từ Google Sheet phản hồi form (Họ và tên, Email, Chuyên ngành của bạn, Upload CV của bạn).
 * Cột CV có thể là tên file cục bộ (khớp với file PDF admin chọn) hoặc link Google Drive (tự tải trên server).
 */
function parseCsv(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const findCol = (keywords) => headers.findIndex((h) => keywords.some((k) => h.includes(k)));
  const emailIdx = findCol(["email"]);
  const nameIdx = findCol(["họ và tên", "họ tên", "name"]);
  const cvIdx = findCol(["filename", "tên file", "upload cv", "link cv", "cv"]);
  const fieldIdx = findCol(["chuyên ngành", "ngành", "field"]);
  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const rawMajor = fieldIdx >= 0 ? cols[fieldIdx] : "";
    const { field, confident } = guessField(rawMajor);
    return {
      email: emailIdx >= 0 ? cols[emailIdx] || "" : "",
      name: nameIdx >= 0 ? cols[nameIdx] || "" : "",
      cvRef: cvIdx >= 0 ? cols[cvIdx] || "" : "",
      field,
      fieldConfident: confident,
      rawMajor,
    };
  }).filter((r) => r.email);
}

const STATUS_ICON = {
  pending: null,
  running: <Loader2 className="w-4 h-4 animate-spin text-violet-600" />,
  success: <CheckCircle className="w-4 h-4 text-emerald-500" />,
  error: <XCircle className="w-4 h-4 text-red-500" />,
};

const STATUS_ROW_BG = {
  pending: "",
  running: "bg-violet-50/60",
  success: "bg-emerald-50/50",
  error: "bg-red-50/40",
};

export function AdminImportUsers() {
  const navigate = useNavigate();
  const csvInputRef = useRef(null);
  const pdfInputRef = useRef(null);

  // rows: [{ email, name, field, cvRef, status, message, analysisId, matchScore }]
  // cvRef: tên file PDF cục bộ (khớp pdfFiles) hoặc link Google Drive (bắt đầu bằng http)
  const [rows, setRows] = useState([]);
  const [pdfFiles, setPdfFiles] = useState({}); // filename → File object
  const [running, setRunning] = useState(false);
  const [csvError, setCsvError] = useState("");
  const [batchSize] = useState(2);

  // ── Drag-and-drop CSV ──────────────────────────────────────────────────────
  const [dragOver, setDragOver] = useState(false);

  const handleCsvFile = useCallback((file) => {
    setCsvError("");
    if (!file) return;
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setCsvError("Chỉ hỗ trợ file .csv");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const parsed = parseCsv(e.target.result);
      if (parsed.length === 0) {
        setCsvError("Không đọc được dòng dữ liệu nào. Kiểm tra định dạng CSV.");
        return;
      }
      setRows(parsed.map((r) => ({ ...r, status: "pending", message: "", analysisId: null, matchScore: null })));
    };
    reader.readAsText(file, "utf-8");
  }, []);

  const handlePdfFiles = useCallback((files) => {
    const map = {};
    for (const f of files) map[f.name] = f;
    setPdfFiles((prev) => ({ ...prev, ...map }));
  }, []);

  // ── Manual row add ─────────────────────────────────────────────────────────
  const addRow = () =>
    setRows((prev) => [
      ...prev,
      { email: "", name: "", field: DEFAULT_FIELD, fieldConfident: true, cvRef: "", status: "pending", message: "", analysisId: null, matchScore: null },
    ]);

  const updateRow = (idx, key, value) =>
    setRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, [key]: value, ...(key === "field" ? { fieldConfident: true } : {}) } : r,
      ),
    );

  const removeRow = (idx) => setRows((prev) => prev.filter((_, i) => i !== idx));

  // ── Run import ─────────────────────────────────────────────────────────────
  const startImport = async () => {
    const validRows = rows.filter((r) => r.email && r.status !== "success");
    if (validRows.length === 0) return;
    setRunning(true);

    const pending = rows.map((r, i) => ({ ...r, _idx: i })).filter((r) => r.email && r.status !== "success");

    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async ({ _idx, email, name, field, cvRef }) => {
          const isDriveUrl = DRIVE_URL_RE.test(cvRef || "");
          const cvFile = isDriveUrl ? null : pdfFiles[cvRef] ?? null;

          // Mark as running
          setRows((prev) => prev.map((r, ri) => ri === _idx ? { ...r, status: "running", message: "Đang xử lý..." } : r));

          if (!isDriveUrl && !cvFile) {
            setRows((prev) =>
              prev.map((r, ri) =>
                ri === _idx
                  ? { ...r, status: "error", message: `Không tìm thấy file PDF "${cvRef || "(chưa chọn)"}"` }
                  : r,
              ),
            );
            return;
          }

          const res = await adminApi.importUserCv({
            email,
            name,
            field: field || DEFAULT_FIELD,
            ...(isDriveUrl ? { cvUrl: cvRef } : { file: cvFile }),
          });
          setRows((prev) =>
            prev.map((r, ri) =>
              ri === _idx
                ? {
                    ...r,
                    status: res.success ? "success" : "error",
                    message: res.success ? res.message : res.error,
                    analysisId: res.analysisId ?? null,
                    matchScore: res.matchScore ?? null,
                  }
                : r,
            ),
          );
        }),
      );
    }
    setRunning(false);
  };

  const resetAll = () => {
    setRows([]);
    setPdfFiles({});
    setCsvError("");
  };

  const totalRows = rows.length;
  const successCount = rows.filter((r) => r.status === "success").length;
  const errorCount = rows.filter((r) => r.status === "error").length;
  const pendingCount = rows.filter((r) => r.status === "pending").length;
  const runningCount = rows.filter((r) => r.status === "running").length;
  const uncertainFieldCount = rows.filter((r) => r.fieldConfident === false && r.status !== "success").length;
  const canStart = !running && rows.some((r) => r.email && r.status !== "success");

  const overallProgress = totalRows > 0 ? Math.round(((successCount + errorCount) / totalRows) * 100) : 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* ── Header ── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate("/admin/users")}
            className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-violet-700 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" /> Quay lại Người dùng
          </button>
          <h2 className="font-headline text-3xl font-black uppercase tracking-tighter text-slate-900">
            Nhập từ <span className="text-violet-700">Google Form</span>
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-600">
            Tạo tài khoản và phân tích CV hàng loạt trước ngày ra mắt sản phẩm.
          </p>
        </div>

        {/* Stats */}
        {totalRows > 0 && (
          <div className="flex items-center gap-3 flex-wrap">
            <StatBadge label="Tổng" value={totalRows} color="slate" />
            <StatBadge label="Thành công" value={successCount} color="emerald" />
            <StatBadge label="Lỗi" value={errorCount} color="red" />
            <StatBadge label="Chờ" value={pendingCount + runningCount} color="violet" />
            {uncertainFieldCount > 0 && (
              <StatBadge label="Ngành chưa chắc chắn" value={uncertainFieldCount} color="amber" />
            )}
          </div>
        )}
      </div>

      {/* ── Step 1: CSV Upload ── */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">1</span>
            Tải lên danh sách CSV
          </h3>
          <a
            href="data:text/csv;charset=utf-8,email%2Cname%2Cfilename%2Cfield%0Anguyen%40example.com%2CNguy%E1%BB%85n%20V%C4%83n%20A%2Anguyen_cv.pdf%2CIT%20%2F%20C%C3%B4ng%20ngh%E1%BB%87"
            download="import_template.csv"
            className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:underline"
          >
            <Download className="w-3.5 h-3.5" /> Tải file mẫu
          </a>
        </div>

        <p className="text-xs text-slate-500">
          File CSV cần có cột: <code className="rounded bg-slate-100 px-1.5 py-0.5">email</code>,{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5">name</code>,{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5">filename</code> (tên file PDF cục bộ HOẶC link Google Drive),{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5">field</code> (ngành nghề). Cũng nhận trực tiếp file CSV xuất
          từ Google Sheet phản hồi form ("Họ và tên", "Email", "Chuyên ngành của bạn", "Upload CV của bạn") — hệ thống tự dò cột và
          đoán field từ ngành học (có thể sửa lại ở bảng bên dưới). File Drive cần đặt quyền chia sẻ{" "}
          <strong>"Bất kỳ ai có link"</strong> để hệ thống tải được.
        </p>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handleCsvFile(f);
          }}
          onClick={() => csvInputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all ${
            dragOver ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:border-violet-300 hover:bg-slate-50/60"
          }`}
        >
          <FileText className="mx-auto mb-2 w-8 h-8 text-slate-300" />
          <p className="text-sm font-semibold text-slate-600">
            Kéo thả file CSV vào đây hoặc <span className="text-violet-600">chọn file</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">Chỉ hỗ trợ .csv (UTF-8)</p>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleCsvFile(e.target.files?.[0])} />
        </div>

        {csvError && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {csvError}
          </div>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-4 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 transition-colors"
          >
            <Users className="w-3.5 h-3.5" /> Thêm dòng thủ công
          </button>
        </div>
      </div>

      {/* ── Step 2: PDF Upload ── */}
      <div className="glass-card p-6 space-y-4">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">
          <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">2</span>
          Chọn các file PDF CV (chỉ cần cho dòng dùng tên file, bỏ qua nếu CSV đã là link Drive)
        </h3>
        <p className="text-xs text-slate-500">
          Chọn nhiều file cùng lúc. Tên file phải khớp với cột CV trong CSV. Các dòng có link Google Drive sẽ tự tải,
          không cần chọn file ở đây.
        </p>

        <button
          type="button"
          onClick={() => pdfInputRef.current?.click()}
          className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 px-6 py-5 w-full text-center hover:border-violet-300 hover:bg-slate-50 transition-all"
        >
          <Upload className="w-5 h-5 text-violet-500" />
          <span className="text-sm font-semibold text-slate-600">
            Chọn file PDF CV ({Object.keys(pdfFiles).length} đã chọn)
          </span>
          <input
            ref={pdfInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => handlePdfFiles(Array.from(e.target.files || []))}
          />
        </button>

        {Object.keys(pdfFiles).length > 0 && (
          <div className="flex flex-wrap gap-2">
            {Object.keys(pdfFiles).map((fname) => (
              <span key={fname} className="flex items-center gap-1.5 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700">
                <FileText className="w-3.5 h-3.5" /> {fname}
                <button type="button" onClick={() => setPdfFiles((p) => { const copy = { ...p }; delete copy[fname]; return copy; })} className="ml-1 text-violet-400 hover:text-red-500">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Step 3: Preview Table ── */}
      {rows.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-700">
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-black text-white">3</span>
              Danh sách import ({rows.length} người)
            </h3>
            <button
              type="button"
              onClick={resetAll}
              disabled={running}
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-red-500 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" /> Xóa tất cả
            </button>
          </div>

          {/* Progress Bar */}
          {(running || successCount + errorCount > 0) && (
            <div className="border-b border-slate-100 px-6 py-3">
              <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-600">
                <span>Tiến trình: {successCount + errorCount}/{totalRows}</span>
                <span>{overallProgress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${overallProgress}%`, background: errorCount > 0 ? "#f87171" : "#8037f4" }}
                />
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-5 py-3 font-black uppercase tracking-widest text-slate-400">#</th>
                  <th className="px-5 py-3 font-black uppercase tracking-widest text-slate-400">Email</th>
                  <th className="px-5 py-3 font-black uppercase tracking-widest text-slate-400">Họ tên</th>
                  <th className="px-5 py-3 font-black uppercase tracking-widest text-slate-400">Ngành</th>
                  <th className="px-5 py-3 font-black uppercase tracking-widest text-slate-400">File PDF</th>
                  <th className="px-5 py-3 text-center font-black uppercase tracking-widest text-slate-400">Điểm</th>
                  <th className="px-5 py-3 font-black uppercase tracking-widest text-slate-400">Trạng thái</th>
                  <th className="px-5 py-3 font-black uppercase tracking-widest text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, idx) => (
                  <tr key={idx} className={`transition-colors ${STATUS_ROW_BG[row.status]}`}>
                    <td className="px-5 py-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-5 py-3">
                      <input
                        value={row.email}
                        onChange={(e) => updateRow(idx, "email", e.target.value)}
                        disabled={row.status === "running" || row.status === "success"}
                        placeholder="email@example.com"
                        className="w-40 rounded-lg border border-slate-200 bg-transparent px-2 py-1 text-xs text-slate-800 outline-none focus:border-violet-400 disabled:opacity-50"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <input
                        value={row.name}
                        onChange={(e) => updateRow(idx, "name", e.target.value)}
                        disabled={row.status === "running" || row.status === "success"}
                        placeholder="Họ và tên"
                        className="w-36 rounded-lg border border-slate-200 bg-transparent px-2 py-1 text-xs text-slate-800 outline-none focus:border-violet-400 disabled:opacity-50"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <select
                        value={row.field}
                        onChange={(e) => updateRow(idx, "field", e.target.value)}
                        disabled={row.status === "running" || row.status === "success"}
                        className={`w-44 rounded-lg border bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-violet-400 disabled:opacity-50 ${
                          row.fieldConfident === false ? "border-amber-400" : "border-slate-200"
                        }`}
                      >
                        {FIELD_OPTIONS.map((f) => <option key={f}>{f}</option>)}
                      </select>
                      {row.fieldConfident === false && (
                        <span
                          className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-600"
                          title={`Ngành gốc "${row.rawMajor || "(trống)"}" không khớp field nào — rơi vào mặc định, điểm phân tích có thể rất thấp. Kiểm tra/sửa tay.`}
                        >
                          <AlertTriangle className="w-3 h-3 shrink-0" /> Chưa chắc chắn
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <input
                        value={row.cvRef}
                        onChange={(e) => updateRow(idx, "cvRef", e.target.value)}
                        disabled={row.status === "running" || row.status === "success"}
                        placeholder="tên_file.pdf hoặc link Drive"
                        className="mb-1 w-40 rounded-lg border border-slate-200 bg-transparent px-2 py-1 text-xs text-slate-800 outline-none focus:border-violet-400 disabled:opacity-50"
                      />
                      {DRIVE_URL_RE.test(row.cvRef || "") ? (
                        <span className="flex items-center gap-1 text-violet-600">
                          <CheckCircle className="w-3.5 h-3.5" /> Link Drive
                        </span>
                      ) : pdfFiles[row.cvRef] ? (
                        <span className="flex items-center gap-1 text-emerald-600">
                          <CheckCircle className="w-3.5 h-3.5" /> Đã có file
                        </span>
                      ) : (
                        <span className="text-slate-400">{row.cvRef ? "Chưa khớp file" : "—"}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center font-bold text-violet-700">
                      {row.matchScore != null ? row.matchScore : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        {STATUS_ICON[row.status]}
                        <span className={`font-medium ${row.status === "error" ? "text-red-600" : row.status === "success" ? "text-emerald-600" : "text-slate-500"}`}>
                          {row.message || { pending: "Chờ", running: "Đang xử lý...", success: "Hoàn tất", error: "Lỗi" }[row.status]}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      {row.status !== "running" && row.status !== "success" && (
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          disabled={running}
                          className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-5">
            <button
              type="button"
              onClick={() => setRows((prev) => prev.map((r) => r.status === "error" ? { ...r, status: "pending", message: "" } : r))}
              disabled={running || errorCount === 0}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-40"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Thử lại các dòng lỗi
            </button>

            <button
              type="button"
              onClick={startImport}
              disabled={!canStart}
              className={`flex items-center gap-2 rounded-2xl px-8 py-3 text-sm font-extrabold transition-all ${
                canStart
                  ? "bg-gradient-to-r from-violet-600 to-violet-700 text-white shadow-lg shadow-violet-500/30 hover:brightness-105"
                  : "cursor-not-allowed bg-slate-100 text-slate-400"
              }`}
            >
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? "Đang nhập..." : "Bắt đầu Import"}
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="glass-card flex flex-col items-center justify-center px-6 py-20 text-center">
          <Users className="mx-auto mb-4 h-14 w-14 text-slate-200" />
          <p className="font-bold text-slate-700">Chưa có danh sách import</p>
          <p className="mt-1 text-sm text-slate-400">Tải lên file CSV hoặc thêm dòng thủ công để bắt đầu.</p>
        </div>
      )}
    </div>
  );
}

function StatBadge({ label, value, color }) {
  const colors = {
    slate: "bg-slate-100 text-slate-600",
    emerald: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    red: "bg-red-50 text-red-700 border border-red-200",
    violet: "bg-violet-50 text-violet-700 border border-violet-200",
    amber: "bg-amber-50 text-amber-700 border border-amber-200",
  };
  return (
    <div className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black ${colors[color]}`}>
      <span>{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
