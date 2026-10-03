import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
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
  Zap as Lightning,
  Medal,
  X,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  Sprout as Plant,
} from "lucide-react";
import {
  getPlans,
  getUser,
  updateUser,
  getInitials,
  getDisplayName,
  restoreSession,
  PLANS_CHANGED_EVENT,
} from "../../utils/auth/auth.js";
import { avatarSrc, DEFAULT_AVATAR, normalizeStoredUploadUrl, resolveMediaUrl } from "../../utils/shared/mediaUrl.js";
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
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import "../../../styles/settings.css";
import "../../../styles/commerce-theme.css";
import {
  emptyWorkEntry,
  estimateExperienceYears,
  formatWorkHistoryLines,
  parseWorkHistory,
  pickCurrentWorkEntry,
  serializeWorkHistory,
} from "../../utils/profile/profileWorkHistory.js";
import {
  formatEducationHistoryLines,
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
  const avatarInputRef = useRef(null);
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

  useEffect(() => {
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

  const isMentor = user?.role === "mentor";
  const displayName = getDisplayName(user) || form.name || "Thành viên";
  const userEmail = form.email || user?.email || "";
  const userAvatar = avatarSrc(user?.avatar || avatarUrl);
  const hasAvatar = userAvatar && userAvatar !== DEFAULT_AVATAR;
  const initials = getInitials(displayName || "U");
  const showMentorRequiredMarks = !isMentor;
  const cvSectionCopy = useMemo(() => getCvSectionCopy(isMentor), [isMentor]);
  const mentorReviewStatus = mentorProfile
    ? mentorProfile?.adminReview?.status || (mentorProfile?.isVerified ? "approved" : "pending")
    : "";

  // Dynamic Profile Completion Score
  const completionPercentage = useMemo(() => {
    let score = 0;
    if (form.name?.trim()) score += 15;
    if (form.email?.trim()) score += 15;
    if (form.phone?.trim()) score += 10;
    if (cvProfile.intro?.trim()) score += 15;
    if (cvProfile.workHistory?.length && cvProfile.workHistory.some((w) => w.role || w.company)) score += 20;
    if (cvProfile.educationHistory?.length && cvProfile.educationHistory.some((e) => e.school)) score += 15;
    if (cvProfile.skillsCerts?.trim()) score += 10;
    return Math.min(score, 100);
  }, [form, cvProfile]);

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

  const planInfo = useMemo(() => {
    if (plans.elitePro) return {
      name: "Thượng hạng (Elite)",
      nameIcon: Medal,
      desc: "Không giới hạn · Phân tích hành vi · Mentor 1:1",
      isPaid: true,
    };
    if (plans.starterPro) return {
      name: "Chuyên nghiệp (Pro)",
      nameIcon: Lightning,
      desc: "Phỏng vấn AI · Nhận diện giọng nói · 10 buổi/tháng",
      isPaid: true,
    };
    return {
      name: "Cơ bản (Free)",
      nameIcon: Plant,
      desc: "2 buổi AI miễn phí · 3 lần phân tích CV",
      isPaid: false,
    };
  }, [plans]);

  useEffect(() => {
    const refresh = () => setPlans(getPlans());
    window.addEventListener(PLANS_CHANGED_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener(PLANS_CHANGED_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const syncAvatarFromSession = useCallback(async () => {
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

  useEffect(() => {
    setAvatarBroken(false);
  }, [avatarUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await restoreSession().catch(() => {});
      if (!cancelled) syncAvatarFromSession();
    })();
    return () => {
      cancelled = true;
    };
  }, [syncAvatarFromSession]);

  const reloadProfileFromServer = useCallback(async (mentorOverride = null) => {
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
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    void reloadProfileFromServer();
  }, [user?.email, reloadProfileFromServer]);

  return (
    <div className="settings-page profile-page min-h-screen">
      <style>{`
        @keyframes avatarPulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.45;
          }
          50% {
            transform: scale(1.15);
            opacity: 0.85;
          }
        }
        .avatar-glow-effect {
          position: absolute;
          inset: -12px;
          border-radius: 40px;
          background: radial-gradient(circle, rgba(147, 51, 234, 0.45) 0%, rgba(124, 58, 237, 0.25) 50%, transparent 75%);
          z-index: 0;
          animation: avatarPulse 4.5s ease-in-out infinite;
          filter: blur(12px);
          pointer-events: none;
        }
        .interactive-card {
          transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease, box-shadow 0.3s ease;
        }
        .interactive-card:hover {
          border-color: rgba(167, 139, 250, 0.35);
          box-shadow: 0 16px 40px rgba(10, 8, 30, 0.4), 0 0 24px rgba(139, 92, 246, 0.12);
        }
        .profile-page textarea:focus,
        .profile-page textarea:focus-visible,
        .profile-page input:focus,
        .profile-page input:focus-visible {
          outline: none !important;
          outline-offset: 0 !important;
        }
      `}</style>

      <div className={`${CUSTOMER_SHELL_GUTTER} pb-24 pt-8 sm:pt-12 settings-container`}>
        <div className={`${CUSTOMER_SHELL_MAX} settings-frame space-y-8`}>

          {/* Header section with entrance animation */}
          <motion.header
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="settings-header"
          >
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                Hồ sơ cá nhân
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-violet-300 bg-violet-500/20 border border-violet-400/30 px-3 py-1 rounded-full">
                  <Sparkles size={12} className="animate-spin" style={{ animationDuration: '6s' }} />
                  {isMentor ? "Hồ sơ Mentor" : "Hồ sơ Học viên"}
                </span>
              </h1>
              <p className="text-slate-300/80 text-xs sm:text-sm mt-1.5 font-medium leading-relaxed">
                Quản lý thông tin cá nhân, mục tiêu nghề nghiệp và hồ sơ mentor của bạn.
              </p>
            </div>

            <Link
              to="/settings"
              className="group relative flex items-center gap-3 px-3.5 py-2 rounded-xl border border-white/15 bg-gradient-to-br from-[#1c183d]/80 via-[#14122e]/85 to-[#0e0c24]/90 backdrop-blur-xl shadow-[0_6px_24px_rgba(0,0,0,0.3)] hover:border-violet-400/50 hover:shadow-[0_10px_30px_rgba(124,58,237,0.22)] hover:-translate-y-0.5 transition-all duration-200 shrink-0 self-start sm:self-auto"
              aria-label="Cài đặt tài khoản"
              title={userEmail}
            >
              <div className="relative shrink-0">
                {hasAvatar ? (
                  <img
                    className="w-9 h-9 rounded-full object-cover ring-2 ring-violet-400/40 shadow-[0_0_10px_rgba(124,58,237,0.3)]"
                    src={userAvatar}
                    alt=""
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                ) : (
                  <span className="w-9 h-9 rounded-full grid place-items-center bg-gradient-to-br from-violet-600 to-indigo-700 text-white text-xs font-bold ring-2 ring-violet-400/40" aria-hidden="true">
                    {initials}
                  </span>
                )}
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-1.5 ring-[#0e0c24]" />
              </div>

              <div className="min-w-0 pr-0.5">
                <p className="text-xs sm:text-sm font-bold text-white group-hover:text-violet-200 transition-colors truncate max-w-[160px] sm:max-w-[200px]">
                  {displayName}
                </p>
                <p className="text-[10px] text-slate-300/80 flex items-center gap-1 mt-0.5">
                  <span className="font-semibold text-violet-300">{isMentor ? "Mentor" : "Học viên"}</span>
                  <span>•</span>
                  <span className="group-hover:text-violet-200 transition-colors">Cài đặt tài khoản</span>
                </p>
              </div>

              <div className="p-1 rounded-lg bg-white/5 border border-white/10 text-slate-300 group-hover:text-white group-hover:bg-violet-600/30 group-hover:border-violet-400/40 transition-all ml-0.5">
                <ArrowUpRight size={13} aria-hidden="true" />
              </div>
            </Link>
          </motion.header>

          {/* Validation & Status Banners with AnimatePresence */}
          <AnimatePresence>
            {mentorApplyError && !isMentor && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -10 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/15 p-4 text-sm font-semibold text-amber-300 shadow-lg"
              >
                <AlertTriangle size={18} className="shrink-0 text-amber-400" />
                <p>{mentorApplyError}</p>
              </motion.div>
            )}

            {!isMentor &&
              mentorProfile?.adminReview?.status === "rejected" &&
              mentorProfile?.adminReview?.reason && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-rose-500/30 bg-rose-500/15 p-5 text-rose-200 shadow-lg"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={18} className="mt-0.5 shrink-0 text-rose-400" />
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-rose-300">
                        Hồ sơ mentor bị từ chối
                      </p>
                      <p className="mt-1 text-sm leading-relaxed">{mentorProfile.adminReview.reason}</p>
                      <p className="mt-2 text-xs text-rose-300/80">
                        Chỉnh sửa <strong>Hồ sơ cá nhân</strong> bên dưới, rồi bấm <strong>Đăng ký làm Mentor</strong> để gửi lại.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
          </AnimatePresence>

          {/* Main Grid: Left Avatar/Plan Card + Right Profile CV Editor */}
          <div className="grid lg:grid-cols-12 gap-8" id="profile-main-grid">
            
            {/* Left Column: Avatar, Profile Progress, Plan, Badges */}
            <motion.aside
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-4 space-y-6"
            >
              {/* Profile Card */}
              <div className="settings-workspace interactive-card p-7 text-center flex flex-col items-center relative overflow-hidden">
                {/* Avatar Glow Ring Container */}
                <div className="relative mx-auto mb-5 w-fit">
                  <div className="avatar-glow-effect" />
                  <div className="relative z-10 w-32 h-32 rounded-[30px] bg-slate-900/90 border-2 border-violet-400/40 overflow-hidden flex items-center justify-center text-3xl font-black text-violet-200 shadow-[0_8px_32px_rgba(124,58,237,0.35)]">
                    {avatarUrl && !avatarBroken ? (
                      <img
                        src={resolveMediaUrl(avatarUrl)}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
                        onError={() => setAvatarBroken(true)}
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    type="button"
                    disabled={avatarUploading}
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 z-20 flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-900 bg-violet-600 text-white shadow-lg transition-colors hover:bg-violet-500 disabled:opacity-60 cursor-pointer"
                    title="Đổi ảnh đại diện"
                  >
                    {avatarUploading ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Camera size={18} />
                    )}
                  </motion.button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
                </div>

                <h2 className="mb-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
                  {form.name || "Người dùng"}
                </h2>
                <p className="text-xs font-bold text-violet-300/80 tracking-wide mb-4">
                  {userEmail}
                </p>

                {/* Status Badges */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-300">
                    <User size={12} />
                    {isMentor ? "Mentor" : "Học viên"}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
                    <planInfo.nameIcon size={12} />
                    {planInfo.name}
                  </span>
                </div>

                {/* Interactive Profile Completion Indicator */}
                <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left space-y-2.5 mb-5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-400" />
                      Mức độ hoàn thiện
                    </span>
                    <span className="font-black text-violet-300 tabular-nums">
                      {completionPercentage}%
                    </span>
                  </div>
                  {/* Animated Progress Bar */}
                  <div className="h-2 w-full rounded-full bg-slate-800/80 overflow-hidden p-0.5 border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${completionPercentage}%` }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-emerald-400 shadow-[0_0_12px_rgba(124,58,237,0.5)]"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {completionPercentage >= 100
                      ? "🎉 Hồ sơ đã hoàn thiện 100%!"
                      : "Điền thêm kinh nghiệm, học vấn và kỹ năng để tăng độ hoàn thiện."}
                  </p>
                </div>

                {/* Account Plan Details Card */}
                <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Gói tài khoản</span>
                    <span className="text-xs font-bold text-violet-300">{planInfo.name}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{planInfo.desc}</p>
                  {!planInfo.isPaid && (
                    <Link
                      to="/pricing"
                      className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:brightness-110 hover:shadow-violet-600/30"
                    >
                      <Sparkles size={14} />
                      Nâng cấp Pro / Elite
                    </Link>
                  )}
                </div>
              </div>
            </motion.aside>

            {/* Right Column: CV & Form Editor */}
            <motion.main
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-8 space-y-6"
            >
              <div id="profile-cv" className="settings-workspace interactive-card scroll-mt-28 p-8 sm:p-10">
                <div className="border-b border-white/10 mb-8 pb-6 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="flex items-center gap-3 text-xl font-black tracking-tight text-white sm:text-2xl">
                      <User size={22} className="text-violet-400" strokeWidth={2} />
                      Hồ sơ <span className="text-violet-300">cá nhân</span>
                    </h2>
                    <ProfileCvMentorHint isMentor={isMentor} />
                  </div>
                </div>

                <div className="profile-cv-accordion-list">
                  {/* Basic Contact Info Section */}
                  <ProfileCvStaticSection title="THÔNG TIN" showDividerBelow>
                    <div className="grid gap-6 md:grid-cols-3">
                      {FORM_FIELDS.map(({ label, key, icon: Icon, mentorRequired }) => (
                        <div key={key} className="space-y-2">
                          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                            <Icon size={13} className="text-violet-400" /> {label}
                            {showMentorRequiredMarks && mentorRequired ? (
                              <span className="font-extrabold text-rose-400" aria-hidden>
                                *
                              </span>
                            ) : null}
                          </label>
                          <input
                            className="w-full rounded-xl border border-white/15 bg-slate-900/50 px-4 py-3 text-sm font-medium text-slate-100 placeholder:text-slate-400 focus:border-[#c4ace8] focus:outline-none focus:ring-2 focus:ring-[#c4ace8]/30 transition-all hover:border-white/25"
                            value={form[key]}
                            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                            placeholder={`Nhập ${label.toLowerCase()}...`}
                          />
                        </div>
                      ))}
                    </div>
                  </ProfileCvStaticSection>

                  {/* Intro Section */}
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

                  {/* Work Experience Section */}
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

                  {/* Skills & Certifications Section */}
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

                  {/* Mentor Hourly Target Rate (for non-mentors registering) */}
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
                          className="w-full rounded-xl border border-white/15 bg-slate-900/50 px-4 py-3 pr-16 text-sm font-medium text-slate-100 placeholder:text-slate-400 focus:border-[#c4ace8] focus:outline-none focus:ring-2 focus:ring-[#c4ace8]/30 transition-all hover:border-white/25"
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
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          VND
                        </span>
                      </div>
                    </ProfileCvAccordionSection>
                  )}

                  {/* Education History Section */}
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

                  {/* Extracurricular Section */}
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

                  {/* Awards Section */}
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

                  {/* Submit Action Buttons with micro-animations */}
                  <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row gap-3">
                    <motion.button
                      whileHover={{ scale: 1.015 }}
                      whileTap={{ scale: 0.985 }}
                      type="button"
                      disabled={saving}
                      onClick={handleSaveProfile}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/20 px-6 py-3.5 text-sm font-bold text-violet-200 hover:bg-violet-500/30 disabled:opacity-50 transition-all cursor-pointer shadow-md"
                    >
                      {saving ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-violet-300 border-t-transparent" />
                      ) : (
                        <>
                          <Check size={16} />
                          Lưu hồ sơ
                        </>
                      )}
                    </motion.button>

                    {!isMentor && (
                      <motion.button
                        whileHover={{ scale: 1.015 }}
                        whileTap={{ scale: 0.985 }}
                        type="button"
                        disabled={applying}
                        onClick={handleSidebarMentorRegister}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {applying ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          <>
                            <Sparkles size={16} />
                            Đăng ký làm Mentor
                          </>
                        )}
                      </motion.button>
                    )}
                  </div>

                </div>
              </div>
            </motion.main>

          </div>

          {/* Toast notifications with AnimatePresence */}
          <AnimatePresence>
            {saveMsg === "avatar" && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-violet-500/40 bg-slate-900/95 px-6 py-4 font-bold text-xs uppercase tracking-widest text-white shadow-2xl backdrop-blur-md"
              >
                <div className="rounded-full bg-emerald-400 p-1 text-slate-950">
                  <Check size={14} />
                </div>
                Đã cập nhật ảnh đại diện
              </motion.div>
            )}

            {saveMsg === "saved" && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-slate-900/95 px-6 py-4 font-bold text-xs uppercase tracking-widest text-emerald-300 shadow-2xl backdrop-blur-md"
              >
                <Check size={18} /> Đã cập nhật thành công
              </motion.div>
            )}

            {saveMsg === "mentor_applied" && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="fixed bottom-6 right-6 z-50 flex max-w-md items-center gap-4 rounded-2xl border border-violet-500/40 bg-slate-900/95 px-6 py-4 font-bold text-xs uppercase tracking-widest text-white shadow-2xl backdrop-blur-md"
              >
                <div className="rounded-full bg-emerald-400 p-1 text-slate-950">
                  <Check size={14} />
                </div>
                <div>
                  <p>Hồ sơ đã được gửi!</p>
                  <p className="mt-1 text-[10px] font-medium lowercase first-letter:uppercase text-slate-300">
                    Hệ thống sẽ phản hồi kết quả trong vòng 24-48 giờ làm việc.
                  </p>
                </div>
              </motion.div>
            )}

            {saveMsg === "mentor_resubmitted" && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="fixed bottom-6 right-6 z-50 flex max-w-md items-center gap-4 rounded-2xl border border-emerald-500/40 bg-slate-900/95 px-6 py-4 font-bold text-xs uppercase tracking-widest text-emerald-300 shadow-2xl backdrop-blur-md"
              >
                <div className="rounded-full bg-violet-500 p-1 text-white">
                  <Check size={14} />
                </div>
                <div>
                  <p>Đã gửi duyệt lại hồ sơ mentor!</p>
                  <p className="mt-1 text-[10px] font-semibold lowercase first-letter:uppercase text-slate-300">
                    Admin sẽ xem xét lại hồ sơ của bạn trong thời gian sớm nhất.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mentor Resubmit Confirmation Modal */}
          {resubmitConfirmOpen && (
            <div
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6"
              role="presentation"
              onClick={() => setResubmitConfirmOpen(false)}
            >
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" aria-hidden />
              <motion.div
                initial={{ opacity: 0, scale: 0.94, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={{ duration: 0.25 }}
                role="dialog"
                aria-modal="true"
                aria-labelledby="mentor-resubmit-confirm-title"
                aria-describedby="mentor-resubmit-confirm-desc"
                className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/15 bg-slate-900 shadow-2xl text-white"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 px-6 pb-5 pt-6 sm:px-7">
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
                      <AlertTriangle size={22} strokeWidth={2.25} aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 pr-1">
                      <p
                        id="mentor-resubmit-confirm-title"
                        className="text-base font-extrabold leading-snug tracking-tight text-white sm:text-lg"
                      >
                        {MENTOR_APPLY_RESUBMIT_CONFIRM_TITLE}
                      </p>
                      <p
                        id="mentor-resubmit-confirm-desc"
                        className="mt-2 text-xs text-slate-300 leading-relaxed"
                      >
                        {MENTOR_APPLY_RESUBMIT_CONFIRM_BODY}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setResubmitConfirmOpen(false)}
                      className="shrink-0 rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
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
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-white/10 transition-colors sm:w-auto cursor-pointer"
                  >
                    Huỷ
                  </button>
                  <button
                    type="button"
                    disabled={applying}
                    onClick={confirmResubmitMentor}
                    className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-3 text-xs font-bold text-white shadow-lg hover:brightness-110 active:scale-[0.99] disabled:opacity-50 transition-all sm:w-auto cursor-pointer"
                  >
                    {applying ? "Đang gửi…" : "Gửi lại hồ sơ"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}