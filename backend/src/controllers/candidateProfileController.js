import {
  getOrCreateCandidateProfile,
  updateCandidateProfile,
  getProfileCompetencies,
} from "../services/candidateProfileService.js";

export const CandidateProfileController = {
  // PR-01: Lấy hồ sơ ứng viên (tự khởi tạo nếu vào lần đầu)
  async getProfile(req, res) {
    const profile = await getOrCreateCandidateProfile(req.userId);
    return res.json({
      success: true,
      profile,
    });
  },

  // PR-01: Cập nhật headline, targetRole, defaultCvId,...
  async updateProfile(req, res) {
    const profile = await updateCandidateProfile(req.userId, req.body);
    return res.json({
      success: true,
      message: "Cập nhật hồ sơ ứng viên thành công.",
      profile,
    });
  },

  // PR-07: Lấy danh sách năng lực và DTO rút gọn cho Application snapshot
  async getCompetencies(req, res) {
    const { competencies, snapshot } = await getProfileCompetencies(req.userId);
    return res.json({
      success: true,
      competencies,
      snapshot,
    });
  },
};
