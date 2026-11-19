import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  ShieldCheck,
  Award,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  TrendingUp,
  Brain,
  MessageSquare,
  Compass,
  FileCheck,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import {
  fetchVerifiedCompetencies,
  syncVerifiedCompetencies,
} from "../../api/candidateProfileApi.js";

function getScoreColor(score) {
  if (score >= 90) return "from-emerald-400 to-teal-400 text-emerald-300 border-emerald-500/30";
  if (score >= 80) return "from-violet-400 to-indigo-400 text-violet-300 border-violet-500/30";
  if (score >= 70) return "from-amber-400 to-orange-400 text-amber-300 border-amber-500/30";
  return "from-slate-400 to-slate-500 text-slate-300 border-slate-500/30";
}

function getScoreBar(score) {
  if (score >= 90) return "from-emerald-500 via-teal-500 to-emerald-400";
  if (score >= 80) return "from-violet-500 via-indigo-500 to-cyan-400";
  if (score >= 70) return "from-amber-500 via-orange-500 to-amber-400";
  return "from-slate-600 to-slate-400";
}

function getCompetencyIcon(id) {
  switch (id) {
    case "shrm_star_method":
      return Compass;
    case "shrm_clarity_comm":
      return MessageSquare;
    case "shrm_problem_solving":
      return Brain;
    case "shrm_credibility":
      return FileCheck;
    case "ddi_confidence_delivery":
      return TrendingUp;
    default:
      return Award;
  }
}

