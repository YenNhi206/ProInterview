import mongoose from "mongoose";
import { CompanyRubric } from "../models/CompanyRubric.js";
import { reviewRubric } from "../services/rubricReviewService.js";

export const ModeratorRubricController = {
  // Danh sách rubric cần duyệt hoặc đã duyệt
  async list(req, res) {
    const { status = "pending_review", roleCategory, companyId } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (roleCategory) filter.roleCategory = roleCategory;
    if (companyId) filter.companyId = companyId;

    const rubrics = await CompanyRubric.find(filter)
      .populate("companyId", "name slug logo industry")
      .populate("createdBy", "name email")
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({ success: true, rubrics });
  },

  async getById(req, res) {
    const rubric = await CompanyRubric.findById(req.params.id)
      .populate("companyId", "name slug logo industry website description")
      .populate("createdBy", "name email")
      .populate("moderationNote.reviewedBy", "name email")
      .lean();

    if (!rubric) {
      return res.status(404).json({ success: false, error: "Không tìm thấy rubric." });
    }

    return res.json({ success: true, rubric });
  },

  /**
   * CO-08: Duyệt rubric.
   * Version mới được duyệt thì version cũ của cùng companyId + roleCategory chuyển thành `archived`.
   * Đảm bảo mỗi roleCategory của mỗi công ty chỉ có đúng 1 rubric approved.
   */
  async approve(req, res) {
    const rubric = await CompanyRubric.findById(req.params.id);
    if (!rubric) {
      return res.status(404).json({ success: false, error: "Không tìm thấy rubric." });
    }

    const { comment = "" } = req.body;

    // Lưu trữ mọi rubric đã duyệt trước đó của cùng công ty và vị trí này
    await CompanyRubric.updateMany(
      {
        companyId: rubric.companyId,
        roleCategory: rubric.roleCategory,
        _id: { $ne: rubric._id },
        status: "approved",
      },
      {
        $set: { status: "archived" },
      }
    );

    rubric.status = "approved";
    rubric.moderationNote = {
      reviewedBy: req.userId,
      reviewedAt: new Date(),
      comment: (comment || "").trim(),
    };

    await rubric.save();
    return res.json({
      success: true,
      message: "Đã phê duyệt rubric thành công.",
      rubric,
    });
  },

  async reject(req, res) {
    const rubric = await CompanyRubric.findById(req.params.id);
    if (!rubric) {
      return res.status(404).json({ success: false, error: "Không tìm thấy rubric." });
    }

    const comment = (req.body?.comment || "").trim();
    if (!comment) {
      return res.status(400).json({
        success: false,
        error: "Vui lòng nhập lý do từ chối để công ty biết và chỉnh sửa lại.",
      });
    }

    rubric.status = "rejected";
    rubric.moderationNote = {
      reviewedBy: req.userId,
      reviewedAt: new Date(),
      comment,
    };

    await rubric.save();
    return res.json({
      success: true,
      message: "Đã từ chối rubric kèm ghi chú.",
      rubric,
    });
  },

  /**
   * CO-09: chạy (lại) AI kiểm tra rubric và trả `aiReview`. Rubric không đổi nội dung thì dùng lại kết quả
   * cũ, trừ khi `force: true`. Chỉ là gợi ý, không đổi trạng thái rubric.
   */
  async aiReview(req, res) {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ success: false, error: "Mã rubric không hợp lệ." });
    }
    const aiReview = await reviewRubric(req.params.id, { force: req.body?.force === true, userId: req.userId });
    if (!aiReview) {
      return res.status(404).json({ success: false, error: "Không tìm thấy rubric." });
    }
    return res.json({ success: true, aiReview });
  },
};
