/**
 * LP-09: chia tiền lộ trình (DESIGN mục 4, DECISIONS "Chia tiền lộ trình").
 *
 *   share_i = floor(T / n)                  với i < n
 *   share_n = T − (n − 1) × floor(T / n)    (buổi cuối nhận phần dư)
 *
 * - Ví dụ: T = 1.000.000, n = 3 → 333.333 · 333.333 · 333.334.
 * - Phí nền tảng mỗi buổi = round(share × rate) — cùng công thức `learningPathBookingMoney` (LP-04),
 *   vì `mentorNetFromBooking` chỉ đọc `totalAmount − platformFee`.
 * - Buổi học lại lần đầu (attempt = 2) miễn phí: share = 0 (quyết định 2).
 * - Hủy lộ trình: hoàn = T − tổng share các buổi gốc (attempt = 1) đã `done`; mentor giữ phần đã nhận.
 *
 * Mọi số tiền là VND nguyên. Hàm thuần, không đụng DB.
 */

function assertVnd(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} phải là số nguyên VND không âm (nhận ${value}).`);
  }
}

function assertRate(rate) {
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate < 0 || rate > 1) {
    throw new RangeError(`platformFeeRate phải nằm trong [0, 1] (nhận ${rate}).`);
  }
}

/** Chia T cho n buổi: phần nguyên đều nhau, buổi cuối nhận phần dư. Tổng luôn bằng T. */
export function splitLearningPathShares(totalAmount, sessionCount) {
  assertVnd(totalAmount, "totalAmount");
  if (!Number.isInteger(sessionCount) || sessionCount < 1) {
    throw new RangeError(`Số buổi phải là số nguyên ≥ 1 (nhận ${sessionCount}).`);
  }
  const base = Math.floor(totalAmount / sessionCount);
  const shares = Array(sessionCount).fill(base);
  shares[sessionCount - 1] = totalAmount - base * (sessionCount - 1);
  return shares;
}

/** Phí nền tảng của một buổi. */
export function learningPathSessionFee(shareAmount, platformFeeRate) {
  assertVnd(shareAmount, "shareAmount");
  assertRate(platformFeeRate);
  return Math.round(shareAmount * platformFeeRate);
}

/**
 * Kế hoạch tiền cho các buổi gốc của lộ trình: mỗi phần tử { order, shareAmount, platformFee, mentorNet }.
 * Tổng shareAmount = T; platformFee + mentorNet = shareAmount ở từng buổi.
 */
export function planLearningPathMoney(totalAmount, sessionCount, platformFeeRate) {
  assertRate(platformFeeRate);
  return splitLearningPathShares(totalAmount, sessionCount).map((shareAmount, i) => {
    const platformFee = learningPathSessionFee(shareAmount, platformFeeRate);
    return { order: i + 1, shareAmount, platformFee, mentorNet: shareAmount - platformFee };
  });
}

/** Buổi học lại lần đầu (attempt 2) miễn phí; attempt ≥ 3 là buổi bổ sung có phí do mentor đề xuất (ngoài T). */
export function isFreeRetake(attempt) {
  return attempt === 2;
}

/** shareAmount của buổi học lại: lần đầu 0; buổi bổ sung có phí lấy giá mentor đề xuất. */
export function retakeShareAmount(attempt, supplementaryPrice = 0) {
  if (!Number.isInteger(attempt) || attempt < 2) throw new RangeError(`attempt của buổi học lại phải ≥ 2 (nhận ${attempt}).`);
  if (isFreeRetake(attempt)) return 0;
  assertVnd(supplementaryPrice, "supplementaryPrice");
  return supplementaryPrice;
}

/**
 * Tiền hoàn khi hủy lộ trình (LP-15). Chỉ buổi gốc (attempt 1) nằm trong T; buổi học lại miễn phí
 * và buổi bổ sung có phí (thu riêng) không trừ vào T.
 * @param {number} totalAmount T đã thu
 * @param {{ attempt?: number, status: string, shareAmount: number }[]} sessions
 * @returns {{ refundAmount: number, consumedAmount: number }}
 */
export function computeLearningPathRefund(totalAmount, sessions) {
  assertVnd(totalAmount, "totalAmount");
  const consumedAmount = (sessions || [])
    .filter((s) => (s.attempt ?? 1) === 1 && s.status === "done")
    .reduce((sum, s) => {
      assertVnd(s.shareAmount, "shareAmount");
      return sum + s.shareAmount;
    }, 0);
  const consumed = Math.min(consumedAmount, totalAmount);
  return { refundAmount: totalAmount - consumed, consumedAmount: consumed };
}
