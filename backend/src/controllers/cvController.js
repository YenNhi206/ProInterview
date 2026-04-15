import { CVAnalysis } from "../models/CVAnalysis.js";
import { User } from "../models/User.js";

export const CVController = {
  /** Lấy quota còn lại */
  getQuota: async (req, res) => {
    try {
      const user = await User.findById(req.userId).select("quota");
      if (!user) return res.status(404).json({ success: false, error: "Người dùng không tồn tại" });
      res.json({ success: true, quota: user.quota });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Tạo bản phân tích CV */
  createAnalysis: async (req, res) => {
    try {
      const { cvText, jdText, analysisType = "basic" } = req.body;
      const userId = req.userId;

      const user = await User.findById(userId);
      if (user.quota.cvAnalysisUsed >= user.quota.cvAnalysisLimit) {
        return res.status(403).json({ success: false, error: "Bạn đã hết lượt phân tích CV miễn phí. Vui lòng nâng cấp gói." });
      }

      // Mock AI Result
      const result = {
        overallSummary: "CV của bạn khá ấn tượng với kinh nghiệm thực tế tốt. Tuy nhiên cần làm nổi bật hơn các con số kết quả.",
        experienceLevel: "Senior",
        topStrengths: ["Kỹ năng giải quyết vấn đề", "Node.js & MongoDB", "Thiết kế hệ thống"],
        areasToImprove: ["Kỹ năng viết Unit Test", "Chứng chỉ ngoại ngữ"],
        recommendations: [
          "Thêm các dự án thực tế vào phần kinh nghiệm",
          "Cập nhật các công nghệ mới nhất đang sử dụng",
        ]
      };

      if (jdText) {
        result.matchScore = Math.floor(Math.random() * 40) + 60; // 60-100
        result.matchStrengths = ["Khớp kỹ năng React", "Kinh nghiệm Ecommerce"];
        result.matchWeaknesses = ["Thiếu kiến thức AWS", "Chưa có kinh nghiệm quản lý team"];
        result.missingKeywords = ["Docker", "Kubernetes", "Microservices"];
      }

      const analysis = await CVAnalysis.create({
        userId,
        cvText,
        jdText,
        analysisType,
        result,
        geminiModel: "mock-analyzer-v1"
      });

      // Increment quota
      user.quota.cvAnalysisUsed += 1;
      await user.save();

      res.status(201).json({ success: true, analysis });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Danh sách lịch sử */
  list: async (req, res) => {
    try {
      const list = await CVAnalysis.find({ userId: req.userId }).sort({ createdAt: -1 });
      res.json({ success: true, list });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Chi tiết 1 bản ghi */
  getById: async (req, res) => {
    try {
      const analysis = await CVAnalysis.findOne({ _id: req.params.id, userId: req.userId });
      if (!analysis) return res.status(404).json({ success: false, error: "Không tìm thấy" });
      res.json({ success: true, analysis });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Xóa bản ghi */
  delete: async (req, res) => {
    try {
      const deleted = await CVAnalysis.findOneAndDelete({ _id: req.params.id, userId: req.userId });
      if (!deleted) return res.status(404).json({ success: false, error: "Không tìm thấy để xóa" });
      res.json({ success: true, message: "Đã xóa bản tích CV" });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};
