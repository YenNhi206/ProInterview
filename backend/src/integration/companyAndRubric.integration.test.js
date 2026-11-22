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
let Company;
let CompanyInvite;
let CompanyRubric;
let QuestionBank;
let createApp;
let companyService;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Company } = await import("../models/Company.js"));
  ({ CompanyInvite } = await import("../models/CompanyInvite.js"));
  ({ CompanyRubric } = await import("../models/CompanyRubric.js"));
  ({ QuestionBank } = await import("../models/QuestionBank.js"));
  companyService = await import("../services/companyService.js");
  ({ createApp } = await import("../app.js"));
  http = await startHttpServer(createApp());
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

/** Mô tả đủ 6 mức 0–5 (bắt buộc khi gửi duyệt, CO-14). */
const LEVELS = { 0: "Chưa có", 1: "Biết sơ", 2: "Làm được với hỗ trợ", 3: "Tự làm được", 4: "Làm tốt, hướng dẫn người khác", 5: "Chuyên gia" };
const crit = (name, shrmKey, weight, extra = {}) => ({ name, shrmKey, weight, levels: LEVELS, ...extra });

function authHeaders(userId) {
  return {
    Authorization: `Bearer ${mintAccessToken(userId)}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

describe("CO-01 đến CO-08: Quản lý Công ty, Lời mời, Phân quyền và Rubric", () => {
  let adminUser;
  let platformMod;
  let candidateUser;
  let companyA;
  let companyB;
  let companyModA;
  let companyModB;

  before(async () => {
    adminUser = await User.create({
      name: "Super Admin",
      email: `admin-${Date.now()}@prointerview.dev`,
      role: "admin",
    });

    platformMod = await User.create({
      name: "Platform Moderator",
      email: `pmod-${Date.now()}@prointerview.dev`,
      role: "moderator",
    });

    candidateUser = await User.create({
      name: "Candidate Student",
      email: `candidate-${Date.now()}@student.dev`,
      role: "customer",
    });

    companyA = await Company.create({
      name: "Tập đoàn VNG",
      slug: `vng-corp-${Date.now()}`,
      industry: "Công nghệ thông tin",
      status: "active",
    });

    companyB = await Company.create({
      name: "FPT Software",
      slug: `fpt-software-${Date.now()}`,
      industry: "Phần mềm",
      status: "active",
    });

    companyModA = await User.create({
      name: "HR VNG",
      email: `hr-vng-${Date.now()}@vng.dev`,
      role: "company_moderator",
      companyId: companyA._id,
    });

    companyModB = await User.create({
      name: "HR FPT",
      email: `hr-fpt-${Date.now()}@fpt.dev`,
      role: "company_moderator",
      companyId: companyB._id,
    });
  });

  // ── CO-01: Quản lý công ty & Khóa công ty chặn truy cập ──
  it("CO-01: Admin tạo công ty, cập nhật và populate orgId", async () => {
    const res = await fetch(`${http.baseUrl}/api/admin/companies`, {
      method: "POST",
      headers: authHeaders(adminUser._id),
      body: JSON.stringify({
        name: "Viettel Telecom",
        industry: "Viễn thông",
        website: "https://viettel.vn",
      }),
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.company.name, "Viettel Telecom");

    // Tạo câu hỏi có orgId và kiểm tra populate("orgId")
    const q = await QuestionBank.create({
      text: `Câu hỏi Viettel ${Date.now()}`,
      originalText: `Câu hỏi Viettel ${Date.now()}`,
      textHash: `hash-viettel-${Date.now()}`,
      orgId: data.company._id,
      source: "org_template",
      roleCategory: "telecom_engineer",
      competencyId: "system_design",
      status: "approved",
    });

    const populatedQ = await QuestionBank.findById(q._id).populate("orgId");
    assert.equal(populatedQ.orgId.name, "Viettel Telecom");
  });

  it("CO-01 & CO-03: Công ty bị tạm khóa thì Company Moderator bị chặn 403", async () => {
    // Khóa companyA
    companyA.status = "suspended";
    await companyA.save();

    const res = await fetch(`${http.baseUrl}/api/company/profile`, {
      headers: authHeaders(companyModA._id),
    });

    assert.equal(res.status, 403);
    const data = await res.json();
    assert.match(data.error, /tạm khóa/);

    // Mở khóa lại để tiếp tục test
    companyA.status = "active";
    await companyA.save();

    const resActive = await fetch(`${http.baseUrl}/api/company/profile`, {
      headers: authHeaders(companyModA._id),
    });
    assert.equal(resActive.status, 200);
  });

  // ── CO-02: Lời mời tham gia công ty ──
  it("CO-02 & Quyết định 14: Từ chối mời email đã có role khác (customer/mentor)", async () => {
    const res = await fetch(`${http.baseUrl}/api/admin/companies/${companyA._id}/invites`, {
      method: "POST",
      headers: authHeaders(adminUser._id),
      body: JSON.stringify({ email: candidateUser.email }),
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /vai trò khác/);
  });

  it("CO-02: Tạo lời mời, verify token, và nhận lời mời tạo tài khoản mới", async () => {
    const inviteEmail = `newhr-${Date.now()}@vng.local`;
    const inviteRes = await fetch(`${http.baseUrl}/api/admin/companies/${companyA._id}/invites`, {
      method: "POST",
      headers: authHeaders(adminUser._id),
      body: JSON.stringify({ email: inviteEmail }),
    });

    assert.equal(inviteRes.status, 201);
    const inviteData = await inviteRes.json();
    assert.ok(inviteData.inviteUrl);
    const token = inviteData.inviteUrl.split("/").pop();

    // Verify token
    const verifyRes = await fetch(`${http.baseUrl}/api/company-invites/verify/${token}`);
    assert.equal(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.invite.email, inviteEmail);
    assert.equal(verifyData.invite.company.name, companyA.name);

    // Accept invite
    const acceptRes = await fetch(`${http.baseUrl}/api/company-invites/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        name: "HR Tuyển Dụng Mới",
        password: "Password123!",
      }),
    });

    assert.equal(acceptRes.status, 201);
    const acceptData = await acceptRes.json();
    assert.equal(acceptData.user.role, "company_moderator");
    assert.equal(String(acceptData.user.companyId), String(companyA._id));

    // Đăng nhập được ngay bằng mật khẩu vừa đặt (trước đây mật khẩu không được lưu)
    const loginRes = await fetch(`${http.baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: inviteEmail, password: "Password123!" }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.equal(loginData.user.role, "company_moderator");

    // Thử nhận lại lần 2 bằng cùng token -> phải bị 400 (token dùng 1 lần)
    const reuseRes = await fetch(`${http.baseUrl}/api/company-invites/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        name: "Hacker",
        password: "Password123!",
      }),
    });
    assert.equal(reuseRes.status, 400);
  });

  // ── CO-03: Kiểm tra truy cập chéo công ty ──
  it("CO-03: Chặn 403 khi Company Moderator công ty B truy cập câu hỏi hoặc rubric của công ty A", async () => {
    // Company A tạo 1 câu hỏi và 1 rubric
    const qA = await QuestionBank.create({
      text: `Bảo mật công ty A ${Date.now()}`,
      originalText: `Bảo mật công ty A ${Date.now()}`,
      textHash: `hash-a-${Date.now()}`,
      orgId: companyA._id,
      source: "org_template",
      roleCategory: "backend_engineer",
      status: "approved",
    });

    const rubricA = await CompanyRubric.create({
      companyId: companyA._id,
      title: "Rubric Backend VNG",
      roleCategory: "backend_engineer",
      status: "draft",
    });

    // Company Mod B thử sửa câu hỏi của A -> 403
    const editQRes = await fetch(`${http.baseUrl}/api/company/questions/${qA._id}`, {
      method: "PATCH",
      headers: authHeaders(companyModB._id),
      body: JSON.stringify({ questionText: "Sửa lén bởi công ty B" }),
    });
    assert.equal(editQRes.status, 403);

    // Company Mod B thử sửa rubric của A -> 403
    const editRubricRes = await fetch(`${http.baseUrl}/api/company/rubrics/${rubricA._id}`, {
      method: "PATCH",
      headers: authHeaders(companyModB._id),
      body: JSON.stringify({ title: "Sửa rubric của A" }),
    });
    assert.equal(editRubricRes.status, 403);
  });

  // ── CO-05: Quản lý câu hỏi công ty & ghi history ──
  it("CO-05: Company Moderator tạo câu, sửa câu (ghi history) và duyệt/từ chối", async () => {
    const qText = `Câu hỏi React Native VNG ${Date.now()}`;
    const createRes = await fetch(`${http.baseUrl}/api/company/questions`, {
      method: "POST",
      headers: authHeaders(companyModA._id),
      body: JSON.stringify({
        questionText: qText,
        roleCategory: "mobile",
        competencyId: "technical_learning",
        status: "draft",
      }),
    });

    assert.equal(createRes.status, 201);
    const createData = await createRes.json();
    const qId = createData.question._id;

    // Sửa câu hỏi
    const editRes = await fetch(`${http.baseUrl}/api/company/questions/${qId}`, {
      method: "PATCH",
      headers: authHeaders(companyModA._id),
      body: JSON.stringify({
        questionText: `${qText} (đã tối ưu)`,
        reason: "Cải thiện độ rõ nghĩa của câu hỏi",
      }),
    });

    assert.equal(editRes.status, 200);
    const editData = await editRes.json();
    assert.equal(editData.question.history.length, 2);
    assert.equal(editData.question.history[1].action, "edit");
    assert.equal(editData.question.history[1].previousQuestion, qText);

    // Duyệt câu hỏi
    const approveRes = await fetch(`${http.baseUrl}/api/company/questions/${qId}/approve`, {
      method: "POST",
      headers: authHeaders(companyModA._id),
      body: JSON.stringify({ reason: "Đã đạt chuẩn tuyển dụng" }),
    });

    assert.equal(approveRes.status, 200);
    const approveData = await approveRes.json();
    assert.equal(approveData.question.status, "approved");
    assert.equal(approveData.question.history.pop().action, "approve");
  });

  // ── CO-07 & CO-08: Soạn Rubric, validate 100% trọng số, Platform Mod duyệt ──
  it("CO-07 & CO-08: Soạn rubric, kiểm tra tổng trọng số 100%, gửi duyệt và Platform Mod phê duyệt", async () => {
    // 1. Tạo bản nháp rubric
    const createRes = await fetch(`${http.baseUrl}/api/company/rubrics`, {
      method: "POST",
      headers: authHeaders(companyModA._id),
      body: JSON.stringify({
        title: "Rubric Senior DevOps",
        roleCategory: "devops",
        description: "Khung năng lực đánh giá vị trí DevOps",
      }),
    });

    assert.equal(createRes.status, 201);
    const rubricId = (await createRes.json()).rubric._id;

    // 2. Cập nhật tiêu chí có tổng trọng số != 100% (ví dụ 80%) và thử submit
    await fetch(`${http.baseUrl}/api/company/rubrics/${rubricId}`, {
      method: "PATCH",
      headers: authHeaders(companyModA._id),
      body: JSON.stringify({
        criteria: [
          crit("CI/CD Pipeline", "technical_learning", 50),
          crit("Kubernetes & Docker", "problem_solving", 30),
        ],
      }),
    });

    const submitFailRes = await fetch(`${http.baseUrl}/api/company/rubrics/${rubricId}/submit`, {
      method: "POST",
      headers: authHeaders(companyModA._id),
    });

    assert.equal(submitFailRes.status, 400);
    const failData = await submitFailRes.json();
    assert.match(failData.error, /100%/);

    // 3. Sửa lại tiêu chí đủ 100% và submit thành công
    await fetch(`${http.baseUrl}/api/company/rubrics/${rubricId}`, {
      method: "PATCH",
      headers: authHeaders(companyModA._id),
      body: JSON.stringify({
        criteria: [
          crit("CI/CD Pipeline", "technical_learning", 60),
          crit("Kubernetes & Docker", "problem_solving", 40),
        ],
      }),
    });

    const submitOkRes = await fetch(`${http.baseUrl}/api/company/rubrics/${rubricId}/submit`, {
      method: "POST",
      headers: authHeaders(companyModA._id),
    });

    assert.equal(submitOkRes.status, 200);
    const submitOkData = await submitOkRes.json();
    assert.equal(submitOkData.rubric.status, "pending_review");

    // 4. Platform Moderator xem danh sách rubric pending và duyệt
    const listModRes = await fetch(`${http.baseUrl}/api/moderator/rubrics?status=pending_review`, {
      headers: authHeaders(platformMod._id),
    });

    assert.equal(listModRes.status, 200);
    const listModData = await listModRes.json();
    const targetRubric = listModData.rubrics.find((r) => String(r._id) === String(rubricId));
    assert.ok(targetRubric, "Rubric phải xuất hiện trong danh sách pending_review của moderator");

    // Duyệt rubric
    const approveRes = await fetch(`${http.baseUrl}/api/moderator/rubrics/${rubricId}/approve`, {
      method: "POST",
      headers: authHeaders(platformMod._id),
      body: JSON.stringify({ comment: "Rubric đạt chuẩn SHRM, tiêu chí phân tách rõ." }),
    });

    assert.equal(approveRes.status, 200);
    const approveData = await approveRes.json();
    assert.equal(approveData.rubric.status, "approved");

    // 5. Kiểm tra tính độc nhất: Khi tạo version 2 và được duyệt, version 1 phải chuyển thành `archived`
    const createV2Res = await fetch(`${http.baseUrl}/api/company/rubrics`, {
      method: "POST",
      headers: authHeaders(companyModA._id),
      body: JSON.stringify({
        title: "Rubric Senior DevOps V2",
        roleCategory: "devops",
      }),
    });
    const v2Id = (await createV2Res.json()).rubric._id;

    await fetch(`${http.baseUrl}/api/company/rubrics/${v2Id}`, {
      method: "PATCH",
      headers: authHeaders(companyModA._id),
      body: JSON.stringify({
        criteria: [crit("All-in-one DevOps", "technical_learning", 100)],
      }),
    });

    await fetch(`${http.baseUrl}/api/company/rubrics/${v2Id}/submit`, {
      method: "POST",
      headers: authHeaders(companyModA._id),
    });

    // Mod duyệt V2
    await fetch(`${http.baseUrl}/api/moderator/rubrics/${v2Id}/approve`, {
      method: "POST",
      headers: authHeaders(platformMod._id),
      body: JSON.stringify({ comment: "Duyệt version 2" }),
    });

    // Kiểm tra version 1 đã chuyển thành `archived`
    const v1Doc = await CompanyRubric.findById(rubricId);
    assert.equal(v1Doc.status, "archived");

    const v2Doc = await CompanyRubric.findById(v2Id);
    assert.equal(v2Doc.status, "approved");
  });
  // ── CO-14: trình soạn rubric — kiểm năng lực, mô tả mức, câu áp dụng, từ chối → sửa → gửi lại ──
  it("CO-14: kiểm shrmKey theo LP-01, đủ 6 mức mới gửi duyệt, gắn câu đã duyệt của công ty, bị từ chối thì sửa và gửi lại", async () => {
    const post = (path, body, user = companyModA) =>
      fetch(`${http.baseUrl}${path}`, { method: "POST", headers: authHeaders(user._id), body: JSON.stringify(body ?? {}) });
    const patch = (path, body) =>
      fetch(`${http.baseUrl}${path}`, { method: "PATCH", headers: authHeaders(companyModA._id), body: JSON.stringify(body) });

    // Năng lực ngoài bộ tiêu chí LP-01 → 400
    const badKey = await post("/api/company/rubrics", { title: "Rubric FE", roleCategory: "frontend", criteria: [crit("UI", "technical_mastery", 100)] });
    assert.equal(badKey.status, 400);
    assert.match((await badKey.json()).error, /bộ tiêu chí/);

    // Câu hỏi của công ty khác / chưa duyệt không gắn được
    const otherQ = await QuestionBank.create({ text: `Câu của FPT ${Date.now()}`, textHash: `hash-co14-b-${Date.now()}`, orgId: companyB._id, source: "org_template", roleCategory: "frontend", status: "approved" });
    const draftQ = await QuestionBank.create({ text: `Câu nháp VNG ${Date.now()}`, textHash: `hash-co14-d-${Date.now()}`, orgId: companyA._id, source: "org_template", roleCategory: "frontend", status: "draft" });
    const okQ = await QuestionBank.create({ text: `Câu đã duyệt VNG ${Date.now()}`, textHash: `hash-co14-a-${Date.now()}`, orgId: companyA._id, source: "org_template", roleCategory: "frontend", status: "approved" });
    for (const q of [otherQ, draftQ]) {
      const res = await post("/api/company/rubrics", { title: "Rubric FE", roleCategory: "frontend", criteria: [crit("UI", "communication", 100, { questionIds: [String(q._id)] })] });
      assert.equal(res.status, 400);
    }

    // Bản nháp được thiếu mô tả mức, nhưng gửi duyệt thì 400
    const created = await post("/api/company/rubrics", {
      title: "Rubric FE", roleCategory: "frontend",
      criteria: [{ name: "Giao tiếp", shrmKey: "communication", weight: 100, levels: { 0: "Chưa có" }, questionIds: [String(okQ._id)], extra: "bị bỏ" }],
    });
    assert.equal(created.status, 201);
    const rubric = (await created.json()).rubric;
    assert.deepEqual(rubric.criteria[0].questionIds.map(String), [String(okQ._id)]);
    assert.equal(rubric.criteria[0].extra, undefined, "chỉ lưu field của model");
    const noLevels = await post(`/api/company/rubrics/${rubric._id}/submit`);
    assert.equal(noLevels.status, 400);
    assert.match((await noLevels.json()).error, /6 mức/);

    // Đủ mức → gửi duyệt; đang chờ duyệt thì không sửa, không gửi lại
    assert.equal((await patch(`/api/company/rubrics/${rubric._id}`, { criteria: [crit("Giao tiếp", "communication", 100)] })).status, 200);
    assert.equal((await post(`/api/company/rubrics/${rubric._id}/submit`)).status, 200);
    assert.equal((await patch(`/api/company/rubrics/${rubric._id}`, { title: "Sửa khi chờ" })).status, 409);
    assert.equal((await post(`/api/company/rubrics/${rubric._id}/submit`)).status, 409);

    // Platform Mod từ chối → công ty thấy lý do ở moderationNote.comment, sửa rồi gửi lại
    const reject = await post(`/api/moderator/rubrics/${rubric._id}/reject`, { comment: "Mô tả mức 3 và 4 chưa phân biệt rõ." }, platformMod);
    assert.equal(reject.status, 200);
    const seen = await (await fetch(`${http.baseUrl}/api/company/rubrics/${rubric._id}`, { headers: authHeaders(companyModA._id) })).json();
    assert.equal(seen.rubric.status, "rejected");
    assert.equal(seen.rubric.moderationNote.comment, "Mô tả mức 3 và 4 chưa phân biệt rõ.");
    const fixed = { ...LEVELS, 3: "Tự trình bày rõ cho người cùng chuyên môn", 4: "Trình bày rõ cho người ngoài chuyên môn" };
    assert.equal((await patch(`/api/company/rubrics/${rubric._id}`, { criteria: [crit("Giao tiếp", "communication", 100, { levels: fixed })] })).status, 200);
    const resubmit = await post(`/api/company/rubrics/${rubric._id}/submit`);
    assert.equal(resubmit.status, 200);
    assert.equal((await resubmit.json()).rubric.status, "pending_review");
  });
});
