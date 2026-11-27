import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canMentorCompleteBooking,
  mentorCompleteBlockMessage,
  minutesUntilMentorCanComplete,
} from "./meetingLinks.js";

// Giờ địa phương 20:00 ngày 27/11/2026 — parseBookingStartMs đọc theo giờ máy.
const booking = { date: "2026-11-27", timeSlot: "20:00" };
const at = (h, m) => new Date(2026, 10, 27, h, m, 0).getTime();

describe("Mentor kết thúc buổi: khớp mốc 15 phút của backend", () => {
  it("trước giờ bắt đầu thì chưa kết thúc được", () => {
    assert.equal(canMentorCompleteBooking(booking, at(19, 50)), false);
    assert.match(mentorCompleteBlockMessage(booking, at(19, 50)), /Chưa tới giờ bắt đầu/);
  });

  it("trong 15 phút đầu thì chưa kết thúc được, báo số phút còn lại", () => {
    assert.equal(canMentorCompleteBooking(booking, at(20, 5)), false);
    assert.equal(minutesUntilMentorCanComplete(booking, at(20, 5)), 10);
    assert.match(mentorCompleteBlockMessage(booking, at(20, 5)), /còn 10 phút/);
  });

  it("từ phút 15 trở đi thì kết thúc được", () => {
    assert.equal(canMentorCompleteBooking(booking, at(20, 15)), true);
    assert.equal(mentorCompleteBlockMessage(booking, at(20, 15)), "");
  });
});
