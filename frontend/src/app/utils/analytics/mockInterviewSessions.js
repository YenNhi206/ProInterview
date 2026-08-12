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

    return {
      id: `mock-free-session-${key}`,
      user: { name: u.name || "", email: u.email || "" },
      status: isCompleted ? "completed" : "abandoned",
      plan: "free",
      role: pick(ROLE_POOL, rand),
      questionCount,
      questionsAllowed,
      questions: [],
      answerCount: questionCount,
      createdAt,
      completedAt: isCompleted ? createdAt : null,
    };
  });
}
