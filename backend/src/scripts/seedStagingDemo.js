// `_devOnlyGuard.js` (nạp .env + chặn production) chỉ import khi chạy từ dòng lệnh, ở cuối file:
// test import module này không bị .env ghi đè biến môi trường (bẫy trong CLAUDE.md).
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import { User } from "../models/User.js";
import { Company } from "../models/Company.js";
import { CompanyRubric } from "../models/CompanyRubric.js";
import { JobPost } from "../models/JobPost.js";
import { QuestionBank, hashQuestionText } from "../models/QuestionBank.js";
import { Mentor } from "../models/Mentor.js";
import { CandidateProfile } from "../models/CandidateProfile.js";
import { CVDocument } from "../models/CVDocument.js";
import { InterviewSession } from "../models/InterviewSession.js";
import { Booking } from "../models/Booking.js";
import { LearningPath } from "../models/LearningPath.js";
import { LearningPathSession } from "../models/LearningPathSession.js";
import { MentorshipRequest } from "../models/MentorshipRequest.js";
import { ModerationItem } from "../models/ModerationItem.js";
import { recomputeCompetencyProfile } from "../services/competencyProfileService.js";
import { RUBRIC_SHARING_TERMS } from "../config/rubricSharingTerms.js";
import { BASELINE_QUESTIONS } from "../config/baselineQuestions.js";

const SALT_ROUNDS = 10;
const DEMO_PASSWORD = "Password123!";

const daysAgo = (n) => new Date(Date.now() - n * 86400 * 1000);

/** Câu doanh nghiệp FPT (job Senior Frontend), gắn vào tiêu chí rubric cùng shrmKey. */
const FPT_COMPANY_QUESTIONS = [
  {
    competencyId: "problem_solving",
    competencyName: "Giải quyết vấn đề & Tư duy phản biện",
    text: "Kể về một lỗi giao diện chỉ xảy ra trên môi trường thật mà bạn từng xử lý. Bạn khoanh vùng nguyên nhân thế nào và kết quả ra sao?",
  },
  {
    competencyId: "teamwork",
    competencyName: "Làm việc nhóm",
    text: "Khi designer và backend có ý kiến khác nhau về một luồng màn hình, bạn đã phối hợp thế nào để cả nhóm thống nhất?",
  },
];

/** Câu doanh nghiệp VNG (job Fullstack). */
const VNG_COMPANY_QUESTIONS = [
  {
    competencyId: "problem_solving",
    competencyName: "Giải quyết vấn đề & Tư duy phản biện",
    text: "Kể về lần bạn phát hiện một tính năng không được người dùng dùng như dự kiến. Bạn tìm nguyên nhân và đề xuất thay đổi gì?",
  },
  {
    competencyId: "adaptability",
    competencyName: "Thích ứng",
    text: "Giữa sprint, phạm vi tính năng bị đổi lớn. Bạn điều chỉnh kế hoạch của mình và của nhóm như thế nào?",
  },
];

/** Câu trả lời mẫu cho buổi phỏng vấn có câu doanh nghiệp FPT; `quotes` phải là đoạn có trong `transcript`. */
const FPT_COMPANY_ANSWERS = [
  {
    transcript:
      "Trang thanh toán bị trắng màn hình trên Safari của khách nhưng máy em chạy bình thường. Em xin log từ Sentry, thấy lỗi do dùng hàm structuredClone mà Safari cũ chưa hỗ trợ. Em thay bằng cách sao chép thủ công và thêm test trên BrowserStack, sau đó số lỗi trên Sentry về 0 trong hai tuần.",
    scores: { problem_solving: [4, "Em xin log từ Sentry, thấy lỗi do dùng hàm structuredClone mà Safari cũ chưa hỗ trợ"] },
  },
  {
    transcript:
      "Designer muốn màn hình lọc đơn hàng tải toàn bộ dữ liệu một lần, còn backend lo quá tải. Em làm một bản prototype có phân trang và đo thời gian tải để cả hai bên cùng xem. Cuối cùng nhóm chọn phân trang 50 dòng và giữ hiệu ứng lọc tức thì ở phía giao diện.",
    scores: { teamwork: [3, "Em làm một bản prototype có phân trang và đo thời gian tải để cả hai bên cùng xem"] },
  },
];

/** 5 câu trả lời cùng năng lực problem_solving, AI chấm thấp, moderator chấm lại (bằng chứng cho miner AI-03). */
const OVERRIDE_ANSWERS = [
  ["Kể về một lần bạn sửa lỗi khó trong dự án.", "Em gặp lỗi đơn hàng bị trùng khi mạng chậm. Em thêm khóa idempotency cho API tạo đơn, từ đó không còn đơn trùng."],
  ["Bạn xử lý thế nào khi hệ thống chậm vào giờ cao điểm?", "Em đo bằng APM thấy truy vấn báo cáo quét cả bảng, em thêm index và cache 5 phút, thời gian phản hồi giảm từ 3 giây xuống 400 mili giây."],
  ["Kể về lần bạn phải chọn giữa hai giải pháp kỹ thuật.", "Em so sánh WebSocket và polling cho màn hình thông báo, chọn polling 30 giây vì lượng người dùng nhỏ và dễ vận hành hơn, sau ba tháng chưa phải sửa."],
  ["Bạn làm gì khi không tái hiện được lỗi người dùng báo?", "Em thêm log có mã phiên cho luồng đăng nhập, hai ngày sau bắt được trường hợp token hết hạn giữa chừng và sửa được."],
  ["Kể về lần bạn cải thiện một quy trình của nhóm.", "Nhóm hay quên chạy migration khi deploy, em viết script kiểm tra trong CI, từ đó không còn lần deploy nào bị lỗi vì thiếu migration."],
];

