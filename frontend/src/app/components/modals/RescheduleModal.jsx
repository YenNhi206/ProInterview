import { useState } from "react";
import { toast } from "sonner";
import {
  CalendarOff as CalendarX,
  Clock,
  AlertTriangle as Warning,
  Send as PaperPlaneTilt,
  X,
  User,
} from "lucide-react";


export function RescheduleModal({ meeting, onClose }) {
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [reason, setReason] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!newDate || !newTime) {
      toast.error("Vui lòng chọn ngày và giờ mới");
      return;
    }

    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do dời lịch");
      return;
    }

    // Validate new date is in future
    const newDateTime = new Date(`${newDate}T${newTime}`);
    const now = new Date();
    if (newDateTime <= now) {
      toast.error("Thời gian mới phải sau thời điểm hiện tại");
      return;
    }

    // Success
    toast.success(
      `Đã gửi yêu cầu dời lịch đến ${meeting.mentee.name}. Mentee sẽ nhận thông báo qua email và có thể chấp nhận hoặc đề xuất thời gian khác.`,
      { duration: 6000 }
    );

    // Reset and close
    setNewDate("");
    setNewTime("");
    setReason("");
    onClose();
  };

  const originalDate = new Date(meeting.scheduledDate);
  const originalDateStr = originalDate.toLocaleDateString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{ background: "linear-gradient(135deg, #FFD600, #FF8C42)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.25)" }}
            >
              <CalendarX className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Dời lịch họp</h3>
              <p className="text-xs mt-0.5 text-white/90">Thông báo mentee về thời gian mới</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/20"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Warning Banner */}
        <div
          className="mx-6 mt-5 p-4 rounded-xl flex items-start gap-3"
          style={{ background: "rgba(255,214,0,0.1)", border: "1px solid rgba(255,214,0,0.25)" }}
        >
          <Warning className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#FFD600" }} />
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: "#1F1F1F" }}>
              Lưu ý khi dời lịch
            </p>
            <ul className="text-xs space-y-1" style={{ color: "#6B7280" }}>
              <li>• Mentee sẽ nhận thông báo qua email ngay lập tức</li>
              <li>• Mentee có thể chấp nhận hoặc đề xuất thời gian khác</li>
              <li>• Nên dời lịch ít nhất 24h trước giờ họp để tránh gián đoạn</li>
            </ul>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Current Meeting Info */}
          <div
            className="p-4 rounded-xl"
            style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}
          >
            <p className="text-xs font-semibold mb-3" style={{ color: "#9CA3AF" }}>
              THÔNG TIN BUỔI HỌP HIỆN TẠI
            </p>
            <div className="flex items-start gap-3">
              <img
                src={meeting.mentee.avatar}
                alt={meeting.mentee.name}
                className="w-12 h-12 rounded-full object-cover flex-shrink-0"
              />
              <div className="flex-1">
                <p className="font-semibold text-sm mb-1" style={{ color: "#1F1F1F" }}>
                  {meeting.mentee.name}
                </p>
                <p className="text-xs mb-2" style={{ color: "#6E35E8" }}>
                  {meeting.position} @ {meeting.company}
                </p>
                <div className="flex items-center gap-3 text-xs" style={{ color: "#9CA3AF" }}>
                  <span>{originalDateStr}</span>
                  <span>•</span>
                  <span>{meeting.scheduledTime}</span>
                </div>
              </div>
            </div>
          </div>

          {/* New Date Input */}
          <div>
            <label className="text-sm font-semibold mb-2 block" style={{ color: "#1F1F1F" }}>
              Ngày mới <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full p-3 rounded-xl text-sm outline-none transition-all"
              style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}
            />
          </div>

          {/* New Time Input */}
          <div>
            <label className="text-sm font-semibold mb-2 block" style={{ color: "#1F1F1F" }}>
              Giờ mới <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="w-full p-3 rounded-xl text-sm outline-none transition-all"
              style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}
            />
          </div>

          {/* Reason Input */}
          <div>
            <label className="text-sm font-semibold mb-2 block" style={{ color: "#1F1F1F" }}>
              Lý do dời lịch <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ví dụ: Xin lỗi em, thầy có việc đột xuất trong công việc. Thầy sẽ compensate thêm 15 phút cho buổi họp này..."
              rows={4}
              className="w-full p-3 rounded-xl text-sm outline-none transition-all resize-none"
              style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}
            />
            <p className="text-xs mt-1.5" style={{ color: "#9CA3AF" }}>
              Lời nhắn này sẽ được gửi đến mentee để họ hiểu lý do dời lịch
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-colors hover:bg-gray-200"
              style={{ background: "#F4F5F7", color: "#1F1F1F" }}
            >
              Huỷ
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all hover:brightness-110 flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #FFD600, #FF8C42)",
                color: "#1F1F1F",
                boxShadow: "0 4px 16px rgba(255,214,0,0.3)",
              }}
            >
              <PaperPlaneTilt className="w-4 h-4" />
              Gửi yêu cầu dời lịch
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}