import { useEffect, useState } from "react";
import { MentorListExpandButton } from "../../components/mentor/MentorListExpandButton.jsx";
import { useMentorListExpand } from "../../hooks/useMentorListExpand.js";
import { MentorScrollFadeRow } from "../../components/mentor/MentorScrollFadeRow.jsx";
import { useParams, useNavigate } from "react-router";
import {
   BookOpen,
   Users,
   MessageCircle as ChatCircle,
   BarChart as ChartBar,
   Pencil as PencilSimple,
   Trash2 as Trash,
   Plus,
   Layout,
   Eye,
   PlayCircle,
   Clock,
   CheckCircle,
   AlertTriangle as Warning,
   Upload,
   Video,
   GraduationCap,
   Star,
   TrendingUp as TrendUp,
   ArrowUp,
   ArrowDown,
   BadgeCheck as SealCheck,
   Zap as Lightning,
   ToggleLeft,
   ToggleRight,
   X,
   Check,
   Video as FileVideo,
   User,
   Calendar as CalendarBlank,
   PieChart as ChartPie,
   LineChart as ChartLineIcon,
   CircleDollarSign as CurrencyCircleDollar,
   ChevronRight as CaretRight,
   Search as MagnifyingGlass,
   Filter as Funnel,
   Share as Export,
   Medal,
   AlertCircle as WarningCircle,
   Sparkles,
   ThumbsUp,
   Target,
   ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import {
   fetchCourseById,
   createCourseDraft,
   publishCourse,
   updateCourseDraft,
   archiveCourse,
   fetchCourseMentorStudents,
   fetchCourseMentorQA,
   answerCourseMentorQA,
   fetchCourseMentorReviews,
   fetchCourseMentorAnalytics,
} from "../../api/courseApi.js";
import { ArchiveCourseDialog } from "../../components/courses/ArchiveCourseDialog";
import { mapCourseAdminModerationNote } from "../../utils/admin/courseAdminReview.js";
import { uploadFile, uploadVideoDirectly, shouldUseDirectUpload } from "../../api/uploadApi.js";
import { MentorPageShell } from "../../components/mentor/MentorPageShell";
import { CourseCreateStepper } from "../../components/mentor/course-create/CourseCreateStepper";
import { CourseCreateStep1, CourseCreateFooter } from "../../components/mentor/course-create/CourseCreateStep1";
import { CourseCreateStep2 } from "../../components/mentor/course-create/CourseCreateStep2";
import {
  mentorGhostBtnClass,
  mentorSectionCardClass,
  mentorCreateScopeClass,
  mentorCreateShellClass,
  mentorValidationKeyframes,
} from "../../components/mentor/course-create/mentorCourseCreateTheme";
import { toast } from "sonner";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";
import { mediaSrc, DEFAULT_COURSE_THUMB, avatarSrc, normalizeStoredUploadUrl } from "../../utils/shared/mediaUrl.js";
import { getVideoDurationMinutes } from "../../utils/shared/videoDuration.js";

const COURSE_STATUS_META = {
   published: { label: "Đã xuất bản", className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
   pending_review: { label: "Chờ duyệt mới", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
   pending_update: { label: "Chờ duyệt cập nhật", className: "border-sky-500/30 bg-sky-500/10 text-sky-300" },
   draft: { label: "Bản nháp", className: "border-white/20 bg-white/5 text-slate-300" },
   archived: { label: "Đã lưu trữ", className: "border-rose-500/30 bg-rose-500/10 text-rose-400" },
};

const MENTOR_COURSE_EDIT_EXTRA_CSS = `
        .mentor-course-edit .app-page-subtitle {
          font-weight: 500;
          color: #a994bd;
        }
`;

/* ── Helpers ─────────────────────────────────────────────────── */
const formatDuration = (minutes) => {
   const h = Math.floor(minutes / 60);
   const m = minutes % 60;
   return h > 0 ? `${h}h ${m > 0 ? m + "m" : ""}`.trim() : `${m}m`;
};
const formatPrice = (price) => formatVnd(price);

function TabPanelState({ loading, error, empty, emptyMessage, children }) {
   if (loading) {
      return (
         <div className="flex min-h-[220px] items-center justify-center rounded-2xl border border-white/10 bg-[#160f26]/80 p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#93f72b] border-t-transparent" />
         </div>
      );
   }
   if (error) {
      return (
         <div className="rounded-2xl border border-rose-500/30 bg-rose-950/40 p-8 text-center text-sm font-medium text-rose-300">
            {error}
         </div>
      );
   }
   if (empty) {
      return (
         <div className="rounded-2xl border border-white/10 bg-[#160f26]/60 p-12 text-center text-sm text-slate-400">
            {emptyMessage || "Chưa có dữ liệu."}
         </div>
      );
   }
   return children;
}

/* ── UI Components ─────────────────────────────────────────── */

function MiniBar({ value, max = 100, color }) {
   return (
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden flex-1">
         <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(100, Math.max(0, (value / max) * 100))}%` }}
            className="h-full rounded-full"
            style={{ background: color || "#93f72b", boxShadow: `0 0 10px ${color || "#93f72b"}60` }}
         />
      </div>
   );
}

/* ── Tabs Content ──────────────────────────────────────────── */

function ReviewsTab({ reviews, summary }) {
   const stats = [
      { label: "Rating trung bình", value: summary?.avgRating ?? "0.0" },
      { label: "Tổng đánh giá", value: summary?.total ?? reviews.length },
      { label: "Chờ phản hồi", value: summary?.pendingReply ?? 0 },
      { label: "Đã xác minh", value: reviews.filter((r) => r.verified).length },
   ];
   return (
      <motion.div className="space-y-6">
         <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            {stats.map((s, i) => (
               <div key={i} className="rounded-2xl border border-white/10 bg-[#160f26]/80 backdrop-blur-xl p-5 shadow-lg">
                  <h3 className="text-2xl font-black text-white">{s.value}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
               </div>
            ))}
         </div>
         <div className="space-y-4">
            {reviews.map((review) => (
               <div key={review.id} className="rounded-2xl border border-white/10 bg-[#160f26]/80 backdrop-blur-xl p-6 sm:p-7 shadow-lg">
                  <div className="mb-4 flex items-start gap-4">
                     <img src={avatarSrc(review.avatar)} alt="" className="h-11 w-11 rounded-xl object-cover border border-white/15" />
                     <div>
                        <h5 className="text-base font-bold text-white">{review.name}</h5>
                        <p className="mt-0.5 text-xs text-slate-400">
                           {review.role ? `${review.role} · ` : ""}
                           {review.date}
                           {" · "}
                           <span className="text-[#93f72b]">
                              {"★".repeat(review.rating)}
                              {"☆".repeat(Math.max(0, 5 - review.rating))}
                           </span>
                        </p>
                     </div>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200 italic">"{review.comment}"</p>
                  {review.response ? (
                     <div className="mt-4 rounded-xl border border-[#93f72b]/20 bg-[#93f72b]/5 p-4 text-sm text-slate-200">
                        <span className="font-semibold text-[#93f72b]">Phản hồi của bạn: </span>
                        {review.response}
                     </div>
                  ) : null}
               </div>
            ))}
         </div>
      </motion.div>
   );
}

function LessonsTab({ lessons, onLessonsChange }) {
   const [editList, setEditList] = useState([]);
   const [editingId, setEditingId] = useState(null);
   const [draftTitle, setDraftTitle] = useState("");

   useEffect(() => {
      setEditList(
         (lessons || []).map((lesson) => ({
            ...lesson,
            duration: Number(lesson.duration || 10),
            isPreview: Boolean(lesson.isPreview),
            videoFileName: lesson.videoFileName || "",
         })),
      );
   }, [lessons]);

   const commit = (updater) => {
      const next = typeof updater === "function" ? updater(editList) : updater;
      setEditList(next);
      onLessonsChange?.(next);
   };

   const handleAddLesson = () => {
      const nextIndex = editList.length + 1;
      const newLesson = {
         id: `new-${Date.now()}-${nextIndex}`,
         title: `Bài ${nextIndex}: Nội dung mới`,
         duration: 0,
         isPreview: false,
         videoFileName: "",
      };
      // Thêm lên đầu danh sách để người dùng thấy ngay lập tức.
      commit((prev) => [newLesson, ...prev]);
      setEditingId(newLesson.id);
      setDraftTitle(newLesson.title);
   };

   const startEdit = (lesson) => {
      setEditingId(lesson.id);
      setDraftTitle(lesson.title || "");
   };

   const saveEdit = (lessonId) => {
      const t = draftTitle.trim();
      if (!t) return;
      commit((prev) => prev.map((lesson) => (lesson.id === lessonId ? { ...lesson, title: t } : lesson)));
      setEditingId(null);
      setDraftTitle("");
   };

   const removeLessonItem = (lessonId) => {
      commit((prev) => prev.filter((lesson) => lesson.id !== lessonId));
      if (editingId === lessonId) {
         setEditingId(null);
         setDraftTitle("");
      }
   };

   const toggleLessonPreview = (lessonId) => {
      commit((prev) =>
         prev.map((lesson) => (lesson.id === lessonId ? { ...lesson, isPreview: !lesson.isPreview } : lesson)),
      );
   };

   const setLessonVideo = async (lessonId, file) => {
      if (!file) return;
      const loadingToast = toast.loading(`Đang tải video lên: ${file.name}...`);
      try {
         const durationMinutes = await getVideoDurationMinutes(file);
         const res = shouldUseDirectUpload(file)
            ? await uploadVideoDirectly(file, (pct) =>
                 toast.loading(`Đang tải video: ${pct}%`, { id: loadingToast }),
              )
            : await uploadFile(file, "course-video");
         if (res.success) {
            toastApiSuccess(
               durationMinutes > 0
                  ? `Upload video thành công · ${durationMinutes} phút`
                  : "Upload video thành công!",
            );
            commit((prev) =>
               prev.map((lesson) =>
                  lesson.id === lessonId
                     ? {
                          ...lesson,
                          videoFileName: file.name,
                          videoUrl: res.url,
                          duration: durationMinutes > 0 ? durationMinutes : lesson.duration,
                       }
                     : lesson,
               ),
            );
         } else {
            toastApiError(res.error, "Upload video thất bại.");
         }
      } catch {
         toastApiError("Lỗi kết nối khi upload video.");
      } finally {
         toast.dismiss(loadingToast);
      }
   };

   return (
      <div className="rounded-2xl border border-white/10 bg-[#160f26]/85 backdrop-blur-xl overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.4)]">
         <div className="flex flex-col gap-4 border-b border-white/10 bg-white/[0.02] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
            <div>
               <h3 className="text-base font-bold text-white tracking-tight">Danh sách bài giảng & Video</h3>
               <p className="mt-1 text-xs font-semibold text-slate-400">Tổng cộng {editList.length} bài học</p>
            </div>
            <button
               type="button"
               onClick={handleAddLesson}
               className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#93f72b] px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_16px_rgba(147,247,43,0.3)] transition hover:bg-[#a8ff4e]"
            >
               <Plus size={16} /> Thêm bài học mới
            </button>
         </div>
         <ul className="divide-y divide-white/5">
            {editList.map((lesson, idx) => (
               <li key={lesson.id} className="overflow-hidden px-4 py-4 transition-colors hover:bg-white/[0.02] sm:px-6 sm:py-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                     <div className="flex min-w-0 items-start gap-3 sm:gap-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-bold text-[#93f72b]">
                        {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1 space-y-2.5">
                           {editingId === lesson.id ? (
                              <input
                                 value={draftTitle}
                                 onChange={(e) => setDraftTitle(e.target.value)}
                                 className="w-full bg-[#10091e] border border-white/20 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-[#93f72b]"
                              />
                           ) : (
                              <h4 className="break-words text-sm font-bold text-white">{lesson.title}</h4>
                           )}
                           <div className="flex flex-wrap items-center gap-2.5">
                              <span className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
                                 {lesson.videoFileName && lesson.duration > 0
                                    ? `${lesson.duration} phút (từ video)`
                                    : "Thời lượng: upload video để tự lấy"}
                              </span>
                              <button
                                 type="button"
                                 onClick={() => toggleLessonPreview(lesson.id)}
                                 className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                                    lesson.isPreview
                                       ? "border border-[#93f72b]/40 bg-[#93f72b]/15 text-[#93f72b]"
                                       : "border border-white/10 bg-white/5 text-slate-400"
                                 }`}
                              >
                                 {lesson.isPreview ? "Xem thử miễn phí" : "Khóa học viên"}
                              </button>
                              <label className="cursor-pointer rounded-lg border border-[#93f72b]/40 bg-[#93f72b]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#93f72b] transition hover:bg-[#93f72b]/20">
                                 {lesson.videoFileName ? "Đổi video khác" : "Tải video bài giảng lên"}
                                 <input
                                    type="file"
                                    accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
                                    className="hidden"
                                    onChange={(e) => {
                                       const file = e.target.files?.[0];
                                       if (file) setLessonVideo(lesson.id, file);
                                    }}
                                 />
                              </label>
                              <span className="min-w-0 max-w-full truncate text-xs text-slate-400 font-medium">
                                 {lesson.videoFileName || "Chưa tải video"}
                              </span>
                           </div>
                        </div>
                     </div>
                     <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/5 pt-3 sm:border-0 sm:pt-0 sm:gap-2">
                        {editingId === lesson.id ? (
                           <>
                              <button
                                 type="button"
                                 onClick={() => saveEdit(lesson.id)}
                                 className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-400 transition hover:bg-emerald-500/20"
                                 title="Lưu tên bài"
                              >
                                 <Check size={16} />
                              </button>
                              <button
                                 type="button"
                                 onClick={() => {
                                    setEditingId(null);
                                    setDraftTitle("");
                                 }}
                                 className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:text-white"
                                 title="Hủy"
                              >
                                 <X size={16} />
                              </button>
                           </>
                        ) : (
                        <button
                           type="button"
                           onClick={() => startEdit(lesson)}
                           className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-white/20 hover:text-white"
                           title="Sửa tên bài"
                        >
                           <PencilSimple size={16} />
                        </button>
                        )}
                        <button
                           type="button"
                           onClick={() => removeLessonItem(lesson.id)}
                           className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400"
                           title="Xóa bài học"
                        >
                           <Trash size={16} />
                        </button>
                     </div>
                  </div>
               </li>
            ))}
         </ul>
      </div>
   );
}

