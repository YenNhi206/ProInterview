import { useEffect, useState } from "react";
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
   Sparkles as Sparkle,
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
   published: { label: "Đã đăng", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
   pending_review: { label: "Chờ duyệt mới", className: "bg-amber-50 text-amber-800 border-amber-200" },
   pending_update: { label: "Chờ duyệt cập nhật", className: "bg-sky-50 text-sky-800 border-sky-200" },
   draft: { label: "Bản nháp", className: "bg-slate-100 text-slate-600 border-slate-200" },
   archived: { label: "Đã lưu trữ", className: "bg-red-50 text-red-700 border-red-200" },
};

const MENTOR_COURSE_EDIT_EXTRA_CSS = `
        .mentor-course-edit .app-page-subtitle {
          font-weight: 600;
          color: #475569;
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
         <div className="glass-card flex min-h-[200px] items-center justify-center p-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" />
         </div>
      );
   }
   if (error) {
      return <div className="glass-card p-8 text-center text-sm text-red-600">{error}</div>;
   }
   if (empty) {
      return (
         <div className="glass-card p-12 text-center text-sm text-slate-500">
            {emptyMessage || "Chưa có dữ liệu."}
         </div>
      );
   }
   return children;
}

/* ── UI Components ─────────────────────────────────────────── */

function MiniBar({ value, max = 100, color }) {
   return (
      <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden flex-1">
         <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${(value / max) * 100}%` }}
            className="h-full rounded-full"
            style={{ background: color, boxShadow: `0 0 10px ${color}40` }}
         />
      </div>
   );
}

/* ── Tabs Content ──────────────────────────────────────────── */

