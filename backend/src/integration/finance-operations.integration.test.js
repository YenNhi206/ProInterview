import { before, after, it } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";
applyTestEnv();
process.env.MAIL_USER = ""; process.env.MAIL_PASS = "";
process.env.UPSTASH_REDIS_REST_URL = ""; process.env.UPSTASH_REDIS_REST_TOKEN = "";
process.env.SEPAY_WEBHOOK_API_KEY = "finance-test-webhook";
process.env.COURSE_PLATFORM_FEE_RATE = "0.35";
let mongo, db, models, http, earnings, admin;
before(async () => {
  const { MongoMemoryReplSet } = await import("mongodb-memory-server");
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  db = (await import("mongoose")).default; await db.connect(mongo.getUri());
  models = await import("../models/index.js");
  await Promise.all(Object.values(models).filter((m) => m?.modelName).map((m) => m.init()));
  earnings = await import("../services/mentorEarningsService.js");
  http = await startHttpServer((await import("../app.js")).createApp());
  admin = await models.User.create({ name: "Finance admin", email: "admin-finance@test.local", role: "admin" });
});
after(async () => { if (http) await stopHttpServer(http.server); if (db) await db.disconnect(); if (mongo) await mongo.stop(); });
async function request(user, path, method = "GET", body) {
  const res = await fetch(http.baseUrl + path, { method, headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${mintAccessToken(user._id)}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (res.headers.get("content-type")?.includes("application/pdf")) return { status: res.status, pdf: Buffer.from(await res.arrayBuffer()) };
  return { status: res.status, ...await res.json() };
}
async function fixture() {
  const key = new db.Types.ObjectId().toString();
  const customer = await models.User.create({ name: "Nguyễn Thị Ánh", email: `buyer-${key}@test.local`, role: "customer" });
  const owner = await models.User.create({ name: "Mentor", email: `mentor-${key}@test.local`, role: "mentor" });
  const mentor = await models.Mentor.findOneAndUpdate({ userId: owner._id }, { $set: { name: "Mentor", publicId: key, isActive: true,
    "finance.bankAccount": { bankName: "MB", accountNumber: "123456789", accountName: "MENTOR TEST" } } }, { upsert: true, returnDocument: "after" });
  const course = await models.Course.create({ mentorId: mentor._id, title: "Luyện phỏng vấn kỹ thuật", price: 100000, level: "basic", status: "published" });
  return { customer, owner, mentor, course };
}
async function paidEnrollment(f, date = new Date()) {
  return models.Enrollment.create({ userId: f.customer._id, courseId: f.course._id, paymentStatus: "paid", paymentMethod: "transfer", pricePaid: 100000,
    platformFeeRate: .35, platformFee: 35000, paidAt: date });
}
async function cartOrder(f) {
  assert.equal((await request(f.customer, "/api/cart/items", "POST", { courseId: f.course._id })).status, 200);
  const r = await request(f.customer, "/api/cart/checkout", "POST", {}); assert.equal(r.status, 200); return r.order;
}
async function webhook(order, id) {
  return fetch(http.baseUrl + "/api/payments/webhook/sepay", { method: "POST", headers: { Authorization: "Apikey finance-test-webhook", "Content-Type": "application/json" },
    body: JSON.stringify({ id, transferType: "in", transferAmount: order.totalAmount, content: order.orderRef }) });
}

it("holds new course income for exactly 3 days, then releases once under concurrent calls", async () => {
  const f = await fixture(), paidAt = new Date(); const row = await paidEnrollment(f, paidAt);
  await Promise.all([earnings.tryCreditMentorForPaidEnrollment(String(row._id)), earnings.tryCreditMentorForPaidEnrollment(String(row._id))]);
  let mentor = await models.Mentor.findById(f.mentor._id);
  assert.equal(mentor.finance.clearingBalance, 65000); assert.equal(mentor.finance.availableBalance, 0);
  const recorded = await models.Enrollment.findById(row._id); assert.equal(recorded.earningsClearAt.getTime() - paidAt.getTime(), 3 * 86400000);
  await earnings.releaseEligibleEarnings(new Date(recorded.earningsClearAt.getTime() - 1));
  assert.equal((await models.Mentor.findById(f.mentor._id)).finance.availableBalance, 0);
  await Promise.all([earnings.releaseEligibleEarnings(recorded.earningsClearAt), earnings.releaseEligibleEarnings(recorded.earningsClearAt)]);
  mentor = await models.Mentor.findById(f.mentor._id);
  assert.equal(mentor.finance.availableBalance, 65000); assert.equal(mentor.finance.clearingBalance, 0); assert.equal(mentor.finance.totalEarned, 65000);
});

it("holds completed booking income during disputes and allows release to suspended mentors after resolution", async () => {
  const f = await fixture(); const old = new Date(Date.now() - 5 * 86400000);
  const booking = await models.Booking.create({ userId: f.customer._id, mentorId: f.mentor._id, status: "completed", paymentStatus: "paid",
    date: "01/01/2020", timeSlot: "08:00", durationMinutes: 60, sessionType: "mock_interview", price: 100000, totalAmount: 100000, platformFee: 35000, vat: 0, completedAt: old });
  await earnings.tryCreditMentorForCompletedBooking(String(booking._id));
  const report = await models.Report.create({ reportedBy: f.customer._id, targetType: "booking", targetId: booking._id, reason: "other", description: "Test dispute" });
  await earnings.releaseEligibleEarnings(); assert.equal((await models.Mentor.findById(f.mentor._id)).finance.availableBalance, 0);
  await models.Report.updateOne({ _id: report._id }, { $set: { status: "resolved" } });
  await models.Mentor.updateOne({ _id: f.mentor._id }, { $set: { isActive: false, status: "suspended" } });
  await earnings.releaseEligibleEarnings(); assert.equal((await models.Mentor.findById(f.mentor._id)).finance.availableBalance, 65000);
});

it("reports discrepancies without modifying balances and keeps legacy available income untouched", async () => {
  const f = await fixture(); const row = await paidEnrollment(f, new Date(Date.now() - 5 * 86400000));
  await models.Enrollment.updateOne({ _id: row._id }, { $set: { mentorEarningsCreditedAt: new Date() } });
  await models.Mentor.updateOne({ _id: f.mentor._id }, { $set: { "finance.availableBalance": 65000, "finance.pendingBalance": 1000 } });
  await earnings.releaseEligibleEarnings(); let report = await earnings.reconcileMentorClearingBalances();
  assert.ok(report.payoutMismatches.some((m) => m.mentorId === String(f.mentor._id) && m.diff === 1000));
  assert.equal((await models.Mentor.findById(f.mentor._id)).finance.availableBalance, 65000);
  assert.ok(!report.mismatches.some((m) => m.mentorId === String(f.mentor._id)));
  const other = await fixture(); const held = await paidEnrollment(other, new Date(Date.now() - 5 * 86400000));
  await earnings.tryCreditMentorForPaidEnrollment(String(held._id));
  await models.Mentor.updateOne({ _id: other.mentor._id }, { $set: { "finance.clearingBalance": 0 } });
  await earnings.releaseEligibleEarnings(); const after = await models.Enrollment.findById(held._id);
  assert.ok(after.earningsClearFailedAt); assert.ok(!after.earningsClearedAt);
  report = await earnings.reconcileMentorClearingBalances(); assert.ok(report.mismatches.some((m) => m.mentorId === String(other.mentor._id) && m.expected === 65000));
});

it("reserves payouts atomically, prevents double spending, rejects invalid settlement and pays once", async () => {
  const f = await fixture(); await models.Mentor.updateOne({ _id: f.mentor._id }, { $set: { "finance.availableBalance": 120000 } });
  const create = () => request(admin, `/api/admin/mentors/${f.mentor._id}/payouts`, "POST", { amount: 120000, reason: "Final settlement" });
  const results = await Promise.all([create(), create()]); assert.equal(results.filter((r) => r.status === 201).length, 1);
  const payout = results.find((r) => r.status === 201).payout;
  assert.equal((await request(admin, `/api/admin/payouts/${payout._id}/approve`, "PATCH", {})).status, 200);
  assert.equal((await request(admin, `/api/admin/payouts/${payout._id}/mark-paid`, "PATCH", {})).status, 400);
  const finish = () => request(admin, `/api/admin/payouts/${payout._id}/mark-paid`, "PATCH", { transferRef: "BANK-123" });
  const paid = await Promise.all([finish(), finish()]); assert.equal(paid.filter((r) => r.status === 200).length, 1);
  const mentor = await models.Mentor.findById(f.mentor._id); assert.equal(mentor.finance.pendingBalance, 0); assert.equal(mentor.finance.availableBalance, 0);
});

it("retains incoming money from locked cart payers and records a refund without granting course access", async () => {
  const f = await fixture(), order = await cartOrder(f);
  await models.User.updateOne({ _id: f.customer._id }, { $set: { isActive: false } });
  assert.equal((await webhook(order, `held-${order.id}`)).status, 200);
  await webhook(order, `held-${order.id}`);
  const payment = await models.Payment.findOne({ userId: f.customer._id }); assert.equal(payment.status, "held_inactive_account");
  assert.equal(await models.Enrollment.countDocuments({ userId: f.customer._id, paymentStatus: "paid" }), 0);
  const blocked = await request(admin, `/api/admin/cart-orders/${order.id}/confirm-transfer`, "POST", { force: true, forceNote: "Should block", amount: order.totalAmount }); assert.equal(blocked.status, 409);
  const path = `/api/admin/payments/${payment._id}/refund-held`;
  assert.equal((await request(admin, path, "PATCH", { amount: 1, transferRef: "REF-1", reason: "Refund inactive" })).status, 409);
  const refunded = await request(admin, path, "PATCH", { amount: payment.amount, transferRef: "REF-1", reason: "Refund inactive" }); assert.equal(refunded.status, 200);
  assert.equal((await models.Payment.findById(payment._id)).refundAmount, payment.amount);
  assert.equal((await request(admin, `/api/admin/users/${f.customer._id}/impact`)).impact.canClose, true);
});

it("returns rejected payout money once and rolls back settlement when the wallet does not match", async () => {
  const f = await fixture(); await models.Mentor.updateOne({ _id: f.mentor._id }, { $set: { "finance.availableBalance": 100000 } });
  const create = () => request(admin, `/api/admin/mentors/${f.mentor._id}/payouts`, "POST", { amount: 100000, reason: "Settlement test" });
  let result = await create(); let id = result.payout._id;
  const reject = () => request(admin, `/api/admin/payouts/${id}/reject`, "PATCH", { reason: "Bank details need review" });
  const attempts = await Promise.all([reject(), reject()]); assert.equal(attempts.filter((r) => r.status === 200).length, 1);
  assert.equal((await models.Mentor.findById(f.mentor._id)).finance.availableBalance, 100000);
  result = await create(); id = result.payout._id;
  await request(admin, `/api/admin/payouts/${id}/approve`, "PATCH", {});
  await models.Mentor.updateOne({ _id: f.mentor._id }, { $set: { "finance.pendingBalance": 0 } });
  assert.equal((await request(admin, `/api/admin/payouts/${id}/mark-paid`, "PATCH", { transferRef: "BANK-ROLLBACK" })).status, 409);
  assert.equal((await models.PayoutRequest.findById(id)).status, "approved");
  assert.equal((await models.Mentor.findById(f.mentor._id)).finance.pendingBalance, 0);
});

it("previews obligations, blocks account closure and preserves financial history when closure is allowed", async () => {
  const f = await fixture(); await models.Mentor.updateOne({ _id: f.mentor._id }, { $set: { "finance.availableBalance": 999 } });
  const preview = await request(admin, `/api/admin/users/${f.owner._id}/impact`); assert.equal(preview.impact.canClose, false);
  assert.equal(preview.impact.mentor.finance.availableBalance, 999);
  assert.equal((await request(f.owner, "/api/auth/me", "DELETE")).status, 409);
  assert.ok(await models.User.findById(f.owner._id));
  const p = await request(admin, `/api/admin/mentors/${f.mentor._id}/payouts`, "POST", { amount: 999, reason: "Close balance" }); assert.equal(p.status, 201);
  await request(admin, `/api/admin/payouts/${p.payout._id}/approve`, "PATCH", {});
  await request(admin, `/api/admin/payouts/${p.payout._id}/mark-paid`, "PATCH", { transferRef: "BANK-FINAL" });
  const result = await request(admin, `/api/admin/users/${f.owner._id}/close`, "POST", { confirmUserId: String(f.owner._id), reason: "Requested closure" }); assert.equal(result.status, 200);
  assert.ok((await models.User.findById(f.owner._id)).accountClosedAt); assert.equal((await models.Mentor.findById(f.mentor._id)).status, "closed");
  assert.ok(await models.PayoutRequest.findById(p.payout._id));
  assert.equal((await request(admin, `/api/admin/users/${f.owner._id}/status`, "PATCH", { isActive: true })).status, 409);
  assert.equal((await request(f.owner, "/api/auth/me")).status, 403);
});

it("blocks closure for paid overdue bookings in DD/MM/YYYY and active cart orders", async () => {
  const f = await fixture(); await models.Booking.create({ userId: f.customer._id, mentorId: f.mentor._id, status: "confirmed", paymentStatus: "paid", date: "01/01/2020", timeSlot: "09:00", durationMinutes: 60, sessionType: "mock_interview", price: 1, totalAmount: 1, vat: 0, platformFee: 0 });
  assert.equal((await request(f.customer, "/api/auth/me/closure-impact")).impact.canClose, false);
  assert.equal((await request(admin, `/api/admin/users/${f.owner._id}/impact`)).impact.canClose, false);
  const other = await fixture(); await cartOrder(other); assert.equal((await request(other.customer, "/api/auth/me", "DELETE")).status, 409);
  assert.equal((await request(admin, `/api/admin/users/${other.owner._id}/impact`)).impact.canClose, false);
});

it("creates Vietnamese PDF receipts, checks ownership and snapshots both individual and cart invoices", async () => {
  const f = await fixture(), order = await cartOrder(f), outsider = await fixture();
  assert.equal((await request(f.customer, `/api/cart/orders/${order.id}/invoice`)).status, 409);
  await webhook(order, `invoice-${order.id}`);
  const payment = await models.Payment.findOne({ userId: f.customer._id });
  assert.equal((await request(outsider.customer, `/api/payments/${payment._id}/invoice`)).status, 403);
  for (const user of [f.customer, admin]) {
    const invoice = await request(user, `/api/payments/${payment._id}/invoice`); assert.equal(invoice.status, 200); assert.equal(invoice.pdf.subarray(0, 5).toString(), "%PDF-"); assert.ok(invoice.pdf.includes(Buffer.from("/FontFile2")));
  }
  const snapshot = (await models.Payment.findById(payment._id)).invoiceSnapshot;
  assert.equal(snapshot.buyer.name, "Nguyễn Thị Ánh"); assert.equal(snapshot.total, 100000);
  await models.User.updateOne({ _id: f.customer._id }, { $set: { name: "Changed name" } });
  await request(f.customer, `/api/payments/${payment._id}/invoice`);
  assert.equal((await models.Payment.findById(payment._id)).invoiceSnapshot.buyer.name, "Nguyễn Thị Ánh");
  const cartPdf = await request(f.customer, `/api/cart/orders/${order.id}/invoice`); assert.equal(cartPdf.status, 200);
  const { writeFile } = await import("node:fs/promises"); const { tmpdir } = await import("node:os"); const { join } = await import("node:path");
  await writeFile(join(tmpdir(), "prointerview-invoice-smoke.pdf"), cartPdf.pdf);
  assert.equal((await request(outsider.customer, `/api/cart/orders/${order.id}/invoice`)).status, 404);
});

it("paginates owned payment history and records successful and failed admin actions with secrets redacted", async () => {
  const f = await fixture(); const order = await cartOrder(f); await webhook(order, `history-${order.id}`);
  const history = await request(f.customer, "/api/payments/history?page=1&limit=1&type=course&status=success");
  assert.equal(history.payments.length, 1); assert.equal(history.pagination.total, 1); assert.equal(history.payments[0].cartOrderId, order.id);
  const res = await request(admin, `/api/admin/users/${f.customer._id}/close`, "POST", { reason: "Audit test", password: "TOP_SECRET", nested: { accessToken: "TOKEN_SECRET", accountNumber: "BANK_SECRET" } });
  assert.equal(res.status, 400);
  // Logging runs after the response finishes; wait for the actual persisted row, not an arbitrary long sleep.
  let entry;
  for (let i = 0; i < 30 && !entry; i++) { entry = await models.SecurityLog.findOne({ "details.path": `/api/admin/users/${f.customer._id}/close` }); if (!entry) await new Promise((r) => setTimeout(r, 20)); }
  assert.ok(entry); assert.equal(entry.details.success, false); const serialized = JSON.stringify(entry.details);
  for (const secret of ["TOP_SECRET", "TOKEN_SECRET", "BANK_SECRET"]) assert.ok(!serialized.includes(secret));
  assert.equal((await request(f.customer, "/api/admin/audit-log")).status, 403);
  const logs = await request(admin, "/api/admin/audit-log?success=true"); assert.ok(logs.entries.length > 0); assert.ok(logs.entries.every((l) => l.details.success));
});
it("records mentor payout-account changes in the audit log with the account number masked to the last 4 digits", async () => {
  const f = await fixture();
  const res = await request(f.owner, "/api/mentor/payout-account", "PATCH", { bankName: "VCB", accountNumber: "0123456789", accountName: "MENTOR TEST" });
  assert.equal(res.status, 200);
  let entry;
  for (let i = 0; i < 30 && !entry; i++) { entry = await models.SecurityLog.findOne({ type: "mentor_action", userId: f.owner._id, "details.path": "/api/mentor/payout-account" }); if (!entry) await new Promise((r) => setTimeout(r, 20)); }
  assert.ok(entry); assert.equal(entry.details.success, true);
  assert.equal(entry.details.body.accountNumber, "****6789");
  assert.ok(!JSON.stringify(entry.details).includes("0123456789"));
  const mentorLogs = await request(admin, "/api/admin/audit-log?actor=mentor");
  assert.ok(mentorLogs.entries.some((l) => String(l._id) === String(entry._id)));
  assert.ok(mentorLogs.entries.every((l) => l.type === "mentor_action"));
  const adminLogs = await request(admin, "/api/admin/audit-log?actor=admin");
  assert.ok(adminLogs.entries.every((l) => l.type === "admin_action"));
  assert.equal((await request(admin, "/api/admin/audit-log?actor=hacker")).status, 400);
});
