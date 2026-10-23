import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

/**
 * Xác nhận dùng camera/mic trước khi vào phòng phỏng vấn AI.
 * Nội dung gắn với CAMERA_CONSENT_VERSION (utils/interview/cameraConsent.js) — sửa nội dung thì tăng version.
 */
export function CameraConsentDialog({ open, saving = false, onAccept, onDecline, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#14121f] text-slate-200">
        <DialogHeader>
          <DialogTitle className="text-white">Cho phép dùng camera trong buổi phỏng vấn?</DialogTitle>
          <DialogDescription className="text-slate-400">
            Bạn có thể phỏng vấn mà không bật camera.
          </DialogDescription>
        </DialogHeader>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
          <li>Camera và micro được dùng để phân tích hành vi khi trả lời (giao tiếp bằng mắt, độ ổn định, nhịp nói).</li>
          <li>Hệ thống <strong>không lưu video</strong> buổi phỏng vấn.</li>
          <li>
            Sau mỗi câu, 1 ảnh chụp được gửi tới Google Cloud Vision để phân tích biểu cảm rồi bỏ đi — chỉ các chỉ số
            được lưu lại.
          </li>
          <li>Nếu không đồng ý, camera sẽ tắt và bỏ qua phân tích khuôn mặt; micro vẫn dùng để ghi câu trả lời.</li>
        </ul>
        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={onDecline}
            disabled={saving}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-50"
          >
            Phỏng vấn không dùng camera
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={saving}
            className="rounded-xl bg-[#93f72b] px-4 py-2.5 text-sm font-bold text-[#0b0b14] hover:brightness-95 disabled:opacity-50"
          >
            Đồng ý và bật camera
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
