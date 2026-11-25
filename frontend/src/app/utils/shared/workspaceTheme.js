/**
 * Chế độ màu khu làm việc (hiện bật cho Mentor): "light" | "dark" | "system".
 * Lưu theo trình duyệt (localStorage); "system" đi theo `prefers-color-scheme` của máy.
 */
export const WORKSPACE_THEME_STORAGE_KEY = "prointerview_workspace_theme";
export const WORKSPACE_THEME_MODES = ["light", "dark", "system"];
export const THEME_CHANGE_EVENT = "prointerview_workspace_theme_changed";
/** Mặc định giữ giao diện tối như trước khi có lựa chọn. */
export const DEFAULT_WORKSPACE_THEME = "dark";

export function normalizeWorkspaceTheme(value) {
  return WORKSPACE_THEME_MODES.includes(value) ? value : DEFAULT_WORKSPACE_THEME;
}

/** Quy đổi lựa chọn sang màu thật đang hiển thị. */
export function resolveWorkspaceTheme(mode, systemPrefersDark) {
  const normalized = normalizeWorkspaceTheme(mode);
  if (normalized === "system") return systemPrefersDark ? "dark" : "light";
  return normalized;
}

export function readWorkspaceTheme() {
  try {
    return normalizeWorkspaceTheme(window.localStorage.getItem(WORKSPACE_THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_WORKSPACE_THEME;
  }
}

export function applyWorkspaceTheme(mode) {
  if (typeof document === "undefined") return;
  const prefersDark =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)")?.matches === true;
  const resolved = resolveWorkspaceTheme(mode, prefersDark);
  const root = document.documentElement;
  root.dataset.workspaceTheme = resolved === "light" ? "light" : "dark";
}

export function writeWorkspaceTheme(mode) {
  const normalized = normalizeWorkspaceTheme(mode);
  try {
    window.localStorage.setItem(WORKSPACE_THEME_STORAGE_KEY, normalized);
  } catch {
    /* Trình duyệt chặn lưu trữ: lựa chọn chỉ giữ trong phiên hiện tại. */
  }
  applyWorkspaceTheme(normalized);
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: normalized }));
  }
}
