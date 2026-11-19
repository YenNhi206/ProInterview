import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  applyTestEnv,
  startMongoHarness,
  stopMongoHarness,
  mintAccessToken,
  startHttpServer,
  stopHttpServer,
} from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let http;
let User;
let CandidateProfile;
let CVDocument;
let InterviewSession;
let createApp;
let validateCvFile;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ CandidateProfile } = await import("../models/CandidateProfile.js"));
  ({ CVDocument } = await import("../models/CVDocument.js"));
  ({ InterviewSession } = await import("../models/InterviewSession.js"));
  ({ validateCvFile } = await import("../services/cvValidator.js"));
  ({ createApp } = await import("../app.js"));
  http = await startHttpServer(createApp());
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

function authHeaders(userId) {
  return {
    Authorization: `Bearer ${mintAccessToken(userId)}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

describe("Giai đoạn 3: Candidate Profile và kho CV (PR-01, PR-02, PR-04, PR-07, PR-09)", () => {
  let candidateUser;
  let otherUser;

  before(async () => {
    candidateUser = await User.create({
      email: "candidate.test@dev.local",
      name: "Nguyễn Ứng Viên",
      role: "customer",
      field: "Frontend Developer",
    });

    otherUser = await User.create({
      email: "other.user@dev.local",
      name: "Trần Người Dùng Khác",
      role: "customer",
    });
  });

  // ── PR-01: CandidateProfile API ──
  it("PR-01: GET /api/profile/me tự động khởi tạo CandidateProfile khi vào lần đầu", async () => {
    const res = await fetch(`${http.baseUrl}/api/profile/me`, {
      headers: authHeaders(candidateUser._id),
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(body.profile);
    assert.equal(String(body.profile.userId), String(candidateUser._id));
    assert.ok(Array.isArray(body.profile.competencies));
    assert.ok(body.profile.competencies.length >= 6);

    // Kiểm tra DB thực sự đã có document
    const inDb = await CandidateProfile.findOne({ userId: candidateUser._id });
    assert.ok(inDb);
    assert.equal(inDb.targetRole, "Frontend Developer");
  });

  it("PR-01: PATCH /api/profile/me cập nhật headline, targetRoles, summary", async () => {
    const res = await fetch(`${http.baseUrl}/api/profile/me`, {
      method: "PATCH",
      headers: authHeaders(candidateUser._id),
      body: JSON.stringify({
        headline: "Senior Frontend React & TypeScript Specialist",
        targetRole: "Senior Frontend Engineer",
        targetRoles: ["Frontend Engineer", "Fullstack Engineer"],
        summary: "Kỹ sư phần mềm có 4 năm kinh nghiệm phát triển SPA quy mô lớn.",
        yearsOfExperience: 4,
      }),
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.profile.headline, "Senior Frontend React & TypeScript Specialist");
    assert.equal(body.profile.yearsOfExperience, 4);
    assert.deepEqual(body.profile.targetRoles, ["Frontend Engineer", "Fullstack Engineer"]);
  });

  // ── PR-02: CVDocument CRUD, multiple CVs, duplicate, set default ──
  let firstCvId;
  let secondCvId;

  it("PR-02: POST /api/cvs tạo CV đầu tiên -> tự động thành CV mặc định (isDefault = true)", async () => {
    const res = await fetch(`${http.baseUrl}/api/cvs`, {
      method: "POST",
      headers: authHeaders(candidateUser._id),
      body: JSON.stringify({
        title: "CV Frontend React 2026",
        targetRole: "Frontend Developer",
        fileName: "cv_frontend_2026.pdf",
        fileUrl: "/uploads/cv_mock_test_1.pdf",
        skills: ["React", "TypeScript", "Next.js", "TailwindCSS"],
        content: {
          personalInfo: {
            fullName: "Nguyễn Ứng Viên",
            email: "candidate.test@dev.local",
            phone: "0901234567",
            location: "Hồ Chí Minh",
          },
          summary: "Frontend Developer đam mê xây dựng giao diện hiệu năng cao.",
          experiences: [
            {
              company: "Tech Solutions Corp",
              position: "Frontend Developer",
              startDate: "2024",
              endDate: "Hiện tại",
              isCurrent: true,
              description: "Phát triển hệ thống micro-frontend",
              bullets: ["Tối ưu FCP từ 2.4s xuống 0.8s", "Xây dựng 30+ UI components"],
            },
          ],
        },
      }),
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.ok(body.cv);
    assert.equal(body.cv.isDefault, true);
    assert.equal(body.cv.version, 1);
    firstCvId = body.cv.id;

    // Kiểm tra CandidateProfile đồng bộ defaultCvId
    const profile = await CandidateProfile.findOne({ userId: candidateUser._id });
    assert.equal(String(profile.defaultCvId), String(firstCvId));
  });

  it("PR-02: POST /api/cvs tạo CV thứ 2 với isDefault = true -> CV đầu tiên tự động bỏ default", async () => {
    const res = await fetch(`${http.baseUrl}/api/cvs`, {
      method: "POST",
      headers: authHeaders(candidateUser._id),
      body: JSON.stringify({
        title: "CV Fullstack Node & React",
        targetRole: "Fullstack Engineer",
        fileName: "cv_fullstack.pdf",
        fileUrl: "/uploads/cv_mock_test_2.pdf",
        isDefault: true,
      }),
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.cv.isDefault, true);
    secondCvId = body.cv.id;

    // CV đầu tiên không còn là default
    const cv1 = await CVDocument.findById(firstCvId);
    assert.equal(cv1.isDefault, false);

    // CandidateProfile defaultCvId trỏ sang CV thứ 2
    const profile = await CandidateProfile.findOne({ userId: candidateUser._id });
    assert.equal(String(profile.defaultCvId), String(secondCvId));
  });

  it("PR-02: GET /api/cvs trả danh sách CVs của đúng user", async () => {
    const res = await fetch(`${http.baseUrl}/api/cvs`, {
      headers: authHeaders(candidateUser._id),
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.items.length, 2);
    // Sắp xếp: CV mặc định luôn lên đầu
    assert.equal(body.items[0].id, secondCvId);
    assert.equal(body.items[0].isDefault, true);
  });

  it("PR-02: PATCH /api/cvs/:id cập nhật content làm tăng version", async () => {
    const res = await fetch(`${http.baseUrl}/api/cvs/${firstCvId}`, {
      method: "PATCH",
      headers: authHeaders(candidateUser._id),
      body: JSON.stringify({
        title: "CV Frontend React (Updated)",
        content: {
          summary: "Tóm tắt mới đã được cập nhật sau khi phân tích AI.",
        },
      }),
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.cv.title, "CV Frontend React (Updated)");
    assert.equal(body.cv.version, 2); // Version tăng từ 1 lên 2
  });

  it("PR-02: POST /api/cvs/:id/duplicate nhân bản CV thành công", async () => {
    const res = await fetch(`${http.baseUrl}/api/cvs/${firstCvId}/duplicate`, {
      method: "POST",
      headers: authHeaders(candidateUser._id),
    });
    const body = await res.json();

    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.ok(body.cv.title.startsWith("[Bản sao]"));
    assert.equal(String(body.cv.parentCvId), String(firstCvId));
    assert.equal(body.cv.isDefault, false);
    assert.equal(body.cv.version, 1);
  });

  it("PR-02: POST /api/cvs/:id/set-default đổi lại CV mặc định", async () => {
    const res = await fetch(`${http.baseUrl}/api/cvs/${firstCvId}/set-default`, {
      method: "POST",
      headers: authHeaders(candidateUser._id),
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.cv.isDefault, true);

    const cv2 = await CVDocument.findById(secondCvId);
    assert.equal(cv2.isDefault, false);

    const profile = await CandidateProfile.findOne({ userId: candidateUser._id });
    assert.equal(String(profile.defaultCvId), String(firstCvId));
  });

  it("PR-02: Chặn user khác truy cập hoặc sửa CV của người khác (404/403)", async () => {
    const res = await fetch(`${http.baseUrl}/api/cvs/${firstCvId}`, {
      headers: authHeaders(otherUser._id),
    });
    assert.equal(res.status, 404);

    const patchRes = await fetch(`${http.baseUrl}/api/cvs/${firstCvId}`, {
      method: "PATCH",
      headers: authHeaders(otherUser._id),
      body: JSON.stringify({ title: "Hack title" }),
    });
    assert.equal(patchRes.status, 404);
  });

  it("PR-02: DELETE /api/cvs/:id xóa CV mặc định -> CV còn lại tự động thành mặc định mới", async () => {
    const res = await fetch(`${http.baseUrl}/api/cvs/${firstCvId}`, {
      method: "DELETE",
      headers: authHeaders(candidateUser._id),
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);

    // Kiểm tra CV thứ 2 đã được tự động set làm mặc định
    const remainingDefault = await CVDocument.findOne({ userId: candidateUser._id, isDefault: true });
    assert.ok(remainingDefault);
    assert.equal(String(remainingDefault._id), String(secondCvId));

    const profile = await CandidateProfile.findOne({ userId: candidateUser._id });
    assert.equal(String(profile.defaultCvId), String(secondCvId));
  });

  // ── PR-04: Validate file CV (từ chối ảnh và hóa đơn) ──
  it("PR-04: Từ chối ảnh PNG với lỗi tiếng Việt rõ ràng", () => {
    // PNG magic bytes
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

    assert.throws(
      () =>
        validateCvFile({
          originalname: "avatar.png",
          mimetype: "image/png",
          buffer: pngBuffer,
          size: pngBuffer.length,
        }),
      (err) => {
        assert.ok(err.status === 400);
        assert.ok(err.message.includes("không được chấp nhận") || err.message.includes("hình ảnh"));
        return true;
      }
    );
  });

  it("PR-04: Từ chối file PDF nhưng chứa nội dung hóa đơn VAT", () => {
    const invoiceContent = Buffer.from(
      "CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM\nHÓA ĐƠN GIÁ TRỊ GIA TĂNG (VAT)\nSố: 0012345\nTiền hàng: 5,000,000 VND"
    );

    assert.throws(
      () =>
        validateCvFile({
          originalname: "hoa_don.pdf",
          mimetype: "application/pdf",
          buffer: invoiceContent,
          size: invoiceContent.length,
        }),
      (err) => {
        assert.ok(err.status === 400);
        assert.ok(err.message.includes("hóa đơn") || err.message.includes("chứng từ"));
        return true;
      }
    );
  });

  it("PR-04: Chấp nhận file CV hợp lệ chứa các mục kinh nghiệm, học vấn, kỹ năng", () => {
    const validCvBuffer = Buffer.from(
      "HỌ VÀ TÊN: NGUYỄN VĂN A\nMỤC TIÊU NGHỀ NGHIỆP: Software Engineer\nKINH NGHIỆM LÀM VIỆC: 3 năm tại FPT Software\nHỌC VẤN: Đại học Bách Khoa\nKỸ NĂNG: Node.js, React, MongoDB"
    );

    const result = validateCvFile({
      originalname: "my_cv.txt",
      mimetype: "text/plain",
      buffer: validCvBuffer,
      size: validCvBuffer.length,
    });

    assert.equal(result.isValid, true);
  });

  // ── PR-07: API Competencies và DTO cho Application Snapshot ──
  it("PR-07: GET /api/profile/me/competencies trả DTO đầy đủ kèm bằng chứng từ phỏng vấn AI", async () => {
    // Tạo 1 buổi phỏng vấn AI completed có overallScore cho candidate
    await InterviewSession.create({
      userId: candidateUser._id,
      roleCategory: "frontend",
      status: "completed",
      feedback: {
        overallScore: 88,
        summary: "Ứng viên có phản xạ kỹ thuật vững vàng.",
      },
    });

    const res = await fetch(`${http.baseUrl}/api/profile/me/competencies`, {
      headers: authHeaders(candidateUser._id),
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.competencies));
    assert.ok(body.competencies.length >= 6);

    // Kiểm tra technical_mastery đã nhận evidence từ buổi phỏng vấn
    const tech = body.competencies.find((c) => c.key === "technical_mastery");
    assert.ok(tech);
    assert.ok(tech.evidenceCount >= 1);
    assert.equal(tech.score, 88);
    assert.equal(tech.level, 4); // 88 / 20 = ~4

    // Kiểm tra Application Snapshot DTO (dùng cho JB-08)
    assert.ok(body.snapshot);
    assert.equal(body.snapshot.headline, "Senior Frontend React & TypeScript Specialist");
    assert.equal(body.snapshot.isVerified, true);
    assert.ok(Array.isArray(body.snapshot.competencies));
  });

  // ── PR-09: Xuất PDF backend bằng pdfkit + font DejaVu ──
  it("PR-09: POST /api/cvs/:id/export-pdf tạo file PDF tiếng Việt chuẩn ATS", async () => {
    const res = await fetch(`${http.baseUrl}/api/cvs/${secondCvId}/export-pdf`, {
      method: "POST",
      headers: authHeaders(candidateUser._id),
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "application/pdf");

    const pdfBuffer = Buffer.from(await res.arrayBuffer());
    assert.ok(pdfBuffer.length > 500); // File PDF hợp lệ phải có nội dung
    // Magic header của PDF: %PDF-
    assert.equal(pdfBuffer.slice(0, 5).toString("utf-8"), "%PDF-");
  });
});

