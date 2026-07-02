import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router";
import { Loader2 } from "lucide-react";
import { isLoggedIn } from "../../utils/auth/auth.js";
import { buildLoginPath } from "../../utils/auth/authGate.js";
import { fetchCvAnalysisById } from "../../api/cvApi.js";
import { CVAnalysisResultContent } from "../../components/cv/CVAnalysisResultContent";
import { CvJdAnalysisPage } from "../../components/cv/CvJdAnalysisFrame";
import {
  CV_FIELD_ANALYSIS_PATH,
  CV_FIELD_HISTORY_PATH,
  CV_JD_ANALYSIS_PATH,
  CV_JD_HISTORY_PATH,
  cvAnalysisResultPath,
} from "../../components/cv/CvJdAnalysisTabs";

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
    <CvJdAnalysisPage showTabs={false} showHeader={false}>
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#8037f4]" />
        </div>
      )}

      {!loading && loadError && (
        <div className="px-6 py-12 text-center sm:px-8">
          <p className="text-sm font-medium text-slate-700">{loadError}</p>
          <button
            type="button"
            onClick={() => navigate(analysisPath)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#8037f4] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Mở trang phân tích
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
    </CvJdAnalysisPage>
  );
}
