import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { CheckCircle, XCircle, FileText, Briefcase } from "lucide-react";
import { adminApi } from "../../api/adminApi.js";
import { getInitials } from "../../utils/auth/auth.js";
import { formatEducationDisplay } from "../../utils/profile/profileEducationHistory.js";
import { formatWorkHistoryLines, parseWorkHistory } from "../../utils/profile/profileWorkHistory.js";
import { toast } from "sonner";

import { formatVnd as formatVndUtil } from "../../utils/shared/formatVnd.js";

function formatVnd(n) {
  const x = Number(n);
  if (!Number.isFinite(x) || x <= 0) return "—";
  return formatVndUtil(x);
}

function ChipList({ items, empty }) {
  const list = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!list.length) return <p className="text-sm text-[#2D1B69]/50">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((t) => (
        <span
          key={t}
          className="rounded-md border border-[#8037f4]/15 bg-white px-2 py-0.5 text-xs font-medium text-[#2D1B69]"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function hasUsableAvatar(url) {
  const s = String(url ?? "").trim();
  if (!s) return false;
  if (/logo\.png|logo-mark/i.test(s)) return false;
  return s.startsWith("http") || s.startsWith("/");
}

/** Portal ra body, tránh fixed bị kẹt trong layout overflow-hidden của admin shell. */
function AdminModalPortal({ onClose, children, maxWidthClass = "max-w-2xl" }) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 md:p-8">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full ${maxWidthClass} max-h-[min(90vh,calc(100dvh-2rem))] overflow-y-auto rounded-2xl border border-[#8037f4]/18 bg-white p-6 shadow-[0_24px_60px_rgba(128,55,244,0.18)]`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function MentorPreviewAvatar({ mentor }) {
  const name = mentor?.userId?.name || mentor?.name || "Mentor";
  const avatar = mentor?.userId?.avatar || mentor?.avatar || "";
  const initials = getInitials(name);
  const [imgFailed, setImgFailed] = useState(false);

  if (hasUsableAvatar(avatar) && !imgFailed) {
    return (
      <img
        src={avatar}
        alt=""
        className="size-14 shrink-0 rounded-2xl object-cover ring-2 ring-[#8037f4]/20"
        onError={() => setImgFailed(true)}
      />
    );
  }

  return (
    <div
      className="flex size-14 shrink-0 items-center justify-center rounded-2xl text-base font-black text-white ring-2 ring-[#8037f4]/20"
      style={{ background: "#8037f4" }}
      aria-hidden
    >
      {initials}
    </div>
  );
}

function PreviewSection({ label, children }) {
  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#8037f4]">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function PreviewText({ value, empty = "—" }) {
  const text = String(value ?? "").trim();
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#2D1B69]/85">
      {text || empty}
    </p>
  );
}

function formatWorkFromMentorHeader(mentor) {
  const lines = [];
  if (mentor?.title) lines.push(`Chức danh: ${mentor.title}`);
  if (mentor?.company && mentor.company !== "Freelancer") lines.push(`Công ty: ${mentor.company}`);
  const y = Number(mentor?.experienceYears);
  if (Number.isFinite(y) && y > 0) lines.push(`Số năm kinh nghiệm: ${y}`);
  return lines.join("\n");
}

/** Gộp hồ sơ User (form /profile) + snapshot trên Mentor lúc apply. */
function getMentorPreviewFromApplication(mentor) {
  const u = mentor?.userId && typeof mentor.userId === "object" ? mentor.userId : {};
  const companiesFromMentor = Array.isArray(mentor?.companies)
    ? mentor.companies.filter(Boolean)
    : [];

  const educationRaw =
    String(mentor?.profileEducation ?? "").trim() ||
    String(u.profileEducation || u.school || "").trim();
  const education = formatEducationDisplay(educationRaw);

  const rawWork =
    String(mentor?.profileWorkExperience ?? "").trim() ||
    String(u.profileWorkExperience ?? "").trim();
  let workExperience = "";
  if (rawWork.startsWith("{")) {
    workExperience = formatWorkHistoryLines(parseWorkHistory(rawWork));
  } else if (rawWork) {
    workExperience = rawWork;
  }
  if (!workExperience) {
    workExperience =
      formatWorkFromMentorHeader(mentor) || companiesFromMentor.join(", ");
  }

  const extracurricular =
    String(mentor?.profileExtracurricular ?? "").trim() ||
    String(u.profileExtracurricular ?? "").trim();

  const awards =
    String(mentor?.profileAwards ?? "").trim() || String(u.profileAwards ?? "").trim();

  return {
    education,
    workExperience,
    workCompanies: companiesFromMentor,
    extracurricular,
    awards,
  };
}

