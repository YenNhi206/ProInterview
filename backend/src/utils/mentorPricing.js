/**
 * Giá mentor: `Mentor.pricePerHour` là giá 60 phút đã có hiệu lực; booking tính tiền theo
 * `Mentor.sessionTypes[].price` (nếu > 0) trước, rồi mới tới `pricePerHour`
 * (`createBooking` trong `services/bookingsService.js`). Hai chỗ này phải luôn khớp nhau.
 *
 * Giá chỉ đổi qua: đăng ký hồ sơ mentor (chưa duyệt) hoặc admin duyệt yêu cầu đổi giá
 * (`approveMentorPrice`). Đồng bộ User → Mentor và PATCH /api/mentors/me không đổi giá.
 */

/** Giá một loại buổi theo giá/giờ, tỉ lệ theo thời lượng (mặc định 60 phút). */
export function sessionPriceForHourly(pricePerHour, durationMinutes) {
  const hourly = Math.round(Number(pricePerHour) || 0);
  const minutes = Number(durationMinutes) > 0 ? Number(durationMinutes) : 60;
  return Math.round((hourly * minutes) / 60);
}

/** Áp giá/giờ mới cho mọi loại buổi; thiếu loại buổi thì tạo `mock_interview` 60 phút. */
export function sessionTypesForHourly(sessionTypes, pricePerHour) {
  const list = Array.isArray(sessionTypes) && sessionTypes.length
    ? sessionTypes
    : [{ type: "mock_interview", durationMinutes: 60 }];
  return list
    .filter((s) => s && s.type)
    .map((s) => ({
      type: s.type,
      durationMinutes: s.durationMinutes,
      price: sessionPriceForHourly(pricePerHour, s.durationMinutes),
    }));
}
