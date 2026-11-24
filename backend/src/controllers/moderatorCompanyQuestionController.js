import {
  listCompanyQuestionsForReview,
  approveCompanyQuestion,
  rejectCompanyQuestion,
  bulkReviewCompanyQuestions,
} from "../services/companyQuestionReviewService.js";

/** Trả kết quả service `{ ok, status?, error?, ...data }` thành response JSON. */
function send(res, result, okStatus = 200) {
  if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
  const { ok, ...data } = result;
  return res.status(okStatus).json({ success: true, ...data });
}

/** CO-16: Platform Moderator duyệt tầng hai câu doanh nghiệp (`/api/moderator/company-questions`). */
export const ModeratorCompanyQuestionController = {
  async list(req, res) {
    return send(res, await listCompanyQuestionsForReview(req.query));
  },

  async approve(req, res) {
    const result = await approveCompanyQuestion(req.params.id, { note: req.body?.note }, req.userId);
    if (result.ok) result.message = "Đã duyệt câu hỏi, câu được dùng trong phỏng vấn.";
    return send(res, result);
  },

  async reject(req, res) {
    const result = await rejectCompanyQuestion(req.params.id, { reason: req.body?.reason }, req.userId);
    if (result.ok) result.message = "Đã từ chối câu hỏi kèm lý do.";
    return send(res, result);
  },

  async bulk(req, res) {
    const { ids, action, reason } = req.body ?? {};
    return send(res, await bulkReviewCompanyQuestions({ ids, action, reason }, req.userId));
  },
};
