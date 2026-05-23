const STORAGE_KEY = "prointerview_learning_dark";

export function readLearningDarkMode() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) === "1";
}

export function writeLearningDarkMode(isDark) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, isDark ? "1" : "0");
}
