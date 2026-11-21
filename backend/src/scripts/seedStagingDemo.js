import "./_devOnlyGuard.js";
import "../config/loadEnv.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { connectDatabase } from "../db/connect.js";
import { User } from "../models/User.js";
import { Company } from "../models/Company.js";
import { CompanyRubric } from "../models/CompanyRubric.js";
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

const SALT_ROUNDS = 10;
const DEMO_PASSWORD = "Password123!";

export async function seedStagingDemo({ shouldDisconnect = false } = {}) {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/prointerview";
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
          shrmKey: "technical_mastery",
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

  // ── 4. Tạo 3 Job Posts demo ──
  const jobsCollection = mongoose.connection.collection("job_posts");
  const existingJob = await jobsCollection.findOne({ title: "Senior Frontend Engineer (React/TypeScript)" });
  if (!existingJob) {
    await jobsCollection.insertMany([
      {
        companyId: fpt._id,
        title: "Senior Frontend Engineer (React/TypeScript)",
        roleCategory: "frontend",
        status: "published",
        level: "senior",
        salaryRange: "30.000.000 - 45.000.000 VND",
        description: "Tham gia phát triển dự án chuyển đổi số ngân hàng, xây dựng trải nghiệm giao dịch người dùng.",
        requiredCompetencies: ["technical_mastery", "problem_solving", "teamwork"],
        requiredSkills: ["React", "TypeScript", "Tailwind CSS", "REST API"],
        rubricId: rubricFpt._id,
        closesAt: new Date(Date.now() + 30 * 86400 * 1000),
        createdAt: new Date(),
      },
      {
        companyId: fpt._id,
        title: "Backend Golang Specialist",
        roleCategory: "backend",
        status: "published",
        level: "middle",
        salaryRange: "25.000.000 - 38.000.000 VND",
        description: "Xây dựng microservices hiệu năng cao, xử lý hàng triệu transaction mỗi ngày.",
        requiredCompetencies: ["technical_mastery", "problem_solving"],
        requiredSkills: ["Golang", "PostgreSQL", "Kafka", "Docker"],
        closesAt: new Date(Date.now() + 25 * 86400 * 1000),
        createdAt: new Date(),
      },
      {
        companyId: vng._id,
        title: "Fullstack Product Engineer (Node.js/React)",
        roleCategory: "fullstack",
        status: "published",
        level: "senior",
        salaryRange: "35.000.000 - 50.000.000 VND",
        description: "Định hình sản phẩm từ khâu ý tưởng, kiến trúc backend đến giao diện người dùng cho ứng dụng Zalo.",
        requiredCompetencies: ["technical_mastery", "adaptability", "leadership"],
        requiredSkills: ["React", "Node.js", "Redis", "System Design"],
        closesAt: new Date(Date.now() + 40 * 86400 * 1000),
        createdAt: new Date(),
      },
    ]);
    console.log("  ✓ Đã tạo 3 Job Posts demo");
  }

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
      isVerified: true,
      verifiedAt: new Date(),
      competencies: [
        {
          key: "technical_mastery",
          name: "Chuyên môn kỹ thuật (Technical Mastery)",
          category: "Kỹ năng chuyên môn",
          level: 4,
          score: 88,
          evidenceCount: 2,
          sources: [
            { type: "ai_interview", title: "Phỏng vấn AI Kỹ thuật Frontend (88/100)", score: 88, at: new Date() },
          ],
        },
        {
          key: "problem_solving",
          name: "Giải quyết vấn đề (Problem Solving)",
          category: "Năng lực tư duy",
          level: 4,
          score: 85,
          evidenceCount: 1,
          sources: [
            { type: "mentor_session", title: "Buổi học cùng Mentor Lê Nguyễn Anh Tú", score: 85, at: new Date() },
          ],
        },
      ],
    });
    console.log("  ✓ Đã tạo CandidateProfile kèm verified competencies");
  }

  // Tạo 1 buổi phỏng vấn AI completed
  const session = await InterviewSession.create({
    userId: candidate._id,
    hrGender: "female",
    roleCategory: "frontend",
    status: "completed",
    feedback: {
      overallScore: 88,
      overall5: 4.4,
      summary: "Ứng viên nắm rất chắc bản chất bất đồng bộ trong JavaScript và tư duy tối ưu render component.",
      strengths: ["Lập luận STAR rõ ràng", "Phân tích Trade-off kỹ thuật sắc bén"],
      improvements: ["Cần đào sâu hơn về kiến trúc Micro-Frontend"],
      perQuestion: [
        { questionIndex: 0, overallScore: 88, overall5: 4.4, score: 88, shrmLevel: "Vững" },
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
      status: "done",
      outcome: "passed",
      shareAmount: 350000,
      feedback: {
        summary: "Đạt chuẩn kiến thức cốt lõi.",
        strengths: ["Hiểu rõ callstack", "Tối ưu render tốt"],
        improvements: ["Đọc thêm về Concurrent Mode"],
      },
      doneAt: new Date(Date.now() - 3 * 86400 * 1000),
    });

    const s2 = await LearningPathSession.create({
      pathId: lp._id,
      order: 2,
      title: "Buổi 2: State Management & Data Fetching Patterns",
      status: "done",
      outcome: "not_passed",
      shareAmount: 350000,
      feedback: {
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
      status: "done",
      outcome: "passed",
      shareAmount: 0,
      feedback: {
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

  // ── 7. Tạo ít nhất 5 lượt chấm lại (ModerationItem) để miner đủ ngưỡng ──
  const modCount = await ModerationItem.countDocuments({ "resolution.action": "override_score" });
  if (modCount < 5) {
    const items = [];
    for (let i = 1; i <= 5; i++) {
      items.push({
        type: "evaluation_report",
        status: "resolved",
        priority: "normal",
        refs: {
          sessionId: session._id,
          questionIndex: 0,
          userId: candidate._id,
        },
        snapshot: {
          questionText: "Bạn hãy giải thích cơ chế Event Loop trong JavaScript?",
          transcript: "Event Loop hoạt động với Call Stack, Web API và Task Queue...",
          aiEvaluation: { overall: 3.5, score: 70 },
        },
        resolution: {
          action: "override_score",
          note: `Platform Moderator phúc khảo lần ${i}: Câu trả lời ứng viên có dẫn chứng thực tế tốt, nâng điểm lên thang 4.`,
          by: platformMod._id,
          at: new Date(Date.now() - (6 - i) * 3600 * 1000),
        },
      });
    }
    await ModerationItem.insertMany(items);
    console.log("  ✓ Đã tạo 5 ModerationItems được chấm lại để đủ điều kiện cho aiImprovementMinerJob");
  }

  console.log("🎉 Hoàn tất seed dữ liệu demo staging thành công!");
  if (shouldDisconnect) {
    await mongoose.disconnect();
  }
}

// Chạy trực tiếp nếu gọi từ command line
if (process.argv[1] && process.argv[1].endsWith("seedStagingDemo.js")) {
  seedStagingDemo({ shouldDisconnect: true }).catch((err) => {
    console.error("Lỗi khi seed staging demo:", err);
    process.exit(1);
  });
}
