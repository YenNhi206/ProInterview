import React, { useMemo, useState } from "react";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { useNavigate } from "react-router";
import {
  User,
  Mail as EnvelopeSimple,
  Phone,
  Check,
  Star,
  Mic as Microphone,
  Users,
  TrendingUp as TrendUp,
  Camera,
  ChevronRight as CaretRight,
  Zap as Lightning,
  Medal,
  X,
  Trophy,
  Sprout as Plant,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import {
  getPlans,
  getUser,
  updateUser,
  logout,
  getInitials,
  restoreSession,
  PLANS_CHANGED_EVENT,
} from "../../utils/auth/auth.js";
import { applyAsMentor, fetchMyMentorProfile, updateMyMentorProfile } from "../../api/mentorApi.js";
import { buildMentorApplyPayload } from "../../utils/mentor/mentorApplyPayload.js";
import {
  getCvSectionKeysToExpand,
  getProfileCvMissing,
  mentorApplyBlockedMessage,
  MENTOR_APPLY_RESUBMIT_CONFIRM_BODY,
  MENTOR_APPLY_RESUBMIT_CONFIRM_TITLE,
} from "../../utils/profile/profileCvValidation.js";
import {
  ProfileCvAccordionSection,
  ProfileCvMentorHint,
  ProfileCvStaticSection,
  ProfileCvTextarea,
} from "../../components/profile/ProfileCvSection";
import { ProfileWorkHistoryEditor } from "../../components/profile/ProfileWorkHistoryEditor";
import { ProfileEducationHistoryEditor } from "../../components/profile/ProfileEducationHistoryEditor";
import { uploadFile } from "../../api/uploadApi.js";
import { normalizeStoredUploadUrl, resolveMediaUrl } from "../../utils/shared/mediaUrl.js";
import {
  emptyWorkEntry,
  estimateExperienceYears,
  formatWorkHistoryLines,
  hasWorkHistoryContent,
  inferStartMonthFromExperienceYears,
  parseWorkHistory,
  pickCurrentWorkEntry,
  serializeWorkHistory,
} from "../../utils/profile/profileWorkHistory.js";
import {
  formatEducationHistoryLines,
  hasEducationHistoryContent,
  parseEducationHistory,
  serializeEducationHistory,
} from "../../utils/profile/profileEducationHistory.js";

function buildCvProfileFromSources(u, mentor) {
  const skillsFromUser =
    Array.isArray(u?.expertise) && u.expertise.length
      ? u.expertise.join(", ")
      : u?.field
        ? String(u.field)
        : "";
  const userWork = String(u?.profileWorkExperience ?? "").trim();
  const mentorWork = String(mentor?.profileWorkExperience ?? "").trim();
  const rawWork = userWork.startsWith("{")
    ? userWork
    : mentorWork.startsWith("{")
      ? mentorWork
      : userWork || mentorWork;
  let workHistory = parseWorkHistory(rawWork);
  const hasStructured = String(rawWork).trim().startsWith("{");
  if (!hasStructured && (mentor?.title || u?.position || mentor?.company || u?.currentCompany)) {
    const cur = pickCurrentWorkEntry(workHistory) || emptyWorkEntry();
    const yearsHint = mentor?.experienceYears ?? u?.experience;
    const startMonth =
      cur.startMonth || inferStartMonthFromExperienceYears(yearsHint);
    workHistory = [
      {
        ...cur,
        role: mentor?.title || u?.position || cur.role,
        company: mentor?.company || u?.currentCompany || cur.company,
        isCurrent: true,
        startMonth,
      },
      ...workHistory.slice(1),
    ];
  }
  const current = pickCurrentWorkEntry(workHistory);
  const years =
    mentor?.experienceYears ?? u?.experience ?? estimateExperienceYears(workHistory) ?? "";
  const rawEdu = mentor?.profileEducation || u?.profileEducation || u?.school || "";
  const educationHistory = parseEducationHistory(rawEdu);
  const hasStructuredEdu = String(rawEdu).trim().startsWith("{");
  return {
    intro: mentor?.bio || u?.bio || "",
    title: current?.role || mentor?.title || u?.position || "",
    company: current?.company || mentor?.company || u?.currentCompany || "",
    yearsOfExperience: String(years ?? ""),
    workHistory,
    workExperience: hasStructured ? formatWorkHistoryLines(workHistory) : String(rawWork).trim(),
    educationHistory,
    education: hasStructuredEdu
      ? formatEducationHistoryLines(educationHistory)
      : String(rawEdu).trim(),
    extracurricular: mentor?.profileExtracurricular || u?.profileExtracurricular || "",
    awards: mentor?.profileAwards || u?.profileAwards || "",
    skillsCerts:
      (Array.isArray(mentor?.specialties) && mentor.specialties.length
        ? mentor.specialties.join(", ")
        : "") || skillsFromUser,
    linkedinProfile: mentor?.linkedinUrl || "",
    portfolioLink: mentor?.portfolioUrl || "",
    targetRate: String(mentor?.pricePerHour ?? ""),
    fields: Array.isArray(mentor?.fields) ? mentor.fields.join(", ") : "",
    responseTime: mentor?.responseTime || "",
    timezone: mentor?.timezone || "Asia/Ho_Chi_Minh",
  };
}

function syncCvFromEducationHistory(cv) {
  const entries = Array.isArray(cv.educationHistory) ? cv.educationHistory : [];
  return {
    ...cv,
    education: entries.length ? formatEducationHistoryLines(entries) : cv.education ?? "",
  };
}

function syncCvFromWorkHistory(cv) {
  const entries = Array.isArray(cv.workHistory) ? cv.workHistory : [];
  const current = pickCurrentWorkEntry(entries);
  const manualYears = Number(cv.yearsOfExperience);
  const autoYears = estimateExperienceYears(entries);
  const years = Number.isFinite(manualYears) && manualYears >= 0 ? manualYears : autoYears ?? 0;
  return {
    ...cv,
    title: current?.role ?? cv.title ?? "",
    company: current?.company ?? cv.company ?? "",
    yearsOfExperience: years > 0 ? String(years) : cv.yearsOfExperience ?? "",
    workExperience: entries.length ? formatWorkHistoryLines(entries) : cv.workExperience,
  };
}

function expandCvSectionsWithContent(cv) {
  // Return empty object to keep all sections closed by default as requested
  return {};
}

async function persistCvProfileToUser(cv) {
  const splitCsv = (s) =>
    String(s ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
  const synced = syncCvFromEducationHistory(syncCvFromWorkHistory(cv));
  const years = Number(synced.yearsOfExperience);
  const workStored = serializeWorkHistory(synced.workHistory || []);
  const eduStored = serializeEducationHistory(synced.educationHistory || []);
  const eduText = formatEducationHistoryLines(synced.educationHistory || []);
  return updateUser({
    bio: synced.intro,
    position: synced.title,
    company: synced.company,
    experience: Number.isFinite(years) && years >= 0 ? years : 0,
    school: eduText,
    profileWorkExperience: workStored,
    profileEducation: eduStored,
    profileExtracurricular: synced.extracurricular,
    profileAwards: synced.awards,
    expertise: splitCsv(synced.skillsCerts),
  });
}

/** Placeholder trong ô nhập (gợi ý nằm trong textarea, không chữ bên ngoài). */
function getCvSectionCopy(isMentor) {
  return {
    intro: {
      placeholder: isMentor
        ? "Giới thiệu thế mạnh, mục tiêu nghề nghiệp và lý do muốn làm Mentor..."
        : "Chia sẻ ngắn về bản thân, định hướng nghề nghiệp và mục tiêu hiện tại.",
    },
    education: {
      placeholder:
        "Thêm trường, bằng cấp, chuyên ngành và thời gian học, có thể nhiều mốc.",
    },
    extracurricular: {
      placeholder: "Thêm hoạt động, câu lạc bộ hoặc dự án ngoài lớp bạn từng tham gia.",
    },
    awards: {
      placeholder: "Thêm thành tích, giải thưởng hoặc sự ghi nhận nổi bật.",
    },
    skills: {
      placeholder: "Cập nhật kỹ năng, công cụ, chứng chỉ hoặc khóa học bạn đã hoàn thành.",
    },
  };
}

const ACHIEVEMENTS = [
  { icon: Lightning, label: "5 ngày streak", color: "from-[#93f72b] to-[#7fe015]", earned: true },
  { icon: Microphone, label: "10 buổi phỏng vấn", color: "from-[#8037f4] to-[#a66ff8]", earned: true },
  { icon: Star, label: "Điểm STAR 4.0+", color: "from-[#93f72b] to-[#7fe015]", earned: true },
  { icon: Users, label: "3 buổi với Mentor", color: "from-[#a66ff8] to-[#8037f4]", earned: false },
  { icon: Medal, label: "Top 10% học viên", color: "from-[#8037f4] to-[#8037f4]", earned: false },
  { icon: TrendUp, label: "Cải thiện 50%", color: "from-[#93f72b] to-[#7fe015]", earned: false },
];

export function Profile() {
  const navigate = useNavigate();
  const user = getUser();
  const [plans, setPlans] = useState(getPlans());
  const [form, setForm] = useState({
    name: user?.name || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });
  const [saveMsg, setSaveMsg] = useState(null);
  const [mentorProfile, setMentorProfile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);
  const [mentorApplyError, setMentorApplyError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar || "");
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = React.useRef(null);
  const [cvProfile, setCvProfile] = useState(() => buildCvProfileFromSources(user, null));
  const [openCvSections, setOpenCvSections] = useState({
    intro: false,
    work: false,
    education: false,
    extracurricular: false,
    awards: false,
    skills: false,
    mentorExtra: false,
  });
  const [resubmitConfirmOpen, setResubmitConfirmOpen] = useState(false);

  React.useEffect(() => {
    if (!resubmitConfirmOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") setResubmitConfirmOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [resubmitConfirmOpen]);

  const toggleCvSection = (key) => {
    setOpenCvSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandCvSectionsForEdit = (cv = cvProfile, contact = form) => {
    const keys = getCvSectionKeysToExpand(cv, contact);
    if (!keys.length) return;
    setOpenCvSections((prev) => {
      const next = { ...prev };
      for (const key of keys) next[key] = true;
      return next;
    });
  };

  const initials = getInitials(form.name || "U");
  const isMentor = user?.role === "mentor";
  const showMentorRequiredMarks = !isMentor;
  const cvSectionCopy = useMemo(() => getCvSectionCopy(isMentor), [isMentor]);
  const mentorReviewStatus = mentorProfile
    ? mentorProfile?.adminReview?.status || (mentorProfile?.isVerified ? "approved" : "pending")
    : "";

  const scrollToCv = () => {
    document.getElementById("profile-cv")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const persistContactAndCv = async () => {
    const userRes = await updateUser({
      name: form.name,
      email: form.email,
      phone: form.phone,
    });
    if (!userRes?.success) {
      return { ok: false, error: userRes?.error || "Không lưu được thông tin liên hệ." };
    }
    const cvRes = await persistCvProfileToUser(cvProfile);
    if (!cvRes?.success) {
      return { ok: false, error: cvRes?.error || "Không lưu được hồ sơ cá nhân." };
    }
    return { ok: true };
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    const saved = await persistContactAndCv();
    if (!saved.ok) {
      setSaving(false);
      alert(saved.error);
      return;
    }

    if (isMentor) {
      const splitCsv = (s) =>
        String(s ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean);
      const mentorRes = await updateMyMentorProfile({
        title: cvProfile.title,
        company: cvProfile.company,
        bio: cvProfile.intro,
        experienceYears: cvProfile.yearsOfExperience,
        specialties: splitCsv(cvProfile.skillsCerts),
        fields: splitCsv(cvProfile.fields),
        linkedinUrl: cvProfile.linkedinProfile,
        portfolioUrl: cvProfile.portfolioLink,
        pricePerHour: cvProfile.targetRate,
        responseTime: cvProfile.responseTime,
        timezone: cvProfile.timezone,
      });
      if (!mentorRes?.success) {
        setSaving(false);
        alert(mentorRes?.error || "Không cập nhật được hồ sơ mentor.");
        return;
      }
      if (mentorRes.mentor) setMentorProfile(mentorRes.mentor);
    }

    syncAvatarFromSession();
    setSaving(false);
    setSaveMsg("saved");
    setTimeout(() => setSaveMsg(null), 2500);
  };

  /** «Đăng ký / Gửi lại mentor»: thiếu → nhắc điền; chờ duyệt (lần 2+) → xác nhận rồi gửi. */
  const handleSidebarMentorRegister = () => {
    const missing = getProfileCvMissing(cvProfile, form);
    if (missing.length) {
      setMentorApplyError(mentorApplyBlockedMessage(missing));
      expandCvSectionsForEdit(cvProfile, form);
      scrollToCv();
      return;
    }

    if (mentorReviewStatus === "pending") {
      setResubmitConfirmOpen(true);
      return;
    }

    setMentorApplyError("");
    handleApplyMentor();
  };

  const confirmResubmitMentor = async () => {
    setResubmitConfirmOpen(false);
    setMentorApplyError("");
    handleApplyMentor();
  };

  const handleApplyMentor = async ({ skipPersist = false } = {}) => {
    const wasResubmit =
      mentorReviewStatus === "rejected" || mentorReviewStatus === "pending";

    setApplying(true);
    if (!skipPersist) {
      const saved = await persistContactAndCv();
      if (!saved.ok) {
        setApplying(false);
        alert(saved.error);
        return;
      }
    }
    const res = await applyAsMentor(buildMentorApplyPayload(cvProfile));
    setApplying(false);
    if (res.success) {
      await reloadProfileFromServer(res.mentor);
      setSaveMsg(wasResubmit ? "mentor_resubmitted" : "mentor_applied");
      setTimeout(() => setSaveMsg(null), 4000);
    } else {
      alert(res.error || "Gửi yêu cầu thất bại.");
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file ảnh (JPG, PNG, …).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("Ảnh tối đa 5MB.");
      return;
    }
    setAvatarUploading(true);
    const up = await uploadFile(file, "avatar");
    if (!up.success || !up.url) {
      setAvatarUploading(false);
      alert(up.error || "Upload ảnh thất bại.");
      return;
    }
    const storedAvatar = normalizeStoredUploadUrl(up.url);
    const res = await updateUser({ avatar: storedAvatar });
    setAvatarUploading(false);
    if (res.success) {
      setAvatarUrl(getUser()?.avatar || storedAvatar);
      setSaveMsg("avatar");
      setTimeout(() => setSaveMsg(null), 2500);
    } else {
      alert(res.error || "Không lưu được ảnh đại diện.");
    }
  };

  const FORM_FIELDS = [
    { label: "Họ và tên", key: "name", icon: User, mentorRequired: true },
    { label: "Email", key: "email", icon: EnvelopeSimple, mentorRequired: true },
    { label: "Số điện thoại", key: "phone", icon: Phone, mentorRequired: false },
  ];

  const planInfo = (() => {
    if (plans.elitePro) return {
      name: "Thượng hạng (Elite)",
      nameIcon: Medal,
      badge: { bg: "bg-primary-fixed/20", border: "border-primary-fixed/30", icon: "text-primary-fixed", text: "text-primary-fixed" },
      cardGrad: "linear-gradient(145deg, #0E0922 0%, #1a0d35 100%)",
      desc: "Không giới hạn · Phân tích hành vi · Mentor 1:1",
      progress: null,
      isPaid: true,
      accent: "#93f72b"
    };
    if (plans.starterPro) return {
      name: "Chuyên nghiệp (Pro)",
      nameIcon: Lightning,
      badge: { bg: "bg-[#93f72b]/20", border: "border-[#93f72b]/40", icon: "text-[#7fe015]", text: "text-[#8037f4]" },
      cardGrad: "#8037f4",
      desc: "Phỏng vấn AI · Nhận diện giọng nói · 10 buổi/tháng",
      progress: { used: 0, max: 10 },
      isPaid: true,
      accent: "#8037f4"
    };
    return {
      name: "Cơ bản (Free)",
      nameIcon: Plant,
      badge: { bg: "bg-[#8037f4]/15", border: "border-[#8037f4]/30", icon: "text-[#8037f4]", text: "text-[#8037f4]" },
      cardGrad: "linear-gradient(145deg, #2D1B69 0%, #3B2A82 100%)",
      desc: "2 buổi AI miễn phí · 3 lần phân tích CV",
      progress: { used: 2, max: 2 },
      isPaid: false,
      accent: "#93f72b"
    };
  })();
  React.useEffect(() => {
    const refresh = () => setPlans(getPlans());
    window.addEventListener(PLANS_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(PLANS_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const syncAvatarFromSession = React.useCallback(async () => {
    const raw = getUser()?.avatar || "";
    const normalized = normalizeStoredUploadUrl(raw);
    if (raw && normalized.startsWith("/uploads/") && normalized !== raw) {
      const fixed = await updateUser({ avatar: normalized });
      if (fixed?.success) {
        setAvatarUrl(getUser()?.avatar || normalized);
        setAvatarBroken(false);
        return;
      }
    }
    setAvatarUrl(raw);
    setAvatarBroken(false);
  }, []);

  React.useEffect(() => {
    setAvatarBroken(false);
  }, [avatarUrl]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      await restoreSession().catch(() => {});
      if (!cancelled) syncAvatarFromSession();
    })();
    return () => {
      cancelled = true;
    };
  }, [syncAvatarFromSession]);

  const reloadProfileFromServer = React.useCallback(async (mentorOverride = null) => {
    await restoreSession().catch(() => {});
    const u = getUser();
    let mentor = mentorOverride;
    if (!mentor) {
      const res = await fetchMyMentorProfile();
      if (res?.success && res.mentor) mentor = res.mentor;
    }
    setMentorProfile(mentor || null);
    const cv = buildCvProfileFromSources(u, mentor || null);
    setCvProfile(cv);
    setForm({
      name: u?.name || "",
      email: u?.email || "",
      phone: u?.phone || "",
    });
    setOpenCvSections((prev) => ({ ...prev, ...expandCvSectionsWithContent(cv) }));
  }, []);

  React.useEffect(() => {
    if (!user?.email) return;
    void reloadProfileFromServer();
  }, [user?.email, reloadProfileFromServer]);

  return (
    <MentorPageShell
      bottomPad="pb-20"
      className="text-[#2D1B69] selection:bg-[#93f72b]/35 selection:text-[#2D1B69]"
    >
      <style>{`
        .profile-page {
          --pf-purple: #8037f4;
          --pf-purple-dark: #8037f4;
          --pf-purple-deep: #2D1B69;
          --pf-purple-soft: #f8f5ff;
          --pf-lime: #93f72b;
          --pf-lime-dark: #7fe015;
          --pf-lime-soft: rgba(180, 245, 0, 0.2);
          color: var(--pf-purple-deep);
        }
        .profile-page .profile-muted { color: rgba(45, 27, 105, 0.58); }
        .profile-page .profile-divider { border-color: rgba(128, 55, 244, 0.14); }
        .profile-page .profile-banner-info {
          border: 1px solid rgba(128, 55, 244, 0.22);
          background: var(--pf-purple-soft);
          color: var(--pf-purple-deep);
        }
        .profile-page .profile-banner-lime {
          border: 1px solid rgba(180, 245, 0, 0.45);
          background: var(--pf-lime-soft);
          color: var(--pf-purple-deep);
        }
        .profile-page .profile-badge-pending,
        .profile-page .profile-badge-approved {
          border: 1px solid rgba(180, 245, 0, 0.5);
          background: var(--pf-lime-soft);
          color: var(--pf-purple-deep);
        }
        .profile-page .profile-badge-rejected {
          border: 1px solid rgba(128, 55, 244, 0.35);
          background: var(--pf-purple-soft);
          color: var(--pf-purple-dark);
        }
        .profile-page .glass-card {
           background: #ffffff;
           backdrop-filter: none;
           border-radius: 28px;
           border: 1px solid rgba(128, 55, 244, 0.18);
           transition: transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.35s ease, box-shadow 0.45s ease;
           position: relative;
           overflow: hidden;
           box-shadow: 0 10px 24px rgba(128, 55, 244, 0.08);
        }
        .profile-page .glass-card::before { content: none; }
        .profile-page .glass-card:hover {
           border-color: rgba(122, 35, 229, 0.32);
           transform: translateY(-2px);
           box-shadow: 0 16px 32px rgba(128, 55, 244, 0.12);
        }
        .profile-page .font-headline {
          letter-spacing: -0.045em;
          text-shadow: none;
        }
        .profile-page .profile-cv-section-heading {
          display: inline-block;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          color: var(--pf-purple-deep);
          padding-bottom: 0.35rem;
          border-bottom: 3px solid var(--pf-lime);
          line-height: 1.2;
        }
        .profile-page .profile-cv-accordion-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }
        .profile-page .profile-cv-accordion-item {
          border-bottom: 1px solid rgba(128, 55, 244, 0.1);
        }
        .profile-page .profile-cv-accordion-item--split {
          border-bottom: 1px solid rgba(128, 55, 244, 0.18);
          margin-bottom: 0;
        }
        .profile-page .profile-cv-accordion-trigger {
          display: flex;
          width: 100%;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          padding: 0.65rem 0;
          text-align: left;
          background: transparent;
          border: none;
           cursor: pointer;
          transition: opacity 0.2s ease;
        }
        .profile-page .profile-cv-accordion-trigger:hover {
          opacity: 0.82;
        }
        .profile-page .profile-cv-accordion-chevron {
          color: var(--pf-purple-dark);
          transition: transform 0.25s ease;
        }
        .profile-page .profile-cv-accordion-chevron.is-open {
          transform: rotate(180deg);
        }
        .profile-page .profile-cv-accordion-panel {
          padding: 0 0 0.85rem;
        }
        .profile-page .profile-cv-static-section {
          padding: 0 0 0.9rem;
          border-bottom: 1px solid rgba(128, 55, 244, 0.1);
        }

        .profile-page .profile-cv-static-body {
          margin-top: 0.65rem;
        }
        .profile-page .profile-accent-lime { color: var(--pf-lime-dark); }
        .profile-page .profile-accent-purple { color: var(--pf-purple-dark); }
        .profile-page .glow-halo { position: relative; display: flex; align-items: center; justify-content: center; }
        .profile-page .glow-halo::after {
           content: '';
           position: absolute;
           width: 150%;
           height: 150%;
           background: radial-gradient(circle, rgba(180,245,0,0.28) 0%, rgba(128,55,244,0.18) 45%, transparent 70%);
           border-radius: 50%;
           z-index: -1;
           animation: pulse-halo 3.2s ease-in-out infinite;
        }
        @keyframes pulse-halo {
           0%, 100% { transform: scale(1); opacity: 0.55; }
           50% { transform: scale(1.15); opacity: 0.95; }
        }
        .profile-page .input-glass {
           background: #ffffff;
           border: 1px solid rgba(128, 55, 244, 0.2);
           border-radius: 14px;
           color: var(--pf-purple-deep);
           padding: 12px 16px;
           font-size: 0.875rem;
           font-weight: 500;
           letter-spacing: -0.01em;
           transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }
        .profile-page .input-glass:focus {
           background: #ffffff;
           border-color: rgba(122, 35, 229, 0.5);
           outline: none;
           box-shadow: 0 0 0 2px rgba(180, 245, 0, 0.25);
        }
        .profile-page .input-glass:disabled { opacity: 0.55; cursor: not-allowed; }
        .profile-page .input-glass::placeholder { color: rgba(45, 27, 105, 0.4); }
        .profile-page .profile-btn-purple {
          background: var(--pf-purple-dark);
          color: #ffffff;
          box-shadow: 0 10px 28px rgba(122, 35, 229, 0.28);
        }
        .profile-page .profile-btn-lime {
          background: var(--pf-lime);
          color: var(--pf-purple-deep);
          box-shadow: 0 10px 24px rgba(180, 245, 0, 0.28);
        }
        .profile-page .profile-btn-lime-outline {
          background: #ffffff;
          color: var(--pf-purple-deep);
          border: 2px solid var(--pf-lime);
          box-shadow: 0 8px 20px rgba(180, 245, 0, 0.14);
        }
        .profile-page .profile-toast-purple {
          background: var(--pf-purple);
          border-color: rgba(139, 77, 255, 0.45);
          color: #ffffff;
        }
        .profile-page .profile-toast-lime {
          background: var(--pf-lime);
          border-color: rgba(180, 245, 0, 0.5);
          color: var(--pf-purple-deep);
        }
        .profile-page .profile-glass-danger:hover {
          transform: none;
          border-color: rgba(128, 55, 244, 0.4);
          box-shadow: 0 16px 40px rgba(128, 55, 244, 0.15);
        }
        .profile-page .profile-mentor-apply-option {
          transition: opacity 0.2s ease;
        }
        .profile-page .profile-mentor-apply-option:hover {
          opacity: 0.88;
        }
        .profile-page .profile-mentor-apply-option:has([data-state="checked"]) span {
          color: var(--pf-purple-dark);
        }
        .profile-mentor-resubmit-overlay {
          animation: profile-mentor-overlay-in 0.22s ease-out;
        }
        .profile-mentor-resubmit-panel {
          animation: profile-mentor-panel-in 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes profile-mentor-overlay-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes profile-mentor-panel-in {
          from {
            opacity: 0;
            transform: scale(0.96) translateY(10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
      `}</style>
      <div className="profile-page relative z-10 mx-auto max-w-6xl px-6 pb-8 pt-8 sm:px-8 sm:pt-10">
        {mentorApplyError && !isMentor && (
          <div className="profile-banner-info mb-6 flex gap-3 rounded-2xl px-4 py-3 text-sm font-medium">
            <AlertTriangle size={18} className="profile-accent-purple mt-0.5 shrink-0" />
            <p>{mentorApplyError}</p>
          </div>
        )}

        {!isMentor &&
          mentorProfile?.adminReview?.status === "rejected" &&
          mentorProfile?.adminReview?.reason && (
            <div className="profile-banner-lime mb-6 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="profile-accent-purple mt-0.5 shrink-0" />
                <div>
                  <p className="profile-accent-purple text-xs font-black uppercase tracking-widest">
                    Hồ sơ mentor bị từ chối
                  </p>
                  <p className="profile-muted mt-2 text-sm leading-relaxed">
                    {mentorProfile.adminReview.reason}
                  </p>
                  <p className="profile-muted mt-2 text-[11px]">
                    Chỉnh sửa <strong>Hồ sơ cá nhân</strong> bên dưới, rồi bấm <strong>Đăng ký làm Mentor</strong> để gửi lại.
                  </p>
                </div>
              </div>
            </div>
          )}

        {/* Status messages */}
        {saveMsg === "avatar" && (
          <div className="profile-toast-purple fixed bottom-10 right-10 z-50 flex items-center gap-4 px-8 py-5 rounded-2xl shadow-2xl border font-black text-xs uppercase tracking-widest animate-in fade-in slide-in-from-bottom-5">
            <div className="rounded-full bg-[#93f72b] p-1 text-[#2D1B69]">
              <Check size={14} />
            </div>
            Đã cập nhật ảnh đại diện
          </div>
        )}
        {saveMsg === "saved" && (
          <div className="profile-toast-lime fixed bottom-10 right-10 z-50 flex items-center gap-3 px-8 py-4 rounded-2xl shadow-2xl border font-black text-xs uppercase tracking-widest animate-in fade-in slide-in-from-bottom-5">
            <Check size={18} /> Đã cập nhật thành công
          </div>
        )}
        {saveMsg === "mentor_applied" && (
          <div className="profile-toast-purple fixed bottom-10 right-10 z-50 flex max-w-md items-center gap-4 px-8 py-5 rounded-2xl shadow-2xl border font-black text-xs uppercase tracking-widest animate-in fade-in slide-in-from-bottom-5">
            <div className="rounded-full bg-[#93f72b] p-1 text-[#2D1B69]"><Check size={14} /></div>
            <div>
              <p>Hồ sơ đã được gửi!</p>
              <p className="mt-1 text-[9px] font-medium lowercase first-letter:uppercase text-white/85">Hệ thống sẽ phản hồi kết quả trong vòng 24-48 giờ làm việc.</p>
            </div>
          </div>
        )}
        {saveMsg === "mentor_resubmitted" && (
          <div className="profile-toast-lime fixed bottom-10 right-10 z-50 flex max-w-md items-center gap-4 px-8 py-5 rounded-2xl shadow-2xl border font-black text-xs uppercase tracking-widest animate-in fade-in slide-in-from-bottom-5">
            <div className="rounded-full bg-[#8037f4] p-1 text-white"><Check size={14} /></div>
            <div>
              <p>Đã gửi duyệt lại hồ sơ mentor!</p>
              <p className="mt-1 text-[9px] font-semibold lowercase first-letter:uppercase opacity-80">Admin sẽ xem xét lại hồ sơ của bạn trong thời gian sớm nhất.</p>
            </div>
          </div>
        )}

        {resubmitConfirmOpen && (
          <div
            className="profile-mentor-resubmit-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
            role="presentation"
            onClick={() => setResubmitConfirmOpen(false)}
          >
            <div className="absolute inset-0 bg-[#2D1B69]/45 backdrop-blur-[6px]" aria-hidden />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="mentor-resubmit-confirm-title"
              aria-describedby="mentor-resubmit-confirm-desc"
              className="profile-mentor-resubmit-panel relative w-full max-w-md overflow-hidden rounded-3xl border border-violet-200/80 bg-white shadow-[0_24px_64px_rgba(45,27,105,0.22)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b border-violet-100/90 bg-gradient-to-br from-[#faf7fe] to-white px-6 pb-5 pt-6 sm:px-7">
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-[#8037f4]">
                    <AlertTriangle size={22} strokeWidth={2.25} aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 pr-1">
                    <p
                      id="mentor-resubmit-confirm-title"
                      className="text-base font-extrabold leading-snug tracking-tight text-[#2D1B69] sm:text-lg"
                    >
                      {MENTOR_APPLY_RESUBMIT_CONFIRM_TITLE}
                    </p>
                    <p
                      id="mentor-resubmit-confirm-desc"
                      className="profile-muted mt-2 text-sm leading-relaxed"
                    >
                      {MENTOR_APPLY_RESUBMIT_CONFIRM_BODY}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setResubmitConfirmOpen(false)}
                    className="profile-muted shrink-0 rounded-xl p-2 transition-colors hover:bg-violet-50 hover:text-[#2D1B69]"
                    aria-label="Đóng"
                  >
                    <X size={18} strokeWidth={2.25} />
                  </button>
                </div>
              </div>
              <div className="flex flex-col-reverse gap-2.5 px-6 py-5 sm:flex-row sm:justify-end sm:gap-3 sm:px-7">
                <button
                  type="button"
                  onClick={() => setResubmitConfirmOpen(false)}
                  className="w-full rounded-2xl border border-violet-200 bg-white px-4 py-3 text-sm font-semibold text-[#5c4d7a] transition-colors hover:border-violet-300 hover:bg-violet-50/50 sm:w-auto sm:min-w-[7.5rem]"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  disabled={applying}
                  onClick={confirmResubmitMentor}
                  className="profile-btn-lime w-full rounded-2xl px-5 py-3 text-sm font-bold transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-55 sm:w-auto sm:min-w-[9rem]"
                >
                  {applying ? "Đang gửi…" : "Gửi lại hồ sơ"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-4 space-y-10">
            <div className="glass-card p-10 text-center">
               <div className="glow-halo relative mx-auto mb-8 w-fit">
                  <div className="w-32 h-32 rounded-[34px] bg-[#f8f5ff] border-[3px] border-[#8037f4] overflow-hidden flex items-center justify-center text-[2.3rem] font-black text-[#8037f4] shadow-[0_10px_24px_rgba(122,35,229,0.25)]">
                     {avatarUrl && !avatarBroken ? (
                       <img
                         src={resolveMediaUrl(avatarUrl)}
                         alt=""
                         className="h-full w-full object-cover"
                         onError={() => setAvatarBroken(true)}
                       />
                     ) : (
                       initials
                     )}
                  </div>
                  <button
                    type="button"
                    disabled={avatarUploading}
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-[#8037f4] text-white shadow-lg transition hover:scale-105 disabled:opacity-60"
                    title="Đổi ảnh đại diện"
                  >
                    <Camera size={18} />
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
               </div>
               
               <h2 className="mb-1 text-2xl font-black tracking-tight sm:text-3xl">{form.name || "Người dùng"}</h2>
               <p className="profile-muted mb-6 text-[10px] font-bold uppercase tracking-wide">{planInfo.name}</p>
               
            </div>

          </div>

          <div className="lg:col-span-8 space-y-10">
            <div id="profile-cv" className="glass-card scroll-mt-28 p-8 sm:p-10">
              <div className="profile-divider mb-8 border-b pb-6">
                <h2 className="font-headline flex items-center gap-3 text-xl font-black tracking-tight sm:text-2xl">
                  <User size={20} className="profile-accent-purple" strokeWidth={2} />
                  Hồ sơ <span className="profile-accent-purple">cá nhân</span>
                </h2>
                <ProfileCvMentorHint isMentor={isMentor} />
              </div>

              <div className="profile-cv-accordion-list">
                <ProfileCvStaticSection
                  title="Thông tin"
                  showDividerBelow
                >
                  <div className="grid gap-6 md:grid-cols-3">
                    {FORM_FIELDS.map(({ label, key, icon: Icon, mentorRequired }) => (
                      <div key={key} className="space-y-3">
                        <label className="profile-muted flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide">
                          <Icon size={12} /> {label}
                          {showMentorRequiredMarks && mentorRequired ? (
                            <span className="font-extrabold text-red-500" aria-hidden>
                              *
                            </span>
                          ) : null}
                        </label>
                        <input
                          className="input-glass w-full"
                          value={form[key]}
                          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                          placeholder={`Nhập ${label.toLowerCase()}...`}
                        />
                      </div>
                    ))}
                  </div>
                </ProfileCvStaticSection>

                <ProfileCvAccordionSection
                  title="Giới thiệu bản thân"
                  requiredMark={showMentorRequiredMarks}
                  isOpen={openCvSections.intro}
                  onToggle={() => toggleCvSection("intro")}
                >
                  <ProfileCvTextarea
                    placeholder={cvSectionCopy.intro.placeholder}
                    value={cvProfile.intro}
                    onChange={(e) => {
                      setMentorApplyError("");
                      setCvProfile({ ...cvProfile, intro: e.target.value });
                    }}
                    rows={5}
                  />
                </ProfileCvAccordionSection>

                <ProfileCvAccordionSection
                  title="Kinh nghiệm làm việc"
                  requiredMark={showMentorRequiredMarks}
                  isOpen={openCvSections.work}
                  onToggle={() => toggleCvSection("work")}
                >
                  <ProfileWorkHistoryEditor
                    entries={cvProfile.workHistory}
                    showMentorRequiredHint={showMentorRequiredMarks}
                    onChange={(workHistory) => {
                      setMentorApplyError("");
                      setCvProfile(syncCvFromWorkHistory({ ...cvProfile, workHistory }));
                    }}
                  />
                </ProfileCvAccordionSection>

                <ProfileCvAccordionSection
                  title="Kỹ năng & chứng chỉ"
                  requiredMark={showMentorRequiredMarks}
                  isOpen={openCvSections.skills}
                  onToggle={() => toggleCvSection("skills")}
                >
                  <ProfileCvTextarea
                    placeholder={cvSectionCopy.skills.placeholder}
                    value={cvProfile.skillsCerts}
                    onChange={(e) => {
                      setMentorApplyError("");
                      setCvProfile({ ...cvProfile, skillsCerts: e.target.value });
                    }}
                    rows={3}
                  />
                </ProfileCvAccordionSection>

                {!isMentor && (
                  <ProfileCvAccordionSection
                    title="Mức giá đăng ký"
                    requiredMark={showMentorRequiredMarks}
                    isOpen={openCvSections.mentorExtra}
                    onToggle={() => toggleCvSection("mentorExtra")}
                  >
                    <div className="relative max-w-md">
                      <input
                        type="text"
                        inputMode="numeric"
                        className="input-glass w-full pr-12"
                        placeholder="VD: 300.000 (VNĐ / 60 phút)"
                        value={
                          cvProfile.targetRate
                            ? Number(cvProfile.targetRate).toLocaleString("vi-VN")
                            : ""
                        }
                        onChange={(e) =>
                          setCvProfile({
                            ...cvProfile,
                            targetRate: e.target.value.replace(/\D/g, ""),
                          })
                        }
                      />
                      <span className="profile-muted pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold">
                        VND
                      </span>
                    </div>
                  </ProfileCvAccordionSection>
                )}

                <ProfileCvAccordionSection
                  title="Quá trình học tập"
                  isOpen={openCvSections.education}
                  onToggle={() => toggleCvSection("education")}
                >
                  <ProfileEducationHistoryEditor
                    entries={cvProfile.educationHistory}
                    onChange={(educationHistory) => {
                      setMentorApplyError("");
                      setCvProfile(syncCvFromEducationHistory({ ...cvProfile, educationHistory }));
                    }}
                  />
                </ProfileCvAccordionSection>

                <ProfileCvAccordionSection
                  title="Hoạt động ngoại khóa"
                  isOpen={openCvSections.extracurricular}
                  onToggle={() => toggleCvSection("extracurricular")}
                >
                  <ProfileCvTextarea
                    placeholder={cvSectionCopy.extracurricular.placeholder}
                    value={cvProfile.extracurricular}
                    onChange={(e) => {
                      setMentorApplyError("");
                      setCvProfile({ ...cvProfile, extracurricular: e.target.value });
                    }}
                    rows={3}
                  />
                </ProfileCvAccordionSection>

                <ProfileCvAccordionSection
                  title="Tên giải thưởng"
                  isOpen={openCvSections.awards}
                  onToggle={() => toggleCvSection("awards")}
                >
                  <ProfileCvTextarea
                    placeholder={cvSectionCopy.awards.placeholder}
                    value={cvProfile.awards}
                    onChange={(e) => {
                      setMentorApplyError("");
                      setCvProfile({ ...cvProfile, awards: e.target.value });
                    }}
                    rows={2}
                  />
                </ProfileCvAccordionSection>

                <div className="profile-divider flex flex-col gap-3 border-t pt-6 sm:flex-row">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleSaveProfile}
                    className="profile-btn-lime-outline flex w-full flex-1 items-center justify-center rounded-2xl py-4 text-sm font-bold transition-all hover:bg-[#fafef5] active:scale-[0.99] disabled:opacity-50"
                  >
                    {saving ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2D1B69]/25 border-t-[#2D1B69]" />
                    ) : (
                      "Lưu hồ sơ"
                    )}
                  </button>
                  {!isMentor && (
                    <button
                      type="button"
                      disabled={applying}
                      onClick={handleSidebarMentorRegister}
                      className="profile-btn-lime flex w-full flex-1 items-center justify-center rounded-2xl py-4 text-sm font-bold transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
                    >
                      {applying ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#2D1B69]/25 border-t-[#2D1B69]" />
                      ) : (
                        "Đăng ký làm Mentor"
                      )}
                    </button>
                  )}
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </MentorPageShell>
  );
}