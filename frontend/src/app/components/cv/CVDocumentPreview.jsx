import React, { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { FileText, Briefcase, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, CheckCircle2, AlertCircle } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const ZOOM_MIN = 0.75;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.15;

// ─── Single document panel ───────────────────────────────────────────────────
export function DocPanel({
  title,
  fileName,
  icon,
  accentGradient,
  file,
  matchedKws,
  missingKws,
  showHeader = true,
  maxHeight = 720,
}) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [width, setWidth] = useState(null);
  const [zoom, setZoom] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= 640 ? 1.75 : 1
  );

  const containerRef = useCallback((node) => {
    if (node) setWidth(node.getBoundingClientRect().width);
  }, []);

  const zoomIn = () => setZoom((z) => Math.min(ZOOM_MAX, +(z + ZOOM_STEP).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(ZOOM_MIN, +(z - ZOOM_STEP).toFixed(2)));

  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-gradient-to-b from-[#181538]/70 via-[#13112b]/75 to-[#0d0b21]/80 shadow-[0_12px_40px_rgba(0,0,0,0.4)] backdrop-blur-2xl overflow-hidden transition-all duration-300">
      {showHeader && (
        <div className={`px-4 py-3 flex items-center gap-3 flex-shrink-0 text-white shadow-sm ${accentGradient}`}>
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 shadow-inner">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs sm:text-sm font-bold tracking-tight leading-tight">{title}</p>
            <p className="text-white/80 text-[11px] truncate font-medium mt-0.5">{fileName || "Tài liệu"}</p>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {matchedKws.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-emerald-500/25 border border-emerald-300/40 text-emerald-100 backdrop-blur-sm">
                <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                {matchedKws.length} khớp
              </span>
            )}
            {missingKws.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-amber-500/25 border border-amber-300/40 text-amber-100 backdrop-blur-sm">
                <AlertCircle className="w-3 h-3 text-amber-300" />
                {missingKws.length} thiếu
              </span>
            )}
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-[#0a081a]/90 p-2"
        style={{ minHeight: 400, maxHeight }}
      >
        {file && width ? (
          <Document
            file={file}
            onLoadSuccess={({ numPages: total }) => {
              setNumPages(total);
              setPageNumber(1);
            }}
            loading={
              <div className="flex flex-col items-center justify-center py-24 text-sm text-slate-400 gap-2">
                <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                <span>Đang tải nội dung PDF…</span>
              </div>
            }
            error={
              <div className="flex items-center justify-center py-24 text-sm text-rose-400 font-medium">
                Không thể đọc file PDF hoặc định dạng không hỗ trợ.
              </div>
            }
          >
            {Array.from({ length: numPages ?? 0 }, (_, i) => (
              <div key={i + 1} className="mb-3 last:mb-0 shadow-md rounded-lg overflow-hidden border border-white/10">
                <Page
                  pageNumber={i + 1}
                  width={(width - 24) * zoom}
                  renderAnnotationLayer={false}
                />
              </div>
            ))}
          </Document>
        ) : (
          <div className="flex flex-col items-center justify-center py-28 text-slate-400 text-sm">
            <FileText className="w-10 h-10 text-slate-500 mb-2 stroke-1" />
            <p className="font-medium text-slate-300">Chưa có dữ liệu xem trước</p>
            <p className="text-xs text-slate-500 mt-0.5">Không tìm thấy bản tài liệu PDF khả dụng</p>
          </div>
        )}
      </div>

      {showHeader && file && width && (
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-t border-white/10 bg-[#14122e]/95 backdrop-blur-md flex-shrink-0">
          <div className="flex items-center gap-1.5 bg-white/[0.06] rounded-xl p-1 border border-white/10">
            <button
              onClick={zoomOut}
              disabled={zoom <= ZOOM_MIN}
              aria-label="Thu nhỏ"
              className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-30 transition-all shadow-none"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-200 font-bold w-12 text-center select-none tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={zoomIn}
              disabled={zoom >= ZOOM_MAX}
              aria-label="Phóng to"
              className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-30 transition-all shadow-none"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {numPages && numPages > 1 && (
            <div className="flex items-center gap-1.5 bg-white/[0.06] rounded-xl p-1 border border-white/10">
              <button
                onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                disabled={pageNumber <= 1}
                aria-label="Trang trước"
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-30 transition-all shadow-none"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs text-slate-200 font-bold px-1 select-none tabular-nums">
                {pageNumber} / {numPages}
              </span>
              <button
                onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
                disabled={pageNumber >= numPages}
                aria-label="Trang sau"
                className="p-1 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white disabled:opacity-30 transition-all shadow-none"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function CVDocumentPreview({
  cvFile,
  jdFile,
  cvFileUrl,
  jdFileUrl,
  cvFileName,
  jdFileName,
  matchedKws = [],
  missingKws = [],
}) {
  const cvSource = cvFile || cvFileUrl || null;
  const jdSource = jdFile || jdFileUrl || null;

  return (
    <div className="w-full">
      <div className="grid gap-6 lg:grid-cols-2">
        <DocPanel
          title="CV của bạn"
          fileName={cvFileName || "cv.pdf"}
          icon={<FileText className="w-4 h-4 text-white" />}
          accentGradient="bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-700"
          file={cvSource}
          matchedKws={matchedKws}
          missingKws={missingKws}
        />
        <DocPanel
          title="Job Description (JD)"
          fileName={jdFileName || "jd.pdf"}
          icon={<Briefcase className="w-4 h-4 text-white" />}
          accentGradient="bg-gradient-to-r from-indigo-700 via-purple-700 to-fuchsia-700"
          file={jdSource}
          matchedKws={matchedKws}
          missingKws={missingKws}
        />
      </div>
    </div>
  );
}
