import { INTERVIEW_HISTORY, CV_ANALYSIS_HISTORY } from "../data/mockData";

const CV_HISTORY_KEY = "prointerview_cv_history";
const INTERVIEW_HISTORY_KEY = "prointerview_interview_history";

function seedIfEmpty(key, defaultData) {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) {
      localStorage.setItem(key, JSON.stringify(defaultData));
      return defaultData;
    }
    return JSON.parse(stored);
  } catch {
    return defaultData;
  }
}

export function getCVAnalysisHistory() {
  return seedIfEmpty(CV_HISTORY_KEY, CV_ANALYSIS_HISTORY);
}

export function getStoredInterviewHistory() {
  return seedIfEmpty(INTERVIEW_HISTORY_KEY, INTERVIEW_HISTORY);
}

export function addCVAnalysisRecord(record) {
  try {
    const history = getCVAnalysisHistory();
    const updated = [record, ...history];
    localStorage.setItem(CV_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [record];
  }
}

export function addInterviewRecord(record) {
  try {
    const history = getStoredInterviewHistory();
    const updated = [record, ...history];
    localStorage.setItem(INTERVIEW_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [record];
  }
}

// Get latest CV analysis for reuse
export function getLatestCVAnalysis() {
  const history = getCVAnalysisHistory();
  return history.length > 0 ? history[0] : null;
}

// Get stored CV file
const CV_FILE_KEY = "prointerview_cv_file";
const JD_FILE_KEY = "prointerview_jd_file";
const CV_UPLOADS_KEY = "prointerview_cv_uploads";
const JD_UPLOADS_KEY = "prointerview_jd_uploads";

// ─── CV Uploads Management ─────────────────────────────────────────
export function saveUploadedCV(file) {
  const uploadedFile = {
    id: `cv-${Date.now()}`,
    name: file.name,
    size: file.size,
    type: file.type,
    uploadDate: new Date().toISOString(),
    position: file.position,
    company: file.company,
  };
  
  try {
    const uploads = getAllUploadedCVs();
    const updated = [uploadedFile, ...uploads];
    localStorage.setItem(CV_UPLOADS_KEY, JSON.stringify(updated));
    // Also save as latest for backward compatibility
    localStorage.setItem(CV_FILE_KEY, JSON.stringify(uploadedFile));
    return uploadedFile;
  } catch {
    localStorage.setItem(CV_FILE_KEY, JSON.stringify(uploadedFile));
    return uploadedFile;
  }
}

export function getAllUploadedCVs() {
  try {
    const raw = localStorage.getItem(CV_UPLOADS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getUploadedCV() {
  try {
    const raw = localStorage.getItem(CV_FILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── JD Uploads Management ─────────────────────────────────────────
export function saveUploadedJD(file) {
  const uploadedFile = {
    id: `jd-${Date.now()}`,
    name: file.name,
    size: file.size,
    type: file.type,
    uploadDate: new Date().toISOString(),
    position: file.position,
    company: file.company,
  };
  
  try {
    const uploads = getAllUploadedJDs();
    const updated = [uploadedFile, ...uploads];
    localStorage.setItem(JD_UPLOADS_KEY, JSON.stringify(updated));
    localStorage.setItem(JD_FILE_KEY, JSON.stringify(uploadedFile));
    return uploadedFile;
  } catch {
    localStorage.setItem(JD_FILE_KEY, JSON.stringify(uploadedFile));
    return uploadedFile;
  }
}

export function getAllUploadedJDs() {
  try {
    const raw = localStorage.getItem(JD_UPLOADS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getUploadedJD() {
  try {
    const raw = localStorage.getItem(JD_FILE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ─── Get Suggested Data from Latest Analysis ───────────────────────
export function getSuggestedBookingData() {
  const latestAnalysis = getLatestCVAnalysis();
  if (!latestAnalysis) return null;
  
  return {
    position: latestAnalysis.position || "",
    cvFile: latestAnalysis.cvFile || null,
    jdFile: latestAnalysis.jdFile || null,
  };
}