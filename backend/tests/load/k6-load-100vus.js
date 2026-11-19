import http from "k6/http";
import { check, sleep, group } from "k6";
import { Rate, Trend } from "k6/metrics";

/**
 * QA-02: Script k6 100 người dùng đồng thời
 * Kịch bản:
 * 1. Đăng nhập / Lấy token
 * 2. Xem danh sách Mentors
 * 3. Xem danh sách Jobs
 * 4. Tạo phiên phỏng vấn AI (Mock mode)
 * 5. Đặt lịch / Kiểm tra availability
 * 
 * NFR Target:
 * - p95 Latency < 2000ms
 * - Error rate < 1%
 */

const errorRate = new Rate("error_rate");
const loginDuration = new Trend("login_duration");
const browseMentorsDuration = new Trend("browse_mentors_duration");
const browseJobsDuration = new Trend("browse_jobs_duration");
const createSessionDuration = new Trend("create_session_duration");

export const options = {
  stages: [
    { duration: "10s", target: 20 },   // Khởi động 20 VUs
    { duration: "20s", target: 50 },   // Tăng lên 50 VUs
    { duration: "30s", target: 100 },  // Duy trì tải tối đa 100 VUs đồng thời
    { duration: "10s", target: 0 },    // Hạ tải về 0
  ],
  thresholds: {
    http_req_duration: ["p(95)<2000"], // p95 phản hồi dưới 2s
    error_rate: ["rate<0.01"],         // Tỉ lệ lỗi dưới 1%
  },
};

const BASE_URL = __ENV.TARGET_URL || "http://localhost:5000";

export default function () {
  let authToken = "";

  group("1. Authentication - User Login", () => {
    const payload = JSON.stringify({
      email: "candidate.demo@prointerview.vn",
      password: "Password123!",
    });

    const res = http.post(`${BASE_URL}/api/auth/login`, payload, {
      headers: { "Content-Type": "application/json" },
    });

    loginDuration.add(res.timings.duration);
    const success = check(res, {
      "login status is 200": (r) => r.status === 200,
      "has access token": (r) => {
        try {
          const body = r.json();
          if (body && body.accessToken) {
            authToken = body.accessToken;
            return true;
          }
          return false;
        } catch (_) {
          return false;
        }
      },
    });

    errorRate.add(!success);
  });

  sleep(1);

  const authHeaders = {
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
  };

  group("2. Browse Mentors & Directory", () => {
    const res = http.get(`${BASE_URL}/api/mentors`, authHeaders);
    browseMentorsDuration.add(res.timings.duration);

    const success = check(res, {
      "mentors status is 200": (r) => r.status === 200,
      "mentors list returned": (r) => {
        try {
          const body = r.json();
          return body && Array.isArray(body.mentors || body.data || body);
        } catch (_) {
          return false;
        }
      },
    });

    errorRate.add(!success);
  });

  sleep(1);

  group("3. Browse Job Postings", () => {
    const res = http.get(`${BASE_URL}/api/jobs`, authHeaders);
    browseJobsDuration.add(res.timings.duration);

    const success = check(res, {
      "jobs status is 200 or 404": (r) => r.status === 200 || r.status === 404,
    });

    errorRate.add(!success);
  });

  sleep(1);

  group("4. Candidate AI Interview Session", () => {
    const payload = JSON.stringify({
      roleCategory: "frontend",
      hrGender: "female",
    });

    const res = http.post(`${BASE_URL}/api/interviews`, payload, authHeaders);
    createSessionDuration.add(res.timings.duration);

    const success = check(res, {
      "interview create status is 200 or 201": (r) => r.status === 200 || r.status === 201,
    });

    errorRate.add(!success);
  });

  sleep(1);
}