function StudentsTab({ students, summary }) {
   const { visibleItems: visibleStudents, showExpandButton, expanded, toggleExpanded } =
      useMentorListExpand(students, String(students.length));
   const statCards = [
      { label: "Đang hoạt động", value: summary?.active ?? students.filter((s) => s.status === "active").length },
      { label: "Đã hoàn thành", value: summary?.completed ?? students.filter((s) => s.status === "completed").length },
      { label: "Tiến độ trung bình", value: summary?.avgProgress ?? "0%" },
      { label: "Tỷ lệ Drop-off", value: summary?.dropoffRate ?? "0%" },
   ];
   return (
      <div className="space-y-6">
         <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            {statCards.map((s, i) => (
               <div key={i} className="rounded-2xl border border-white/10 bg-[#160f26]/80 backdrop-blur-xl p-5 shadow-lg">
                  <h3 className="text-2xl font-black text-white">{s.value}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{s.label}</p>
               </div>
            ))}
         </div>
         <div className="rounded-2xl border border-white/10 bg-[#160f26]/85 backdrop-blur-xl overflow-hidden shadow-lg">
            <div className="space-y-3 p-4 lg:hidden">
               {visibleStudents.map((s) => (
                  <div
                     key={s.id}
                     className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                  >
                     <div className="flex items-center gap-3">
                        <img src={avatarSrc(s.avatar)} alt="" className="h-11 w-11 rounded-xl object-cover border border-white/10" />
                        <div className="min-w-0 flex-1">
                           <p className="truncate text-sm font-bold text-white">{s.name}</p>
                           {!s.hasAccess ? (
                              <p className="text-xs text-amber-400">Chờ thanh toán</p>
                           ) : (
                              <p className="text-xs text-slate-400">Lần cuối: {s.lastActive}</p>
                           )}
                        </div>
                     </div>
                     <div className="mt-3 flex items-center gap-3 border-t border-white/5 pt-3">
                        <MiniBar value={s.progress} color={s.progress === 100 ? "#93f72b" : "#a78bfa"} />
                        <span className="text-xs font-bold text-white">{s.progress}%</span>
                     </div>
                  </div>
               ))}
               {!students.length && (
                  <p className="py-8 text-center text-sm text-slate-400">Chưa có học viên nào tham gia khóa này.</p>
               )}
            </div>
            <div className="hidden lg:block">
            <table className="w-full text-left">
               <thead>
                  <tr className="border-b border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white/[0.02]">
                     <th className="px-6 py-4">Học viên</th>
                     <th className="px-6 py-4">Tiến độ bài giảng</th>
                     <th className="px-6 py-4 text-right">Hoạt động gần nhất</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  {visibleStudents.map((s) => (
                     <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                              <img src={avatarSrc(s.avatar)} alt="" className="h-10 w-10 rounded-xl object-cover border border-white/10" />
                              <div>
                                 <span className="text-sm font-bold text-white">{s.name}</span>
                                 {!s.hasAccess ? (
                                    <p className="text-[10px] font-semibold text-amber-400">Chờ thanh toán</p>
                                 ) : null}
                              </div>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex w-44 items-center gap-3">
                              <MiniBar value={s.progress} color={s.progress === 100 ? "#93f72b" : "#a78bfa"} />
                              <span className="text-xs font-bold text-white">{s.progress}%</span>
                           </div>
                        </td>
                        <td className="px-6 py-4 text-right text-xs font-medium text-slate-400">{s.lastActive}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
            </div>
            {showExpandButton ? (
               <MentorListExpandButton expanded={expanded} onToggle={toggleExpanded} />
            ) : null}
         </div>
      </div>
   );
}

function QATab({ courseId, items, onAnswered }) {
   const [drafts, setDrafts] = useState({});
   const [sending, setSending] = useState(null);

   const handleSend = async (qaId) => {
      const content = String(drafts[qaId] || "").trim();
      if (!content) return;
      setSending(qaId);
      try {
         const res = await answerCourseMentorQA(courseId, qaId, content);
         if (!res.success) {
            toastApiError(res.error, "Không gửi được câu trả lời.");
            return;
         }
         toastApiSuccess(res.message || "Đã gửi câu trả lời.");
         setDrafts((prev) => ({ ...prev, [qaId]: "" }));
         onAnswered?.();
      } catch {
         toastApiError("Lỗi kết nối khi gửi câu trả lời.");
      } finally {
         setSending(null);
      }
   };

   return (
      <div className="space-y-4">
         {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-[#160f26]/80 backdrop-blur-xl p-6 sm:p-7 shadow-lg">
               <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                     <img src={avatarSrc(item.avatar)} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover border border-white/10" />
                     <div>
                        <p className="text-sm font-bold text-white">{item.student}</p>
                        <p className="text-xs font-semibold text-[#93f72b]">
                           {item.lessonTitle || `Bài ${(item.lessonIdx ?? 0) + 1}`} · {item.time}
                        </p>
                     </div>
                  </div>
                  {item.isAnswered ? (
                     <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        Đã trả lời
                     </span>
                  ) : (
                     <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                        Chờ trả lời
                     </span>
                  )}
               </div>
               <p className="text-sm leading-relaxed text-slate-200">{item.question}</p>
               {item.answer ? (
                  <div className="mt-4 rounded-xl border border-[#93f72b]/20 bg-[#93f72b]/5 p-4 text-sm text-slate-200">
                     <span className="font-semibold text-[#93f72b]">Câu trả lời của bạn: </span>
                     {item.answer}
                  </div>
               ) : (
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                     <textarea
                        value={drafts[item.id] || ""}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="Nhập câu trả lời cho học viên..."
                        rows={3}
                        className="min-h-[80px] flex-1 resize-y rounded-xl border border-white/15 bg-[#10091e] px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-[#93f72b] focus:outline-none focus:ring-2 focus:ring-[#93f72b]/20"
                     />
                     <button
                        type="button"
                        onClick={() => handleSend(item.id)}
                        disabled={sending === item.id || !String(drafts[item.id] || "").trim()}
                        className="shrink-0 rounded-xl bg-[#93f72b] px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-950 transition hover:bg-[#a8ff4e] disabled:opacity-40"
                     >
                        {sending === item.id ? "Đang gửi..." : "Gửi trả lời"}
                     </button>
                  </div>
               )}
            </div>
         ))}
      </div>
   );
}

function AnalyticsTab({ lessonStats }) {
   return (
      <div className="space-y-6">
         <div className="rounded-2xl border border-white/10 bg-[#160f26]/85 backdrop-blur-xl overflow-hidden shadow-lg">
            <table className="w-full text-left">
               <thead className="border-b border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-white/[0.02]">
                  <tr>
                     <th className="px-6 py-4">Bài học</th>
                     <th className="px-6 py-4">Lượt hoàn thành</th>
                     <th className="px-6 py-4">Tỷ lệ xem trọn vẹn</th>
                     <th className="px-6 py-4 text-right">Câu hỏi Q&A</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-white/5">
                  {lessonStats.map((s) => (
                     <tr key={s.lessonIndex} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold text-white">
                           {s.title || `Bài ${s.lessonIndex}`}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-300">{s.views}</td>
                        <td className="px-6 py-4">
                           <span className="text-sm font-bold text-[#93f72b]">{s.completionRate}%</span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-slate-400">{s.questions}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
         <p className="text-xs text-slate-400">
            Dữ liệu phân tích dựa trên lịch sử xem video và câu hỏi Q&amp;A thực tế của học viên trên nền tảng.
         </p>
      </div>
   );
}

function buildCoursePayloadFromForm(form, chapters, thumbnailUrl) {
   return {
      title: form.title,
      description: form.description,
      category: form.category,
      level: form.level,
      price: Number(form.price || 0),
      outcomes: form.outcomes,
      tags: form.tags,
      thumbnail: normalizeStoredUploadUrl(thumbnailUrl) || "",
      chapters: chapters.map((chapter) => ({
         title: chapter.title,
         lessons: (chapter.lessons || []).map((lesson) => ({
            title: lesson.title,
            duration: Number(lesson.duration || 0),
            isPreview: Boolean(lesson.isPreview),
            videoFileName: lesson.videoFileName || "",
            videoUrl: lesson.videoUrl || "",
         })),
      })),
   };
}

function mapTopicToCategory(topics = []) {
   const first = String(Array.isArray(topics) ? topics[0] || "" : "").toLowerCase();
   if (first === "behavioral") return "behavioral-interview";
   if (first === "technical") return "technical-interview";
   return "career-development";
}

function CourseAdminModerationBanner({ note, className = "mb-8" }) {
   if (!note) return null;
   const isAmber = note.tone === "amber";
   return (
      <div
         className={`${className} rounded-2xl border p-5 ${
            isAmber ? "border-amber-500/30 bg-amber-950/40 text-amber-200" : "border-rose-500/30 bg-rose-950/40 text-rose-200"
         }`}
      >
         <div className="flex items-start gap-3">
            <WarningCircle size={18} className={`mt-0.5 shrink-0 ${isAmber ? "text-amber-400" : "text-rose-400"}`} />
            <div>
               <p
                  className={`text-[10px] font-black uppercase tracking-widest ${
                     isAmber ? "text-amber-300" : "text-rose-300"
                  }`}
               >
                  {note.title}
               </p>
               <p className={`mt-2 text-sm whitespace-pre-wrap leading-relaxed ${isAmber ? "text-amber-100" : "text-rose-100"}`}>
                  {note.reason}
               </p>
            </div>
         </div>
      </div>
   );
}

function CreateCourseForm({ navigate }) {
   const [step, setStep] = useState(1);
   const [form, setForm] = useState({
      title: "",
      description: "",
      category: "",
      level: "basic",
      price: 0,
      outcomes: ["", "", ""],
      tags: "",
   });
   const [chapters, setChapters] = useState([]);
   const [thumbnailUrl, setThumbnailUrl] = useState("");
   const [thumbnailFileName, setThumbnailFileName] = useState("");
   const addChapter = () =>
      setChapters(prev => [
         ...prev,
         {
            id: `ch-${Date.now()}-${prev.length + 1}`,
            title: `Chương ${prev.length + 1}`,
            lessons: [{ id: `l-${Date.now()}-1`, title: "Bài 1: Giới thiệu", duration: 0, isPreview: true, videoFileName: "" }],
         },
      ]);
   const updateChapterTitle = (id, value) =>
      setChapters(prev => prev.map(ch => (ch.id === id ? { ...ch, title: value } : ch)));
   const addLessonToChapter = (chapterId) =>
      setChapters(prev =>
         prev.map(ch => {
            if (ch.id !== chapterId) return ch;
            const nextLessonIndex = ch.lessons.length + 1;
            return {
               ...ch,
               lessons: [
                  ...ch.lessons,
                  {
                     id: `l-${Date.now()}-${nextLessonIndex}`,
                     title: `Bài ${nextLessonIndex}: Nội dung mới`,
                     duration: 0,
                     isPreview: false,
                     videoFileName: "",
                  },
               ],
            };
         }),
      );
   const updateLessonTitle = (chapterId, lessonId, value) =>
      setChapters(prev =>
         prev.map(ch =>
            ch.id !== chapterId
               ? ch
               : {
                    ...ch,
                    lessons: ch.lessons.map(lesson => (lesson.id === lessonId ? { ...lesson, title: value } : lesson)),
                 },
         ),
      );
   const toggleLessonPreview = (chapterId, lessonId) =>
      setChapters(prev =>
         prev.map(ch =>
            ch.id !== chapterId
               ? ch
               : {
                    ...ch,
                    lessons: ch.lessons.map(lesson =>
                       lesson.id === lessonId ? { ...lesson, isPreview: !lesson.isPreview } : lesson,
                    ),
                 },
         ),
      );
   const updateLessonVideo = async (chapterId, lessonId, file) => {
      if (!file) return;
      const loadingToast = toast.loading(`Đang tải video lên: ${file.name}...`);
      try {
         const durationMinutes = await getVideoDurationMinutes(file);
         const res = shouldUseDirectUpload(file)
            ? await uploadVideoDirectly(file, (pct) =>
                 toast.loading(`Đang tải video: ${pct}%`, { id: loadingToast }),
              )
            : await uploadFile(file, "course-video");
         if (res.success) {
            toastApiSuccess(
               durationMinutes > 0
                  ? `Upload video thành công · ${durationMinutes} phút`
                  : "Upload video thành công!",
            );
            setChapters((prev) =>
               prev.map((ch) =>
                  ch.id !== chapterId
                     ? ch
                     : {
                          ...ch,
                          lessons: ch.lessons.map((lesson) =>
                             lesson.id === lessonId
                                ? {
                                     ...lesson,
                                     videoFileName: file.name,
                                     videoUrl: res.url,
                                     duration: durationMinutes > 0 ? durationMinutes : lesson.duration,
                                  }
                                : lesson,
                          ),
                       },
               ),
            );
         } else {
            toastApiError(res.error, "Upload video thất bại.");
         }
      } catch {
         toastApiError("Lỗi kết nối khi upload video.");
      } finally {
         toast.dismiss(loadingToast);
      }
   };
   const removeLesson = (chapterId, lessonId) =>
      setChapters(prev =>
         prev.map(ch =>
            ch.id !== chapterId
               ? ch
               : {
                    ...ch,
                    lessons: ch.lessons.filter(lesson => lesson.id !== lessonId),
                 },
         ),
      );
   const removeChapter = (id) => setChapters(prev => prev.filter(ch => ch.id !== id));

   const totalLessons = chapters.reduce((acc, ch) => acc + ch.lessons.length, 0);
   const lessonsWithVideo = chapters.reduce(
      (acc, ch) => acc + ch.lessons.filter((lesson) => lesson.videoFileName && lesson.videoFileName.trim()).length,
      0,
   );
   const canContinueStep2 = totalLessons > 0 && lessonsWithVideo > 0;

   return (
      <MentorPageShell bottomPad="pb-24" className="!min-h-0" extraStyles={MENTOR_COURSE_EDIT_EXTRA_CSS}>
         <style>{mentorValidationKeyframes}</style>
         <div className="relative z-10 mx-auto max-w-4xl px-4 pb-8 pt-8 sm:px-6 sm:pt-12">
            <header className="mb-8">
               <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#93f72b]/30 bg-[#93f72b]/10 px-3.5 py-1 text-xs font-bold text-[#93f72b] tracking-wider uppercase">
                  <Sparkles size={13} /> Studio Khóa Học & Video
               </div>
               <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Tạo khóa học & Tải video mới</h1>
               <p className="mt-2 max-w-2xl text-sm text-violet-200/70">
                  Điền thông tin khóa học, tổ chức hệ thống bài giảng và tải video lên. Khóa học sẽ được gửi kiểm duyệt trước khi phát hành công khai.
               </p>
            </header>

            <div className={`${mentorCreateScopeClass} ${mentorCreateShellClass}`}>
               <CourseCreateStepper step={step} />

               {step === 1 && (
                  <CourseCreateStep1
                     initialForm={form}
                     onCancel={() => navigate("/mentor/courses")}
                     onNext={(step1Data) => {
                        setForm((prev) => ({ ...prev, ...step1Data }));
                        setStep(2);
                     }}
                  />
               )}

               {step === 2 && (
                  <CourseCreateStep2
                     chapters={chapters}
                     addChapter={addChapter}
                     removeChapter={removeChapter}
                     updateChapterTitle={updateChapterTitle}
                     addLessonToChapter={addLessonToChapter}
                     updateLessonTitle={updateLessonTitle}
                     toggleLessonPreview={toggleLessonPreview}
                     removeLesson={removeLesson}
                     updateLessonVideo={updateLessonVideo}
                     thumbnailUrl={thumbnailUrl}
                     thumbnailFileName={thumbnailFileName}
                     onThumbnailUploaded={(url, name) => {
                        setThumbnailUrl(url);
                        setThumbnailFileName(name);
                     }}
                     canContinue={canContinueStep2}
                     onNext={() => setStep(3)}
                  />
               )}

               {step === 3 && (
                  <div className="space-y-6">
                     <div className={mentorSectionCardClass}>
                        <h3 className="mb-4 text-lg font-bold text-white tracking-tight">Xác nhận thông tin trước khi gửi duyệt</h3>
                        <dl className="grid gap-3 sm:grid-cols-2">
                           {[
                              ["Tiêu đề", form.title || "(chưa nhập)"],
                              ["Danh mục", form.category || "(chưa chọn)"],
                              ["Cấp độ", form.level],
                              ["Giá khóa học", formatPrice(Number(form.price || 0))],
                              ["Số chương", String(chapters.length)],
                              ["Tổng số bài học", String(totalLessons)],
                              ["Video đã upload", String(lessonsWithVideo)],
                           ].map(([label, value]) => (
                              <div key={label} className="rounded-xl border border-white/10 bg-[#10091e] px-4 py-3">
                                 <dt className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</dt>
                                 <dd className="mt-1 text-sm font-semibold text-white">{value}</dd>
                              </div>
                           ))}
                        </dl>
                     </div>
                     <CourseCreateFooter
                        extra={
                           <>
                              <button
                                 type="button"
                                 onClick={async () => {
                                    try {
                                       const payload = buildCoursePayloadFromForm(form, chapters, thumbnailUrl);
                                       const r = await createCourseDraft(payload);
                                       if (!r.success) {
                                          toastApiError(r.error, "Không thể lưu nháp.");
                                          return;
                                       }
                                       toastApiSuccess("Đã lưu nháp khóa học.");
                                       navigate(`/mentor/courses/${r.course?._id}/edit`);
                                    } catch {
                                       toastApiError("Lỗi kết nối khi lưu nháp khóa học.");
                                    }
                                 }}
                                 className={mentorGhostBtnClass}
                              >
                                 Lưu nháp
                              </button>
                           </>
                        }
                        onPrimary={async () => {
                           try {
                              const payload = buildCoursePayloadFromForm(form, chapters, thumbnailUrl);
                              const r = await createCourseDraft(payload);
                              if (!r.success) {
                                 toastApiError(r.error, "Không thể tạo khóa học.");
                                 return;
                              }
                              const pub = await publishCourse(r.course?._id);
                              if (!pub.success) {
                                 toastApiError(pub.error, "Tạo nháp thành công nhưng chưa đăng được.");
                                 navigate(`/mentor/courses/${r.course?._id}/edit`);
                                 return;
                              }
                              toastApiSuccess("Đã gửi khóa học chờ admin duyệt.");
                              navigate("/mentor/courses");
                           } catch {
                              toastApiError("Lỗi kết nối khi gửi khóa học duyệt.");
                           }
                        }}
                        primaryLabel="Gửi admin phê duyệt xuất bản"
                     />
                  </div>
               )}
            </div>
         </div>
      </MentorPageShell>
   );
}

/* ── Main MentorCourseEdit Component ────────────────────────── */
export function MentorCourseEdit() {
   const { id } = useParams();
   const navigate = useNavigate();
   const [activeTab, setActiveTab] = useState("lessons");
   const isCreateMode = id === "new";
   const [course, setCourse] = useState(null);
   const [loading, setLoading] = useState(!isCreateMode);
   const [editableLessons, setEditableLessons] = useState([]);
   const [thumbnailUrl, setThumbnailUrl] = useState("");
   const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
   const [courseAdminNote, setCourseAdminNote] = useState(null);
   const [showArchiveDialog, setShowArchiveDialog] = useState(false);
   const [archiving, setArchiving] = useState(false);
   const [tabLoading, setTabLoading] = useState(false);
   const [tabError, setTabError] = useState("");
   const [students, setStudents] = useState([]);
   const [studentsSummary, setStudentsSummary] = useState(null);
   const [qaItems, setQaItems] = useState([]);
   const [reviews, setReviews] = useState([]);
   const [reviewsSummary, setReviewsSummary] = useState(null);
   const [analyticsStats, setAnalyticsStats] = useState([]);

   const loadTabData = async (tab) => {
      if (!id || isCreateMode || tab === "lessons") return;
      setTabLoading(true);
      setTabError("");
      try {
         if (tab === "students") {
            const res = await fetchCourseMentorStudents(id);
            if (!res.success) {
               setTabError(res.error || "Không tải được danh sách học viên.");
               setStudents([]);
               setStudentsSummary(null);
            } else {
               setStudents(res.students || []);
               setStudentsSummary(res.summary || null);
            }
         } else if (tab === "qa") {
            const res = await fetchCourseMentorQA(id);
            if (!res.success) {
               setTabError(res.error || "Không tải được Q&A.");
               setQaItems([]);
            } else {
               setQaItems(res.items || []);
            }
         } else if (tab === "reviews") {
            const res = await fetchCourseMentorReviews(id);
            if (!res.success) {
               setTabError(res.error || "Không tải được đánh giá.");
               setReviews([]);
               setReviewsSummary(null);
            } else {
               setReviews(res.reviews || []);
               setReviewsSummary(res.summary || null);
            }
         } else if (tab === "analytics") {
            const res = await fetchCourseMentorAnalytics(id);
            if (!res.success) {
               setTabError(res.error || "Không tải được phân tích.");
               setAnalyticsStats([]);
            } else {
               setAnalyticsStats(res.lessonStats || []);
            }
         }
      } catch {
         setTabError("Lỗi kết nối khi tải dữ liệu tab.");
      } finally {
         setTabLoading(false);
      }
   };

   useEffect(() => {
      loadTabData(activeTab);
   }, [activeTab, id, isCreateMode]);

   useEffect(() => {
      if (isCreateMode) return;
      let cancelled = false;
      void (async () => {
         setLoading(true);
         try {
         const res = await fetchCourseById(id || "");
         if (cancelled) return;
         if (!res.success || !res.course) {
            if (!res.success) toastApiError(res.error, "Không tải được khóa học.");
            setCourse(null);
            return;
         }
         const c = res.course;
         setCourseAdminNote(mapCourseAdminModerationNote(c));
         const mappedLessons =
            c.modules?.flatMap((m) =>
               (m.lessons || []).map((lesson, idx) => ({
                  id: lesson._id || `${m._id || m.title}-${idx}`,
                  title: lesson.title,
                  duration: lesson.durationMinutes || 10,
                  isPreview: Boolean(lesson.isFree),
                  videoFileName: lesson.videoUrl || "",
               })),
            ) || [];
         setCourse({
            id: c._id,
            title: c.title,
            status: c.status || "draft",
            thumbnail: mediaSrc(c.thumbnail, DEFAULT_COURSE_THUMB),
            studentsCount: c.stats?.enrollmentCount || 0,
            rating: c.stats?.rating || 0,
            mentorAvatar: c.mentorId?.userId?.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Lucky",
            mentorName: c.mentorId?.userId?.name || "Mentor",
            lessons: mappedLessons,
            raw: c,
         });
         setEditableLessons(mappedLessons);
         setThumbnailUrl(normalizeStoredUploadUrl(c.thumbnail) || "");
         } catch {
            if (!cancelled) {
               toastApiError("Lỗi kết nối khi tải khóa học.");
               setCourse(null);
            }
         } finally {
            if (!cancelled) setLoading(false);
         }
      })();
      return () => {
         cancelled = true;
      };
   }, [id, isCreateMode]);

   if (isCreateMode) {
      return <CreateCourseForm navigate={navigate} />;
   }
   const lessons = editableLessons.length ? editableLessons : course?.lessons || [];
   const isArchived = course?.status === "archived";
   const refreshQA = () => loadTabData("qa");

   const handleArchiveConfirm = async () => {
      if (!id) return;
      setArchiving(true);
      try {
         const res = await archiveCourse(id);
         if (!res.success) {
            toastApiError(res.error, "Không thể lưu trữ khóa học.");
            return;
         }
         toastApiSuccess(res.message || "Đã lưu trữ khóa học.");
         setShowArchiveDialog(false);
         navigate("/mentor/courses");
      } catch {
         toastApiError("Lỗi kết nối khi lưu trữ khóa học.");
      } finally {
         setArchiving(false);
      }
   };

   if (loading) {
      return (
         <div className="min-h-screen bg-[#0b0813] flex items-center justify-center text-white">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#93f72b] border-t-transparent" />
         </div>
      );
   }

   if (!course) {
      return (
         <div className="min-h-screen bg-[#0b0813] flex items-center justify-center text-white">
            <div className="text-center px-4">
               <BookOpen size={64} className="mx-auto mb-6 text-[#93f72b]/30" />
               <h2 className="mb-3 text-2xl font-bold tracking-tight text-white">Không tìm thấy khóa học</h2>
               <p className="mb-8 text-sm text-slate-400">Khóa học có thể đã bị xóa hoặc bạn không có quyền truy cập.</p>
               <button onClick={() => navigate("/mentor/courses")} className="inline-flex items-center gap-2 rounded-xl bg-[#93f72b] px-8 py-3 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_20px_rgba(147,247,43,0.35)] transition hover:bg-[#a8ff4e]">
                  Về quản lý khóa học
               </button>
            </div>
         </div>
      );
   }

   const statusMeta = COURSE_STATUS_META[course.status] || COURSE_STATUS_META.draft;
   const coverSrc = mediaSrc(thumbnailUrl || course.thumbnail, DEFAULT_COURSE_THUMB);

   const TABS = [
      { key: "lessons", label: "Bài giảng & Video", icon: Layout },
      { key: "students", label: "Học viên", icon: Users },
      { key: "qa", label: "Hỏi & Đáp Q&A", icon: ChatCircle },
      { key: "reviews", label: "Đánh giá học viên", icon: Star },
      { key: "analytics", label: "Phân tích học tập", icon: ChartBar },
   ];

   return (
      <MentorPageShell bottomPad="pb-36" className="overflow-x-clip" extraStyles={MENTOR_COURSE_EDIT_EXTRA_CSS}>
         <div className="relative z-10 mx-auto max-w-6xl overflow-x-hidden px-4 pb-8 sm:px-6 lg:px-8 mentor-course-edit">
            <CourseAdminModerationBanner note={courseAdminNote} />
            {isArchived && !courseAdminNote ? (
               <div className="mb-8 rounded-2xl border border-rose-500/30 bg-rose-950/40 p-5 text-sm text-rose-300">
                  Khóa học này đã được lưu trữ và không còn hiển thị trên sàn công khai.
               </div>
            ) : null}
            <div className="mb-8 rounded-2xl border border-white/10 bg-[#160f26]/85 backdrop-blur-xl p-6 sm:p-8 shadow-[0_16px_48px_rgba(0,0,0,0.4)]">
               <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
                  <div className="group/thumb relative mx-auto shrink-0 lg:mx-0">
                     <img
                        src={coverSrc}
                        alt=""
                        className="h-36 w-full max-w-[220px] rounded-xl border border-white/15 object-cover shadow-lg sm:h-40"
                     />
                     <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-xl bg-black/60 opacity-100 transition-opacity lg:opacity-0 lg:group-hover/thumb:opacity-100">
                        <div className="text-center">
                           {isUploadingThumbnail ? (
                              <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#93f72b] border-t-transparent mx-auto" />
                           ) : (
                              <>
                                 <Upload size={20} className="text-[#93f72b] mx-auto mb-1" />
                                 <span className="text-xs font-bold text-white uppercase tracking-wider">Đổi ảnh bìa</span>
                              </>
                           )}
                        </div>
                        <input
                           type="file"
                           accept="image/*"
                           className="hidden"
                           disabled={isUploadingThumbnail}
                           onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setIsUploadingThumbnail(true);
                              try {
                                 const res = await uploadFile(file, "course-thumbnail");
                                 if (res.success) {
                                    setThumbnailUrl(res.url);
                                    toastApiSuccess("Đã upload ảnh mới!");
                                 } else {
                                    toastApiError(res.error, "Upload thất bại");
                                 }
                              } catch {
                                 toastApiError("Lỗi kết nối khi upload ảnh.");
                              } finally {
                                 setIsUploadingThumbnail(false);
                              }
                           }}
                        />
                     </label>
                  </div>

                  <div className="min-w-0 flex-1">
                     <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${statusMeta.className}`}>
                        {statusMeta.label}
                     </span>
                     <h1 className="mt-3 text-2xl font-black tracking-tight text-white sm:text-3xl">{course.title}</h1>
                     <div className="mt-4 flex flex-wrap gap-4 text-sm font-medium text-slate-300">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs">
                           <Users size={14} className="text-[#93f72b]" />
                           <strong className="text-white font-bold">{course.studentsCount}</strong> học viên
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs">
                           <Star size={14} className="text-amber-400 fill-amber-400" />
                           {course.rating > 0 ? (
                              <>
                                 <strong className="text-white font-bold">{course.rating}</strong> sao
                              </>
                           ) : (
                              "Chưa có đánh giá"
                           )}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs">
                           <Layout size={14} className="text-violet-400" />
                           <strong className="text-white font-bold">{lessons.length}</strong> bài học
                        </span>
                     </div>
                     <div className="mt-6 flex flex-wrap gap-3">
                        {course.status === "published" ? (
                           <button
                              type="button"
                              onClick={() => navigate(`/courses/${id}`)}
                              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-200 transition hover:bg-white/10 hover:text-white"
                           >
                              <Eye size={15} /> Xem trang công khai
                           </button>
                        ) : null}
                        {!isArchived ? (
                           <button
                              type="button"
                              onClick={() => setShowArchiveDialog(true)}
                              className="inline-flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-rose-400 transition hover:bg-rose-500/20"
                           >
                              <Trash size={15} /> Lưu trữ / Ngừng bán
                           </button>
                        ) : null}
                     </div>
                  </div>
               </div>
            </div>

            <MentorScrollFadeRow
               className="mb-8 rounded-2xl border border-white/10 bg-[#160f26]/60 backdrop-blur-md p-1.5"
               innerClassName="flex gap-2"
               fadeFrom="from-[#110c1e]"
            >
               {TABS.map((tab) => (
                  <button
                     key={tab.key}
                     type="button"
                     onClick={() => setActiveTab(tab.key)}
                     className={`flex shrink-0 snap-start items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                        activeTab === tab.key
                           ? "bg-[#93f72b] text-slate-950 shadow-[0_0_16px_rgba(147,247,43,0.35)]"
                           : "text-slate-300 hover:bg-white/5 hover:text-white"
                     }`}
                  >
                     <tab.icon size={15} />
                     {tab.label}
                  </button>
               ))}
            </MentorScrollFadeRow>

            {/* Dynamic Tab Body */}
            <AnimatePresence mode="wait">
               <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3 }}
               >
                  {activeTab === "lessons" && <LessonsTab lessons={lessons} onLessonsChange={setEditableLessons} />}
                  {activeTab === "students" && (
                     <TabPanelState
                        loading={tabLoading}
                        error={tabError}
                        empty={!students.length}
                        emptyMessage="Chưa có học viên nào tham gia khóa này."
                     >
                        <StudentsTab students={students} summary={studentsSummary} />
                     </TabPanelState>
                  )}
                  {activeTab === "qa" && (
                     <TabPanelState
                        loading={tabLoading}
                        error={tabError}
                        empty={!qaItems.length}
                        emptyMessage="Chưa có câu hỏi nào từ học viên."
                     >
                        <QATab courseId={id} items={qaItems} onAnswered={refreshQA} />
                     </TabPanelState>
                  )}
                  {activeTab === "reviews" && (
                     <TabPanelState
                        loading={tabLoading}
                        error={tabError}
                        empty={!reviews.length}
                        emptyMessage="Chưa có đánh giá nào cho khóa này."
                     >
                        <ReviewsTab reviews={reviews} summary={reviewsSummary} />
                     </TabPanelState>
                  )}
                  {activeTab === "analytics" && (
                     <TabPanelState
                        loading={tabLoading}
                        error={tabError}
                        empty={!analyticsStats.length}
                        emptyMessage="Chưa có dữ liệu phân tích (cần ít nhất một bài học)."
                     >
                        <AnalyticsTab lessonStats={analyticsStats} />
                     </TabPanelState>
                  )}
               </motion.div>
            </AnimatePresence>
         </div>

         <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4 sm:pb-6">
            <div className="pointer-events-auto w-full max-w-2xl">
            <div className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-[#140c24]/90 px-5 py-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-6">
               <p className="text-center text-xs font-semibold text-slate-300 sm:text-left">
                  Lưu cập nhật bài học và video trước khi gửi ban quản trị duyệt.
               </p>
               <div className="flex flex-col gap-2.5 sm:flex-row">
                  <button
                     type="button"
                     onClick={() => window.location.reload()}
                     className="min-h-[42px] rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-300 transition hover:bg-white/10 hover:text-white"
                  >
                     Hủy thay đổi
                  </button>
                  <button
                     type="button"
                     onClick={async () => {
                        try {
                           // Giữ nguyên cấu trúc chapter gốc, chỉ cập nhật nội dung từng bài
                           const rawModules = course.raw?.modules || course.raw?.chapters || [];
                           const chapters = rawModules.length
                              ? rawModules.map((m) => ({
                                   title: m.title || "Chương",
                                   lessons: (m.lessons || []).map((orig) => {
                                      const edited = lessons.find(
                                         (el) => el.id === (orig._id?.toString?.() || orig.id),
                                      ) || orig;
                                      return {
                                         title: edited.title,
                                         duration: Number(edited.duration || 0),
                                         isPreview: Boolean(edited.isPreview),
                                         videoUrl: edited.videoUrl || edited.videoFileName || "",
                                      };
                                   }),
                                }))
                              : [
                                   {
                                      title: "Chương 1",
                                      lessons: lessons.map((l) => ({
                                         title: l.title,
                                         duration: Number(l.duration || 0),
                                         isPreview: Boolean(l.isPreview),
                                         videoUrl: l.videoUrl || l.videoFileName || "",
                                      })),
                                   },
                                ];
                           const payload = {
                              title: course.raw?.title || course.title,
                              description: course.raw?.description || "",
                              category: mapTopicToCategory(course.raw?.topics),
                              level: course.raw?.level || "basic",
                              price: course.raw?.price || 0,
                              outcomes: course.raw?.whatYoullLearn || [],
                              tags: course.raw?.tags || [],
                              thumbnail:
                                 normalizeStoredUploadUrl(thumbnailUrl) ||
                                 normalizeStoredUploadUrl(course.raw?.thumbnail) ||
                                 "",
                              chapters,
                           };

                           const saved = await updateCourseDraft(course.id, payload);
                           if (!saved.success) {
                              toastApiError(saved.error, "Không thể lưu thay đổi trước khi gửi duyệt.");
                              return;
                           }
                           const pub = await publishCourse(course.id, payload);
                           if (!pub.success) {
                              toastApiError(pub.error, "Không thể gửi bản cập nhật.");
                              return;
                           }
                           toastApiSuccess("Đã gửi bản cập nhật để admin duyệt. Khóa hiện tại vẫn đang public.");
                           navigate("/mentor/courses");
                        } catch {
                           toastApiError("Lỗi kết nối khi gửi bản cập nhật.");
                        }
                     }}
                     className="min-h-[42px] rounded-xl bg-[#93f72b] px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-950 shadow-[0_0_20px_rgba(147,247,43,0.3)] transition hover:bg-[#a8ff4e]"
                  >
                     Lưu & gửi duyệt
                  </button>
               </div>
            </div>
            </div>
         </div>

         <ArchiveCourseDialog
            open={showArchiveDialog}
            courseTitle={course.title}
            archiving={archiving}
            onOpenChange={(open) => {
               if (!archiving) setShowArchiveDialog(open);
            }}
            onConfirm={handleArchiveConfirm}
         />
      </MentorPageShell>
   );
}
