/**
 * /api/role-categories — danh sách nhóm vị trí dùng chung (`config/roleCategories.json`).
 * Công khai vì bộ lọc trang /jobs (JB-11) cần khi chưa đăng nhập. Đổi theo `version` khi deploy → ETag.
 */
import { Router } from "express";
import { listRoleCategories } from "../services/roleCategories.js";

export const roleCategoriesRouter = Router();

roleCategoriesRouter.get("/", (req, res) => {
  const payload = listRoleCategories();
  const etag = `W/"role-categories-${payload.version}"`;
  res.set("Cache-Control", "public, max-age=3600");
  res.set("ETag", etag);
  if (req.headers["if-none-match"] === etag) return res.status(304).end();
  return res.json({ success: true, ...payload });
});
