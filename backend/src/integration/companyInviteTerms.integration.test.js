/**
 * CO-02 (bổ sung 23/11/2026, đề xuất aa): nhận lời mời phải đồng ý điều khoản dùng rubric ẩn danh;
 * lưu thời điểm đồng ý (lời mời + công ty). Token dùng 1 lần; hết hạn; email trùng role khác.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  applyTestEnv,
  startMongoHarness,
  stopMongoHarness,
  startHttpServer,
  stopHttpServer,
} from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let http;
let User;
let Company;
let CompanyInvite;
let TERMS;
let seq = 0;

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Company } = await import("../models/Company.js"));
  ({ CompanyInvite } = await import("../models/CompanyInvite.js"));
  ({ RUBRIC_SHARING_TERMS: TERMS } = await import("../config/rubricSharingTerms.js"));
  const { createApp } = await import("../app.js");
  http = await startHttpServer(createApp());
});

after(async () => {
  if (http?.server) await stopHttpServer(http.server);
  if (harness) await stopMongoHarness(harness);
});

/** Tạo công ty + lời mời trực tiếp trong DB, trả token gốc (giống link trong email). */
async function seedInvite({ company, expiresAt = new Date(Date.now() + 86400000) } = {}) {
  seq += 1;
  const co = company ?? (await Company.create({ name: `Công ty ${seq}`, slug: `terms-co-${Date.now()}-${seq}`, status: "active" }));
  const rawToken = crypto.randomBytes(24).toString("hex");
  const invite = await CompanyInvite.create({
    companyId: co._id,
    email: `terms-hr-${Date.now()}-${seq}@test.local`,
    tokenHash: crypto.createHash("sha256").update(rawToken).digest("hex"),
    expiresAt,
  });
  return { company: co, invite, rawToken };
}

async function accept(body) {
  const res = await fetch(`${http.baseUrl}/api/company-invites/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

const validBody = (token, extra = {}) => ({
  token,
  name: "HR Mới",
  password: "Password123!",
  acceptRubricTerms: true,
  termsVersion: TERMS.version,
  ...extra,
});

describe("CO-02 — điều khoản dùng rubric ẩn danh khi nhận lời mời", () => {
  it("verify trả điều khoản (version, tiêu đề, các ý) để trang nhận lời mời hiển thị", async () => {
    const { rawToken } = await seedInvite();
    const res = await fetch(`${http.baseUrl}/api/company-invites/verify/${rawToken}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.terms.version, TERMS.version);
    assert.ok(body.terms.title);
    assert.ok(body.terms.points.length >= 3);
  });

  it("không đồng ý điều khoản → 400, không tạo tài khoản, lời mời vẫn dùng được", async () => {
    const { invite, rawToken } = await seedInvite();
    for (const extra of [{ acceptRubricTerms: false }, { acceptRubricTerms: "true" }, { acceptRubricTerms: undefined }]) {
      const res = await accept(validBody(rawToken, extra));
      assert.equal(res.status, 400);
      assert.match(res.body.error, /điều khoản/);
    }
    assert.equal(await User.countDocuments({ email: invite.email }), 0);
    assert.equal((await CompanyInvite.findById(invite._id).lean()).status, "pending");

    assert.equal((await accept(validBody(rawToken))).status, 201);
  });

  it("đồng ý bản điều khoản cũ / thiếu version → 409", async () => {
    const { invite, rawToken } = await seedInvite();
    assert.equal((await accept(validBody(rawToken, { termsVersion: "2020-01-v0" }))).status, 409);
    assert.equal((await accept(validBody(rawToken, { termsVersion: undefined }))).status, 409);
    assert.equal((await CompanyInvite.findById(invite._id).lean()).status, "pending");
  });

  it("đồng ý → lưu thời điểm + version ở lời mời và ở công ty", async () => {
    const { company, invite, rawToken } = await seedInvite();
    const before = Date.now();
    const res = await accept(validBody(rawToken));
    assert.equal(res.status, 201);
    assert.equal(res.body.user.role, "company_moderator");

    const savedInvite = await CompanyInvite.findById(invite._id).lean();
    assert.equal(savedInvite.status, "accepted");
    assert.equal(savedInvite.rubricTermsVersion, TERMS.version);
    assert.ok(savedInvite.rubricTermsAcceptedAt.getTime() >= before);

    const savedCompany = await Company.findById(company._id).lean();
    assert.equal(savedCompany.rubricSharingConsent.termsVersion, TERMS.version);
    assert.ok(savedCompany.rubricSharingConsent.acceptedAt.getTime() >= before);
    assert.equal(String(savedCompany.rubricSharingConsent.acceptedBy), String(res.body.user.id ?? res.body.user._id));
  });

  it("công ty giữ lần đồng ý đầu tiên khi HR thứ hai nhận lời mời", async () => {
    const first = await seedInvite();
    assert.equal((await accept(validBody(first.rawToken))).status, 201);
    const firstConsent = (await Company.findById(first.company._id).lean()).rubricSharingConsent;

    const second = await seedInvite({ company: first.company });
    assert.equal((await accept(validBody(second.rawToken))).status, 201);
    const consent = (await Company.findById(first.company._id).lean()).rubricSharingConsent;
    assert.equal(consent.acceptedAt.getTime(), firstConsent.acceptedAt.getTime());
    assert.equal(String(consent.acceptedBy), String(firstConsent.acceptedBy));
    assert.ok((await CompanyInvite.findById(second.invite._id).lean()).rubricTermsAcceptedAt);
  });
});

describe("CO-02 — token lời mời", () => {
  it("token dùng 1 lần: lần nhận thứ hai → 400", async () => {
    const { rawToken } = await seedInvite();
    assert.equal((await accept(validBody(rawToken))).status, 201);
    assert.equal((await accept(validBody(rawToken, { name: "Người khác" }))).status, 400);
  });

  it("hai lần nhận cùng lúc chỉ một lần thành công", async () => {
    const { invite, rawToken } = await seedInvite();
    const results = await Promise.all([accept(validBody(rawToken)), accept(validBody(rawToken))]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 400]);
    assert.equal(await User.countDocuments({ email: invite.email }), 1);
  });

  it("lời mời hết hạn → 400 và chuyển expired", async () => {
    const { invite, rawToken } = await seedInvite({ expiresAt: new Date(Date.now() - 1000) });
    const res = await accept(validBody(rawToken));
    assert.equal(res.status, 400);
    assert.match(res.body.error, /hết hạn/);
    assert.equal((await CompanyInvite.findById(invite._id).lean()).status, "expired");
  });

  it("email đã có tài khoản role khác → 400, lời mời vẫn pending", async () => {
    const { invite, rawToken } = await seedInvite();
    await User.create({ name: "Ứng viên", email: invite.email, role: "customer" });
    const res = await accept(validBody(rawToken));
    assert.equal(res.status, 400);
    assert.match(res.body.error, /vai trò khác/);
    assert.equal((await CompanyInvite.findById(invite._id).lean()).status, "pending");
  });
});
