import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  attemptLabel,
  buildSlotOptions,
  canProposeSupplementary,
  groupSessionsByOrder,
  isoToBookingDate,
  linesToList,
  mentorSlotsForDay,
  outcomeFormErrors,
  sessionBadge,
  suggestOutcome,
  toIsoDateKey,
  toOutcomePayload,
} from "./learningPathTimeline.js";

const s = (id, order, attempt, status, outcome = null, extra = {}) => ({ id, order, attempt, status, outcome, title: `Buổi ${order}`, ...extra });

describe("sessionBadge", () => {
  it("đặt nhãn theo trạng thái và kết quả", () => {
    assert.equal(sessionBadge(s("a", 1, 1, "done", "passed")).label, "Đạt");
    assert.equal(sessionBadge(s("a", 1, 1, "done", "not_passed")).label, "Chưa đạt");
    assert.equal(sessionBadge(s("a", 1, 1, "scheduled")).label, "Đã đặt lịch");
    assert.equal(sessionBadge(s("a", 1, 3, "pending_payment")).label, "Chờ thanh toán");
    assert.equal(sessionBadge(s("a", 1, 1, "planned", null, { canSchedule: true })).label, "Mở đặt lịch");
    assert.equal(sessionBadge(s("a", 2, 1, "planned")).label, "Chưa mở");
  });
});

describe("attemptLabel", () => {
  it("1 = buổi chính, 2 = học lại miễn phí, ≥ 3 = buổi bổ sung đánh số", () => {
    assert.equal(attemptLabel(1), "Buổi chính");
    assert.equal(attemptLabel(2), "Học lại (miễn phí)");
    assert.equal(attemptLabel(3), "Buổi bổ sung 1");
    assert.equal(attemptLabel(4), "Buổi bổ sung 2");
    assert.equal(attemptLabel(undefined), "Buổi chính");
  });
});

describe("groupSessionsByOrder", () => {
  it("gom theo buổi, sắp lần học tăng dần, latest bỏ lần bị hủy", () => {
    const groups = groupSessionsByOrder([
      s("b", 2, 1, "planned"),
      s("a2", 1, 2, "done", "passed"),
      s("a1", 1, 1, "done", "not_passed"),
      s("a3", 1, 3, "cancelled"),
    ]);
    assert.deepEqual(groups.map((g) => g.order), [1, 2]);
    assert.deepEqual(groups[0].attempts.map((x) => x.id), ["a1", "a2", "a3"]);
    assert.equal(groups[0].latest.id, "a2");
  });
});

describe("canProposeSupplementary", () => {
  const rows = [s("a1", 1, 1, "done", "not_passed"), s("a2", 1, 2, "done", "not_passed")];
  it("chỉ cho lần học lại mới nhất chưa đạt", () => {
    assert.equal(canProposeSupplementary(rows, rows[1]), true);
    assert.equal(canProposeSupplementary(rows, rows[0]), false, "lần trượt đầu đã có học lại miễn phí");
    assert.equal(canProposeSupplementary([...rows, s("a3", 1, 3, "pending_payment")], rows[1]), false, "đã đề xuất rồi");
    assert.equal(canProposeSupplementary(rows, s("x", 2, 2, "done", "passed")), false);
  });
});