export function ProfileVerifiedCompetencies({ initialProfile = null }) {
  const [profile, setProfile] = useState(initialProfile);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [showCriteriaModal, setShowCriteriaModal] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetchVerifiedCompetencies();
        if (isMounted && res.success && res.profile) {
          setProfile(res.profile);
        }
      } catch (e) {
        console.error("Lỗi tải hồ sơ năng lực:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSync = async (sampleIfEmpty = true) => {
    try {
      setSyncing(true);
      const res = await syncVerifiedCompetencies(sampleIfEmpty);
      if (res.success && res.profile) {
        setProfile(res.profile);
        setToastMsg("Đã đồng bộ và cập nhật hồ sơ năng lực xác thực thành công!");
        setTimeout(() => setToastMsg(""), 3500);
      }
    } catch (e) {
      console.error("Lỗi đồng bộ năng lực:", e);
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyLink = () => {
    const url = window.location.href;
    navigator.clipboard?.writeText?.(url);
    setCopied(true);
    setToastMsg("Đã sao chép liên kết hồ sơ năng lực!");
    setTimeout(() => {
      setCopied(false);
      setToastMsg("");
    }, 2500);
  };

  const isVerified = Boolean(profile?.isCompetencyVerified);
  const readinessScore = profile?.verifiedReadinessScore || 0;
  const competencies = profile?.competencies || [];

  return (
    <div className="rounded-3xl border border-white/10 bg-[#120d2c]/85 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(5,3,20,0.45)] mb-8">
      {/* Toast Alert */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-300"
          >
            <CheckCircle2 size={16} />
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center shadow-[0_0_16px_rgba(16,185,129,0.3)]">
            <ShieldCheck size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                Hồ sơ năng lực đã xác thực (Verified Competencies)
              </h3>
              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
                Chuẩn SHRM & DDI
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Bộ tiêu chuẩn đánh giá năng lực phỏng vấn hành vi và phản xạ chuyên môn theo chuẩn nhân sự quốc tế.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
            title="Chia sẻ hồ sơ"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span className="hidden sm:inline">Sao chép liên kết</span>
          </button>

          <button
            type="button"
            disabled={syncing}
            onClick={() => handleSync(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            title="Cập nhật lại từ các buổi phỏng vấn"
          >
            <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
            {syncing ? "Đang đồng bộ..." : "Đồng bộ năng lực"}
          </button>
        </div>
      </div>

      {/* Main Readiness Index Hero Card */}
      {isVerified && readinessScore > 0 ? (
        <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/30 via-[#151238] to-[#0e0a26] p-5 sm:p-6 shadow-[0_4px_24px_rgba(16,185,129,0.08)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              {/* Radial Score Gauge */}
              <div className="relative size-20 sm:size-24 rounded-2xl bg-slate-950/80 border border-emerald-500/40 flex flex-col items-center justify-center shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <span className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-300 via-teal-200 to-cyan-400">
                  {readinessScore}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80 -mt-0.5">
                  / 100 Điểm
                </span>
                <div className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-emerald-400 border-2 border-slate-900" />
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                    Chỉ số sẵn sàng phỏng vấn (Readiness Index)
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    <CheckCircle2 size={11} /> Đã kiểm định
                  </span>
                </div>
                <h4 className="text-base sm:text-lg font-black text-white">
                  Đủ điều kiện phỏng vấn thực tế tại các doanh nghiệp
                </h4>
                <p className="text-xs text-slate-300/80 mt-1 max-w-xl leading-relaxed">
                  {profile?.verifiedProfileSummary ||
                    "Hồ sơ đã đạt tiêu chuẩn phỏng vấn cấu trúc STAR và phương pháp phản xạ năng lực hành vi quốc tế."}
                </p>
              </div>
            </div>

            {/* Verification Stamp Meta */}
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3.5 text-xs text-slate-300 space-y-1.5 shrink-0 min-w-[220px]">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Mã xác thực:</span>
                <span className="font-mono font-bold text-violet-300">
                  {competencies[0]?.verificationCode || "SHRM-DDI-VERIFIED"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Cơ chế xác thực:</span>
                <span className="font-semibold text-emerald-300">AI SHRM & Mentor 1:1</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Ngày cập nhật:</span>
                <span className="text-slate-300">
                  {profile?.lastVerifiedAt ? new Date(profile.lastVerifiedAt).toLocaleDateString("vi-VN") : "Hôm nay"}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-white/15 bg-white/[0.02] p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="size-10 rounded-xl bg-violet-600/20 border border-violet-400/30 text-violet-300 flex items-center justify-center shrink-0">
                <Sparkles size={20} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Chưa hoàn tất kiểm định năng lực phỏng vấn</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-xl leading-relaxed">
                  Hoàn thành 01 buổi phỏng vấn AI với camera hoặc đặt lịch tư vấn cùng Mentor để hệ thống tự động phân tích và cấp huy hiệu xác thực năng lực theo chuẩn SHRM & DDI.
                </p>
              </div>
            </div>

            <button
              type="button"
              disabled={syncing}
              onClick={() => handleSync(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-400/40 bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer shrink-0"
            >
              <ShieldCheck size={15} />
              Kích hoạt xác thực năng lực mẫu
            </button>
          </div>
        </div>
      )}

      {/* 5 Core Competencies Grid */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Chi tiết 5 trụ cột năng lực được chuẩn hóa
          </h4>
          <span className="text-[11px] text-slate-400">Khung chuẩn SHRM (Mỹ) & DDI Framework</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-1">
          {competencies.map((comp) => {
            const IconComp = getCompetencyIcon(comp.competencyId);
            const score = comp.score || 85;

            return (
              <div
                key={comp.competencyId || comp.name}
                className="rounded-2xl border border-white/10 bg-[#0e0a26]/70 p-4 hover:border-white/20 transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-xl bg-violet-500/20 border border-violet-400/30 text-violet-300 flex items-center justify-center shrink-0">
                      <IconComp size={16} />
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-white">{comp.name}</h5>
                      <span className="text-[11px] text-slate-400">{comp.category}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <span className="text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/25 px-2.5 py-0.5 rounded-full">
                      {comp.level}
                    </span>
                    <span className="text-sm font-black text-white tabular-nums">{score}%</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden p-0.5 border border-white/5 mb-2">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={`h-full rounded-full bg-gradient-to-r ${getScoreBar(score)} shadow-[0_0_10px_rgba(124,58,237,0.4)]`}
                  />
                </div>

                {/* Evidence & Verification Source */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-white/5 gap-1">
                  <p className="truncate max-w-xl text-slate-300/90">{comp.evidence}</p>
                  <span className="text-slate-400 font-medium shrink-0">
                    Xác thực bởi: <span className="text-violet-300">{comp.verifiedBy || "AI SHRM Engine"}</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

