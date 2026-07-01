import React, { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { FileText, Briefcase, Eye, ChevronLeft, ChevronRight } from "lucide-react";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

// ─── Single document panel ───────────────────────────────────────────────────
export function DocPanel({ title, fileName, icon, accentColor, file, matchedKws, missingKws, showHeader = true, maxHeight = 460 }) {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [width, setWidth] = useState(null);

  const containerRef = useCallback(node => {
    if (node) setWidth(node.getBoundingClientRect().width);
  }, []);

  return (
    <div className="flex flex-col overflow-hidden">
      {showHeader && (
        <div
          className="px-4 py-2.5 flex items-center gap-2.5 flex-shrink-0"
          style={{ background: accentColor }}
        >
          <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-semibold leading-tight">{title}</p>
            <p className="text-white/70 text-[0.67rem] truncate">{fileName}</p>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            {matchedKws.length > 0 && (
              <span className="rounded-full px-2.5 py-0.5 text-[0.64rem] font-bold shadow-sm" style={{ background: "#dcfce7", color: "#14532d", border: "1px solid #22c55e" }}>
                ✓ {matchedKws.length} khớp
              </span>
            )}
            {missingKws.length > 0 && (
              <span className="rounded-full px-2.5 py-0.5 text-[0.64rem] font-bold shadow-sm" style={{ background: "#ffedd5", color: "#9a3412", border: "1px solid #ea580c" }}>
                ✗ {missingKws.length} thiếu
              </span>
            )}
          </div>
        </div>
      )}

      <div ref={containerRef} className="flex-1 overflow-y-auto bg-gray-50" style={{ minHeight: 0, maxHeight }}>
        {file && width ? (
          <Document
            file={file}
            onLoadSuccess={({ numPages }) => { setNumPages(numPages); setPageNumber(1); }}
            loading={
              <div className="flex items-center justify-center py-20 text-sm text-gray-400">
                Đang tải PDF…
              </div>
            }
            error={
              <div className="flex items-center justify-center py-20 text-sm text-red-400">
                Không thể đọc file PDF
              </div>
            }
          >
            {Array.from({ length: numPages ?? 0 }, (_, i) => (
              <Page
                key={i + 1}
                pageNumber={i + 1}
                width={width - 8}
                renderAnnotationLayer={false}
              />
            ))}
          </Document>
        ) : (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">
            Chưa có file PDF
          </div>
        )}
      </div>

      {showHeader && numPages && numPages > 1 && (
        <div className="flex items-center justify-center gap-3 py-1.5 border-t border-gray-100 bg-white flex-shrink-0">
          <button
            onClick={() => setPageNumber(p => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-xs text-gray-500 font-medium">
            {pageNumber} / {numPages}
          </span>
          <button
            onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function CVDocumentPreview({
  cvFile, jdFile,
  cvFileUrl, jdFileUrl,
  cvFileName, jdFileName,
  matchedKws = [],
  missingKws = [],
}) {
  const cvSource = cvFile || cvFileUrl || null;
  const jdSource = jdFile || jdFileUrl || null;
  const total = matchedKws.length + missingKws.length;

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2.5">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-md"
          style={{ background: "rgba(128,55,244,0.1)" }}
        >
          <Eye className="h-4 w-4" style={{ color: "#8037f4" }} />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900" style={{ fontSize: "0.9rem" }}>
            Xem CV & JD
          </h3>
          <p className="text-gray-400" style={{ fontSize: "0.75rem" }}>
            <span className="font-medium text-green-600">{matchedKws.length} khớp</span>
            {" · "}
            <span className="font-medium text-orange-500">{missingKws.length} thiếu trong CV</span>
            {" · "}
            {total} từ khóa JD
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <DocPanel
          title="CV của bạn"
          fileName={cvFileName || "cv.pdf"}
          icon={<FileText className="w-4 h-4 text-white" />}
          accentColor="linear-gradient(135deg, #4F46E5, #7C3AED)"
          file={cvSource}
          matchedKws={matchedKws}
          missingKws={missingKws}
        />
        <DocPanel
          title="Job Description"
          fileName={jdFileName || "jd.pdf"}
          icon={<Briefcase className="w-4 h-4 text-white" />}
          accentColor="linear-gradient(135deg, #7C3AED, #9333ea)"
          file={jdSource}
          matchedKws={matchedKws}
          missingKws={missingKws}
        />
      </div>
    </div>
  );
}
