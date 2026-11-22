import { useEffect, useMemo, useState } from "react";
import { roleCategoriesApi } from "../api/roleCategoriesApi.js";

/** Cache theo phiên trình duyệt: danh sách chỉ đổi khi backend deploy bản mới. */
let cached = null;
let pending = null;

function loadRoleCategories() {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = roleCategoriesApi
      .list()
      .then((res) => {
        cached = Array.isArray(res?.roleCategories) ? res.roleCategories : [];
        return cached;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/**
 * Nhóm vị trí dùng chung từ `GET /api/role-categories`.
 * @returns {{ roleCategories: Array<{ key: string, nameVi: string, nameEn: string, suggestedCompetencies: string[] }>,
 *   loading: boolean, error: string, labelOf: (key: string) => string }}
 */
export function useRoleCategories() {
  const [roleCategories, setRoleCategories] = useState(cached ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState("");

  useEffect(() => {
    if (cached) return undefined;
    let alive = true;
    loadRoleCategories()
      .then((rows) => {
        if (alive) setRoleCategories(rows);
      })
      .catch(() => {
        if (alive) setError("Không tải được danh sách vị trí.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const labelOf = useMemo(() => {
    const byKey = new Map(roleCategories.map((r) => [r.key, r.nameVi]));
    return (key) => byKey.get(key) || key || "";
  }, [roleCategories]);

  return { roleCategories, loading, error, labelOf };
}
