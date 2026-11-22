/**
 * Đọc nhật ký thao tác (`SecurityLog`): `admin_action` (admin), `moderator_action` (Platform Moderator)
 * và `mentor_action` (thao tác tiền của mentor), do các middleware trong `adminAuditLog.js` ghi.
 *
 * Tách khỏi `adminController.js` để phần audit log không chạm vào file đang có thay đổi
 * song song từ nhánh khác.
 */
import mongoose from "mongoose";
import { SecurityLog } from "../models/SecurityLog.js";

const DEFAULT_LIMIT = 50;

/**
 * Dòng ghi trước khi tách `moderator_action` mang type `admin_action` nhưng path `/api/moderator/...`
 * (admin không đi qua cổng moderator), nên tách theo path để lọc đúng cả dữ liệu cũ.
 */
const LEGACY_MODERATOR_PATH = /^\/api\/moderator(\/|$)/;

/** `?actor=` → điều kiện Mongo; bỏ trống = mọi loại nhật ký. */
const ACTOR_FILTERS = {
  admin: { type: "admin_action", "details.path": { $not: LEGACY_MODERATOR_PATH } },
  moderator: { $or: [{ type: "moderator_action" }, { type: "admin_action", "details.path": LEGACY_MODERATOR_PATH }] },
  mentor: { type: "mentor_action" },
};
const ALL_AUDIT_FILTER = { type: { $in: ["admin_action", "moderator_action", "mentor_action"] } };
const MAX_LIMIT = 200;

function parsePositiveInt(raw, fallback, max) {
  const n = Number.parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return max ? Math.min(n, max) : n;
}

export const AdminAuditController = {
  /**
   * GET /api/admin/audit-log
   * Query: page, limit, actor ("admin"|"moderator"|"mentor"), adminId (người thao tác), method, success ("true"|"false"), from, to (ISO date)
   */
  getAuditLog: async (req, res, next) => {
    try {
      const page = parsePositiveInt(req.query?.page, 1);
      const limit = parsePositiveInt(req.query?.limit, DEFAULT_LIMIT, MAX_LIMIT);

      const actor = String(req.query?.actor || "").trim().toLowerCase();
      if (actor && !ACTOR_FILTERS[actor]) {
        return res.status(400).json({ success: false, error: "actor chỉ nhận admin, moderator hoặc mentor." });
      }
      const filter = { ...(ACTOR_FILTERS[actor] || ALL_AUDIT_FILTER) };

      const adminId = String(req.query?.adminId || "").trim();
      if (adminId) {
        if (!mongoose.isValidObjectId(adminId)) {
          return res.status(400).json({ success: false, error: "adminId không hợp lệ." });
        }
        filter.userId = adminId;
      }

      const method = String(req.query?.method || "").trim().toUpperCase();
      if (method) filter["details.method"] = method;

      const success = String(req.query?.success || "").trim().toLowerCase();
      if (success === "true") filter["details.success"] = true;
      if (success === "false") filter["details.success"] = false;

      const from = String(req.query?.from || "").trim();
      const to = String(req.query?.to || "").trim();
      if (from || to) {
        const range = {};
        if (from) {
          const d = new Date(from);
          if (Number.isNaN(d.getTime())) {
            return res.status(400).json({ success: false, error: "from không phải ngày hợp lệ." });
          }
          range.$gte = d;
        }
        if (to) {
          const d = new Date(to);
          if (Number.isNaN(d.getTime())) {
            return res.status(400).json({ success: false, error: "to không phải ngày hợp lệ." });
          }
          range.$lte = d;
        }
        filter.createdAt = range;
      }

      const [entries, total] = await Promise.all([
        SecurityLog.find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate("userId", "name email role")
          .lean(),
        SecurityLog.countDocuments(filter),
      ]);

      res.json({
        success: true,
        entries,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (error) {
      next(error);
    }
  },
};
