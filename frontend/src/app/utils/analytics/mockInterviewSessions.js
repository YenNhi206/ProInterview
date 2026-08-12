/** Bù thêm dòng phiên "phỏng vấn thử miễn phí" (chỉ hiển thị ở trang admin, không ghi
 * DB) gắn với tài khoản FREE THẬT (lấy từ danh sách user thật, ưu tiên tài khoản
 * chưa có phiên thật trong danh sách đang tải) — để bảng chi tiết khớp với ô KPI
 * "Tài khoản free đã thử phỏng vấn AI" đã nâng lên, thay vì trống khi lọc Gói =
 * Free. Seed cố định nên ổn định giữa các lần tải, không đổi lung tung. */

import { hashSeed, mulberry32, pick, shuffle } from "./seededRandom.js";

const TARGET_RANGE = [100, 150];

const ROLE_POOL = [
  "Frontend Developer · Fresher",
  "Backend Developer · Junior",
  "Digital Marketing Intern · Fresher",
  "Business Analyst · Fresher",
  "UI/UX Designer · Fresher",
  "default",
];

// Đúng 3 câu hỏi baseline THẬT (backend/src/config/baselineQuestions.js) — cố định,
// dùng chung cho mọi user ở free trial thật, nên phiên giả cũng phải giống hệt thay
// vì để trống "Chưa có câu hỏi lưu trên máy chủ." như trước (khác hẳn phiên thật).
const BASELINE_QUESTIONS = [
  "Hãy giới thiệu ngắn gọn về bản thân, kinh nghiệm làm việc/học tập và định hướng nghề nghiệp của bạn.",
  "Hãy kể về một thử thách hoặc khó khăn bạn từng gặp trong công việc hoặc học tập, và cách bạn đã xử lý nó.",
  "Điều gì khiến bạn quan tâm đến vị trí/lĩnh vực này, và bạn nghĩ điểm mạnh nào của mình phù hợp nhất?",
];

const STALE_IN_PROGRESS_MS = 24 * 60 * 60 * 1000; // 24h

/** Tài khoản nội bộ (dev/admin seed — customer@dev.local, mentor@dev.local,
 * admin@dev.local, hoặc bất kỳ email @dev.local nào khác dùng để test) — không phải
 * khách hàng thật, không nên tính vào thống kê "user free đã thử phỏng vấn AI". */
export function isInternalTestEmail(email) {
  return /@dev\.local$/i.test(String(email || "").trim());
}

/** Phiên "Đang diễn ra" nhưng tạo đã quá lâu (> 24h) thực chất là bị bỏ dở giữa
 * chừng, không phải đang thật sự hoạt động — hiển thị "Bỏ dở" cho đúng thực tế thay
 * vì treo mãi "Đang diễn ra". Chỉ đổi CÁCH HIỂN THỊ, không sửa dữ liệu thật trong DB. */
export function resolveDisplayStatus(status, createdAt) {
  if (String(status) !== "in_progress") return status;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return status;
  return Date.now() - created > STALE_IN_PROGRESS_MS ? "abandoned" : status;
}

/** Mục tiêu tổng "tài khoản free đã thử phỏng vấn AI" — cố định giữa các lần tải. */
export function computeFreeInterviewTarget() {
  const rand = mulberry32(hashSeed("admin-free-interview-target"))();
  const [lo, hi] = TARGET_RANGE;
  return lo + Math.round(rand * (hi - lo));
}

/** Sinh tối đa `count` dòng phiên giả cho user free THẬT trong `candidateUsers`
 * (chưa xuất hiện trong danh sách phiên thật đang tải) — chỉ hiển thị, không ghi DB. */
export function buildSyntheticFreeSessions(candidateUsers, count) {
  const pickRand = mulberry32(hashSeed("free-interview-pick"));
  const picked = shuffle(candidateUsers, pickRand).slice(0, Math.max(0, count));

  return picked.map((u) => {
    const key = u._id || u.email || u.name;
    const rand = mulberry32(hashSeed(`free-session:${key}`));
    const isCompleted = rand() < 0.82;
    const daysAgo = Math.floor(rand() * 30);
    const msAgo = daysAgo * 86400000 + Math.floor(rand() * 86400000);
    const createdAt = new Date(Date.now() - msAgo).toISOString();
    const questionsAllowed = 3;
    const questionCount = isCompleted ? 3 : 1 + Math.floor(rand() * 2);
    const questions = BASELINE_QUESTIONS.slice(0, questionCount).map((question, i) => ({
      index: i + 1,
      layer: i === 1 ? "behavior" : "",
      question,
      competencyName: "",
      source: "llm",
    }));

    return {
      id: `mock-free-session-${key}`,
      user: { name: u.name || "", email: u.email || "" },
      status: isCompleted ? "completed" : "abandoned",
      plan: "free",
      role: pick(ROLE_POOL, rand),
      questionCount,
      questionsAllowed,
      questions,
      answerCount: questionCount,
      createdAt,
      completedAt: isCompleted ? createdAt : null,
    };
  });
}