async function ensureCompanyModerator({ email, name, companyId, passwordHash }) {
  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ email, name, passwordHash, role: "company_moderator", companyId, isEmailVerified: true, isActive: true });
    console.log(`  ✓ Đã tạo Company Moderator: ${email}`);
  }
  return user;
}

/** Rubric đã duyệt duy nhất cho (công ty, vị trí) — CO-08. Có rồi thì giữ nguyên. */
async function ensureApprovedRubric({ companyId, roleCategory, title, criteria, reviewer }) {
  const existing = await CompanyRubric.findOne({ companyId, roleCategory, status: "approved" });
  if (existing) return existing;
  const levels = {
    0: "Không thể hiện tiêu chí này",
    1: "Có nhắc tới nhưng không có ví dụ",
    2: "Có ví dụ nhưng chung chung, thiếu hành động hoặc kết quả",
    3: "Ví dụ cụ thể, rõ phần việc của bản thân và kết quả",
    4: "Như mức 3, kết quả đo được và có rút ra bài học",
    5: "Như mức 4, cách làm được nhóm áp dụng lại",
  };
  return CompanyRubric.create({
    companyId,
    roleCategory,
    title,
    version: 1,
    status: "approved",
    criteria: criteria.map((c) => ({ ...c, levels })),
    moderationNote: { comment: "Seed demo: tiêu chí khớp bộ SHRM/DDI, tổng trọng số 100%.", reviewedAt: new Date(), reviewedBy: reviewer },
  });
}

/**
 * Câu doanh nghiệp đã duyệt (`approved`, qua Platform Mod — CO-16) gắn với job, và gắn vào tiêu chí rubric
 * cùng shrmKey ("câu áp dụng") để JB-06 chèn được vào phỏng vấn. Chạy lại không tạo câu trùng.
 */
