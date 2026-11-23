import { useCallback, useEffect, useState } from "react";
import { normalizeWorkspaceTheme, readWorkspaceTheme, resolveWorkspaceTheme, writeWorkspaceTheme } from "../utils/shared/workspaceTheme.js";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia?.(DARK_QUERY).matches === true;
}

/**
 * Lựa chọn sáng / tối / theo hệ thống của khu làm việc.
 * `enabled = false` (khu chưa hỗ trợ) luôn trả về "dark" và không đọc lựa chọn đã lưu.
 */
export function useWorkspaceTheme(enabled = true) {
  const [mode, setModeState] = useState(() => (enabled ? readWorkspaceTheme() : "dark"));
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (!enabled || !window.matchMedia) return undefined;
    const query = window.matchMedia(DARK_QUERY);
    const change = () => setPrefersDark(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, [enabled]);

  const setMode = useCallback((next) => {
    writeWorkspaceTheme(next);
    setModeState(normalizeWorkspaceTheme(next));
  }, []);

  const resolved = enabled ? resolveWorkspaceTheme(mode, prefersDark) : "dark";
  return { mode: enabled ? mode : "dark", resolved, setMode };
}
