import { Mail as EnvelopeSimple, Phone, MessageCircle as ChatCircleDots } from "lucide-react";

export function SupportContact() {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "#fff",
        border: "2px solid rgba(110, 53, 232,0.15)",
        boxShadow: "0 4px 16px rgba(110, 53, 232,0.08)",
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(110, 53, 232,0.1)" }}
        >
          <ChatCircleDots className="w-5 h-5" style={{ color: "#6E35E8" }} />
        </div>
        <div>
          <h3 className="font-semibold text-sm" style={{ color: "#1F1F1F" }}>
            Cần hỗ trợ?
          </h3>
          <p className="text-xs" style={{ color: "#9CA3AF" }}>
            Chúng tôi luôn sẵn sàng hỗ trợ bạn
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <a
          href="mailto:support@prointerview.vn"
          className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-[#F9FAFB]"
          style={{ border: "1px solid #E5E7EB" }}
        >
          <EnvelopeSimple className="w-5 h-5" style={{ color: "#6E35E8" }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: "#6B7280" }}>
              Email
            </p>
            <p className="text-sm font-semibold" style={{ color: "#1F1F1F" }}>
              support@prointerview.vn
            </p>
          </div>
        </a>

        <a
          href="tel:+842473003636"
          className="flex items-center gap-3 p-3 rounded-xl transition-all hover:bg-[#F9FAFB]"
          style={{ border: "1px solid #E5E7EB" }}
        >
          <Phone className="w-5 h-5" style={{ color: "#6E35E8" }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium" style={{ color: "#6B7280" }}>
              Hotline
            </p>
            <p className="text-sm font-semibold" style={{ color: "#1F1F1F" }}>
              024 7300 3636
            </p>
          </div>
        </a>
      </div>

      <div
        className="mt-4 p-3 rounded-xl text-xs"
        style={{ background: "#F9FAFB", color: "#6B7280" }}
      >
        <strong>Chính sách hỗ trợ:</strong>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>Hoàn tiền 100% nếu mentor hủy</li>
          <li>Hoàn tiền 100% nếu hủy trước 48h</li>
          <li>Đổi lịch miễn phí qua email</li>
        </ul>
      </div>
    </div>
  );
}
