import { useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle as Warning,
  X,
  Send as PaperPlaneTilt,
  ShieldAlert as ShieldWarning,
} from "lucide-react";
import { REPORT_CATEGORIES } from "../../data/mentorMockData";

export function ReportMentorModal({
  mentorId,
  mentorName,
  relatedMeetingId,
  onClose,
}) {
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!category) {
      toast.error("Vui lòng chọn loại báo cáo");
      return;
    }

    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề báo cáo");
      return;
    }

    if (!description.trim() || description.trim().length < 20) {
      toast.error("Vui lòng mô tả chi tiết vấn đề (tối thiểu 20 ký tự)");
      return;
    }

    // Success
    toast.success(
      "Đã gửi báo cáo thành công. Chúng tôi sẽ xem xét và phản hồi trong vòng 24-48h.",
      { duration: 6000 }
    );

    // Reset and close
    setCategory("");
    setTitle("");
    setDescription("");
    onClose();
  };

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
          style={{ background: "linear-gradient(135deg, #EF4444, #FF8C42)" }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.25)" }}
            >
              <ShieldWarning className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Báo cáo Mentor</h3>
              <p className="text-xs mt-0.5 text-white/90">Gửi báo cáo về {mentorName}</p>
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
              Lưu ý khi gửi báo cáo
            </p>
            <ul className="text-xs space-y-1" style={{ color: "#6B7280" }}>
              <li>• Mô tả rõ ràng vấn đề bạn gặp phải</li>
              <li>• Báo cáo sẽ được xem xét trong vòng 24-48h</li>
              <li>• Thông tin của bạn sẽ được bảo mật</li>
              <li>• Báo cáo sai sự thật có thể bị xử lý</li>
            </ul>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Category Selection */}
          <div>
            <label className="text-sm font-semibold mb-2 block" style={{ color: "#1F1F1F" }}>
              Loại báo cáo <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(REPORT_CATEGORIES).map(([key, { label, color }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
                  className="p-3 rounded-xl text-left text-sm font-semibold transition-all"
                  style={
                    category === key
                      ? {
                          background: `${color}15`,
                          border: `2px solid ${color}`,
                          color: color,
                        }
                      : {
                          background: "#F9FAFB",
                          border: "1px solid #E5E7EB",
                          color: "#6B7280",
                        }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Title Input */}
          <div>
            <label className="text-sm font-semibold mb-2 block" style={{ color: "#1F1F1F" }}>
              Tiêu đề <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ví dụ: Mentor thường xuyên dời lịch vào phút cuối"
              className="w-full p-3 rounded-xl text-sm outline-none transition-all"
              style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}
              maxLength={100}
            />
            <p className="text-xs mt-1.5 text-right" style={{ color: "#9CA3AF" }}>
              {title.length}/100
            </p>
          </div>

          {/* Description Input */}
          <div>
            <label className="text-sm font-semibold mb-2 block" style={{ color: "#1F1F1F" }}>
              Mô tả chi tiết <span style={{ color: "#EF4444" }}>*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Vui lòng mô tả rõ ràng vấn đề bạn gặp phải với mentor, bao gồm thời gian, tình huống cụ thể và ảnh hưởng đến bạn..."
              rows={6}
              className="w-full p-3 rounded-xl text-sm outline-none transition-all resize-none"
              style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}
              maxLength={500}
            />
            <p className="text-xs mt-1.5 text-right" style={{ color: "#9CA3AF" }}>
              {description.length}/500 (tối thiểu 20 ký tự)
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-colors hover:bg-gray-200"
              style={{ background: "rgba(22,11,46,0.95)", color: "#f4f4f5" }}
            >
              Huỷ
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all hover:brightness-110 flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #EF4444, #FF8C42)",
                color: "#fff",
                boxShadow: "0 4px 16px rgba(239,68,68,0.3)",
              }}
            >
              <PaperPlaneTilt className="w-4 h-4" />
              Gửi báo cáo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