function ReviewsTab({ reviews, summary }) {
   const stats = [
      { label: "Rating TB", value: summary?.avgRating ?? "0.0" },
      { label: "Tổng đánh giá", value: summary?.total ?? reviews.length },
      { label: "Chờ phản hồi", value: summary?.pendingReply ?? 0 },
      { label: "Đã xác minh", value: reviews.filter((r) => r.verified).length },
   ];
   return (
      <motion.div className="space-y-8">
         <motion.div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {stats.map((s, i) => (
               <motion.div key={i} className="glass-card p-6">
                  <h3 className="mentor-stat-num mentor-stat-num--card text-slate-900 mb-1">{s.value}</h3>
                  <p className="mentor-label">{s.label}</p>
               </motion.div>
            ))}
         </motion.div>
         <motion.div className="space-y-4">
            {reviews.map((review) => (
               <motion.div key={review.id} className="glass-card p-8">
                  <motion.div className="mb-4 flex items-start gap-4">
                     <img src={avatarSrc(review.avatar)} alt="" className="h-12 w-12 rounded-xl object-cover" />
                     <motion.div>
                        <h5 className="text-base font-bold text-slate-900">{review.name}</h5>
                        <p className="text-xs text-slate-500">
                           {review.role ? `${review.role} · ` : ""}
                           {review.date}
                           {" · "}
                           {"★".repeat(review.rating)}
                           {"☆".repeat(Math.max(0, 5 - review.rating))}
                        </p>
                     </motion.div>
                  </motion.div>
                  <p className="text-sm leading-relaxed text-slate-700 italic">"{review.comment}"</p>
                  {review.response ? (
                     <motion.div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/50 p-4 text-sm text-slate-700">
                        <span className="font-semibold text-violet-700">Phản hồi của bạn: </span>
                        {review.response}
                     </motion.div>
                  ) : null}
               </motion.div>
            ))}
         </motion.div>
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
      const loadingToast = toast.loading(`Đang upload video: ${file.name}...`);
      try {
         const durationMinutes = await getVideoDurationMinutes(file);
         const res = shouldUseDirectUpload(file)
            ? await uploadVideoDirectly(file, (pct) =>
                 toast.loading(`Đang upload video: ${pct}%`, { id: loadingToast }),
              )
            : await uploadFile(file, "course-video");
         if (res.success) {
            toastApiSuccess(
               durationMinutes > 0
                  ? `Upload thành công · ${durationMinutes} phút`
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
      <div className="glass-card overflow-hidden">
         <div className="flex flex-col gap-4 border-b border-slate-200/80 bg-slate-50/80 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
               <h3 className="app-page-title">Nội dung bài giảng</h3>
               <p className="app-page-subtitle mt-1">{editList.length} bài học</p>
            </div>
            <button
               type="button"
               onClick={handleAddLesson}
               className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-5 py-3 text-xs font-bold uppercase tracking-wide text-white shadow-md shadow-violet-600/20 hover:bg-violet-700"
            >
               <Plus size={16} /> Thêm bài học
            </button>
         </div>
         <ul className="divide-y divide-slate-100">
            {editList.map((lesson, idx) => (
               <li key={lesson.id} className="px-4 py-5 transition-colors hover:bg-violet-50/30 sm:px-6">
                  <div className="flex items-start justify-between gap-4">
                     <div className="flex items-start gap-6 flex-1">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-sm font-black text-violet-700">
                        {idx + 1}
                        </span>
                        <div className="flex-1">
                           {editingId === lesson.id ? (
                              <input
                                 value={draftTitle}
                                 onChange={(e) => setDraftTitle(e.target.value)}
                                 className="w-[380px] max-w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary-fixed"
                              />
                           ) : (
                              <h4 className="text-sm font-black text-slate-900 group-hover:text-violet-700 transition-colors">{lesson.title}</h4>
                           )}
                           <div className="mt-2 flex flex-wrap items-center gap-2">
                              <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                                 {lesson.videoFileName && lesson.duration > 0
                                    ? `${lesson.duration} phút (từ video)`
                                    : "Thời lượng: upload video để tự lấy"}
                              </span>
                              <button
                                 type="button"
                                 onClick={() => toggleLessonPreview(lesson.id)}
                                 className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest ${
                                    lesson.isPreview
                                       ? "bg-primary-fixed/20 text-violet-700 border border-primary-fixed/30"
                                       : "bg-slate-50 border border-slate-200 text-zinc-400"
                                 }`}
                              >
                                 {lesson.isPreview ? "Preview" : "Ẩn"}
                              </button>
                              <label className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-700 hover:border-violet-300 hover:text-violet-800">
                                 Tải video
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
                              <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wide truncate max-w-[280px]">
                                 {lesson.videoFileName || "Chưa chọn video"}
                              </span>
                           </div>
                        </div>
                     </div>
                     <div className="flex items-center gap-3 shrink-0">
                        {editingId === lesson.id ? (
                           <>
                              <button
                                 type="button"
                                 onClick={() => saveEdit(lesson.id)}
                                 className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-zinc-500 hover:text-emerald-300 transition-all"
                              >
                                 <Check size={16} />
                              </button>
                              <button
                                 type="button"
                                 onClick={() => {
                                    setEditingId(null);
                                    setDraftTitle("");
                                 }}
                                 className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-zinc-500 hover:text-orange-300 transition-all"
                              >
                                 <X size={16} />
                              </button>
                           </>
                        ) : (
                        <button
                           type="button"
                           onClick={() => startEdit(lesson)}
                           className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-zinc-500 hover:text-slate-900 transition-all"
                        >
                           <PencilSimple size={16} />
                        </button>
                        )}
                        <button
                           type="button"
                           onClick={() => removeLessonItem(lesson.id)}
                           className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-zinc-500 hover:text-red-500 transition-all"
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
   const statCards = [
      { label: "Đang hoạt động", value: summary?.active ?? students.filter((s) => s.status === "active").length },
      { label: "Hoàn thành", value: summary?.completed ?? students.filter((s) => s.status === "completed").length },
      { label: "Tiến độ TB", value: summary?.avgProgress ?? "0%" },
      { label: "Drop-off", value: summary?.dropoffRate ?? "0%" },
   ];
   return (
      <div className="space-y-8">
         <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {statCards.map((s, i) => (
               <div key={i} className="glass-card p-6">
                  <h3 className="mentor-stat-num mentor-stat-num--card text-slate-900 mb-1">{s.value}</h3>
                  <p className="mentor-label">{s.label}</p>
               </div>
            ))}
         </div>
         <div className="glass-card overflow-hidden">
            <table className="w-full text-left">
               <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-bold text-zinc-600 uppercase tracking-wide">
                     <th className="px-6 py-4">Học viên</th>
                     <th className="px-6 py-4">Tiến độ</th>
                     <th className="px-6 py-4 text-right">Lần cuối</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {students.map((s) => (
                     <tr key={s.id} className="hover:bg-violet-50/30 transition-colors">
                        <td className="px-6 py-4">
                           <div className="flex items-center gap-3">
                              <img src={avatarSrc(s.avatar)} alt="" className="h-10 w-10 rounded-xl object-cover" />
                              <div>
                                 <span className="text-sm font-bold text-slate-900">{s.name}</span>
                                 {!s.hasAccess ? (
                                    <p className="text-[10px] text-amber-600">Chờ thanh toán</p>
                                 ) : null}
                              </div>
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex w-40 items-center gap-3">
                              <MiniBar value={s.progress} color={s.progress === 100 ? "#10b981" : "#8037f4"} />
                              <span className="text-xs font-bold text-slate-900">{s.progress}%</span>
                           </div>
                        </td>
                        <td className="px-6 py-4 text-right text-xs font-semibold text-slate-600">{s.lastActive}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
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
            <motion.div key={item.id} className="glass-card p-6 sm:p-8">
               <motion.div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <motion.div className="flex min-w-0 items-center gap-3">
                     <img src={avatarSrc(item.avatar)} alt="" className="h-10 w-10 shrink-0 rounded-xl object-cover" />
                     <motion.div>
                        <p className="text-sm font-bold text-slate-900">{item.student}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-600">
                           {item.lessonTitle || `Bài ${(item.lessonIdx ?? 0) + 1}`} · {item.time}
                        </p>
                     </motion.div>
                  </motion.div>
                  {item.isAnswered ? (
                     <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[10px] font-bold uppercase text-emerald-700">
                        Đã trả lời
                     </span>
                  ) : (
                     <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase text-amber-700">
                        Chờ trả lời
                     </span>
                  )}
               </motion.div>
               <p className="text-sm leading-relaxed text-slate-800">{item.question}</p>
               {item.answer ? (
                  <motion.div className="mt-4 rounded-xl border border-violet-100 bg-violet-50/50 p-4 text-sm text-slate-700">
                     <span className="font-semibold text-violet-700">Câu trả lời của bạn: </span>
                     {item.answer}
                  </motion.div>
               ) : (
                  <motion.div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
                     <textarea
                        value={drafts[item.id] || ""}
                        onChange={(e) => setDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder="Nhập câu trả lời cho học viên..."
                        rows={3}
                        className="min-h-[80px] flex-1 resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-400/20"
                     />
                     <button
                        type="button"
                        onClick={() => handleSend(item.id)}
                        disabled={sending === item.id || !String(drafts[item.id] || "").trim()}
                        className="shrink-0 rounded-xl bg-violet-600 px-5 py-3 text-xs font-bold uppercase tracking-wide text-white disabled:opacity-50"
                     >
                        {sending === item.id ? "Đang gửi..." : "Gửi trả lời"}
                     </button>
                  </motion.div>
               )}
            </motion.div>
         ))}
      </div>
   );
}

function AnalyticsTab({ lessonStats }) {
   return (
      <div className="space-y-8">
         <div className="glass-card overflow-hidden">
            <table className="w-full text-left">
               <thead className="border-b border-slate-200 text-[10px] font-bold text-zinc-600 uppercase tracking-wide">
                  <tr>
                     <th className="px-6 py-4">Bài học</th>
                     <th className="px-6 py-4">Đã hoàn thành</th>
                     <th className="px-6 py-4">Tỷ lệ hoàn thành</th>
                     <th className="px-6 py-4 text-right">Câu hỏi</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {lessonStats.map((s) => (
                     <tr key={s.lessonIndex} className="hover:bg-violet-50/30 transition-colors">
                        <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                           {s.title || `Bài ${s.lessonIndex}`}
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600">{s.views}</td>
                        <td className="px-6 py-4">
                           <span className="text-sm font-bold text-violet-700">{s.completionRate}%</span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-slate-500">{s.questions}</td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
         <p className="text-xs text-slate-500">
            Phân tích dựa trên tiến độ ghi danh đã thanh toán và câu hỏi Q&amp;A thực tế trên hệ thống.
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
            isAmber ? "border-amber-200 bg-amber-50" : "border-orange-400/30 bg-orange-500/10"
         }`}
      >
         <div className="flex items-start gap-3">
            <WarningCircle size={18} className={`mt-0.5 shrink-0 ${isAmber ? "text-amber-700" : "text-orange-300"}`} />
            <div>
               <p
                  className={`text-[10px] font-black uppercase tracking-widest ${
                     isAmber ? "text-amber-900" : "text-orange-200"
                  }`}
               >
                  {note.title}
               </p>
               <p className={`mt-2 text-sm whitespace-pre-wrap leading-relaxed ${isAmber ? "text-amber-950" : "text-slate-800"}`}>
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
   const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
   const updateOutcome = (index, value) =>
      setForm(prev => {
         const next = [...prev.outcomes];
         next[index] = value;
         return { ...prev, outcomes: next };
      });
   const addOutcome = () => setForm(prev => ({ ...prev, outcomes: [...prev.outcomes, ""] }));
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
      const loadingToast = toast.loading(`Đang upload video: ${file.name}...`);
      try {
         const durationMinutes = await getVideoDurationMinutes(file);
         const res = shouldUseDirectUpload(file)
            ? await uploadVideoDirectly(file, (pct) =>
                 toast.loading(`Đang upload video: ${pct}%`, { id: loadingToast }),
              )
            : await uploadFile(file, "course-video");
         if (res.success) {
            toastApiSuccess(
               durationMinutes > 0
                  ? `Upload thành công · ${durationMinutes} phút`
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


   const filledOutcomes = form.outcomes.filter(o => o.trim().length > 0).length;
   const validationMessages = [];
   if (form.title.trim().length <= 2) validationMessages.push("Nhập tiêu đề khóa học (ít nhất 3 ký tự).");
   if (form.description.trim().length <= 20) validationMessages.push("Nhập mô tả khóa học (ít nhất 21 ký tự).");
   if (!form.category.trim()) validationMessages.push("Chọn danh mục khóa học.");
   if (filledOutcomes < 3) validationMessages.push("Điền ít nhất 3 mục 'Học viên sẽ học được gì'.");
   const canContinueStep1 = validationMessages.length === 0;
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
               <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Tạo khóa học mới</h1>
               <p className="mt-2 max-w-xl text-sm text-slate-500">
                  Điền thông tin, thêm nội dung video, sau đó gửi admin duyệt trước khi hiển thị công khai.
               </p>
            </header>

            <div className={`${mentorCreateScopeClass} ${mentorCreateShellClass}`}>
               <CourseCreateStepper step={step} />

               {step === 1 && (
                  <CourseCreateStep1
                     form={form}
                     updateField={updateField}
                     updateOutcome={updateOutcome}
                     addOutcome={addOutcome}
                     validationMessages={validationMessages}
                     canContinue={canContinueStep1}
                     onCancel={() => navigate("/mentor/courses")}
                     onNext={() => setStep(2)}
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
                        <h3 className="mb-4 text-lg font-bold text-slate-900">Xem trước trước khi gửi</h3>
                        <dl className="grid gap-3 sm:grid-cols-2">
                           {[
                              ["Tiêu đề", form.title || "(chưa nhập)"],
                              ["Danh mục", form.category || "(chưa chọn)"],
                              ["Cấp độ", form.level],
                              ["Giá", formatPrice(Number(form.price || 0))],
                              ["Số chương", String(chapters.length)],
                              ["Số bài học", String(totalLessons)],
                              ["Video đã upload", String(lessonsWithVideo)],
                           ].map(([label, value]) => (
                              <div key={label} className="rounded-xl bg-slate-50 px-4 py-3">
                                 <dt className="text-xs font-bold uppercase tracking-wide text-slate-600">{label}</dt>
                                 <dd className="mt-1 text-sm font-semibold text-slate-900">{value}</dd>
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
                        primaryLabel="Gửi admin duyệt"
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
         <div className="min-h-screen bg-[#f8f4ff] flex items-center justify-center text-slate-900">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary-fixed border-t-transparent" />
         </div>
      );
   }

   if (!course) {
      return (
         <div className="min-h-screen bg-[#f8f4ff] flex items-center justify-center text-slate-900">
            <div className="text-center">
               <BookOpen size={64} className="mx-auto mb-6 text-violet-700 opacity-20" />
               <h2 className="mb-8 text-xl font-black tracking-tight sm:text-2xl">Không tìm thấy khóa học</h2>
               <button onClick={() => navigate("/mentor/courses")} className="px-10 py-4 rounded-3xl bg-primary-fixed text-black text-xs font-black uppercase tracking-widest shadow-xl">Về quản lý khóa học</button>
            </div>
         </div>
      );
   }

   const statusMeta = COURSE_STATUS_META[course.status] || COURSE_STATUS_META.draft;
   const coverSrc = mediaSrc(thumbnailUrl || course.thumbnail, DEFAULT_COURSE_THUMB);

   const TABS = [
      { key: "lessons", label: "Bài học", icon: Layout },
      { key: "students", label: "Học viên", icon: Users },
      { key: "qa", label: "Hỏi & Đáp", icon: ChatCircle },
      { key: "reviews", label: "Đánh giá", icon: Star },
      { key: "analytics", label: "Phân tích", icon: ChartBar },
   ];

   return (
      <MentorPageShell bottomPad="pb-36" extraStyles={MENTOR_COURSE_EDIT_EXTRA_CSS}>
         <div className="relative z-10 mx-auto max-w-6xl px-6 pb-8 sm:px-8 mentor-course-edit">
            <CourseAdminModerationBanner note={courseAdminNote} />
            {isArchived && !courseAdminNote ? (
               <div className="mb-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
                  Khóa học này đã được lưu trữ và không còn hiển thị trên trang Khám phá.
               </div>
            ) : null}
            <div className="glass-card mb-8 overflow-hidden">
               <div className="flex flex-col gap-6 p-6 sm:p-8 lg:flex-row lg:items-start">
                  <div className="group/thumb relative mx-auto shrink-0 lg:mx-0">
                     <img
                        src={coverSrc}
                        alt=""
                        className="h-36 w-full max-w-[220px] rounded-2xl object-cover shadow-md ring-1 ring-slate-200/80 sm:h-40"
                     />
                     <label className="absolute inset-0 flex cursor-pointer items-center justify-center rounded-2xl bg-black/50 opacity-0 transition-opacity group-hover/thumb:opacity-100">
                        <div className="text-center">
                           {isUploadingThumbnail ? (
                              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mx-auto" />
                           ) : (
                              <>
                                 <Upload size={20} className="text-white mx-auto mb-1" />
                                 <span className="text-[8px] font-bold text-white uppercase tracking-wide">Đổi ảnh</span>
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
                     <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${statusMeta.className}`}>
                        {statusMeta.label}
                     </span>
                     <h1 className="app-page-title mt-3">{course.title}</h1>
                     <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold text-slate-700">
                        <span className="inline-flex items-center gap-1.5">
                           <Users size={15} className="text-violet-600" />
                           <strong className="mentor-stat-num mentor-stat-num--card text-slate-900">{course.studentsCount}</strong> học viên
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                           <Star size={15} className="text-amber-500" />
                           <strong className="mentor-stat-num mentor-stat-num--card text-slate-900">{course.rating > 0 ? course.rating : "—"}</strong> đánh giá
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                           <Layout size={15} className="text-violet-600" />
                           <strong className="mentor-stat-num mentor-stat-num--card text-slate-900">{lessons.length}</strong> bài học
                        </span>
                     </div>
                     <div className="mt-6 flex flex-wrap gap-3">
                        {course.status === "published" ? (
                           <button
                              type="button"
                              onClick={() => navigate(`/courses/${id}`)}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
                           >
                              <Eye size={15} /> Xem trang công khai
                           </button>
                        ) : null}
                        {!isArchived ? (
                           <button
                              type="button"
                              onClick={() => setShowArchiveDialog(true)}
                              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-red-700 hover:bg-red-100"
                           >
                              <Trash size={15} /> Xóa khóa học
                           </button>
                        ) : null}
                     </div>
                  </div>
               </div>
            </div>

            <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50/90 p-1.5">
               {TABS.map((tab) => (
                  <button
                     key={tab.key}
                     type="button"
                     onClick={() => setActiveTab(tab.key)}
                     className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition ${
                        activeTab === tab.key
                           ? "bg-violet-600 text-white shadow-md shadow-violet-600/25"
                           : "font-semibold text-slate-700 hover:bg-white hover:text-slate-900"
                     }`}
                  >
                     <tab.icon size={15} />
                     {tab.label}
                  </button>
               ))}
            </div>

            {/* Dynamic Tab Body */}
            <AnimatePresence mode="wait">
               <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.4 }}
               >
                  {activeTab === "lessons" && <LessonsTab lessons={lessons} onLessonsChange={setEditableLessons} />}
                  {activeTab === "students" && (
                     <TabPanelState
                        loading={tabLoading}
                        error={tabError}
                        empty={!students.length}
                        emptyMessage="Chưa có học viên ghi danh."
                     >
                        <StudentsTab students={students} summary={studentsSummary} />
                     </TabPanelState>
                  )}
                  {activeTab === "qa" && (
                     <TabPanelState
                        loading={tabLoading}
                        error={tabError}
                        empty={!qaItems.length}
                        emptyMessage="Chưa có câu hỏi từ học viên."
                     >
                        <QATab courseId={id} items={qaItems} onAnswered={refreshQA} />
                     </TabPanelState>
                  )}
                  {activeTab === "reviews" && (
                     <TabPanelState
                        loading={tabLoading}
                        error={tabError}
                        empty={!reviews.length}
                        emptyMessage="Chưa có đánh giá nào."
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

         <div className="fixed bottom-6 left-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2">
            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white/95 px-4 py-4 shadow-xl shadow-violet-900/10 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:px-6">
               <p className="text-center text-xs font-semibold text-slate-600 sm:text-left">
                  Lưu thay đổi trước khi gửi admin duyệt
               </p>
               <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                     type="button"
                     onClick={() => window.location.reload()}
                     className="rounded-xl border border-slate-200 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
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
                     className="rounded-xl bg-violet-600 px-6 py-3 text-xs font-bold uppercase tracking-wide text-white shadow-md shadow-violet-600/25 hover:bg-violet-700"
                  >
                     Lưu & gửi duyệt
                  </button>
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
