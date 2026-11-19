import { getFramework } from "../services/competencyFramework.js";

/** Bộ tiêu chí đổi theo `version` khi deploy → cache phía client 1 giờ, ETag theo version. */
const CACHE_CONTROL = "private, max-age=3600";

export const CompetenciesController = {
  /** GET /api/competencies — bộ tiêu chí SHRM/DDI (LP-01) cho mọi role đã đăng nhập. */
  getFramework(req, res) {
    const framework = getFramework();
    const etag = `W/"competencies-${framework.version}"`;
    res.set("Cache-Control", CACHE_CONTROL);
    res.set("ETag", etag);
    if (req.headers["if-none-match"] === etag) return res.status(304).end();
    return res.json({ success: true, framework });
  },
};
