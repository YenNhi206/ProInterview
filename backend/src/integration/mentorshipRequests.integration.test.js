import { before, after, describe, it } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import { applyTestEnv, startMongoHarness, stopMongoHarness, mintAccessToken, startHttpServer, stopHttpServer } from "../test_helpers/mongoTestHarness.js";
applyTestEnv();
let harness, server, baseUrl, User, Mentor, Request, Booking, service, mentee, stranger, mentors, createBooking;
const fields = { title: "Luyện phỏng vấn React Junior", position: "Frontend Developer", description: "Muốn luyện trình bày dự án React và trả lời câu hỏi kỹ thuật.", sessionType: "mock_interview", availability: "Thứ 5 sau 19:00, giờ Việt Nam", budget: 300000 };
const files = { cv: [{ originalname: "cv.pdf", buffer: Buffer.from("private cv") }], jd: [{ originalname: "jd.txt", buffer: Buffer.from("private jd") }] };
const offerBody = { message: "Tôi có thể hỗ trợ luyện React và nhận xét cách trình bày dự án.", availability: "Thứ 5, 19:00–20:00" };
async function actor(user) { return service.requestActor(String(user._id)); }
async function freshRequest() { return service.createRequest(await actor(mentee), fields, files); }
async function selectedRequest() {
  const request = await freshRequest();
  const offered = await service.sendOffer(await actor(mentors[0].user), String(request._id), offerBody);
  return service.selectOffer(await actor(mentee), String(request._id), String(offered.offers[0]._id));
}
before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Mentor } = await import("../models/Mentor.js"));
  ({ MentorshipRequest: Request } = await import("../models/MentorshipRequest.js"));
  ({ Booking } = await import("../models/Booking.js"));
  service = await import("../services/mentorshipRequestsService.js");
  ({ createBooking } = await import("../services/bookingsService.js"));
  mentee = await User.create({ name: "Mentee", email: "requests-mentee@test.local", role: "customer" });
  stranger = await User.create({ name: "Other", email: "requests-other@test.local", role: "customer" });
  mentors = [];
  for (let i = 0; i < 2; i++) {
    const user = await User.create({ name: `Mentor ${i}`, email: `requests-mentor-${i}@test.local`, role: "mentor" });
    const mentor = await Mentor.findOneAndUpdate({ userId: user._id }, { $set: { userId: user._id, name: `Mentor ${i}`, title: "Senior Engineer", company: "Test", publicId: `request-mentor-${i}`, isActive: true, isVerified: true, available: true, pricePerHour: 250000, sessionTypes: [{ type: "mock_interview", durationMinutes: 60, price: 250000 }], availableSlots: {}, recurringSchedule: [] } }, { upsert: true, returnDocument: "after" });
    mentors.push({ user, mentor });
  }
  await Booking.init(); await Request.init();
  const { mentorshipRequestsRouter } = await import("../routes/mentorshipRequests.js");
  const app = express(); app.use(express.json()); app.use("/api/mentorship-requests", mentorshipRequestsRouter);
  app.use((error, req, res, next) => res.status(error.status || 500).json({ success: false, error: error.message }));
  ({ server, baseUrl } = await startHttpServer(app));
});
after(async () => { if (server) await stopHttpServer(server); if (harness) await stopMongoHarness(harness); });
const headers = user => ({ Authorization: `Bearer ${mintAccessToken(user._id)}` });
describe("Mentorship requests: ownership, privacy and selection", () => {
  it("requires authentication and creates a real request with private multipart CV/JD", async () => {
    let res = await fetch(`${baseUrl}/api/mentorship-requests`);
    assert.equal(res.status, 401);
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => form.append(key, value));
    form.append("cv", new Blob(["private uploaded cv"]), "CV.pdf"); form.append("jd", new Blob(["private uploaded jd"]), "JD.txt");
    res = await fetch(`${baseUrl}/api/mentorship-requests`, { method: "POST", headers: headers(mentee), body: form });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.request.status, "open"); assert.equal(body.request.canDownload, true);
    assert.equal(body.request.cvData, undefined); assert.equal(body.request.userId, undefined);
    assert.equal(JSON.stringify(body).includes("private uploaded"), false);
  });
  it("rejects missing, oversized and unsupported documents", async () => {
    await assert.rejects(async () => service.createRequest({ userId: String(mentee._id), mentor: null }, fields, {}), { status: 400 });
    for (const [name, size] of [["evil.exe", 10], ["large.pdf", 5 * 1024 * 1024 + 1]]) {
      const form = new FormData(); Object.entries(fields).forEach(([key, value]) => form.append(key, value));
      form.append("cv", new Blob([Buffer.alloc(size)]), name); form.append("jd", new Blob(["jd"]), "jd.txt");
      const res = await fetch(`${baseUrl}/api/mentorship-requests`, { method: "POST", headers: headers(mentee), body: form });
      assert.equal(res.status, 400);
    }
  });
  it("hides another mentee's requests and prevents downloading before selection", async () => {
    const request = await freshRequest();
    const other = await actor(stranger), mentor = await actor(mentors[0].user);
    await assert.rejects(async () => service.requestDTO(request, other), { status: 404 });
    const dto = await service.requestDTO(request, mentor);
    assert.equal(dto.cvName, ""); assert.equal(dto.canDownload, false); assert.equal(dto.cvData, undefined);
    await assert.rejects(async () => service.getRequestFile(mentor, String(request._id), "cv"), { status: 403 });
    const mine = await service.listRequests(other);
    assert.equal(mine.some(row => row.id === String(request._id)), false);
  });
  it("only approved mentors may propose; a mentor cannot submit twice", async () => {
    const request = await freshRequest();
    await assert.rejects(async () => service.sendOffer(await actor(mentee), String(request._id), offerBody), { status: 403 });
    const mentor = await actor(mentors[0].user);
    const offered = await service.sendOffer(mentor, String(request._id), offerBody);
    assert.equal(offered.offers[0].priceEstimate, 250000);
    await assert.rejects(async () => service.sendOffer(mentor, String(request._id), offerBody), { status: 409 });
    await Mentor.updateOne({ _id: mentors[1].mentor._id }, { $set: { isVerified: false } });
    await assert.rejects(async () => actor(mentors[1].user), { status: 403 });
    await Mentor.updateOne({ _id: mentors[1].mentor._id }, { $set: { isVerified: true } });
  });
  it("hides competing proposals from other mentors", async () => {
    const request = await freshRequest();
    await service.sendOffer(await actor(mentors[0].user), String(request._id), offerBody);
    const both = await service.sendOffer(await actor(mentors[1].user), String(request._id), { ...offerBody, message: "Tôi có thể review CV và luyện trả lời câu hỏi chuyên môn." });
    assert.equal((await service.requestDTO(both, await actor(mentee))).offers.length, 2);
    assert.equal((await service.requestDTO(both, await actor(mentors[0].user))).offers.length, 1);
  });
  it("atomically selects exactly one mentor and only shares files with that mentor", async () => {
    const request = await freshRequest();
    for (const entry of mentors) await service.sendOffer(await actor(entry.user), String(request._id), offerBody);
    const row = await service.loadRequest(String(request._id));
    const owner = await actor(mentee);
    const results = await Promise.allSettled(row.offers.map(o => service.selectOffer(owner, String(row._id), String(o._id))));
    assert.equal(results.filter(r => r.status === "fulfilled").length, 1);
    const selected = await service.loadRequest(String(row._id));
    const winner = mentors.find(m => String(m.mentor._id) === String(selected.selectedMentorId));
    const loser = mentors.find(m => String(m.mentor._id) !== String(selected.selectedMentorId));
    const file = await service.getRequestFile(await actor(winner.user), String(row._id), "cv");
    assert.equal(Buffer.from(file.data).toString(), "private cv");
    const downloaded = await fetch(`${baseUrl}/api/mentorship-requests/${row._id}/files/cv`, { headers: headers(winner.user) });
    assert.equal(downloaded.status, 200);
    assert.equal(downloaded.headers.get("cache-control"), "private, no-store");
    assert.equal(await downloaded.text(), "private cv");
    await assert.rejects(async () => service.getRequestFile(await actor(loser.user), String(row._id), "cv"), { status: 403 });
    await assert.rejects(async () => service.withdrawOffer(await actor(winner.user), String(row._id), String(selected.selectedOfferId)), { status: 409 });
    await assert.rejects(async () => service.sendOffer(await actor(loser.user), String(row._id), offerBody), { status: 409 });
  });
  it("only the owner may select or close a request", async () => {
    const request = await freshRequest();
    const offered = await service.sendOffer(await actor(mentors[0].user), String(request._id), offerBody);
    await assert.rejects(async () => service.selectOffer(await actor(stranger), String(request._id), String(offered.offers[0]._id)), { status: 409 });
    await assert.rejects(async () => service.closeRequest(await actor(stranger), String(request._id)), { status: 409 });
    const closed = await service.closeRequest(await actor(mentee), String(request._id));
    assert.equal(closed.status, "closed");
    await assert.rejects(async () => service.selectOffer(await actor(mentee), String(request._id), String(offered.offers[0]._id)), { status: 409 });
  });
  it("withdrawn offers cannot be selected", async () => {
    const request = await freshRequest(); const mentor = await actor(mentors[0].user);
    const offered = await service.sendOffer(mentor, String(request._id), offerBody); const offerId = String(offered.offers[0]._id);
    await service.withdrawOffer(mentor, String(request._id), offerId);
    await assert.rejects(async () => service.selectOffer(await actor(mentee), String(request._id), offerId), { status: 409 });
  });
  it("binds booking to the selected owner and mentor, snapshots files and blocks duplicate sessions", async () => {
    const request = await selectedRequest();
    const d = new Date(Date.now() + 14 * 86400000);
    const payload = { mentorshipRequestId: String(request._id), mentorId: mentors[0].mentor.publicId, date: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`, timeSlot: "10:00", sessionType: "career_consulting", durationMinutes: 480, paymentMethod: "transfer", cvFileUrl: "https://attacker.invalid/file" };
    assert.equal((await createBooking(String(stranger._id), payload)).status, 403);
    assert.equal((await createBooking(String(mentee._id), { ...payload, mentorId: mentors[1].mentor.publicId })).status, 403);
    const created = await createBooking(String(mentee._id), payload);
    assert.equal(created.ok, true, created.error);
    assert.equal(created.booking.mentorshipRequestId, String(request._id));
    assert.equal(created.booking.sessionType, fields.sessionType); assert.equal(created.booking.durationMinutes, 60);
    assert.equal(created.booking.cvFileUrl, ""); assert.equal(created.booking.cvFileName, "cv.pdf");
    const second = await createBooking(String(mentee._id), { ...payload, timeSlot: "11:00" });
    assert.equal(second.status, 409);
    assert.equal(await Booking.countDocuments({ mentorshipRequestId: request._id }), 1);
    const dto = await service.requestDTO(await service.loadRequest(String(request._id)), await actor(mentee));
    assert.equal(dto.bookingId, created.booking.id);
  });
});


describe("Saved CV/JD reuse", () => {
  it("lists only owned documents and makes an independent private copy of an old request", async () => {
    const owner = await User.create({ name: "Saved CV owner", email: "saved-request@test.local", role: "customer" });
    const ownerActor = await actor(owner);
    const original = await service.createRequest(ownerActor, fields, files);
    const response = await fetch(`${baseUrl}/api/mentorship-requests/documents`, { headers: headers(owner) });
    assert.equal(response.status, 200);
    const { documents } = await response.json();
    assert.equal(documents.length, 2);
    assert.equal(documents[0].id, `request:${original._id}`);
    assert.equal(JSON.stringify(documents).includes("private cv"), false);
    assert.equal(documents[0].url, undefined);
    const form = new FormData();
    Object.entries({ ...fields, cvSource: `request:${original._id}`, jdSource: `request:${original._id}` }).forEach(([key, value]) => form.append(key, value));
    const copiedResponse = await fetch(`${baseUrl}/api/mentorship-requests`, { method: "POST", headers: headers(owner), body: form });
    assert.equal(copiedResponse.status, 201);
    const copied = (await copiedResponse.json()).request;
    await Request.deleteOne({ _id: original._id });
    const file = await service.getRequestFile(ownerActor, copied.id, "cv");
    assert.equal(Buffer.from(file.data).toString(), "private cv");
    await assert.rejects(async () => service.createRequest(await actor(stranger), { ...fields, cvSource: `request:${copied.id}` }, { jd: files.jd }), { status: 404 });
  });
  it("reuses an owned analysis CV from storage, keeping a new JD upload", async () => {
    const { CVAnalysis } = await import("../models/CVAnalysis.js");
    const owner = await User.create({ name: "Analysis owner", email: "saved-analysis@test.local", role: "customer" });
    const fileName = `saved-cv-test-${randomUUID()}.pdf`;
    const filePath = new URL(`../../public/uploads/${fileName}`, import.meta.url);
    await fs.mkdir(new URL("../../public/uploads/", import.meta.url), { recursive: true });
    await fs.writeFile(filePath, "old analysis cv");
    try {
      const source = await CVAnalysis.collection.insertOne({ userId: owner._id, cvFileName: "Frontend CV.pdf", cvFileId: fileName, createdAt: new Date(), mode: "jd" });
      const ownerActor = await actor(owner);
      const copied = await service.createRequest(ownerActor, { ...fields, cvSource: `analysis:${source.insertedId}` }, { jd: files.jd });
      const file = await service.getRequestFile(ownerActor, String(copied._id), "cv");
      assert.equal(file.name, "Frontend CV.pdf");
      assert.equal(Buffer.from(file.data).toString(), "old analysis cv");
      const { listOwnedDocuments } = await import("../services/mentorshipDocumentsService.js");
      assert.equal((await listOwnedDocuments(String(stranger._id))).some(document => document.id === `analysis:${source.insertedId}`), false);
    } finally { await fs.unlink(filePath); }
  });
  it("rejects mixed sources, missing files, path traversal and arbitrary remote URLs", async () => {
    const { CVAnalysis } = await import("../models/CVAnalysis.js");
    const { readOwnedDocument } = await import("../services/mentorshipDocumentsService.js");
    const owner = await User.create({ name: "Invalid source owner", email: "invalid-source@test.local", role: "customer" });
    const ownerActor = await actor(owner);
    await assert.rejects(async () => service.createRequest(ownerActor, { ...fields, cvSource: "request:invalid" }, files), { status: 400 });
    for (const data of [{ cvFileId: "../package.json" }, { cvFileId: "missing-saved-cv.pdf" }, { cvFileUrl: "http://127.0.0.1:5000/private.pdf" }, { cvFileUrl: "https://untrusted.example/cv.pdf" }]) {
      const source = await CVAnalysis.collection.insertOne({ userId: owner._id, cvFileName: "CV.pdf", ...data, createdAt: new Date() });
      await assert.rejects(async () => readOwnedDocument(String(owner._id), `analysis:${source.insertedId}`, "cv"), { status: 410 });
    }
  });
});

describe("Compact mentorship request", () => {
  it("generates a title and keeps omitted time/budget unspecified", async () => {
    const owner = await User.create({ name: "Compact form", email: "compact-form@test.local", role: "customer" });
    const ownerActor = await actor(owner);
    const form = new FormData();
    form.append("position", "Frontend Developer");
    form.append("sessionType", "mock_interview");
    form.append("description", "Cần luyện React và trình bày kinh nghiệm dự án trong CV.");
    form.append("cv", new Blob(["cv"]), "cv.pdf");
    form.append("jd", new Blob(["jd"]), "jd.pdf");
    const response = await fetch(`${baseUrl}/api/mentorship-requests`, { method: "POST", headers: headers(owner), body: form });
    assert.equal(response.status, 201);
    const { request } = await response.json();
    assert.equal(request.title, "Phỏng vấn thử · Frontend Developer");
    assert.equal(request.budget, null);
    assert.equal(request.availability, "");
    const created = await service.createRequest(ownerActor, { position: "Backend Developer", sessionType: "cv_review", description: "Cần góp ý cách trình bày dự án và kinh nghiệm trong CV.", budget: "", availability: "" }, files);
    assert.equal(created.title, "Review CV · Backend Developer");
    assert.equal(created.budget, null);
    const free = await service.createRequest(ownerActor, { ...fields, budget: 0 }, files);
    assert.equal(free.budget, 0, "An explicit zero budget must stay distinct from an unspecified budget");
  });
});
