import { InterviewSession } from "../models/InterviewSession.js";
import { MentorKnowledge } from "../models/MentorKnowledge.js";
import { User } from "../models/User.js";
import {
  generateQuestionsFromText,
  computeCoverage,
  extractPDFText,
  evaluateTranscripts,
} from "../services/interviewQuestionService.js";
import { resolveTopCompetencies } from "../services/competencyFramework.js";
import { BASELINE_QUESTIONS } from "../config/baselineQuestions.js";
import { logger } from "../config/logger.js";
import { syncPlanExpiry } from "../services/plansService.js";
import { mergeInterviewAnswersForEval } from "../utils/mergeInterviewAnswers.js";

// ── Accumulation helper ───────────────────────────────────────────────────────
/**
 * Lấy few-shot examples từ MongoDB: câu hỏi chất lượng cao từ sessions cùng role/competency.
 * Trả về mảng string câu hỏi — inject vào LLM prompt để "học" từ data thực tế.
 * Ban đầu trả [] (chưa có data), tự cải thiện khi user dùng nhiều.
 */
async function getFewShotExamples(roleCategory, competencyIds, limit = 3) {
  try {
    // ── Nguồn 1: AI sessions đã hoàn thành (behavior questions chất lượng cao) ──
    const sessions = await InterviewSession.find({
      "competencyProfile.roleCategory": roleCategory,
      "competencyProfile.competencyIds": { $in: competencyIds },
      status: "completed",
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("questions competencyProfile")
      .lean();

    const candidates = sessions
      .flatMap(s => s.questions ?? [])
      .filter(q =>
        q.layer === "behavior" &&
        q.question?.length > 20 &&
        competencyIds.includes(q.competencyId)
      );

    const seen = new Set();
    const aiExamples = candidates
      .filter(q => {
        const key = q.question.slice(0, 40);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, limit)
      .map(q =>
        `[${q.competencyName || q.competencyId}] ${q.question}` +
        (q.ddiKeyActionTargeted ? ` (DDI: ${q.ddiKeyActionTargeted})` : "")
      );

    // ── Nguồn 2: Mentor knowledge (chuyên gia thật — trọng số cao hơn) ──────────
    // Guard: bỏ qua khi roleCategory rỗng — $regex:"" sẽ match toàn bộ collection
    const roleKey = roleCategory.trim().slice(0, 20);
    let mentorDocs = [];
    if (roleKey) {
      mentorDocs = await MentorKnowledge.find({
        $or: [
          { menteeRole: { $regex: roleKey, $options: "i" } },
          { field:      { $regex: roleKey, $options: "i" } },
        ],
        "questionsAsked.0": { $exists: true }, // chỉ lấy docs có ít nhất 1 câu hỏi
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean();
    }

    const mentorExamples = mentorDocs
      .flatMap(mk => [
        ...mk.questionsAsked.slice(0, 2).map(q => `[MENTOR_INSIGHT: ${mk.menteeRole || mk.field}] ${q}`),
        ...mk.keyInsights.slice(0, 1).map(i => `[MENTOR_ADVICE] ${i}`),
      ])
      .slice(0, limit);

    // Mentor examples ưu tiên đầu danh sách — inject trước AI examples
    const examples = [...mentorExamples, ...aiExamples].slice(0, limit * 2);

    logger.info("few_shot_examples_fetched", {
      roleCategory,
      competencyIds,
      aiCount:     aiExamples.length,
      mentorCount: mentorExamples.length,
      total:       examples.length,
    });

    return examples;
  } catch {
    return [];
  }
}

// ── Controller ────────────────────────────────────────────────────────────────
export const InterviewsController = {

  /**
   * GET /api/interviews/baseline-questions — PUBLIC (không cần đăng nhập)
   * 3 câu hỏi cố định dùng cho free trial (stage 1). Text không đổi → video avatar
   * được cache + dùng lại cho mọi user (xem baselineQuestions.js).
   */
  getBaselineQuestions: async (req, res) => {
    res.json({ success: true, questions: BASELINE_QUESTIONS });
  },

  /** POST /api/interviews/sessions — Tạo buổi phỏng vấn mới */
  createSession: async (req, res) => {
    try {
      const {
        hrGender = "female", competencyProfile, questions, inferredRole, inferredSeniority, coverageScore,
        cvText = "", jdText = "", position = "", field = "",
      } = req.body;
      const userId = req.userId;

      await syncPlanExpiry(userId);

      // Atomic quota check+increment: ngăn race condition khi 2 request đồng thời
      // $expr cho phép so sánh 2 field trong cùng document trong một atomic op
      const userForQuota = await User.findOneAndUpdate(
        { _id: userId, $expr: { $lt: ["$quota.interviewUsed", "$quota.interviewLimit"] } },
        { $inc: { "quota.interviewUsed": 1 } },
        { new: false },
      );
      // findOneAndUpdate trả null → không match: user không tồn tại hoặc hết quota
      if (!userForQuota) {
        const userCheck = await User.findById(userId).lean();
        if (!userCheck) return res.status(404).json({ success: false, error: "Không tìm thấy người dùng." });
        return res.status(403).json({ success: false, error: "Bạn đã hết lượt phỏng vấn thử miễn phí." });
      }
      const user = userForQuota;

      // Baseline-question flow không gọi LLM trước khi tạo session → competencyProfile sẽ trống
      // cho user free (không bao giờ trigger follow-up generation). Tính trước bằng keyword
      // matching (zero LLM cost) để few-shot accumulation + admin analytics vẫn có data cho
      // mọi user, không chỉ Pro user đã sinh được follow-up questions.
      let resolvedProfile = competencyProfile;
      if (!resolvedProfile && (cvText || jdText || position)) {
        const { roleCategory, competencyIds } = resolveTopCompetencies(position, field, cvText, jdText, 3);
        resolvedProfile = {
          roleCategory,
          competencyIds,
          competencyCoverage: competencyIds,
          detectedFromText: competencyIds,
          generatedAt: new Date().toISOString(),
        };
      }

      const session = await InterviewSession.create({
        userId,
        hrGender,
        questionsAllowed: user.quota.interviewQuestionsAllowed || 3,
        status: "in_progress",
        planAtTime: user.plan,
        // Lưu competency data từ generate step (passed from frontend)
        ...(resolvedProfile    && { competencyProfile: resolvedProfile }),
        ...(questions?.length  && { questions }),
        ...(inferredRole       && { inferredRole }),
        ...(inferredSeniority  && { inferredSeniority }),
        ...(coverageScore      && { coverageScore }),
      });

      res.status(201).json({ success: true, session });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** PATCH /api/interviews/sessions/:id — Cập nhật câu trả lời + behavioral data */
  updateAnswer: async (req, res) => {
    try {
      const { id } = req.params;
      const { questionIndex, questionText, transcript, durationSeconds, behavioralData } = req.body;

      const entry = {
        questionIndex, questionText, transcript, durationSeconds,
        recordedAt: new Date(),
        ...(behavioralData && { behavioralData }),
      };

      // Upsert: cập nhật answer đã có cho questionIndex, hoặc push mới nếu chưa có.
      // Dùng findOneAndUpdate thay vì load-modify-save để tránh race condition với analyzeFace.
      let session = await InterviewSession.findOneAndUpdate(
        { _id: id, userId: req.userId, status: "in_progress", "answers.questionIndex": questionIndex },
        { $set: { "answers.$": entry } },
        { new: true },
      );

      if (!session) {
        // Chưa có answer cho questionIndex này — push mới.
        // Filter status: "in_progress" xử lý đồng thời 404 và "đã kết thúc".
        session = await InterviewSession.findOneAndUpdate(
          { _id: id, userId: req.userId, status: "in_progress" },
          { $push: { answers: entry } },
          { new: true },
        );

        if (!session) {
          const exists = await InterviewSession.exists({ _id: id, userId: req.userId });
          if (!exists) return res.status(404).json({ success: false, error: "Phiên phỏng vấn không tồn tại" });
          return res.status(400).json({ success: false, error: "Phiên phỏng vấn này đã kết thúc" });
        }
      }

      res.json({ success: true, session });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** POST /api/interviews/sessions/:id/complete — Hoàn thành (không tạo feedback) */
  completeSession: async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.userId;
      const { answers, totalDurationSeconds, behavioralSummary } = req.body;

      const session = await InterviewSession.findOne({ _id: id, userId });
      if (!session) {
        return res.status(404).json({ success: false, error: "session_not_found" });
      }

      // Idempotent: nếu đã completed thì trả về ngay, không ghi đè
      if (session.status === "completed") {
        return res.json({
          success: true,
          sessionId: session._id,
          status: "completed",
          message: "already_completed",
        });
      }

      // Merge backup answers từ request body — bảo vệ trường hợp fire-and-forget PATCH
      // chưa kịp ghi trước khi user thoát trang
      if (Array.isArray(answers) && answers.length > 0) {
        for (const backupAnswer of answers) {
          const idx = backupAnswer.questionIndex ?? -1;
          if (idx < 0) continue;
          const existing = session.answers.find((a) => a.questionIndex === idx);
          if (!existing || !existing.transcript) {
            session.answers = session.answers.filter((a) => a.questionIndex !== idx);
            session.answers.push({
              questionIndex:   idx,
              questionText:    backupAnswer.questionText ?? "",
              transcript:      backupAnswer.transcript ?? "",
              durationSeconds: backupAnswer.durationSeconds ?? 0,
              recordedAt:      new Date(),
              ...(backupAnswer.behavioralData && { behavioralData: backupAnswer.behavioralData }),
            });
          } else if (existing && backupAnswer.behavioralData && !existing.behavioralData?.eyeContactScore) {
            // Patch behavioral data nếu PATCH fire-and-forget không mang theo
            existing.behavioralData = backupAnswer.behavioralData;
          }
        }
      }

      // Lưu behavioral summary session-level
      if (behavioralSummary && typeof behavioralSummary === "object") {
        session.behavioralSummary = behavioralSummary;
      }

      // Tính tổng thời gian: ưu tiên giá trị từ FE (timer chạy thực tế)
      const computedDuration = session.answers.reduce((acc, a) => acc + (a.durationSeconds || 0), 0);
      session.totalDurationSeconds = totalDurationSeconds ?? computedDuration;
      session.status    = "completed";
      session.completedAt = new Date();
      // Feedback sẽ được tạo bởi /evaluate — không gán gì ở đây

      await session.save();

      logger.info("interview_session_completed", {
        userId,
        sessionId:   String(session._id),
        answerCount: session.answers.filter((a) => a?.transcript).length,
        durationSec: session.totalDurationSeconds,
      });

      return res.json({
        success:   true,
        sessionId: session._id,
        status:    "completed",
        message:   "session_completed_pending_evaluation",
      });
    } catch (error) {
      logger.error("complete_session_failed", {
        userId:    req.userId,
        sessionId: req.params.id,
        error:     error.message,
      });
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** GET /api/interviews/sessions — Lịch sử phỏng vấn */
  list: async (req, res) => {
    try {
      const list = await InterviewSession.find({ userId: req.userId }).sort({ createdAt: -1 });
      res.json({ success: true, list });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /** GET /api/interviews/sessions/:id — Chi tiết 1 phiên */
  getById: async (req, res) => {
    try {
      const session = await InterviewSession.findOne({ _id: req.params.id, userId: req.userId });
      if (!session) return res.status(404).json({ success: false, error: "Không tìm thấy" });
      res.json({ success: true, session });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * POST /api/interviews/generate-questions
   * Body: { cvText?, jdText?, position?, field?, level? }
   *
   * Flow:
   *  1. getFewShotExamples — query MongoDB (trả [] nếu chưa có data)
   *  2. generateQuestionsFromText — SHRM/DDI competency-grounded generation
   *  3. Trả về questions + competencyProfile (frontend lưu sessionStorage để attach vào session)
   *
   * Không còn được Interview.jsx gọi từ sau khi chuyển sang flow 3 baseline + 2 follow-up
   * (xem generateFollowUpQuestions dưới). Giữ lại làm rollback path — xoá sau khi flow mới ổn định.
   */
  generateQuestions: async (req, res) => {
    try {
      const { cvText = "", jdText = "", position = "", field = "", level = "" } = req.body;

      // Quota pre-check BEFORE calling LLM — prevents token waste when user has no quota left.
      // createSession also checks quota, but that runs after the LLM call. Checking here ensures
      // we never consume expensive LLM tokens for a request that will be rejected at session creation.
      await syncPlanExpiry(req.userId);
      const userForQuota = await User.findById(req.userId).select("quota").lean();
      if (!userForQuota) {
        return res.status(404).json({ success: false, error: "Người dùng không tồn tại" });
      }
      if (userForQuota.quota.interviewUsed >= userForQuota.quota.interviewLimit) {
        return res.status(403).json({ success: false, error: "quota_exceeded", message: "Bạn đã hết lượt phỏng vấn thử. Vui lòng nâng cấp gói." });
      }

      logger.info("generate_questions_start", { userId: req.userId, position, field, cvTextLen: cvText.length });

      // Layer 3: Accumulation — lấy few-shot từ MongoDB (sẽ giàu dần theo thời gian)
      // Detect role sơ bộ để query đúng collection
      const { resolveTopCompetencies } = await import("../services/competencyFramework.js");
      const { roleCategory, competencyIds: preIds } = resolveTopCompetencies(position, field, cvText, jdText, 4);
      const fewShotExamples = await getFewShotExamples(roleCategory, preIds);

      if (fewShotExamples.length > 0) {
        logger.info("generate_questions_fewshot", { userId: req.userId, count: fewShotExamples.length });
      }

      // Layer 1+2: SHRM/DDI grounded generation
      const result = await generateQuestionsFromText({
        cvText, jdText, position, field, level, fewShotExamples,
        userId: req.userId,
        sessionId: null, // session created after question generation
      });

      const combined = `${cvText} ${jdText}`;
      const coverage = computeCoverage(result.questions, combined);

      // Fallback: nếu pre-LLM keyword matching không detect được competencies (thường xảy ra
      // khi user dùng form-only, không có CV/JD text), reconstruct từ questions LLM đã sinh.
      // Đảm bảo competencyProfile luôn có data để few-shot accumulation hoạt động.
      const profile = result.competencyProfile;
      if (!profile.competencyIds?.length && result.questions?.length) {
        const uniqueIds   = [...new Set(result.questions.map((q) => q.competencyId).filter(Boolean))];
        const uniqueNames = [...new Set(result.questions.map((q) => q.competencyName).filter(Boolean))];
        profile.competencyIds      = uniqueIds;
        profile.competencyCoverage = uniqueNames;
        profile.roleCategory       = profile.roleCategory || result.inferredRole || position || field || "general";
        profile.generatedAt        = profile.generatedAt  || new Date().toISOString();
      }

      logger.info("generate_questions_ok", {
        userId:       req.userId,
        questionCount: result.questions.length,
        inferredRole:  result.inferredRole,
        competencies:  profile.competencyIds.join(","),
        fewShotCount:  fewShotExamples.length,
      });

      res.json({
        success: true,
        questions:         result.questions,
        inferredRole:      result.inferredRole,
        inferredSeniority: result.inferredSeniority,
        competencyProfile: profile,
        coverageScore:     coverage,
      });
    } catch (error) {
      logger.error("generate_questions_failed", { userId: req.userId, error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * POST /api/interviews/sessions/:id/generate-followup-questions
   * Body: { cvText?, jdText?, position?, field?, level?, baselineAnswers: [{questionIndex, transcript}] }
   *
   * Sinh 2 câu hỏi cá nhân hóa GIỮA buổi phỏng vấn — dựa trên CV/JD + câu trả lời thật của
   * ứng viên cho 3 câu baseline (đào sâu vào điều ứng viên vừa nói, không chỉ CV facts chung).
   * Chỉ Pro user gọi tới đây (free user bị chặn ở UpgradeModal trước khi tới bước này) — đây
   * chính là cost-win của refactor: free user không tốn LLM/D-ID nào cho 2 câu này nữa.
   */
  generateFollowUpQuestions: async (req, res) => {
    try {
      const { id } = req.params;

      // Backend guard: chỉ Pro user được sinh câu hỏi cá nhân hóa (FE chặn bằng UpgradeModal
      // nhưng không đủ — user có thể gọi API trực tiếp để tốn LLM/D-ID credit của hệ thống).
      await syncPlanExpiry(req.userId);
      const userForPlan = await User.findById(req.userId).select("plan planExpiresAt").lean();
      if (!userForPlan) {
        return res.status(404).json({ success: false, error: "Người dùng không tồn tại." });
      }
      const isPro = ["starter_pro", "elite_pro"].includes(userForPlan.plan) &&
        (!userForPlan.planExpiresAt || new Date(userForPlan.planExpiresAt) > new Date());
      if (!isPro) {
        return res.status(403).json({
          success: false,
          error: "Tính năng câu hỏi cá nhân hóa chỉ dành cho gói Pro. Vui lòng nâng cấp tài khoản.",
        });
      }

      const session = await InterviewSession.findOne({ _id: id, userId: req.userId, status: "in_progress" });
      if (!session) {
        return res.status(404).json({ success: false, error: "Phiên phỏng vấn không tồn tại hoặc đã kết thúc" });
      }

      // Idempotency: double-click / retry / back-forward-cache replay → trả lại kết quả đã có,
      // không gọi LLM lại lần thứ 2.
      if (session.questions.length >= 5) {
        return res.json({ success: true, questions: session.questions.slice(3), alreadyGenerated: true });
      }

      const { cvText = "", jdText = "", position = "", field = "", level = "", baselineAnswers = [] } = req.body;

      const priorQA = session.questions.slice(0, 3).map((q, i) => ({
        question: q.question,
        transcript: baselineAnswers.find((a) => a.questionIndex === i)?.transcript ?? "",
      }));

      const { roleCategory, competencyIds } = resolveTopCompetencies(position, field, cvText, jdText, 2);
      const fewShotExamples = await getFewShotExamples(roleCategory, competencyIds);

      logger.info("generate_followup_start", { userId: req.userId, sessionId: id });

      const result = await generateQuestionsFromText({
        cvText, jdText, position, field, level, fewShotExamples, priorQA,
        questionCount: 2,
        userId: req.userId,
        sessionId: id,
      });

      session.questions.push(...result.questions);
      if (!session.competencyProfile?.competencyIds?.length) {
        session.competencyProfile = result.competencyProfile;
      }
      if (!session.inferredRole && result.inferredRole) {
        session.inferredRole = result.inferredRole;
      }
      await session.save();

      logger.info("generate_followup_ok", { userId: req.userId, sessionId: id, questionCount: result.questions.length });

      res.json({ success: true, questions: result.questions });
    } catch (error) {
      logger.error("generate_followup_failed", { userId: req.userId, sessionId: req.params.id, error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * POST /api/interviews/extract-cv-text
   * multipart/form-data: field "file" (PDF)
   */
  extractCvText: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, error: "Không có file được gửi lên" });
      }
      const { text, pageCount } = await extractPDFText(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype,
      );
      res.json({ success: true, text, pageCount });
    } catch (error) {
      res.status(502).json({ success: false, error: error.message });
    }
  },

  /**
   * POST /api/interviews/sessions/:id/evaluate
   * Body: { answers: [{questionIndex, transcript}] }
   *
   * Đánh giá transcript bằng LLM theo SHRM/DDI rubric.
   * Frontend gửi answers trực tiếp (tránh race condition với PATCH fire-and-forget).
   * Kết quả được lưu vào session.feedback.perQuestion.
   */
  evaluateSession: async (req, res) => {
    try {
      const { id } = req.params;
      const { answers = [], questions: bodyQuestions = [] } = req.body;

      const session = await InterviewSession.findOne({ _id: id, userId: req.userId });
      if (!session) return res.status(404).json({ success: false, error: "Không tìm thấy phiên" });

      // Idempotent: return cached feedback if already evaluated (skip LLM call)
      if (session.feedbackGeneratedAt && session.feedback?.perQuestion?.length > 0) {
        const cachedBehavioralPerQuestion = session.answers.map((a) => ({
          questionIndex: a.questionIndex,
          behavioralData: a.behavioralData ?? null,
        }));
        return res.json({
          success:        true,
          evaluation: {
            overallComment: session.feedback.generalComment ?? "",
            perQuestion: session.feedback.perQuestion.map(q => ({
              questionIndex: q.questionIndex,
              overall:       q.overall5 ?? (q.score / 20),
              scores:        q.scores ?? { clarity: 0, structure: 0, relevance: 0, credibility: 0 },
              shrmLevel:     q.shrmLevel ?? "proficient",
              strengths:     q.strengths ?? [],
              improvements:  q.improvements ?? [],
              suggestion:    q.suggestion ?? "",
            })),
          },
          overallScore:   session.feedback.overallScore,
          generalComment: session.feedback.generalComment,
          inferredRole:   session.inferredRole,
          totalDurationSeconds: session.totalDurationSeconds,
          behavioralSummary:      session.behavioralSummary ?? null,
          behavioralPerQuestion:  cachedBehavioralPerQuestion,
        });
      }

      const answersToEval = mergeInterviewAnswersForEval(session.answers, answers);

      // Resolve questions: session > body > build từ questionText trong answers
      let questionsToUse = session.questions;
      if (!questionsToUse?.length) {
        if (bodyQuestions.length) {
          questionsToUse = bodyQuestions;
        } else if (answersToEval.some(a => a.questionText)) {
          questionsToUse = answersToEval.map((a, i) => ({
            question:        a.questionText || `Câu hỏi ${i + 1}`,
            layer:           "behavior",
            competencyName:  "Năng lực tổng quát",
          }));
        } else {
          return res.status(400).json({ success: false, error: "Phiên không có câu hỏi" });
        }
      }

      logger.info("evaluate_session_start", {
        userId: req.userId, sessionId: id,
        questionCount: questionsToUse.length,
        answerCount:   answersToEval.length,
      });

      const evalResult = await evaluateTranscripts({
        questions: questionsToUse,
        answers:   answersToEval,
        userId:    req.userId,
        sessionId: id,
      });

      // Persist to MongoDB
      const BADGE_MAP = { excellent: "Xuất sắc", proficient: "Tốt", developing: "Cần cải thiện" };
      session.feedback = {
        overallScore:   Math.round(
          evalResult.perQuestion.reduce((s, q) => s + q.overall, 0)
          / (evalResult.perQuestion.length || 1) * 20
        ),
        generalComment: evalResult.overallComment,
        perQuestion: evalResult.perQuestion.map(q => ({
          questionIndex: q.questionIndex,
          score:         Math.round(q.overall * 20),
          badge:         BADGE_MAP[q.shrmLevel] ?? "Tốt",
          strengths:     q.strengths,
          improvements:  q.improvements,
          scores:        q.scores,
          shrmLevel:     q.shrmLevel,
          suggestion:    q.suggestion,
          overall5:      q.overall,
        })),
        isLockedForFree: false,
      };
      session.feedbackGeneratedAt = new Date();
      if (!session.questions?.length && questionsToUse?.length) {
        session.questions = questionsToUse;
      }
      await session.save();

      logger.info("evaluate_session_ok", { userId: req.userId, sessionId: id, overallScore: session.feedback.overallScore });

      // Build per-question behavioral lookup
      const behavioralPerQuestion = session.answers.map((a) => ({
        questionIndex: a.questionIndex,
        behavioralData: a.behavioralData ?? null,
      }));

      res.json({
        success:        true,
        evaluation:     evalResult,
        overallScore:   session.feedback.overallScore,
        generalComment: evalResult.overallComment,
        inferredRole:   session.inferredRole,
        totalDurationSeconds: session.totalDurationSeconds,
        behavioralSummary:      session.behavioralSummary ?? null,
        behavioralPerQuestion,
      });
    } catch (error) {
      logger.error("evaluate_session_failed", { userId: req.userId, sessionId: req.params.id, error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  },

  /**
   * POST /api/interviews/sessions/:id/analyze-face
   * Body: { imageBase64: string, questionIndex: number }
   * Proxy sang Google Cloud Vision Face Detection API.
   * Trả { success, emotion } — emotion null nếu không có API key hoặc không detect được mặt.
   */
  analyzeFace: async (req, res) => {
    const { id } = req.params;
    const { imageBase64, questionIndex } = req.body;

    const VISION_KEY = process.env.GOOGLE_VISION_API_KEY;
    if (!VISION_KEY) {
      return res.json({ success: true, emotion: null, reason: "vision_api_not_configured" });
    }
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "imageBase64 required" });
    }

    try {
      const visionRes = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${VISION_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            requests: [{
              image:    { content: imageBase64 },
              features: [{ type: "FACE_DETECTION", maxResults: 1 }],
            }],
          }),
        }
      );
      const data = await visionRes.json();
      const face = data.responses?.[0]?.faceAnnotations?.[0];

      if (!face) return res.json({ success: true, emotion: null });

      const L = { VERY_UNLIKELY: 1, UNLIKELY: 2, POSSIBLE: 3, LIKELY: 4, VERY_LIKELY: 5 };
      const emotion = {
        joy:           L[face.joyLikelihood]      ?? 1,
        sorrow:        L[face.sorrowLikelihood]   ?? 1,
        anger:         L[face.angerLikelihood]    ?? 1,
        surprise:      L[face.surpriseLikelihood] ?? 1,
        headPanAngle:  face.panAngle   ?? 0,
        headTiltAngle: face.tiltAngle  ?? 0,
        lightingOk:    !["LIKELY", "VERY_LIKELY"].includes(face.underExposedLikelihood),
      };

      // Persist emotion into session answer — atomic $set để không race với updateAnswer PATCH.
      // Nếu answer cho questionIndex chưa tồn tại (PATCH chưa kịp ghi), updateOne bỏ qua
      // một cách im lặng; emotion vẫn được trả về FE và lưu qua backup trong completeSession.
      if (typeof questionIndex === "number" && questionIndex >= 0) {
        await InterviewSession.updateOne(
          { _id: id, userId: req.userId, "answers.questionIndex": questionIndex },
          { $set: { "answers.$.behavioralData.emotion": emotion } },
        ).catch(() => {}); // fire-and-forget: không block response nếu DB lỗi
      }

      logger.info("analyze_face_ok", { userId: req.userId, sessionId: id, questionIndex, joy: emotion.joy });
      res.json({ success: true, emotion });
    } catch (err) {
      logger.warn("analyze_face_failed", { sessionId: id, error: err.message });
      res.json({ success: true, emotion: null });
    }
  },
};
