import { InterviewSession } from "../models/InterviewSession.js";
import { User } from "../models/User.js";

export const InterviewsController = {
  /** Tạo buổi phỏng vấn mới */
  createSession: async (req, res) => {
    try {
      const { hrGender = "female" } = req.body;
      const userId = req.userId;

      const user = await User.findById(userId);
      if (user.quota.interviewUsed >= user.quota.interviewLimit) {
        return res.status(403).json({ success: false, error: "Bạn đã hết lượt phỏng vấn thử miễn phí." });
      }

      const session = await InterviewSession.create({
        userId,
        hrGender,
        questionsAllowed: user.quota.interviewQuestionsAllowed || 3,
        status: "in_progress",
        planAtTime: user.plan
      });

      // Increment quota
      user.quota.interviewUsed += 1;
      await user.save();

      res.status(201).json({ success: true, session });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Cập nhật câu trả lời */
  updateAnswer: async (req, res) => {
    try {
      const { id } = req.params;
      const { questionIndex, questionText, transcript, durationSeconds } = req.body;

      const session = await InterviewSession.findOne({ _id: id, userId: req.userId });
      if (!session) return res.status(404).json({ success: false, error: "Phiên phỏng vấn không tồn tại" });
      if (session.status !== "in_progress") {
        return res.status(400).json({ success: false, error: "Phiên phỏng vấn này đã kết thúc" });
      }

      session.answers.push({
        questionIndex,
        questionText,
        transcript,
        durationSeconds,
        recordedAt: new Date()
      });

      await session.save();
      res.json({ success: true, session });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Hoàn thành và tạo feedback */
  completeSession: async (req, res) => {
    try {
      const { id } = req.params;
      const session = await InterviewSession.findOne({ _id: id, userId: req.userId });
      if (!session) return res.status(404).json({ success: false, error: "Không tìm thấy phiên phỏng vấn" });

      // Mock Feedback Generation
      session.status = "completed";
      session.completedAt = new Date();
      session.totalDurationSeconds = session.answers.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0);
      
      session.feedback = {
        overallScore: Math.floor(Math.random() * 30) + 60,
        communication: 75,
        confidence: 80,
        structure: 70,
        content: 65,
        timing: 90,
        generalComment: "Bạn có phong thái tự tin và trả lời đúng trọng tâm. Hãy chú ý hơn vào việc cấu trúc câu trả lời theo mô hình STAR.",
        perQuestion: session.answers.map((a, idx) => ({
          questionIndex: a.questionIndex,
          score: Math.floor(Math.random() * 40) + 50,
          badge: idx % 2 === 0 ? "Tốt" : "Cần cải thiện",
          strengths: ["Phát âm rõ ràng", "Thông tin chính xác"],
          improvements: ["Nên giải thích sâu hơn về kết quả", "Giảm bớt từ từ đệm"]
        }))
      };

      session.feedbackGeneratedAt = new Date();
      await session.save();

      res.json({ success: true, session });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Lịch sử phỏng vấn */
  list: async (req, res) => {
    try {
      const list = await InterviewSession.find({ userId: req.userId }).sort({ createdAt: -1 });
      res.json({ success: true, list });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** Chi tiết 1 phiên */
  getById: async (req, res) => {
    try {
      const session = await InterviewSession.findOne({ _id: req.params.id, userId: req.userId });
      if (!session) return res.status(404).json({ success: false, error: "Không tìm thấy" });
      res.json({ success: true, session });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
};
