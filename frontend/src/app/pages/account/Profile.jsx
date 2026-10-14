import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import {
  User,
  Mail as EnvelopeSimple,
  Phone,
  Check,
  Star,
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
  Briefcase,
  GraduationCap,
  Award,
  Trophy,
  Users,
  FileText,
  DollarSign,
  ChevronRight,
  Settings,
  CircleDashed,
  ExternalLink,
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
  inferStartMonthFromExperienceYears,
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
        ? "Giới thiệu thế mạnh, lĩnh vực chuyên môn và định hướng hỗ trợ học viên..."
        : "Chia sẻ ngắn về bản thân, định hướng nghề nghiệp và mục tiêu phỏng vấn hiện tại...",
    },
    education: {
      placeholder:
        "Thêm trường học, bằng cấp, chuyên ngành và thời gian đào tạo...",
    },
    extracurricular: {
      placeholder: "Thêm hoạt động, câu lạc bộ, dự án cộng đồng hoặc hoạt động ngoại khóa từng tham gia...",
    },
    awards: {
      placeholder: "Thêm thành tích, chứng nhận, giải thưởng hoặc học bổng nổi bật...",
    },
    skills: {
      placeholder: "Ví dụ: React, Node.js, System Design, IELTS 7.5, AWS Certified Practitioner...",
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
    intro: true, // Open intro by default for quick editing
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

  const jumpToSection = (key) => {
    setOpenCvSections((prev) => ({ ...prev, [key]: true }));
    setTimeout(() => {
      const el = document.getElementById(`cv-section-${key}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
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
  const cvSectionCopy = useMemo(() => getCvSectionCopy(isMentor), [isMentor]);
  const mentorReviewStatus = mentorProfile
    ? mentorProfile?.adminReview?.status || (mentorProfile?.isVerified ? "approved" : "pending")
    : "";

  // Dynamic Profile Completion Score & Checkpoints
  const { completionPercentage, checklist } = useMemo(() => {
    let score = 0;
    const items = [];

    const hasName = Boolean(form.name?.trim());
    const hasEmail = Boolean(form.email?.trim());
    const hasPhone = Boolean(form.phone?.trim());
    const hasContact = hasName && hasEmail;
    if (hasName) score += 15;
    if (hasEmail) score += 15;
    if (hasPhone) score += 10;
    items.push({
      id: "contact",
      label: "Thông tin liên lạc",
      done: hasContact,
      action: () => document.getElementById("profile-contact-section")?.scrollIntoView({ behavior: "smooth" }),
    });

    const hasIntro = Boolean(cvProfile.intro?.trim());
    if (hasIntro) score += 15;
    items.push({
      id: "intro",
      label: "Giới thiệu bản thân",
      done: hasIntro,
      action: () => jumpToSection("intro"),
    });

    const hasWork = Boolean(cvProfile.workHistory?.length && cvProfile.workHistory.some((w) => w.role || w.company));
    if (hasWork) score += 20;
    items.push({
      id: "work",
      label: "Kinh nghiệm làm việc",
      done: hasWork,
      action: () => jumpToSection("work"),
    });

    const hasEdu = Boolean(cvProfile.educationHistory?.length && cvProfile.educationHistory.some((e) => e.school));
    if (hasEdu) score += 15;
    items.push({
      id: "education",
      label: "Quá trình học tập",
      done: hasEdu,
      action: () => jumpToSection("education"),
    });

    const hasSkills = Boolean(cvProfile.skillsCerts?.trim());
    if (hasSkills) score += 10;
    items.push({
      id: "skills",
      label: "Kỹ năng & chuyên môn",
      done: hasSkills,
      action: () => jumpToSection("skills"),
    });

    return {
      completionPercentage: Math.min(score, 100),
      checklist: items,
    };
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

  const planInfo = useMemo(() => {
    if (plans.elitePro) return {
      name: "Thượng hạng (Elite)",
      nameIcon: Medal,
      desc: "Không giới hạn phỏng vấn · Phân tích hành vi nâng cao · Mentor 1:1 chuyên sâu",
      isPaid: true,
    };
    if (plans.starterPro) return {
      name: "Chuyên nghiệp (Pro)",
      nameIcon: Lightning,
      desc: "Phỏng vấn AI không giới hạn · Nhận diện giọng nói chuẩn xác · 10 buổi/tháng",
      isPaid: true,
    };
    return {
      name: "Cơ bản (Free)",
      nameIcon: Plant,
      desc: "2 buổi AI trải nghiệm · 3 lần phân tích CV chuyên sâu theo chuẩn ngành",
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
      <div className={`${CUSTOMER_SHELL_GUTTER} pb-24 pt-10 sm:pt-14 md:pt-16 settings-container`}>
        <div className={`${CUSTOMER_SHELL_MAX} settings-frame space-y-8`}>

          {/* Top Page Header with Apple/Linear Tab Switcher */}
          <motion.header
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6"
          >
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white flex items-center gap-3">
                Hồ sơ cá nhân
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-400/30 px-3 py-1 rounded-full">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  {isMentor ? "Mentor" : "Học viên"}
                </span>
              </h1>
              <p className="text-slate-300/80 text-xs sm:text-sm mt-1.5 font-medium leading-relaxed max-w-2xl">
                Cập nhật thông tin học vấn, kinh nghiệm và kỹ năng để tối ưu hóa lộ trình luyện phỏng vấn AI và kết nối Mentor.
              </p>
            </div>

            {/* Account Suite Tab Switcher */}
            <div
              className="relative flex items-center p-1 sm:p-1.5 rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c183d]/85 via-[#14122e]/90 to-[#0e0c24]/95 shadow-[0_8px_32px_rgba(5,3,20,0.5),inset_0_1px_1px_rgba(255,255,255,0.12)] backdrop-blur-2xl shrink-0 self-start sm:self-auto"
              role="tablist"
              aria-label="Điều hướng tài khoản"
            >
              <span
                className="relative flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-gradient-to-b from-white/[0.18] via-white/[0.08] to-transparent border border-white/20 border-t-white/35 shadow-[0_4px_16px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md select-none"
              >
                <User size={15} className="text-violet-200" />
                <span>Hồ sơ cá nhân</span>
              </span>
              <Link
                to="/settings"
                className="relative flex items-center justify-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-all duration-200 select-none"
              >
                <Settings size={15} />
                <span>Cài đặt & Bảo mật</span>
              </Link>
            </div>
          </motion.header>

          {/* Validation & Status Banners */}
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
                        Vui lòng hoàn thiện hồ sơ bên dưới rồi bấm <strong>Đăng ký làm Mentor</strong> để ban quản trị xem xét lại.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}
          </AnimatePresence>

          {/* Main Grid: Left Avatar/Stats + Right Workspace */}
          <div className="grid lg:grid-cols-12 gap-8 items-start" id="profile-main-grid">

            {/* Left Column: Avatar Card + Strength Meter + Plan */}
            <motion.aside
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              className="lg:col-span-4 space-y-6 lg:sticky lg:top-24"
            >
              {/* Profile Card */}
              <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-[#18133d]/85 via-[#130f32]/90 to-[#0e0a24]/95 p-6 sm:p-7 text-center flex flex-col items-center relative overflow-hidden shadow-[0_20px_50px_rgba(5,3,20,0.5)] backdrop-blur-2xl">
                
                {/* Avatar with Glow and Upload Action */}
                <div className="relative mx-auto mb-4 w-fit">
                  <div className="relative size-28 sm:size-32 rounded-3xl p-1 bg-gradient-to-tr from-violet-600 via-indigo-500 to-fuchsia-500 shadow-[0_10px_35px_rgba(124,58,237,0.4)]">
                    <div className="size-full rounded-[22px] bg-slate-950 overflow-hidden flex items-center justify-center text-3xl font-black text-violet-200">
                      {avatarUrl && !avatarBroken ? (
                        <img
                          src={resolveMediaUrl(avatarUrl)}
                          alt=""
                          className="size-full object-cover transition-transform duration-500 hover:scale-105"
                          onError={() => setAvatarBroken(true)}
                        />
                      ) : (
                        initials
                      )}
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.94 }}
                    type="button"
                    disabled={avatarUploading}
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 z-10 flex size-9 items-center justify-center rounded-2xl border border-white/25 border-t-white/50 bg-gradient-to-b from-violet-500/80 via-violet-600/90 to-indigo-700 shadow-[0_4px_16px_rgba(124,58,237,0.5),inset_0_1px_1px_rgba(255,255,255,0.4)] backdrop-blur-md text-white hover:brightness-110 active:scale-95 disabled:opacity-60 cursor-pointer transition-all"
                    title="Đổi ảnh đại diện"
                  >
                    {avatarUploading ? (
                      <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <Camera size={16} />
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

                <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white mb-1">
                  {displayName}
                </h2>
                <p className="text-xs font-medium text-slate-300/80 tracking-wide mb-4 truncate max-w-[240px]">
                  {userEmail}
                </p>

                {/* Status Badges */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-300">
                    <User size={13} />
                    {isMentor ? "Mentor" : "Học viên"}
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
                    <planInfo.nameIcon size={13} />
                    {planInfo.name}
                  </span>
                </div>

                {/* Profile Strength Card with Checklist */}
                <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left space-y-3 mb-5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200 flex items-center gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-400" />
                      Mức độ hoàn thiện
                    </span>
                    <span className="font-black text-violet-300 text-sm tabular-nums">
                      {completionPercentage}%
                    </span>
                  </div>

                  {/* Gradient Progress Bar */}
                  <div className="h-2 w-full rounded-full bg-slate-900/90 overflow-hidden p-0.5 border border-white/5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${completionPercentage}%` }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 via-indigo-500 to-emerald-400 shadow-[0_0_12px_rgba(124,58,237,0.5)]"
                    />
                  </div>

                  {/* Interactive Checklist Pills */}
                  <div className="space-y-1.5 pt-1">
                    {checklist.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={item.action}
                        className="w-full flex items-center justify-between text-[11px] py-1 px-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer text-left"
                      >
                        <span className={`font-medium ${item.done ? "text-slate-300" : "text-slate-400"}`}>
                          {item.label}
                        </span>
                        {item.done ? (
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <Check size={11} strokeWidth={3} /> Đã có
                          </span>
                        ) : (
                          <span className="text-violet-400 font-semibold hover:underline">
                            + Thêm
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed border-t border-white/5 pt-2">
                    {completionPercentage >= 100
                      ? "🎉 Tuyệt vời! Hồ sơ đã đầy đủ 100% để tối ưu hóa phỏng vấn AI."
                      : "Điền thêm thông tin giúp AI cá nhân hóa câu hỏi phỏng vấn chuẩn xác nhất."}
                  </p>
                </div>

                {/* Account Plan Details Card */}
                <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Gói dịch vụ</span>
                    <span className="text-xs font-bold text-violet-300">{planInfo.name}</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{planInfo.desc}</p>
                  {!planInfo.isPaid && (
                    <Link
                      to="/pricing"
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-violet-400/40 border-t-white/45 bg-gradient-to-b from-violet-500/80 via-violet-600/70 to-indigo-700/80 px-4 py-2.5 text-xs font-bold text-white shadow-[0_4px_16px_rgba(124,58,237,0.45),inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-md hover:brightness-110 active:scale-[0.98] transition-all"
                    >
                      <Sparkles size={14} />
                      Nâng cấp Pro / Elite
                    </Link>
                  )}
                </div>

              </div>
            </motion.aside>

            {/* Right Column: CV & Form Workspace */}
            <motion.main
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="lg:col-span-8 space-y-6"
            >
              <div
                id="profile-cv"
                className="rounded-3xl border border-white/10 bg-[#120d2c]/85 backdrop-blur-2xl p-6 sm:p-9 shadow-[0_20px_50px_rgba(5,3,20,0.45)]"
              >
                {/* Workspace Header */}
                <div className="border-b border-white/10 pb-6 mb-7">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-2xl bg-violet-600/25 border border-violet-400/30 text-violet-300 flex items-center justify-center shadow-[0_0_16px_rgba(124,58,237,0.25)]">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                        Hồ sơ năng lực & CV
                      </h2>
                      <ProfileCvMentorHint isMentor={isMentor} />
                    </div>
                  </div>
                </div>

                {/* 1. Basic Contact Info */}
                <div id="profile-contact-section" className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <User size={15} className="text-violet-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Thông tin liên lạc cơ bản
                    </h3>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {/* Name */}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                        Họ và tên <span className="text-rose-400">*</span>
                      </label>
                      <input
                        className="w-full rounded-xl border border-white/12 bg-[#0b0820]/90 px-4 py-3 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25 transition-all"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Nhập họ và tên..."
                      />
                    </div>

                    {/* Phone */}
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                        Số điện thoại
                      </label>
                      <input
                        className="w-full rounded-xl border border-white/12 bg-[#0b0820]/90 px-4 py-3 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25 transition-all"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        placeholder="Nhập số điện thoại..."
                      />
                    </div>

                    {/* Email - Full width so long emails never get truncated */}
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                        Địa chỉ Email <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative">
                        <input
                          className="w-full rounded-xl border border-white/12 bg-[#0b0820]/90 px-4 py-3 pr-24 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25 transition-all"
                          value={form.email}
                          onChange={(e) => setForm({ ...form, email: e.target.value })}
                          placeholder="Nhập email..."
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                          Tài khoản chính
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Professional Background Accordions */}
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Briefcase size={15} className="text-violet-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                        Hồ sơ chuyên môn & kinh nghiệm
                      </h3>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Bấm vào từng mục để mở rộng và cập nhật
                    </span>
                  </div>

                  {/* Intro Section */}
                  <div id="cv-section-intro">
                    <ProfileCvAccordionSection
                      title="Giới thiệu bản thân"
                      icon={FileText}
                      isFilled={Boolean(cvProfile.intro?.trim())}
                      preview={cvProfile.intro?.trim()}
                      isOpen={openCvSections.intro}
                      onToggle={() => toggleCvSection("intro")}
                      description="Tóm tắt ngắn gọn thế mạnh, tính cách làm việc và định hướng nghề nghiệp giúp bạn nổi bật trong mắt nhà tuyển dụng hoặc mentor."
                    >
                      <ProfileCvTextarea
                        placeholder={cvSectionCopy.intro.placeholder}
                        value={cvProfile.intro}
                        onChange={(e) => {
                          setMentorApplyError("");
                          setCvProfile({ ...cvProfile, intro: e.target.value });
                        }}
                        rows={4}
                      />
                    </ProfileCvAccordionSection>
                  </div>

                  {/* Work Experience Section */}
                  <div id="cv-section-work">
                    <ProfileCvAccordionSection
                      title="Kinh nghiệm làm việc"
                      icon={Briefcase}
                      isFilled={Boolean(cvProfile.workHistory?.length && cvProfile.workHistory.some((w) => w.role || w.company))}
                      preview={
                        cvProfile.workHistory?.length
                          ? `${cvProfile.workHistory.filter((w) => w.role || w.company).length} vị trí đã ghi nhận`
                          : null
                      }
                      isOpen={openCvSections.work}
                      onToggle={() => toggleCvSection("work")}
                      description="Liệt kê các công việc thực tế, kỳ thực tập hoặc dự án thực chiến mà bạn đã tham gia."
                    >
                      <ProfileWorkHistoryEditor
                        entries={cvProfile.workHistory}
                        showMentorRequiredHint={false}
                        onChange={(workHistory) => {
                          setMentorApplyError("");
                          setCvProfile(syncCvFromWorkHistory({ ...cvProfile, workHistory }));
                        }}
                      />
                    </ProfileCvAccordionSection>
                  </div>

                  {/* Skills & Certifications Section */}
                  <div id="cv-section-skills">
                    <ProfileCvAccordionSection
                      title="Kỹ năng & chứng chỉ"
                      icon={Sparkles}
                      isFilled={Boolean(cvProfile.skillsCerts?.trim())}
                      preview={cvProfile.skillsCerts?.trim()}
                      isOpen={openCvSections.skills}
                      onToggle={() => toggleCvSection("skills")}
                      description="Các công nghệ, kỹ năng mềm, chứng chỉ quốc tế hoặc ngoại ngữ (phân cách bằng dấu phẩy)."
                    >
                      <ProfileCvTextarea
                        placeholder={cvSectionCopy.skills.placeholder}
                        value={cvProfile.skillsCerts}
                        onChange={(e) => {
                          setMentorApplyError("");
                          setCvProfile({ ...cvProfile, skillsCerts: e.target.value });
                        }}
                        rows={3}
                        hint="Gợi ý: Viết theo định dạng tên kỹ năng, phân tách bằng dấu phẩy (vd: React, Docker, IELTS 7.0)"
                      />
                    </ProfileCvAccordionSection>
                  </div>

                  {/* Education History Section */}
                  <div id="cv-section-education">
                    <ProfileCvAccordionSection
                      title="Quá trình học tập"
                      icon={GraduationCap}
                      isFilled={Boolean(cvProfile.educationHistory?.length && cvProfile.educationHistory.some((e) => e.school))}
                      preview={
                        cvProfile.educationHistory?.length
                          ? `${cvProfile.educationHistory.filter((e) => e.school).length} cơ sở đào tạo`
                          : null
                      }
                      isOpen={openCvSections.education}
                      onToggle={() => toggleCvSection("education")}
                      description="Trường đại học, cao đẳng, chứng chỉ chuyên sâu hoặc khóa học nghề mà bạn đã hoặc đang theo học."
                    >
                      <ProfileEducationHistoryEditor
                        entries={cvProfile.educationHistory}
                        onChange={(educationHistory) => {
                          setMentorApplyError("");
                          setCvProfile(syncCvFromEducationHistory({ ...cvProfile, educationHistory }));
                        }}
                      />
                    </ProfileCvAccordionSection>
                  </div>

                  {/* Extracurricular Section */}
                  <div id="cv-section-extracurricular">
                    <ProfileCvAccordionSection
                      title="Hoạt động ngoại khóa"
                      icon={Users}
                      badge="Tùy chọn"
                      isFilled={Boolean(cvProfile.extracurricular?.trim())}
                      preview={cvProfile.extracurricular?.trim()}
                      isOpen={openCvSections.extracurricular}
                      onToggle={() => toggleCvSection("extracurricular")}
                      description="Câu lạc bộ, hoạt động tình nguyện, dự án phi lợi nhuận hoặc sự kiện tổ chức bạn từng tham gia."
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
                  </div>

                  {/* Awards Section */}
                  <div id="cv-section-awards">
                    <ProfileCvAccordionSection
                      title="Giải thưởng & thành tích"
                      icon={Trophy}
                      badge="Tùy chọn"
                      isFilled={Boolean(cvProfile.awards?.trim())}
                      preview={cvProfile.awards?.trim()}
                      isOpen={openCvSections.awards}
                      onToggle={() => toggleCvSection("awards")}
                      description="Các cuộc thi học thuật, học bổng, sự ghi nhận hoặc giải thưởng nổi bật mà bạn đã đạt được."
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
                  </div>
                </div>

                {/* 3. Mentor Configuration or Application Section */}
                <div id="cv-section-mentorExtra" className="mb-8">
                  {isMentor ? (
                    /* For existing Mentors: Consulting Fee & Settings */
                    <ProfileCvAccordionSection
                      title="Cấu hình Cố vấn & Mức giá (Mentor Settings)"
                      icon={DollarSign}
                      badge="Mentor"
                      isFilled={Boolean(cvProfile.targetRate)}
                      preview={cvProfile.targetRate ? `${Number(cvProfile.targetRate).toLocaleString("vi-VN")} VNĐ / 60 phút` : "Chưa đặt giá"}
                      isOpen={openCvSections.mentorExtra}
                      onToggle={() => toggleCvSection("mentorExtra")}
                      description="Thiết lập mức giá tư vấn 1:1 cho mỗi buổi kéo dài 60 phút và thông tin liên kết mạng xã hội."
                    >
                      <div className="space-y-4">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                            Mức giá tư vấn (VNĐ / 60 phút)
                          </label>
                          <div className="relative max-w-sm">
                            <input
                              type="text"
                              inputMode="numeric"
                              className="w-full rounded-xl border border-white/12 bg-[#0b0820]/90 px-4 py-3 pr-16 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25 transition-all"
                              placeholder="VD: 300.000"
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
                            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-violet-300">
                              VNĐ
                            </span>
                          </div>
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                          <div>
                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                              LinkedIn Profile
                            </label>
                            <input
                              className="w-full rounded-xl border border-white/12 bg-[#0b0820]/90 px-4 py-3 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25 transition-all"
                              placeholder="https://linkedin.com/in/..."
                              value={cvProfile.linkedinProfile}
                              onChange={(e) => setCvProfile({ ...cvProfile, linkedinProfile: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                              Portfolio / Website cá nhân
                            </label>
                            <input
                              className="w-full rounded-xl border border-white/12 bg-[#0b0820]/90 px-4 py-3 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25 transition-all"
                              placeholder="https://yourportfolio.dev"
                              value={cvProfile.portfolioLink}
                              onChange={(e) => setCvProfile({ ...cvProfile, portfolioLink: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                    </ProfileCvAccordionSection>
                  ) : (
                    /* For Students: Become a Mentor Spotlight Card */
                    <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-900/20 via-[#16103c]/60 to-[#0e0a26]/80 p-5 sm:p-6 shadow-lg">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div className="flex items-start gap-3.5">
                          <div className="size-10 rounded-xl bg-violet-600/30 border border-violet-400/40 text-violet-200 flex items-center justify-center shrink-0">
                            <Sparkles size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-base font-bold text-white">
                                Trở thành Mentor tại ProInterview
                              </h4>
                              <span className="text-[10px] font-bold text-violet-300 bg-violet-500/20 px-2 py-0.5 rounded-full border border-violet-400/30">
                                Thu nhập & Uy tín
                              </span>
                            </div>
                            <p className="text-xs text-slate-300/80 mt-1 leading-relaxed">
                              Chia sẻ kinh nghiệm phỏng vấn thực tế, hướng dẫn học viên và gia tăng thu nhập của bạn qua các buổi tư vấn 1:1.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleCvSection("mentorExtra")}
                          className="text-xs font-bold text-white bg-gradient-to-b from-white/[0.18] via-white/[0.08] to-transparent border border-white/20 border-t-white/35 shadow-[0_4px_16px_rgba(0,0,0,0.45),0_1px_2px_rgba(0,0,0,0.3),inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-md px-4 py-2 rounded-xl hover:brightness-110 active:scale-95 transition-all self-start sm:self-auto shrink-0 cursor-pointer"
                        >
                          {openCvSections.mentorExtra ? "Thu gọn đăng ký" : "Thiết lập mức giá"}
                        </button>
                      </div>

                      <AnimatePresence>
                        {openCvSections.mentorExtra && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden border-t border-white/10 pt-4 mt-3 space-y-4"
                          >
                            <div>
                              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                                Mức giá đề xuất nhận học viên (VNĐ / 60 phút) <span className="text-rose-400">*</span>
                              </label>
                              <div className="relative max-w-sm">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-4 py-3 pr-16 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25 transition-all"
                                  placeholder="VD: 300.000"
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
                                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-violet-300">
                                  VNĐ
                                </span>
                              </div>
                              <p className="mt-1.5 text-[11px] text-slate-400">
                                Bạn có thể điều chỉnh mức thù lao bất cứ lúc nào sau khi hồ sơ được ban quản trị xét duyệt.
                              </p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                {/* 4. Action Buttons */}
                <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.985 }}
                    type="button"
                    disabled={saving}
                    onClick={handleSaveProfile}
                    className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 border-t-white/45 bg-gradient-to-b from-white/[0.22] via-white/[0.10] to-transparent shadow-[0_6px_24px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-xl hover:bg-white/[0.25] text-white px-6 py-3.5 text-sm font-bold disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {saving ? (
                      <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <>
                        <Check size={16} strokeWidth={2.5} />
                        Lưu thay đổi hồ sơ
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
                      className="w-full sm:flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/40 border-t-white/50 bg-gradient-to-b from-violet-500/85 via-violet-600/75 to-indigo-700/85 shadow-[0_6px_24px_rgba(124,58,237,0.5),inset_0_1px_1px_rgba(255,255,255,0.35)] backdrop-blur-xl px-6 py-3.5 text-sm font-bold text-white hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all cursor-pointer"
                    >
                      {applying ? (
                        <div className="size-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
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
                <Check size={18} /> Đã cập nhật thành công hồ sơ
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
                  <p>Hồ sơ mentor đã được gửi!</p>
                  <p className="mt-1 text-[10px] font-medium lowercase first-letter:uppercase text-slate-300">
                    Ban quản trị sẽ xem xét và phản hồi kết quả trong vòng 24-48 giờ làm việc.
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
                    Ban quản trị sẽ xem xét lại hồ sơ cập nhật của bạn trong thời gian sớm nhất.
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
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
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