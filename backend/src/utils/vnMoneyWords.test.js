import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { vnMoneyInWords, vnNumberToWords } from "./vnMoneyWords.js";

describe("vnMoneyWords — số tiền bằng chữ trên hóa đơn", () => {
  const cases = [
    [0, "không"],
    [5, "năm"],
    [10, "mười"],
    [15, "mười lăm"],
    [21, "hai mươi mốt"],
    [25, "hai mươi lăm"],
    [105, "một trăm lẻ năm"],
    [110, "một trăm mười"],
    [99_000, "chín mươi chín nghìn"],
    [199_000, "một trăm chín mươi chín nghìn"],
    [350_000, "ba trăm năm mươi nghìn"],
    [1_005_000, "một triệu không trăm lẻ năm nghìn"],
    [1_000_000, "một triệu"],
    [12_500_000, "mười hai triệu năm trăm nghìn"],
    [2_000_000_000, "hai tỷ"],
    [1_000_000_000_000, "một nghìn tỷ"],
  ];
  for (const [n, words] of cases) {
    it(`${n.toLocaleString("vi-VN")} → ${words}`, () => assert.equal(vnNumberToWords(n), words));
  }

  it("vnMoneyInWords viết hoa chữ đầu, thêm 'đồng'; số âm / rác đọc theo giá trị tuyệt đối / 0", () => {
    assert.equal(vnMoneyInWords(350000), "Ba trăm năm mươi nghìn đồng");
    assert.equal(vnMoneyInWords(0), "Không đồng");
    assert.equal(vnMoneyInWords("abc"), "Không đồng");
  });
});
