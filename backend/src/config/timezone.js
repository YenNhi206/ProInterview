/**
 * Giờ của booking (`date` + `timeSlot`) là giờ Việt Nam, và code đặt lịch dựng ngày bằng `new Date(y, m, d, h, min)`
 * (giờ địa phương của process). Render chạy UTC nên 20:00 bị hiểu thành 20:00 UTC (03:00 sáng hôm sau ở VN):
 * mentor không kết thúc được buổi, job nhắc lịch / hủy booking quá hạn lệch 7 tiếng.
 * Import file này đầu tiên trong `server.js` để cả process dùng giờ Việt Nam. Ghi đè bằng biến `TZ` nếu cần.
 */
export const APP_TIMEZONE = "Asia/Ho_Chi_Minh";

if (!process.env.TZ) process.env.TZ = APP_TIMEZONE;