describe("ô chọn giờ", () => {
  // Thứ 2, 23/11/2026, 08:00 giờ máy.
  const now = new Date(2026, 10, 23, 8, 0);
  const weekly = { availableSlots: {}, recurringSchedule: [{ dayOfWeek: 0, slots: ["07:00", "09:00", "19:00"] }, { dayOfWeek: 2, slots: ["20:00"] }], blockedDates: [] };

  it("toIsoDateKey hiểu nhiều dạng ngày", () => {
    assert.equal(toIsoDateKey("24/11/2026", 2000), "2026-11-24");
    assert.equal(toIsoDateKey("24/11", 2026), "2026-11-24");
    assert.equal(toIsoDateKey("Thứ 2, 24/11/2026", 2000), "2026-11-24");
    assert.equal(toIsoDateKey("2026-11-24", 2000), "2026-11-24");
    assert.equal(toIsoDateKey("", 2026), "");
  });

  it("lịch tuần: thứ 2 và thứ 4 có giờ, các ngày khác không", () => {
    assert.deepEqual(mentorSlotsForDay(weekly, new Date(2026, 10, 23)), ["07:00", "09:00", "19:00"]);
    assert.deepEqual(mentorSlotsForDay(weekly, new Date(2026, 10, 25)), ["20:00"]);
    assert.deepEqual(mentorSlotsForDay(weekly, new Date(2026, 10, 24)), []);
  });

  it("lịch riêng của ngày ưu tiên hơn lịch tuần; ngày bị chặn thì rỗng", () => {
    const av = { ...weekly, availableSlots: { "23/11/2026": ["15:00"] }, blockedDates: ["25/11/2026"] };
    assert.deepEqual(mentorSlotsForDay(av, new Date(2026, 10, 23)), ["15:00"]);
    assert.deepEqual(mentorSlotsForDay(av, new Date(2026, 10, 25)), [], "thứ 4 có lịch tuần nhưng bị chặn");
  });

  it("buildSlotOptions bỏ giờ đã qua và giờ đã có người đặt", () => {
    const options = buildSlotOptions(weekly, { "23/11/2026": ["19:00"] }, { now, days: 7 });
    assert.deepEqual(options.map((o) => o.date), ["23/11/2026", "25/11/2026"]);
    assert.deepEqual(options[0].times, ["09:00"], "07:00 đã qua, 19:00 đã có người đặt");
    assert.deepEqual(options[1].times, ["20:00"]);
  });

  it("map đã đặt dùng khóa không có năm vẫn nhận ra", () => {
    const options = buildSlotOptions(weekly, { "23/11": ["09:00", "19:00"] }, { now, days: 1 });
    assert.deepEqual(options, []);
  });

  it("mentor chưa khai báo lịch → null (FE cho nhập tay)", () => {
    assert.equal(buildSlotOptions({ availableSlots: {}, recurringSchedule: [] }, {}, { now }), null);
    assert.equal(buildSlotOptions(null, {}, { now }), null);
  });

  it("isoToBookingDate đổi YYYY-MM-DD sang DD/MM/YYYY", () => {
    assert.equal(isoToBookingDate("2026-11-24"), "24/11/2026");
    assert.equal(isoToBookingDate("24/11/2026"), "");
  });
});

describe("form chấm buổi", () => {
  it("linesToList bỏ dòng trống và giới hạn số dòng", () => {
    assert.deepEqual(linesToList(" a \n\n b\n"), ["a", "b"]);
    assert.equal(linesToList(Array.from({ length: 12 }, (_, i) => `x${i}`).join("\n")).length, 10);
  });

  it("suggestOutcome khớp backend: mọi key ≥ 3 mới đạt, thiếu điểm thì không gợi ý", () => {
    const keys = ["teamwork", "communication"];
    assert.equal(suggestOutcome({ teamwork: 3, communication: 5 }, keys), "passed");
    assert.equal(suggestOutcome({ teamwork: 5, communication: 2 }, keys), "not_passed");
    assert.equal(suggestOutcome({ teamwork: 4 }, keys), null);
    assert.equal(suggestOutcome({ teamwork: 4, communication: null }, keys), null);
    assert.equal(suggestOutcome({}, []), null);
  });

  it("outcomeFormErrors bắt thiếu kết quả, nhận xét ngắn, chưa đạt thiếu cải thiện", () => {
    assert.equal(outcomeFormErrors({ outcome: "", summary: "" }).length, 2);
    assert.deepEqual(outcomeFormErrors({ outcome: "passed", summary: "Rất tốt, rõ ràng." }), []);
    assert.equal(outcomeFormErrors({ outcome: "not_passed", summary: "Chưa đạt yêu cầu.", improvementsText: "" }).length, 1);
  });

  it("toOutcomePayload: bỏ điểm để trống, 'null' = chưa đủ dữ liệu, tách dòng", () => {
    const payload = toOutcomePayload({
      outcome: "not_passed",
      summary: "  Còn thiếu ví dụ cụ thể.  ",
      strengthsText: "Tự tin",
      improvementsText: "Thêm số liệu\nNói chậm lại",
      scores: { teamwork: "4", communication: "null", leadership: "" },
    });
    assert.deepEqual(payload, {
      outcome: "not_passed",
      feedback: { summary: "Còn thiếu ví dụ cụ thể.", strengths: ["Tự tin"], improvements: ["Thêm số liệu", "Nói chậm lại"] },
      scores: [{ shrmKey: "teamwork", score: 4 }, { shrmKey: "communication", score: null }],
    });
    assert.equal("scores" in toOutcomePayload({ outcome: "passed", summary: "Rất tốt ạ ok.", scores: {} }), false);
  });
});
