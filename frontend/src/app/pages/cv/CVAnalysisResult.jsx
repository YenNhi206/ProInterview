import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router";
import { Loader2 } from "lucide-react";
import { isLoggedIn } from "../../utils/auth/auth.js";
import { buildLoginPath } from "../../utils/auth/authGate.js";
import { fetchCvAnalysisById } from "../../api/cvApi.js";
import { CVAnalysisResultContent } from "../../components/cv/CVAnalysisResultContent";
import {
  CV_FIELD_ANALYSIS_PATH,
  CV_FIELD_HISTORY_PATH,
  CV_JD_ANALYSIS_PATH,
  CV_JD_HISTORY_PATH,
  cvAnalysisResultPath,
} from "../../components/cv/CvJdAnalysisTabs";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";

export function CVAnalysisResult() {
  const navigate = useNavigate();
  const location = useLocation();
  const { analysisId: paramId } = useParams();

  const routeMode = location.pathname.includes("/cv-analysis/field") ? "field" : "jd";
  const analysisPath = routeMode === "field" ? CV_FIELD_ANALYSIS_PATH : CV_JD_ANALYSIS_PATH;
  const historyPath = routeMode === "field" ? CV_FIELD_HISTORY_PATH : CV_JD_HISTORY_PATH;
  const loginReturnPath = cvAnalysisResultPath(routeMode, paramId);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [resultReady, setResultReady] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [savedFileInfo, setSavedFileInfo] = useState(null);
  const [historySaveWarning, setHistorySaveWarning] = useState(null);
  const [cvFile, setCvFile] = useState(null);
  const [jdFile, setJdFile] = useState(null);

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate(buildLoginPath(loginReturnPath), { replace: true });
      return;
    }

    const state = location.state;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(null);

      if (state && Object.prototype.hasOwnProperty.call(state, "analysis")) {
        setAnalysisResult(state.analysis);
        setSavedFileInfo(state.savedFileInfo ?? null);
        setHistorySaveWarning(state.historySaveWarning ?? null);
        setCvFile(state.cvFile ?? null);
        setJdFile(state.jdFile ?? null);
        setResultReady(true);
        setLoading(false);
        return;
      }

      const id = paramId || state?.viewHistoryId;
      if (!id) {
        setLoadError("Không có dữ liệu kết quả, hãy phân tích CV trước.");
        setLoading(false);
        return;
      }

      const res = await fetchCvAnalysisById(id);
      if (cancelled) return;
      if (!res.success || !res.analysis) {
        setLoadError(res.error || "Không tải được kết quả phân tích.");
        setLoading(false);
        return;
      }

      setAnalysisResult(res.analysis);
      setSavedFileInfo({
        analysisId: res.analysisId,
        cvFileName: res.historyItem?.cvFileName || res.historyItem?.cvFile || "cv.pdf",
        jdFileName: res.historyItem?.jdFileName || res.historyItem?.jdFile || null,
        cvFileUrl: res.analysis?.cvFileUrl ?? null,
        jdFileUrl: res.analysis?.jdFileUrl ?? null,
      });
      setResultReady(true);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [paramId, location.state, navigate, loginReturnPath]);

  return (
    <div className={`relative z-[1] min-h-[calc(100svh-76px)] pb-20 pt-6 sm:pt-8 text-[#f0edf7] ${CUSTOMER_SHELL_GUTTER}`}>
      <div className={CUSTOMER_SHELL_MAX}>
        {loading && (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-16 w-16 animate-ping rounded-full bg-violet-400/20" />
              <div className="h-14 w-14 rounded-2xl bg-white/[0.06] backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-lg shadow-violet-500/10">
                <Loader2 className="h-7 w-7 animate-spin text-violet-400" />
              </div>
            </div>
            <p className="mt-5 text-base font-bold text-white">Đang tổng hợp báo cáo phân tích...</p>
            <p className="text-xs text-slate-400 mt-1">Đang trích xuất điểm số, từ khóa và đề xuất cải thiện</p>
          </div>
        )}

        {!loading && loadError && (
          <div className="mx-auto max-w-lg rounded-3xl border border-rose-500/30 bg-gradient-to-br from-[#1c183f]/90 via-[#13112c]/90 to-[#0e0c24]/95 p-8 text-center shadow-xl shadow-rose-950/20 backdrop-blur-xl my-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 mb-4">
              <Loader2 className="h-6 w-6 stroke-[2.5]" />
            </div>
            <h2 className="text-lg font-bold text-white">Không tìm thấy kết quả phân tích</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{loadError}</p>
            <button
              type="button"
              onClick={() => navigate(analysisPath)}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/25 transition-transform hover:-translate-y-0.5 active:translate-y-0"
            >
              Mở trang phân tích mới
            </button>
          </div>
        )}

        {!loading && !loadError && resultReady && (
          <CVAnalysisResultContent
            routeMode={routeMode}
            analysisResult={analysisResult}
            historySaveWarning={historySaveWarning}
            cvFile={cvFile}
            jdFile={jdFile}
            cvFileName={savedFileInfo?.cvFileName ?? cvFile?.name}
            jdFileName={savedFileInfo?.jdFileName ?? jdFile?.name}
            cvFileUrl={savedFileInfo?.cvFileUrl ?? analysisResult?.cvFileUrl}
            jdFileUrl={savedFileInfo?.jdFileUrl ?? analysisResult?.jdFileUrl}
            analysisPath={analysisPath}
            historyPath={historyPath}
            analysisId={savedFileInfo?.analysisId ?? paramId ?? null}
          />
        )}
      </div>
    </div>
  );
}