export function AdminMentorsPending() {
  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewMentor, setPreviewMentor] = useState(null);
  const [rejectingMentor, setRejectingMentor] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [submittingReject, setSubmittingReject] = useState(false);

  const loadPendingMentors = async () => {
    setLoading(true);
    const res = await adminApi.getMentors();
    if (res.success) {
      const pending = res.mentors.filter(
        (m) => !m.isActive && !m.isVerified && m?.adminReview?.status !== "rejected",
      );
      setMentors(pending);
    } else {
      toast.error(res.error || "Không thể tải danh sách hồ sơ chờ duyệt.");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPendingMentors();
  }, []);

  const handleApprove = async (id) => {
    const res = await adminApi.updateMentorStatus(id, true);
    if (res.success) {
      toast.success("Đã duyệt hồ sơ cố vấn thành công!");
      setMentors((prev) => prev.filter((m) => m._id !== id));
    } else {
      toast.error(res.error || "Không thể duyệt hồ sơ cố vấn.");
    }
  };

  const openRejectModal = (mentor) => {
    setRejectingMentor(mentor);
    setRejectReason("");
  };

  const closeRejectModal = () => {
    if (submittingReject) return;
    setRejectingMentor(null);
    setRejectReason("");
  };

  const handleReject = async () => {
    const mentorId = rejectingMentor?._id;
    if (!mentorId) return;

    const reason = rejectReason.trim();
    if (!reason) {
      toast.error("Vui lòng nhập lý do từ chối hồ sơ.");
      return;
    }

    setSubmittingReject(true);
    const res = await adminApi.rejectMentorApplication(mentorId, reason);
    setSubmittingReject(false);

    if (res.success) {
      toast.success("Đã từ chối hồ sơ cố vấn.");
      setMentors((prev) => prev.filter((m) => m._id !== mentorId));
      closeRejectModal();
    } else {
      toast.error(res.error || "Không thể từ chối hồ sơ cố vấn.");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h2 className="font-headline mb-2 text-3xl font-black uppercase tracking-tighter text-slate-900">
          Duyệt đăng ký <span className="text-violet-700">Cố vấn</span>
        </h2>
        <p className="text-sm font-medium text-slate-600">
          Danh sách các chuyên gia đang chờ hệ thống phê duyệt hồ sơ.
        </p>
      </div>

      <div className="glass-card overflow-hidden border-slate-200/90">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">Ứng viên</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Chức danh / Công ty
                </th>
                <th className="px-8 py-6 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Hồ sơ gửi
                </th>
                <th className="px-8 py-6 text-right text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center text-[10px] font-black uppercase italic tracking-widest text-slate-500">
                    Đang tải danh sách chờ...
                  </td>
                </tr>
              ) : mentors.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center text-[10px] font-black uppercase italic tracking-widest text-slate-500">
                    Hiện không có hồ sơ nào đang chờ duyệt.
                  </td>
                </tr>
              ) : (
                mentors.map((mentor) => (
                  <tr key={mentor._id} className="group transition-colors hover:bg-violet-50/40">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <img
                          src={mentor.userId?.avatar}
                          alt=""
                          className="size-10 rounded-xl bg-slate-100 object-cover"
                        />
                        <div>
                          <p className="font-black text-slate-900">{mentor.userId?.name}</p>
                          <p className="text-[10px] uppercase tracking-widest text-slate-500">{mentor.userId?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 font-medium lowercase text-slate-700 first-letter:uppercase">
                        <Briefcase size={14} className="text-violet-600" /> {mentor.title}
                      </div>
                      <p className="mt-1 text-[10px] uppercase tracking-widest text-slate-500">
                        {mentor.company || "Freelancer"}
                      </p>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <button
                        type="button"
                        onClick={() => setPreviewMentor(mentor)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase text-slate-600 transition-all hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800"
                      >
                        <FileText size={12} /> Xem hồ sơ
                      </button>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openRejectModal(mentor)}
                          className="rounded-xl border border-red-200 bg-red-50 p-2 text-red-600 transition-all hover:border-red-400 hover:bg-red-600 hover:text-white"
                        >
                          <XCircle size={18} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleApprove(mentor._id)}
                          className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-emerald-800 transition-all hover:border-emerald-400 hover:bg-emerald-600 hover:text-white"
                        >
                          <CheckCircle size={14} /> Phê duyệt
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {previewMentor ? (
        <AdminModalPortal onClose={() => setPreviewMentor(null)}>
          <div aria-labelledby="admin-mentor-preview-title">
            <div className="flex items-start justify-between gap-4 border-b border-[#8037f4]/10 pb-4">
              <div>
                <h3 id="admin-mentor-preview-title" className="text-lg font-black text-[#2D1B69]">
                  Hồ sơ ứng tuyển cố vấn
                </h3>
                <p className="mt-1 text-sm text-[#2D1B69]/55">
                  Thông tin mentor gửi qua form đăng ký trên hồ sơ cá nhân.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewMentor(null)}
                className="shrink-0 rounded-lg border border-[#8037f4]/20 px-3 py-1.5 text-xs font-bold text-[#8037f4] transition hover:bg-[#f8f5ff]"
              >
                Đóng
              </button>
            </div>

            <div className="mt-5 flex gap-4 rounded-xl bg-[#f8f5ff] p-4 ring-1 ring-[#8037f4]/12">
              <MentorPreviewAvatar mentor={previewMentor} />
              <div className="min-w-0 flex-1">
                <p className="font-black text-[#2D1B69]">{previewMentor.userId?.name || previewMentor.name}</p>
                <p className="truncate text-sm text-[#2D1B69]/55">{previewMentor.userId?.email}</p>
                <p className="mt-2 text-sm text-[#2D1B69]">
                  <span className="font-semibold">{previewMentor.title}</span>
                  <span className="text-[#2D1B69]/35"> · </span>
                  {previewMentor.company || "Freelancer"}
                </p>
                <p className="mt-1.5 text-xs text-[#2D1B69]/55">
                  Kinh nghiệm:{" "}
                  <span className="font-semibold text-[#2D1B69]">
                    {Number.isFinite(Number(previewMentor.experienceYears))
                      ? `${previewMentor.experienceYears} năm`
                      : "—"}
                  </span>
                  <span className="mx-2 text-[#8037f4]/25">|</span>
                  Đề xuất giá/giờ:{" "}
                  <span className="font-semibold text-[#2D1B69]">{formatVnd(previewMentor.pricePerHour)}</span>
                </p>
              </div>
            </div>

            {(() => {
              const profile = getMentorPreviewFromApplication(previewMentor);
              return (
            <div className="mt-5 divide-y divide-[#8037f4]/10">
              <PreviewSection label="Giới thiệu bản thân">
                <PreviewText value={previewMentor.bio} />
              </PreviewSection>
              <PreviewSection label="Quá trình học tập">
                <PreviewText value={profile.education} empty="Không có." />
              </PreviewSection>
              <PreviewSection label="Kinh nghiệm làm việc">
                <PreviewText value={profile.workExperience} empty="Không có." />
                {profile.workCompanies.length > 0 &&
                profile.workExperience !== profile.workCompanies.join(", ") ? (
                  <div className="mt-2">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[#2D1B69]/45">
                      Công ty (tách theo dấu phẩy)
                    </p>
                    <ChipList items={profile.workCompanies} empty="" />
                  </div>
                ) : null}
              </PreviewSection>
              <PreviewSection label="Hoạt động ngoại khóa">
                <PreviewText value={profile.extracurricular} empty="Không có." />
              </PreviewSection>
              {profile.awards ? (
                <PreviewSection label="Giải thưởng">
                  <PreviewText value={profile.awards} />
                </PreviewSection>
              ) : null}
              <PreviewSection label="Kỹ năng & chứng chỉ">
                <ChipList items={previewMentor.specialties} empty="Không có." />
              </PreviewSection>
            </div>
              );
            })()}

            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-[#8037f4]/10 pt-5">
              <button
                type="button"
                onClick={() => {
                  const m = previewMentor;
                  setPreviewMentor(null);
                  openRejectModal(m);
                }}
                className="rounded-xl border border-[#8037f4]/25 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-[#8037f4] transition hover:border-[#8037f4] hover:bg-[#f8f5ff]"
              >
                Từ chối
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = previewMentor._id;
                  setPreviewMentor(null);
                  await handleApprove(id);
                }}
                className="rounded-xl border border-[#7fe015]/50 bg-[#93f72b] px-4 py-2 text-xs font-black uppercase tracking-wider text-[#2D1B69] shadow-[0_8px_20px_rgba(180,245,0,0.35)] transition hover:brightness-95"
              >
                Phê duyệt
              </button>
            </div>
          </div>
        </AdminModalPortal>
      ) : null}

      {rejectingMentor ? (
        <AdminModalPortal onClose={closeRejectModal} maxWidthClass="max-w-lg">
            <h3 className="text-lg font-black text-slate-900">Từ chối hồ sơ cố vấn</h3>
            <p className="mt-2 text-sm text-slate-600">
              Bạn đang từ chối hồ sơ của{" "}
              <span className="font-semibold text-slate-900">{rejectingMentor.userId?.name || "cố vấn"}</span>. Vui lòng
              nhập lý do để mentor biết và chỉnh sửa hồ sơ.
            </p>

            <label className="mt-5 block text-[11px] font-black uppercase tracking-widest text-slate-500">
              Lý do từ chối
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Ví dụ: Hồ sơ còn thiếu thông tin kinh nghiệm và minh chứng chuyên môn."
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-violet-400"
            />
            <p className="mt-1 text-right text-[10px] text-slate-500">{rejectReason.length}/500</p>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeRejectModal}
                disabled={submittingReject}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={submittingReject}
                className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-black uppercase tracking-wider text-red-700 transition hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingReject ? "Đang xử lý..." : "Xác nhận từ chối"}
              </button>
            </div>
        </AdminModalPortal>
      ) : null}
    </div>
  );
}
