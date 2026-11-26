import { useCallback, useEffect, useState } from "react";
import {
  normalizeWorkspaceTheme,
  readWorkspaceTheme,
  resolveWorkspaceTheme,
  writeWorkspaceTheme,
  applyWorkspaceTheme,
  THEME_CHANGE_EVENT,
  WORKSPACE_THEME_STORAGE_KEY,
} from "../utils/shared/workspaceTheme.js";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia?.(DARK_QUERY)?.matches === true;
}

/**
 * Lựa chọn sáng / tối / theo hệ thống của khu làm việc.
 * `enabled = false` luôn trả về "dark".
 */
export function useWorkspaceTheme(enabled = true) {
  const [mode, setModeState] = useState(() => (enabled ? readWorkspaceTheme() : "dark"));
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (!enabled) return undefined;

    // Áp dụng ngay theme lên <html>
    applyWorkspaceTheme(mode);

    const handleThemeChange = (e) => {
      const next = normalizeWorkspaceTheme(e?.detail || readWorkspaceTheme());
      setModeState(next);
      applyWorkspaceTheme(next);
    };

    const handleStorage = (e) => {
      if (e.key === WORKSPACE_THEME_STORAGE_KEY) {
        const next = normalizeWorkspaceTheme(e.newValue);
        setModeState(next);
        applyWorkspaceTheme(next);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
      window.addEventListener("storage", handleStorage);
    }

    let query;
    let change;
    if (typeof window !== "undefined" && window.matchMedia) {
      query = window.matchMedia(DARK_QUERY);
      change = () => {
        setPrefersDark(query.matches);
        applyWorkspaceTheme(readWorkspaceTheme());
      };
      query.addEventListener("change", change);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
        window.removeEventListener("storage", handleStorage);
      }
      if (query && change) {
        query.removeEventListener("change", change);
      }
    };
  }, [enabled, mode]);

  const setMode = useCallback((next) => {
    writeWorkspaceTheme(next);
    setModeState(normalizeWorkspaceTheme(next));
  }, []);

  const resolved = enabled ? resolveWorkspaceTheme(mode, prefersDark) : "dark";
  return { mode: enabled ? mode : "dark", resolved, setMode, setTheme: setMode };
}
