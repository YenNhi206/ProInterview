import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mentorNetFromBooking } from "./mentorEarningsService.js";

describe("mentorNetFromBooking", () => {
  it("mentor net không đổi khi booking có ưu đãi Pro/Elite (platform tự gánh phần giảm giá)", () => {
    const price = 250000;
    const standardPlatformFee = Math.round(price * 0.3);
    const noDiscountNet = mentorNetFromBooking({
      price,
      totalAmount: price,
      platformFee: standardPlatformFee,
    });

    const discountAmount = Math.round(price * 0.1); // Elite 10%
    const discountedNet = mentorNetFromBooking({
      price,
      totalAmount: price - discountAmount,
      platformFee: standardPlatformFee - discountAmount,
    });

    assert.equal(discountedNet, noDiscountNet);
  });

  it("dùng price làm fallback khi totalAmount thiếu (booking cũ trước khi có field này)", () => {
    const net = mentorNetFromBooking({ price: 100000, platformFee: 30000 });
    assert.equal(net, 70000);
  });
});