async function ensureCompanyQuestions({ company, job, rubric, questions }) {
  if (!job || !rubric) return [];
  const ids = [];
  for (const q of questions) {
    const textHash = hashQuestionText(q.text);
    const doc = await QuestionBank.findOneAndUpdate(
      { orgId: company._id, textHash },
      {
        $setOnInsert: {
          text: q.text,
          originalText: q.text,
          source: "org_template",
          orgId: company._id,
          jobPostId: job._id,
          roleCategory: job.roleCategory,
          competencyId: q.competencyId,
          competencyName: q.competencyName,
          layer: "behavior",
          language: "vi",
          status: "approved",
          textHash,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );
    ids.push(doc._id);
    const criterion = rubric.criteria.find((c) => c.shrmKey === q.competencyId) ?? rubric.criteria[0];
    if (!criterion.questionIds.some((id) => String(id) === String(doc._id))) criterion.questionIds.push(doc._id);
  }
  if (rubric.isModified()) await rubric.save();
  return ids;
}

/**
 * Buổi phỏng vấn đã hoàn thành: 3 câu baseline + 2 câu doanh nghiệp, câu doanh nghiệp đã chấm rubric (JB-07)
 * với trích dẫn nguyên văn. Đủ dữ liệu cho trang feedback (JB-14) và chỉ số ứng viên – doanh nghiệp (JB-19).
 */
async function ensureCompanyInterviewSession({ candidate, company, job, rubricId, questionIds }) {
  if (!job || questionIds.length < FPT_COMPANY_ANSWERS.length) return null;
  const existing = await InterviewSession.findOne({ userId: candidate._id, "companyQuestions.questionId": questionIds[0] });
  if (existing) return existing;

  const rubric = await CompanyRubric.findById(rubricId).lean();
  const questions = await QuestionBank.find({ _id: { $in: questionIds } }).lean();
  const qById = new Map(questions.map((q) => [String(q._id), q]));
  const baselineAnswers = [
    "Em là lập trình viên frontend 4 năm kinh nghiệm, chủ yếu làm React và TypeScript cho sản phẩm thương mại điện tử.",
    "Dự án gần nhất bị trễ vì API thay đổi liên tục, em đề xuất viết hợp đồng API bằng OpenAPI để hai bên cùng theo, nhóm kịp phát hành đúng hạn.",
    "Em muốn làm ở môi trường có quy trình kỹ thuật rõ ràng và sản phẩm nhiều người dùng để học cách làm hệ thống lớn.",
  ];
  const sessionQuestions = [
    ...BASELINE_QUESTIONS.map((b, i) => ({ id: `b${i + 1}`, layer: "behavior", competencyId: b.competencyId, question: b.question, source: "baseline" })),
    ...questionIds.map((id, i) => {
      const q = qById.get(String(id));
      return { id: `company${i + 1}`, layer: "behavior", competencyId: q.competencyId, competencyName: q.competencyName, question: q.text, questionBankId: q._id, source: "company" };
    }),
  ];
  const answers = [
    ...baselineAnswers.map((transcript, i) => ({ questionIndex: i, transcript, wordCount: transcript.split(/\s+/).length, durationSeconds: 45 })),
    ...FPT_COMPANY_ANSWERS.map((a, i) => {
      const questionIndex = BASELINE_QUESTIONS.length + i;
      const qid = String(questionIds[i]);
      const criteria = (rubric?.criteria ?? []).filter((c) => (c.questionIds ?? []).some((x) => String(x) === qid));
      const rubricScores = criteria.map((c) => {
        const [score, quote] = a.scores[c.shrmKey] ?? [3, ""];
        if (quote && !a.transcript.includes(quote)) throw new Error(`Seed: trích dẫn không có trong câu trả lời (${c.shrmKey})`);
        return { criterionKey: String(c._id), criterionName: c.name, shrmKey: c.shrmKey, weight: c.weight, score, evidenceQuote: quote };
      });
      return {
        questionIndex,
        transcript: a.transcript,
        wordCount: a.transcript.split(/\s+/).length,
        durationSeconds: 70,
        questionBankId: questionIds[i],
        rubricScores,
        rubricScoring: { status: "scored", rubricId, companyId: company._id, promptVersion: "rubric-v1", model: "seed", scoredAt: daysAgo(2) },
      };
    }),
  ];
  const overall = [3.8, 3.6, 3.4, 4.2, 3.6];
  const levelOf = (o) => (o >= 4 ? "excellent" : o >= 3 ? "proficient" : "developing");
  return InterviewSession.create({
    userId: candidate._id,
    hrGender: "male",
    status: "completed",
    planAtTime: "free",
    questionsAllowed: 5,
    completedAt: daysAgo(2),
    totalDurationSeconds: 300,
    questions: sessionQuestions,
    companyQuestions: questionIds.map((id) => ({ questionId: id, companyId: company._id, jobPostId: job._id, rubricId })),
    answers,
    feedback: {
      overallScore: Math.round((overall.reduce((s, x) => s + x, 0) / overall.length) * 20),
      generalComment: "Ứng viên kể ví dụ cụ thể, có số liệu ở câu xử lý lỗi; câu phối hợp nhóm nên nói rõ hơn phần việc của bản thân.",
      perQuestion: overall.map((o, i) => ({
        questionIndex: i,
        score: Math.round(o * 20),
        overall5: o,
        shrmLevel: levelOf(o),
        scores: { clarity: o, structure: o, relevance: o, credibility: o },
        strengths: ["Có ví dụ cụ thể"],
        improvements: ["Nêu rõ kết quả đo được"],
      })),
      promptVersion: "eval-v1",
    },
    feedbackGeneratedAt: daysAgo(2),
  });
}

/**
 * Buổi 5 câu cùng năng lực problem_solving, AI chấm thấp; moderator đã chấm lại từng câu (ghi `moderatorOverride`
 * trên câu trả lời — miner AI-03 bỏ qua item không có điểm này) + 5 ModerationItem `override_score` đã xử lý.
 * @returns {Promise<number>} số item chấm lại của buổi này
 */
async function ensureOverrideEvidence({ candidate, platformMod }) {
  let session = await InterviewSession.findOne({ userId: candidate._id, "questions.question": OVERRIDE_ANSWERS[0][0] });
  if (!session) {
    session = await InterviewSession.create({
      userId: candidate._id,
      hrGender: "female",
      status: "completed",
      planAtTime: "free",
      questionsAllowed: OVERRIDE_ANSWERS.length,
      completedAt: daysAgo(6),
      questions: OVERRIDE_ANSWERS.map(([question], i) => ({
        id: `ov${i + 1}`, layer: "behavior", competencyId: "problem_solving", competencyName: "Giải quyết vấn đề & Tư duy phản biện", question,
      })),
      answers: OVERRIDE_ANSWERS.map(([, transcript], i) => ({
        questionIndex: i,
        transcript,
        moderatorOverride: {
          scores: { clarity: 3.5, structure: 3.5, relevance: 4, credibility: 4 },
          overall: 3.75,
          shrmLevel: "proficient",
          note: "Có hành động cụ thể và kết quả đo được, AI chấm thấp vì câu trả lời ngắn.",
          by: platformMod._id,
          at: daysAgo(5),
        },
      })),
      feedback: {
        overallScore: 50,
        generalComment: "Câu trả lời ngắn.",
        perQuestion: OVERRIDE_ANSWERS.map((_, i) => ({
          questionIndex: i, score: 50, overall5: 2.5, shrmLevel: "developing",
          scores: { clarity: 2.5, structure: 2, relevance: 3, credibility: 2.5 },
        })),
        promptVersion: "eval-v1",
      },
      feedbackGeneratedAt: daysAgo(6),
    });
  }
  for (let i = 0; i < OVERRIDE_ANSWERS.length; i += 1) {
    const [questionText, transcript] = OVERRIDE_ANSWERS[i];
    const exists = await ModerationItem.exists({ "refs.sessionId": session._id, "refs.questionIndex": i, "resolution.action": "override_score" });
    if (exists) continue;
    await ModerationItem.create({
      type: "evaluation_report",
      status: "resolved",
      priority: "normal",
      refs: { sessionId: session._id, questionIndex: i, userId: candidate._id },
      snapshot: { questionText, transcript, aiEvaluation: { overall: 2.5, score: 50 } },
      resolution: {
        action: "override_score",
        note: `Platform Moderator chấm lại câu ${i + 1}: có hành động và kết quả cụ thể, nâng từ 2,5 lên 3,75.`,
        by: platformMod._id,
        at: daysAgo(5),
      },
    });
  }
  return ModerationItem.countDocuments({ "refs.sessionId": session._id, "resolution.action": "override_score" });
}

export async function seedStagingDemo({ shouldDisconnect = false } = {}) {
  // Chạy lên staging: đặt TARGET_MONGO_URI (loadEnv ghi đè MONGO_URI bằng giá trị trong .env).
  const uri = process.env.TARGET_MONGO_URI?.trim() || process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/prointerview";
  await connectDatabase(uri);
  console.log("🚀 Bắt đầu seed dữ liệu demo kịch bản 7 bước cho staging...");

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  // ── 1. Tạo 2 Công ty đối tác (FPT Software & VNG) ──
  let fpt = await Company.findOne({ slug: "fpt-software" });
  if (!fpt) {
    fpt = await Company.create({
      name: "FPT Software",
      slug: "fpt-software",
      taxCode: "0101601092",
      status: "active",
      address: "Tòa nhà FPT Tower, số 10 Phạm Văn Bạch, Cầu Giấy, Hà Nội",
      industry: "Công nghệ thông tin & Dịch vụ phần mềm",
      website: "https://fptsoftware.com",
      description: "Tập đoàn công nghệ hàng đầu Việt Nam cung cấp giải pháp chuyển đổi số toàn cầu.",
    });
    console.log("  ✓ Đã tạo công ty: FPT Software");
  }

  let vng = await Company.findOne({ slug: "vng-corporation" });
  if (!vng) {
    vng = await Company.create({
      name: "VNG Corporation",
      slug: "vng-corporation",
      taxCode: "0303513222",
      status: "active",
      address: "VNG Campus, Khu chế xuất Tân Thuận, Quận 7, TP. Hồ Chí Minh",
      industry: "Internet, Nội dung số & Fintech",
      website: "https://vng.com.vn",
      description: "Kỳ lân công nghệ đầu tiên tại Việt Nam với các sản phẩm Zalo, ZaloPay, Zing.",
    });
    console.log("  ✓ Đã tạo công ty: VNG Corporation");
  }

  // ── 2. Tạo tài khoản Company Moderator & Platform Moderator ──
  let hrFpt = await User.findOne({ email: "hr.fpt@prointerview.vn" });
  if (!hrFpt) {
    hrFpt = await User.create({
      email: "hr.fpt@prointerview.vn",
      name: "Trần Thu Hà (HR FPT)",
      passwordHash,
      role: "company_moderator",
      companyId: fpt._id,
      isEmailVerified: true,
      isActive: true,
    });
    console.log("  ✓ Đã tạo Company Moderator: hr.fpt@prointerview.vn");
  }

  let hrVng = await User.findOne({ email: "hr.vng@prointerview.vn" });
  if (!hrVng) {
    hrVng = await User.create({
      email: "hr.vng@prointerview.vn",
      name: "Nguyễn Hoàng Nam (HR VNG)",
      passwordHash,
      role: "company_moderator",
      companyId: vng._id,
      isEmailVerified: true,
      isActive: true,
    });
    console.log("  ✓ Đã tạo Company Moderator: hr.vng@prointerview.vn");
  }

  // QA-05 bổ sung (đề xuất aa): công ty thứ 3 (tên hư cấu) để ≥ 3 công ty có rubric đã duyệt cùng shrmKey.
  let lumen = await Company.findOne({ slug: "lumen-tech" });
  if (!lumen) {
    lumen = await Company.create({
      name: "Lumen Tech",
      slug: "lumen-tech",
      status: "active",
      address: "Quận Hải Châu, Đà Nẵng",
      industry: "Phần mềm doanh nghiệp (SaaS)",
      size: "50–200 nhân sự",
      description: "Công ty demo (hư cấu) phát triển phần mềm quản lý vận hành cho doanh nghiệp vừa và nhỏ.",
    });
    console.log("  ✓ Đã tạo công ty: Lumen Tech");
  }
  const hrLumen = await ensureCompanyModerator({
    email: "hr.lumen@prointerview.vn",
    name: "Võ Minh Thư (HR Lumen Tech)",
    companyId: lumen._id,
    passwordHash,
  });

  // CO-02: cả 3 công ty đã đồng ý điều khoản dùng rubric ẩn danh (miner AI-18 chỉ lấy công ty đã đồng ý).
  for (const [company, hr] of [[fpt, hrFpt], [vng, hrVng], [lumen, hrLumen]]) {
    await Company.updateOne(
      { _id: company._id, "rubricSharingConsent.acceptedAt": null },
      { $set: { rubricSharingConsent: { acceptedAt: new Date(), acceptedBy: hr._id, termsVersion: RUBRIC_SHARING_TERMS.version } } },
    );
  }

  let platformMod = await User.findOne({ email: "moderator@dev.local" });
  if (!platformMod) {
    platformMod = await User.create({
      email: "moderator@dev.local",
      name: "Phan Quốc Bảo (Platform Moderator)",
      passwordHash,
      role: "moderator",
      isEmailVerified: true,
      isActive: true,
    });
    console.log("  ✓ Đã tạo Platform Moderator: moderator@dev.local");
  }

  // ── 3. Rubric công ty đã được Platform Mod phê duyệt ──
  let rubricFpt = await CompanyRubric.findOne({ companyId: fpt._id, roleCategory: "frontend" });
  if (!rubricFpt) {
    rubricFpt = await CompanyRubric.create({
      companyId: fpt._id,
      title: "Rubric đánh giá Frontend Engineer (FPT Software)",
      roleCategory: "frontend",
      version: 1,
      status: "approved",
      criteria: [
        {
          name: "Kiến thức cốt lõi React & TypeScript",
          shrmKey: "technical_learning",
          weight: 40,
          description: "Nắm vững lifecycle, hook, state management",
          levels: {
            "0": "Không nắm được component lifecycle, virtual DOM",
            "1": "Biết cú pháp cơ bản nhưng chưa tối ưu render",
            "2": "Dùng tốt hooks phổ biến (useState, useEffect)",
            "3": "Thành thạo custom hooks, TypeScript generic, memoization",
            "4": "Thiết kế state management quy mô lớn (Zustand/Redux), SSR/SSG",
            "5": "Chuyên gia tối ưu Web Vitals, bundle splitting, micro-frontends",
          },
        },
        {
          name: "Khả năng giải quyết bài toán UI/UX phức tạp",
          shrmKey: "problem_solving",
          weight: 35,
          description: "Phân tích root-cause, refactor và xử lý edge cases",
          levels: {
            "0": "Bế tắc khi layout bị vỡ hoặc gặp race condition",
            "1": "Cần hướng dẫn chi tiết từng bước",
            "2": "Sửa được bug sau khi tra cứu tài liệu",
            "3": "Độc lập phân tích root-cause, refactor code sạch",
            "4": "Dự phòng edge cases, xử lý kết nối yếu offline-first",
            "5": "Thiết kế hệ thống UI components tái sử dụng cho toàn công ty",
          },
        },
        {
          name: "Tư duy phối hợp & Giao tiếp kỹ thuật",
          shrmKey: "teamwork",
          weight: 25,
          description: "Code review, chia sẻ giải pháp kỹ thuật",
          levels: {
            "0": "Ngại trao đổi, không tiếp nhận feedback",
            "1": "Giao tiếp một chiều, khó hiểu",
            "2": "Báo cáo tiến độ đầy đủ trong daily scrum",
            "3": "Code review phản biện có xây dựng, phối hợp mượt với Backend/PO",
            "4": "Mentor cho junior, chủ trì technical spike",
            "5": "Lan tỏa văn hóa kỹ thuật, chia sẻ kiến thức toàn trung tâm",
          },
        },
      ],
      moderationNote: {
        comment: "Rubric thiết kế chặt chẽ theo thang chuẩn SHRM, tổng trọng số 100%. Phê duyệt.",
        reviewedAt: new Date(),
        reviewedBy: platformMod._id,
      },
    });
    console.log("  ✓ Đã tạo & phê duyệt CompanyRubric: FPT Software Frontend");
  }

  // ── 4. Tạo 3 Job Posts demo (model JobPost, JB-01) ──
  // Năng lực theo bộ tiêu chí LP-01 ({ shrmKey, minLevel }), roleCategory theo config/roleCategories.json.
  const existingJob = await JobPost.findOne({ title: "Senior Frontend Engineer (React/TypeScript)" }).lean();
  if (!existingJob) {
    const now = new Date();
    const inDays = (n) => new Date(now.getTime() + n * 86400 * 1000);
    await JobPost.create([
      {
        companyId: fpt._id,
        title: "Senior Frontend Engineer (React/TypeScript)",
        roleCategory: "frontend",
        level: "senior",
        employmentType: "full_time",
        workMode: "hybrid",
        location: "Hà Nội",
        salaryRange: "30.000.000 - 45.000.000 VND",
        description: "Tham gia phát triển dự án chuyển đổi số ngân hàng, xây dựng trải nghiệm giao dịch cho hàng triệu người dùng. Làm việc cùng team sản phẩm và backend để thiết kế giao diện hiệu năng cao.",
        requiredCompetencies: [
          { shrmKey: "technical_learning", minLevel: 4 },
          { shrmKey: "problem_solving", minLevel: 3 },
          { shrmKey: "teamwork", minLevel: 3 },
        ],
        requiredSkills: ["React", "TypeScript", "Tailwind CSS", "REST API"],
        rubricId: rubricFpt._id,
        status: "published",
        publishedAt: now,
        closesAt: inDays(30),
      },
      {
        companyId: fpt._id,
        title: "Backend Golang Specialist",
        roleCategory: "backend",
        level: "middle",
        employmentType: "full_time",
        workMode: "onsite",
        location: "TP. Hồ Chí Minh",
        salaryRange: "25.000.000 - 38.000.000 VND",
        description: "Xây dựng microservices hiệu năng cao, xử lý hàng triệu transaction mỗi ngày. Thiết kế API, tối ưu truy vấn cơ sở dữ liệu và vận hành hệ thống hàng đợi sự kiện.",
        requiredCompetencies: [
          { shrmKey: "technical_learning", minLevel: 3 },
          { shrmKey: "problem_solving", minLevel: 3 },
        ],
        requiredSkills: ["Golang", "PostgreSQL", "Kafka", "Docker"],
        status: "published",
        publishedAt: now,
        closesAt: inDays(25),
      },
      {
        companyId: vng._id,
        title: "Fullstack Product Engineer (Node.js/React)",
        roleCategory: "fullstack",
        level: "senior",
        employmentType: "full_time",
        workMode: "hybrid",
        location: "TP. Hồ Chí Minh",
        salaryRange: "35.000.000 - 50.000.000 VND",
        description: "Định hình sản phẩm từ khâu ý tưởng, kiến trúc backend đến giao diện người dùng cho ứng dụng Zalo. Chủ động đề xuất giải pháp và dẫn dắt nhóm nhỏ triển khai tính năng mới.",
        requiredCompetencies: [
          { shrmKey: "technical_learning", minLevel: 4 },
          { shrmKey: "adaptability", minLevel: 3 },
          { shrmKey: "leadership", minLevel: 3 },
        ],
        requiredSkills: ["React", "Node.js", "Redis", "System Design"],
        status: "published",
        publishedAt: now,
        closesAt: inDays(40),
      },
    ]);
    console.log("  ✓ Đã tạo 3 Job Posts demo");
  }

  // ── 4b. Rubric VNG, Lumen + câu doanh nghiệp đã duyệt (JB-06: chèn vào phỏng vấn AI; JB-07: chấm rubric) ──
  const rubricVng = await ensureApprovedRubric({
    companyId: vng._id,
    roleCategory: "fullstack",
    title: "Rubric Fullstack Product Engineer (VNG)",
    reviewer: platformMod._id,
    criteria: [
      { name: "Giải quyết vấn đề sản phẩm", shrmKey: "problem_solving", weight: 40, description: "Tìm nguyên nhân gốc, chọn giải pháp có số liệu" },
      { name: "Thích ứng khi yêu cầu thay đổi", shrmKey: "adaptability", weight: 35, description: "Điều chỉnh kế hoạch, giữ chất lượng khi phạm vi đổi" },
      { name: "Dẫn dắt nhóm nhỏ", shrmKey: "leadership", weight: 25, description: "Chia việc, gỡ vướng, chịu trách nhiệm kết quả" },
    ],
  });
  await ensureApprovedRubric({
    companyId: lumen._id,
    roleCategory: "backend",
    title: "Rubric Backend Engineer (Lumen Tech)",
    reviewer: platformMod._id,
    criteria: [
      { name: "Xử lý sự cố hệ thống", shrmKey: "problem_solving", weight: 60, description: "Khoanh vùng lỗi, đo trước/sau, phòng tái diễn" },
      { name: "Phối hợp liên nhóm", shrmKey: "teamwork", weight: 40, description: "Thống nhất giao diện API, chia sẻ kiến thức" },
    ],
  });

  const jobFe = await JobPost.findOne({ companyId: fpt._id, title: "Senior Frontend Engineer (React/TypeScript)" });
  const jobVng = await JobPost.findOne({ companyId: vng._id, title: "Fullstack Product Engineer (Node.js/React)" });
  if (jobVng && !jobVng.rubricId) {
    jobVng.rubricId = rubricVng._id;
    await jobVng.save();
  }
  const fptQuestionIds = await ensureCompanyQuestions({
    company: fpt,
    job: jobFe,
    rubric: rubricFpt,
    questions: FPT_COMPANY_QUESTIONS,
  });
  await ensureCompanyQuestions({ company: vng, job: jobVng, rubric: rubricVng, questions: VNG_COMPANY_QUESTIONS });
  console.log("  ✓ Rubric đã duyệt cho 3 công ty (chung tiêu chí problem_solving) + câu doanh nghiệp đã duyệt cho job FPT, VNG");

  // ── 5. Tạo 3 Mentors (Tú, Minh, Hằng) ──
  const mentorSeeds = [
    {
      email: "mentor.tu@prointerview.vn",
      name: "Lê Nguyễn Anh Tú",
      headline: "Senior Tech Lead @ VNG Corporation (6+ năm kinh nghiệm)",
      expertise: ["React", "TypeScript", "System Design"],
      about: "Đã phỏng vấn hơn 100 kỹ sư phần mềm. Hỗ trợ bạn tự tin chinh phục vòng Technical & Behavioral.",
      sessionRate: 350000,
      rating: 5,
      reviewCount: 14,
    },
    {
      email: "mentor.minh@prointerview.vn",
      name: "Nguyễn Hoàng Minh",
      headline: "Principal Engineer @ FPT Software (8+ năm kinh nghiệm)",
      expertise: ["Node.js", "Microservices", "Cloud AWS"],
      about: "Chuyên sâu về kiến trúc hệ thống, phân tán và tối ưu database lớn.",
      sessionRate: 400000,
      rating: 4.9,
      reviewCount: 9,
    },
    {
      email: "mentor.hang@prointerview.vn",
      name: "Đỗ Thu Hằng",
      headline: "Engineering Manager @ Shopee (7+ năm kinh nghiệm)",
      expertise: ["STAR Method", "Behavioral Interview", "Career Growth"],
      about: "Hướng dẫn xây dựng câu chuyện phỏng vấn nổi bật theo chuẩn SHRM/DDI quốc tế.",
      sessionRate: 380000,
      rating: 5,
      reviewCount: 18,
    },
  ];

  const createdMentors = [];
  for (const m of mentorSeeds) {
    let u = await User.findOne({ email: m.email });
    if (!u) {
      u = await User.create({
        email: m.email,
        name: m.name,
        passwordHash,
        role: "mentor",
        isEmailVerified: true,
        isActive: true,
      });
    }
    let mp = await Mentor.findOne({ userId: u._id });
    if (!mp) {
      mp = await Mentor.create({
        userId: u._id,
        name: m.name,
        slug: m.email.split("@")[0].replace(".", "-"),
        headline: m.headline,
        about: m.about,
        expertise: m.expertise,
        pricing: {
          session1on1: m.sessionRate,
          cvReview: 250000,
          mockInterview: 500000,
        },
        languages: ["Tiếng Việt", "Tiếng Anh"],
        stats: { rating: m.rating, reviewCount: m.reviewCount },
      });
      console.log(`  ✓ Đã tạo Mentor: ${m.name}`);
    }
    createdMentors.push(mp);
  }

  // ── 6. Tạo Ứng viên (Candidate) có 2 CV, lịch sử phỏng vấn, lộ trình ──
  const candidateEmail = "candidate.demo@prointerview.vn";
  let candidate = await User.findOne({ email: candidateEmail });
  if (!candidate) {
    candidate = await User.create({
      email: candidateEmail,
      name: "Nguyễn Hoàng Đăng Khôi",
      passwordHash,
      role: "customer",
      desiredPosition: "Senior Frontend Engineer",
      isEmailVerified: true,
      isActive: true,
    });
    console.log("  ✓ Đã tạo Candidate: candidate.demo@prointerview.vn");
  }

  // Tạo 2 CVs trong kho
  let cv1 = await CVDocument.findOne({ userId: candidate._id, title: "CV Frontend React - ATS Standard" });
  if (!cv1) {
    cv1 = await CVDocument.create({
      userId: candidate._id,
      title: "CV Frontend React - ATS Standard",
      fileName: "CV_DangKhoi_Frontend_ATS.pdf",
      fileUrl: "https://res.cloudinary.com/prointerview/image/upload/sample_cv1.pdf",
      fileSize: 1048576,
      version: 2,
      isDefault: true,
      content: {
        personalInfo: {
          fullName: "Nguyễn Hoàng Đăng Khôi",
          email: "candidate.demo@prointerview.vn",
          phone: "0901234567",
          title: "Senior Frontend Engineer",
        },
        skills: ["React", "TypeScript", "Next.js", "Tailwind CSS", "Redux Toolkit", "Jest"],
      },
    });
  }

  let cv2 = await CVDocument.findOne({ userId: candidate._id, title: "CV Fullstack Product General" });
  if (!cv2) {
    cv2 = await CVDocument.create({
      userId: candidate._id,
      title: "CV Fullstack Product General",
      fileName: "CV_DangKhoi_Fullstack.pdf",
      fileUrl: "https://res.cloudinary.com/prointerview/image/upload/sample_cv2.pdf",
      fileSize: 852100,
      version: 1,
      isDefault: false,
    });
  }
  console.log("  ✓ Đã tạo 2 CVs trong kho CV của Candidate");

  // Tạo CandidateProfile
  let profile = await CandidateProfile.findOne({ userId: candidate._id });
  if (!profile) {
    profile = await CandidateProfile.create({
      userId: candidate._id,
      headline: "Senior Frontend React & TypeScript Specialist",
      targetRole: "Senior Frontend Engineer",
      targetRoles: ["Frontend Engineer", "Fullstack Engineer"],
      summary: "Kỹ sư phần mềm 4 năm kinh nghiệm chuyên sâu về Single Page Applications, Design Systems và tối ưu hiệu năng web.",
      defaultCvId: cv1._id,
      yearsOfExperience: 4,
      // PR-06: năng lực gộp từ buổi phỏng vấn và buổi lộ trình bên dưới (recomputeCompetencyProfile ở cuối seed).
      competencies: [],
    });
    console.log("  ✓ Đã tạo CandidateProfile (năng lực gộp ở cuối seed)");
  }

  // Tạo 1 buổi phỏng vấn AI completed (chạy lại seed không tạo thêm buổi trùng)
  const session = (await InterviewSession.findOne({
    userId: candidate._id,
    "questions.question": "Bạn hãy giải thích cơ chế Event Loop trong JavaScript?",
  })) ?? await InterviewSession.create({
    userId: candidate._id,
    hrGender: "female",
    roleCategory: "frontend",
    status: "completed",
    completedAt: new Date(Date.now() - 4 * 86400 * 1000),
    // PR-06: câu có key năng lực LP-01 để gộp vào hồ sơ.
    questions: [
      { id: "q1", layer: "theory", competencyId: "technical_learning", question: "Bạn hãy giải thích cơ chế Event Loop trong JavaScript?" },
      { id: "q2", layer: "behavior", competencyId: "problem_solving", question: "Kể về lần bạn tối ưu một trang React bị render chậm. Bạn tìm nguyên nhân thế nào?" },
    ],
    answers: [
      { questionIndex: 0, transcript: "Event Loop hoạt động với Call Stack, Web API và Task Queue..." },
      { questionIndex: 1, transcript: "Em dùng React Profiler tìm component render lại, thêm memo và tách state, thời gian render giảm 60%." },
    ],
    feedback: {
      overallScore: 88,
      overall5: 4.4,
      summary: "Ứng viên nắm rất chắc bản chất bất đồng bộ trong JavaScript và tư duy tối ưu render component.",
      strengths: ["Lập luận STAR rõ ràng", "Phân tích Trade-off kỹ thuật sắc bén"],
      improvements: ["Cần đào sâu hơn về kiến trúc Micro-Frontend"],
      perQuestion: [
        { questionIndex: 0, overall5: 4.4, score: 88, shrmLevel: "excellent" },
        { questionIndex: 1, overall5: 4, score: 80, shrmLevel: "proficient" },
      ],
    },
  });

  // Tạo MentorshipRequest trước cho candidate
  let mReq = await MentorshipRequest.findOne({ userId: candidate._id });
  if (!mReq) {
    mReq = await MentorshipRequest.create({
      userId: candidate._id,
      title: "Cần luyện phỏng vấn Senior Frontend",
      position: "Senior Frontend Engineer",
      description: "Muốn luyện sâu kỹ thuật React/TypeScript và System Design cùng Mentor VNG/FPT.",
      sessionType: "mock_interview",
      cvName: "cv_dangkhoi.pdf",
      jdName: "jd_frontend.pdf",
      cvData: Buffer.from("mock cv data"),
      jdData: Buffer.from("mock jd data"),
      status: "path_proposed",
      selectedMentorId: createdMentors[0]._id,
    });
  }

  // Tạo lộ trình LearningPath demo 3 buổi
  let lp = await LearningPath.findOne({ candidateId: candidate._id });
  if (!lp) {
    lp = await LearningPath.create({
      candidateId: candidate._id,
      mentorId: createdMentors[0]._id,
      mentorshipRequestId: mReq._id,
      goal: "Lộ trình Master Frontend & Chinh phục Senior Interview tại FPT/VNG",
      status: "active",
      version: 1,
      totalAmount: 1050000,
      platformFeeRate: 0.2,
      createdAt: new Date(),
    });

    const s1 = await LearningPathSession.create({
      pathId: lp._id,
      order: 1,
      title: "Buổi 1: Thao tác DOM, Event Loop & Tối ưu Render React",
      shrmKeys: ["technical_learning", "problem_solving"],
      status: "done",
      outcome: "passed",
      shareAmount: 350000,
      feedback: {
        summary: "Đạt chuẩn kiến thức cốt lõi.",
        scores: [{ shrmKey: "technical_learning", score: 4 }, { shrmKey: "problem_solving", score: 3 }],
        strengths: ["Hiểu rõ callstack", "Tối ưu render tốt"],
        improvements: ["Đọc thêm về Concurrent Mode"],
      },
      doneAt: new Date(Date.now() - 3 * 86400 * 1000),
    });

    const s2 = await LearningPathSession.create({
      pathId: lp._id,
      order: 2,
      title: "Buổi 2: State Management & Data Fetching Patterns",
      shrmKeys: ["planning_execution"],
      status: "done",
      outcome: "not_passed",
      shareAmount: 350000,
      feedback: {
        scores: [{ shrmKey: "planning_execution", score: 2 }],
        summary: "Cần cải thiện cách xử lý race condition và cache invalidation.",
        strengths: ["Biết dùng Redux Toolkit"],
        improvements: ["Chưa nắm kỹ stale-while-revalidate"],
      },
      doneAt: new Date(Date.now() - 2 * 86400 * 1000),
    });

    const s2Retake = await LearningPathSession.create({
      pathId: lp._id,
      order: 2,
      attempt: 2,
      retakeOf: s2._id,
      title: "Buổi 2 (Học lại): State Management & Data Fetching Patterns",
      shrmKeys: ["planning_execution"],
      status: "done",
      outcome: "passed",
      shareAmount: 0,
      feedback: {
        scores: [{ shrmKey: "planning_execution", score: 3 }],
        summary: "Đã khắc phục hoàn toàn các lỗ hổng về cache invalidation và race condition.",
        strengths: ["Làm bài test xử lý debounce/cancel token xuất sắc"],
      },
      doneAt: new Date(Date.now() - 1 * 86400 * 1000),
    });

    const s3 = await LearningPathSession.create({
      pathId: lp._id,
      order: 3,
      title: "Buổi 3: Mock Interview kỹ thuật chuyên sâu theo Rubric chuẩn",
      status: "scheduled",
      shareAmount: 350000,
    });
    console.log("  ✓ Đã tạo LearningPath 3 buổi cho Candidate (kèm buổi học lại 0đ)");
  }

  // ── 7. Buổi phỏng vấn có câu doanh nghiệp FPT đã chấm rubric (JB-07) → trang feedback (JB-14) và chỉ số (JB-19) ──
  await ensureCompanyInterviewSession({ candidate, company: fpt, job: jobFe, rubricId: rubricFpt._id, questionIds: fptQuestionIds });

  // JB-20/JB-21: ứng viên đã xem 2 job có câu doanh nghiệp → thẻ "Luyện theo job bạn quan tâm gần đây".
  await CandidateProfile.updateOne(
    { userId: candidate._id },
    { $set: { recentJobViews: [jobFe, jobVng].filter(Boolean).map((j, i) => ({ jobPostId: j._id, viewedAt: new Date(Date.now() - i * 3600 * 1000) })) } },
  );
  // Demo B3.8 cần ứng viên còn lượt phỏng vấn: các buổi seed tạo thẳng vào DB, không trừ lượt; chạy lại seed thì trả lượt.
  await User.updateOne({ _id: candidate._id }, { $set: { "quota.interviewUsed": 0 } });

  // ── 8. 5 lượt chấm lại CÓ điểm moderator trên câu trả lời → miner AI-03 đủ ngưỡng tạo đề xuất ──
  const overrides = await ensureOverrideEvidence({ candidate, platformMod });
  console.log(`  ✓ ${overrides} lượt chấm lại (override_score) có điểm moderator cho aiImprovementMinerJob`);

  // PR-06: gộp hồ sơ năng lực từ dữ liệu nguồn vừa tạo (không ghi tay).
  await recomputeCompetencyProfile(candidate._id);
  console.log("  ✓ Đã gộp hồ sơ năng lực của Candidate từ buổi phỏng vấn và buổi lộ trình");

  console.log("🎉 Hoàn tất seed dữ liệu demo staging thành công!");
  if (shouldDisconnect) {
    await mongoose.disconnect();
  }
}

// Chạy trực tiếp nếu gọi từ command line
if (process.argv[1] && process.argv[1].endsWith("seedStagingDemo.js")) {
  import("./_devOnlyGuard.js").then(() => seedStagingDemo({ shouldDisconnect: true })).catch((err) => {
    console.error("Lỗi khi seed staging demo:", err);
    process.exit(1);
  });
}
