/**
 * Admin nhận thông báo (chuông) khi có người gửi hoặc gửi lại hồ sơ đăng ký mentor.
 * Mentor đã duyệt chỉ sửa hồ sơ thì không báo.
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { applyTestEnv, startMongoHarness, stopMongoHarness } from "../test_helpers/mongoTestHarness.js";

applyTestEnv();

let harness;
let User;
let Mentor;
let Notification;
let applyForMentor;
let MENTOR_APPLICATION_ADMIN_URL;

const TYPE = "mentor_application_submitted";

const validBody = {
  title: "Senior Frontend Developer",
  company: "Công ty XYZ",
  bio: "6 năm kinh nghiệm frontend, muốn hỗ trợ ứng viên luyện phỏng vấn.",
  skills: ["React", "TypeScript"],
  targetRate: 300000,
  yearsOfExperience: 6,
};

before(async () => {
  harness = await startMongoHarness();
  ({ User } = await import("../models/User.js"));
  ({ Mentor } = await import("../models/Mentor.js"));
  ({ Notification } = await import("../models/Notification.js"));
  ({ applyForMentor, MENTOR_APPLICATION_ADMIN_URL } = await import("../services/mentorMeService.js"));
});

after(async () => {
  if (harness) await stopMongoHarness(harness);
});

describe("Thông báo admin khi đăng ký mentor", () => {
  let admin1;
  let admin2;
  let lockedAdmin;

  before(async () => {
    admin1 = await User.create({ name: "Admin 1", email: "admin1-mentor-notify@test.local", role: "admin" });
    admin2 = await User.create({ name: "Admin 2", email: "admin2-mentor-notify@test.local", role: "admin" });
    lockedAdmin = await User.create({
      name: "Admin khóa",
      email: "admin-locked-mentor-notify@test.local",
      role: "admin",
      isActive: false,
    });
  });

  it("gửi hồ sơ lần đầu: mọi admin đang hoạt động nhận 1 thông báo có link trang duyệt", async () => {
    const applicant = await User.create({ name: "Nguyễn Văn A", email: "applicant-a@test.local", role: "customer" });
    const res = await applyForMentor(String(applicant._id), validBody);
    assert.equal(res.ok, true, res.error);

    const mentor = await Mentor.findOne({ userId: applicant._id }).lean();
    for (const admin of [admin1, admin2]) {
      const list = await Notification.find({ userId: admin._id, type: TYPE }).lean();
      assert.equal(list.length, 1);
      assert.equal(list[0].title, "Có hồ sơ đăng ký mentor mới");
      assert.match(list[0].body, /Nguyễn Văn A/);
      assert.equal(list[0].metadata.actionUrl, MENTOR_APPLICATION_ADMIN_URL);
      assert.equal(String(list[0].metadata.mentorId), String(mentor._id));
    }
    assert.equal(await Notification.countDocuments({ userId: lockedAdmin._id, type: TYPE }), 0);
    // Người đăng ký không nhận thông báo dành cho admin.
    assert.equal(await Notification.countDocuments({ userId: applicant._id, type: TYPE }), 0);
  });

  it("gửi lại khi đang chờ duyệt: admin nhận thông báo 'gửi lại'", async () => {
    const applicant = await User.create({ name: "Trần Thị B", email: "applicant-b@test.local", role: "customer" });
    await applyForMentor(String(applicant._id), validBody);
    const res = await applyForMentor(String(applicant._id), { ...validBody, bio: "Đã bổ sung kinh nghiệm." });
    assert.equal(res.ok, true, res.error);

    const titles = (await Notification.find({ userId: admin1._id, type: TYPE, body: /Trần Thị B/ }).sort({ createdAt: 1 }).lean())
      .map((n) => n.title);
    assert.deepEqual(titles, ["Có hồ sơ đăng ký mentor mới", "Hồ sơ mentor được gửi lại"]);
  });

  it("mentor đã duyệt chỉ sửa hồ sơ: không báo admin", async () => {
    const applicant = await User.create({ name: "Lê Văn C", email: "applicant-c@test.local", role: "customer" });
    await applyForMentor(String(applicant._id), validBody);
    await Mentor.updateOne({ userId: applicant._id }, { $set: { "adminReview.status": "approved" } });
    const before = await Notification.countDocuments({ userId: admin1._id, type: TYPE });

    const res = await applyForMentor(String(applicant._id), { ...validBody, targetRate: 400000 });
    assert.equal(res.ok, true, res.error);
    assert.equal(await Notification.countDocuments({ userId: admin1._id, type: TYPE }), before);
  });

  it("đăng ký thiếu thông tin: không tạo thông báo", async () => {
    const applicant = await User.create({ name: "Phạm D", email: "applicant-d@test.local", role: "customer" });
    const before = await Notification.countDocuments({ type: TYPE });
    const res = await applyForMentor(String(applicant._id), { ...validBody, bio: "" });
    assert.equal(res.ok, false);
    assert.equal(await Notification.countDocuments({ type: TYPE }), before);
  });
});
