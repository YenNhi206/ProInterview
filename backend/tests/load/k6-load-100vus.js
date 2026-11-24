import http from "k6/http";
import { check, sleep, group } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

/**
 * QA-02 (NFR-04): 100 người dùng đồng thời trên staging.
 *
 *   k6 run -e TARGET_URL=https://<staging-backend> -e K6_EMAIL=... -e K6_PASSWORD=... \
 *     --summary-export=docs/report/nfr-raw/k6-summary.json backend/tests/load/k6-load-100vus.js
 *
 * Kịch bản mỗi VU: đăng nhập 1 lần (giữ token cho các vòng sau) → xem mentor → xem job → tạo buổi
 * phỏng vấn AI với 3 câu baseline. Backend staging bật `LOAD_TEST=true` (bỏ rate limit, `middleware/rateLimiters.js`)
 * và `MOCK_AI_SERVICES=true` (không gọi AI thật, QA-01) để đo hạ tầng, không đo giới hạn chống spam.
 *
 * Sửa 24/11/2026 (đề xuất ae): đăng nhập trả `token` (không phải `accessToken`); tạo buổi là
 * `POST /api/interviews/sessions` (không có `POST /api/interviews`); job phải trả 200 (không chấp nhận 404).
 * Hết lượt phỏng vấn (403) là phản hồi nghiệp vụ đúng nên không tính lỗi, nhưng đếm riêng
 * ở `interview_quota_limited` để báo cáo ghi rõ.
 */

const errorRate = new Rate("error_rate");
const loginDuration = new Trend("login_duration", true);
const browseMentorsDuration = new Trend("browse_mentors_duration", true);
const browseJobsDuration = new Trend("browse_jobs_duration", true);
const createSessionDuration = new Trend("create_session_duration", true);
const quotaLimited = new Counter("interview_quota_limited");

export const options = {
  stages: [
    { duration: "10s", target: 20 },
    { duration: "20s", target: 50 },
    { duration: "30s", target: 100 }, // giữ 100 VU đồng thời
    { duration: "10s", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    error_rate: ["rate<0.01"],
  },
};

const BASE_URL = __ENV.TARGET_URL || "http://localhost:5000";
const EMAIL = __ENV.K6_EMAIL || "candidate.demo@prointerview.vn";
const PASSWORD = __ENV.K6_PASSWORD || "Password123!";

/** Lấy 3 câu baseline một lần cho cả bài test (API công khai). */
export function setup() {
  const res = http.get(`${BASE_URL}/api/interviews/baseline-questions`);
  const ok = check(res, { "baseline questions 200": (r) => r.status === 200 });
  if (!ok) throw new Error(`Không lấy được câu baseline: HTTP ${res.status}`);
  return { questions: res.json("questions") };
}

let token = ""; // mỗi VU một biến riêng: đăng nhập một lần rồi dùng lại

function login() {
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ email: EMAIL, password: PASSWORD }), {
    headers: { "Content-Type": "application/json" },
    tags: { name: "POST /api/auth/login" },
  });
  loginDuration.add(res.timings.duration);
  let value = "";
  const ok = check(res, {
    "login 200": (r) => r.status === 200,
    "login có token": (r) => {
      try {
        value = r.json("token") || "";
        return Boolean(value);
      } catch (_) {
        return false;
      }
    },
  });
  errorRate.add(!ok);
  return ok ? value : "";
}

export default function (data) {
  group("1. Đăng nhập", () => {
    if (!token) token = login();
  });
  if (!token) {
    sleep(1);
    return;
  }
  const auth = { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } };
  sleep(1);

  group("2. Xem mentor", () => {
    const res = http.get(`${BASE_URL}/api/mentors`, { ...auth, tags: { name: "GET /api/mentors" } });
    browseMentorsDuration.add(res.timings.duration);
    errorRate.add(!check(res, {
      "mentors 200": (r) => r.status === 200,
      "mentors là mảng": (r) => {
        try {
          return Array.isArray(r.json("mentors"));
        } catch (_) {
          return false;
        }
      },
    }));
  });
  sleep(1);

  group("3. Xem job", () => {
    const res = http.get(`${BASE_URL}/api/jobs`, { ...auth, tags: { name: "GET /api/jobs" } });
    browseJobsDuration.add(res.timings.duration);
    errorRate.add(!check(res, { "jobs 200": (r) => r.status === 200 }));
  });
  sleep(1);

  group("4. Tạo buổi phỏng vấn AI", () => {
    const res = http.post(
      `${BASE_URL}/api/interviews/sessions`,
      JSON.stringify({ hrGender: "female", questions: data.questions }),
      { ...auth, tags: { name: "POST /api/interviews/sessions" } },
    );
    createSessionDuration.add(res.timings.duration);
    // createSession chỉ trả 403 khi hết lượt phỏng vấn (interviewsController, kiểm quota nguyên tử).
    const limited = res.status === 403;
    if (limited) quotaLimited.add(1);
    errorRate.add(!check(res, { "tạo buổi 200/201 (hoặc 403 hết lượt)": (r) => r.status === 200 || r.status === 201 || limited }));
  });
  sleep(1);
}
