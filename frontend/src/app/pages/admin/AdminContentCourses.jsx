import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router";
import { motion } from "motion/react";
import {
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Archive,
  ExternalLink,
  Eye,
  Film,
  GraduationCap,
  Star,
  ImageIcon,
  User,
  XCircle,
} from "lucide-react";
import { AdminFilterSelect, AdminListFilterBar } from "../../components/admin/AdminListFilters.jsx";
import { AdminLessonVideoPlayer } from "../../components/admin/AdminLessonVideoPlayer.jsx";
import {
  AdminPageToolbar,
  adminGlassTable,
  adminHeaderRow,
  adminPageWrap,
  adminStatGrid2,
  adminStatGrid3,
  adminTdCell,
  adminThCell,
} from "../../components/admin/AdminPageShell.jsx";
import { adminApi } from "../../api/adminApi.js";
import { toastApiError, toastApiSuccess, tryApi } from "../../utils/shared/apiToast.js";
import { markAdminCoursePreviewReturn } from "../../utils/admin/adminCoursePreview.js";
import { mediaSrc, DEFAULT_COURSE_THUMB, avatarSrc } from "../../utils/shared/mediaUrl.js";
import { getInitials } from "../../utils/auth/auth.js";

const LEVEL_LABELS = {
  basic: "Cơ bản",
  intermediate: "Trung cấp",
  advanced: "Nâng cao",
};

const STATUS_META = {
  pending_review: {
    label: "Khóa mới",
    className: "bg-amber-100 text-amber-900 ring-amber-200",
  },
  pending_update: {
    label: "Cập nhật",
    className: "bg-sky-100 text-sky-900 ring-sky-200",
  },
  published: {
    label: "Đã xuất bản",
    className: "bg-emerald-100 text-emerald-900 ring-emerald-200",
  },
};

const LIST_OPTIONS = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Chờ duyệt" },
  { id: "published", label: "Đã xuất bản" },
  { id: "incomplete", label: "Thiếu video" },
];

function isCourseVideoIncomplete(course) {
  const r = course?.review || {};
  const lessons = Number(r.lessonCount || 0);
  const videos = Number(r.videoCount || 0);
  return lessons > 0 && videos < lessons;
}

function filterCoursesBySearch(list, searchTerm) {
  const q = searchTerm.trim().toLowerCase();
  if (!q) return list;
  return list.filter((c) => {
    const r = c.review || {};
    const title = String(r.title || "").toLowerCase();
    const mentor = String(c.mentor?.name || "").toLowerCase();
    const email = String(c.mentor?.email || "").toLowerCase();
    return title.includes(q) || mentor.includes(q) || email.includes(q);
  });
}

function formatDuration(minutes) {
  const m = Number(minutes) || 0;
  if (m <= 0) return "—";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h > 0) return r > 0 ? `${h}h ${r} phút` : `${h}h`;
  return `${r} phút`;
}

function formatEnrollmentStats(stats) {
  return Number(stats?.enrollmentCount || 0).toLocaleString("vi-VN");
}

function formatRatingStats(stats) {
  const count = Number(stats?.reviewCount || 0);
  const rating = Number(stats?.rating || 0);
  if (count <= 0) return "—";
  return `${rating.toFixed(1)} (${count})`;
}

function formatDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function CourseModerationModal({ mode, course, busy, onClose, onConfirm }) {
  const isReject = mode === "reject";
  const [reason, setReason] = useState("");

  if (!course) return null;

  return (
    <AdminModal onClose={onClose} maxWidth="max-w-lg">
      <h3 className="text-lg font-black text-slate-900">
        {isReject ? "Từ chối khóa học" : "Gỡ khỏi marketplace"}
      </h3>
      <p className="mt-2 text-sm text-slate-600">
        <span className="font-semibold text-slate-800">{course.review?.title || "Khóa học"}</span>
        {isReject
          ? course.status === "pending_update"
            ? ", Bản cập nhật sẽ bị hủy, khóa hiện tại vẫn public."
            : ", Khóa trả về bản nháp cho cố vấn chỉnh sửa."
          : ", Khóa sẽ chuyển sang trạng thái lưu trữ và không hiển thị cho học viên."}
      </p>
      <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-600">
        {isReject ? "Lý do từ chối (bắt buộc)" : "Lý do gỡ (tuỳ chọn)"}
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        rows={4}
        placeholder={
          isReject
            ? "Ví dụ: Nội dung chưa đạt, thiếu video bài học, vi phạm chính sách…"
            : "Ví dụ: Vi phạm nội dung, spam, yêu cầu cố vấn…"
        }
        className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-violet-400"
      />
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          type="button"
          disabled={busy || (isReject && !reason.trim())}
          onClick={() => onConfirm(reason.trim())}
          className={`rounded-lg px-4 py-2 text-sm font-bold uppercase text-white disabled:opacity-50 ${
            isReject ? "bg-red-600 hover:bg-red-700" : "bg-amber-700 hover:bg-amber-800"
          }`}
        >
          {busy ? "Đang xử lý…" : isReject ? "Xác nhận từ chối" : "Gỡ khỏi marketplace"}
        </button>
      </div>
    </AdminModal>
  );
}

function AdminModal({ onClose, children, maxWidth = "max-w-3xl" }) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Đóng"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full ${maxWidth} max-h-[min(92vh,100dvh-1rem)] overflow-y-auto rounded-lg border border-violet-200/80 bg-white p-6 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function MentorBlock({ mentor }) {
  const name = mentor?.name || "Cố vấn";
  const avatar = mentor?.avatar || "";
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = avatar && !imgFailed;

  return (
    <div className="flex items-center gap-3">
      {showImg ? (
        <img
          src={avatarSrc(avatar)}
          alt=""
          className="size-12 shrink-0 rounded-lg object-cover ring-2 ring-violet-100"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-sm font-bold text-white">
          {getInitials(name)}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate font-bold text-slate-900">{name}</p>
        <p className="truncate text-xs text-slate-500">{mentor?.email || "—"}</p>
        {(mentor?.title || mentor?.company) && (
          <p className="mt-0.5 truncate text-xs text-violet-700">
            {[mentor.title, mentor.company].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        <Icon className="h-3.5 w-3.5 text-violet-600" />
        {label}
      </div>
      <p className="mt-1 text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

function ChapterList({ chapters, defaultOpen = false, allowVideoPreview = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [activeVideoKey, setActiveVideoKey] = useState(null);
  if (!chapters?.length) {
    return <p className="text-sm text-slate-500">Chưa có chương / bài học.</p>;
  }
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-bold text-slate-800 hover:bg-slate-50"
      >
        <span className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-violet-600" />
          Nội dung ({chapters.length} chương)
        </span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open ? (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {chapters.map((ch, ci) => (
            <li key={ci} className="px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
                Chương {ci + 1}: {ch.title}
              </p>
              <ul className="mt-2 space-y-1.5">
                {(ch.lessons || []).map((lesson, li) => {
                  const videoKey = `${ci}-${li}`;
                  const canPlay = allowVideoPreview && lesson.hasVideo && lesson.videoUrl;
                  const playing = activeVideoKey === videoKey;
                  return (
                    <li key={li} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-slate-800">
                          {li + 1}. {lesson.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {lesson.hasVideo ? (
                            <span className="inline-flex items-center gap-1 text-emerald-700">
                              <Film className="h-3 w-3" /> Có video
                            </span>
                          ) : (
                            <span className="text-amber-700">Chưa có video</span>
                          )}
                          {lesson.durationMinutes > 0 ? (
                            <span>{lesson.durationMinutes} phút</span>
                          ) : null}
                          {lesson.isPreview ? (
                            <span className="rounded bg-lime-100 px-1.5 py-0.5 font-semibold text-lime-900">
                              Xem thử
                            </span>
                          ) : null}
                          {canPlay ? (
                            <button
                              type="button"
                              onClick={() => setActiveVideoKey(playing ? null : videoKey)}
                              className="rounded-md border border-violet-200 bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-violet-800 hover:bg-violet-50"
                            >
                              {playing ? "Ẩn video" : "Xem video"}
                            </button>
                          ) : null}
                        </span>
                      </div>
                      {playing ? (
                        <div className="mt-3">
                          <AdminLessonVideoPlayer url={lesson.videoUrl} title={lesson.title} />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PendingChangesBanner({ changes }) {
  if (!changes?.length) return null;
  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/80 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-sky-800">Thay đổi so với bản đang public</p>
      <ul className="mt-2 space-y-2">
        {changes.map((c) => (
          <li key={c.label} className="text-sm text-slate-800">
            <span className="font-semibold text-sky-900">{c.label}:</span>{" "}
            <span className="text-slate-500 line-through">{c.from}</span>
            <span className="mx-1 text-slate-400">→</span>
            <span className="font-medium text-slate-900">{c.to}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CourseReviewCard({ course, busy, onApprove, onReject, onPreview }) {
  const meta = STATUS_META[course.status] || STATUS_META.pending_review;
  const r = course.review || {};
  const thumb = mediaSrc(r.thumbnail, DEFAULT_COURSE_THUMB);
  const topic = Array.isArray(r.topics) && r.topics.length ? r.topics[0] : "—";
  const priorReject =
    course.status === "draft" && course.adminReview?.lastAction === "reject" && course.adminReview?.reason;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-gradient-to-r from-violet-50/80 to-white p-5 sm:flex-row">
        <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-lg border border-slate-200 sm:h-32 sm:w-44">
          <img src={thumb} alt="" className="h-full w-full object-cover" />
          {!r.thumbnail ? (
            <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
              Chưa có ảnh bìa
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start gap-2">
            <span className={`inline-flex rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${meta.className}`}>
              {meta.label}
            </span>
            <span className="text-[10px] font-medium text-slate-500">{formatDate(course.updatedAt)}</span>
          </div>
          <h2 className="mt-2 text-xl font-black text-slate-900">{r.title || "(Không có tiêu đề)"}</h2>
        </div>
      </div>

      <div className="space-y-4 p-5">
        {priorReject ? (
          <div className="rounded-lg border border-red-200 bg-red-50/90 px-4 py-3 text-sm text-red-900">
            <p className="text-[10px] font-black uppercase tracking-wide text-red-800">Lần từ chối trước</p>
            <p className="mt-1 whitespace-pre-wrap">{course.adminReview.reason}</p>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-violet-700">Cố vấn</p>
            <MentorBlock mentor={course.mentor} />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2">
            <StatPill icon={GraduationCap} label="Giá" value={r.priceLabel || "—"} />
            <StatPill icon={BookOpen} label="Chủ đề" value={topic} />
            <StatPill icon={User} label="Cấp độ" value={LEVEL_LABELS[r.level] || r.level || "—"} />
            <StatPill icon={Clock} label="Thời lượng" value={formatDuration(r.durationMinutes)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatPill icon={BookOpen} label="Chương" value={String(r.chapterCount ?? 0)} />
          <StatPill icon={Film} label="Bài có video" value={`${r.videoCount ?? 0}/${r.lessonCount ?? 0}`} />
          <StatPill icon={Eye} label="Bài xem thử" value={String(r.previewCount ?? 0)} />
          <StatPill icon={ImageIcon} label="Loại" value={r.isFree ? "Miễn phí" : "Trả phí"} />
        </div>

        {course.status === "pending_update" ? (
          <PendingChangesBanner changes={course.pendingChanges} />
        ) : null}

        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">Mô tả</p>
          <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-700 line-clamp-4">
            {r.description || "(Không có mô tả)"}
          </p>
        </div>

        {Array.isArray(r.whatYoullLearn) && r.whatYoullLearn.length > 0 ? (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-violet-700">Học viên sẽ học được</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
              {r.whatYoullLearn.slice(0, 5).map((item, i) => (
                <li key={i}>{item}</li>
              ))}
              {r.whatYoullLearn.length > 5 ? (
                <li className="list-none text-xs text-slate-500">+{r.whatYoullLearn.length - 5} mục khác…</li>
              ) : null}
            </ul>
          </div>
        ) : null}

        <ChapterList chapters={r.chapters} allowVideoPreview />

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
          >
            <Eye className="h-4 w-4" />
            Xem chi tiết
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-red-800 disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            {busy ? "Đang xử lý…" : "Từ chối"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onApprove}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-500 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-white shadow-sm disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" />
            {busy ? "Đang xử lý…" : "Duyệt & xuất bản"}
          </button>
        </div>
      </div>
    </article>
  );
}

function CourseDetailModal({
  course,
  onClose,
  onApprove,
  onReject,
  onArchive,
  onStudentPreview,
  busy,
  readOnly = false,
}) {
  const r = course?.review || {};
  const thumb = mediaSrc(r.thumbnail, DEFAULT_COURSE_THUMB);
  const isPublished = course?.status === "published";
  const canUnpublish = course?.status === "published" || course?.status === "pending_update";

  return (
    <AdminModal onClose={onClose} maxWidth="max-w-4xl">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-wide text-violet-600">
            {readOnly ? "Khóa đã xuất bản" : "Chi tiết khóa"}
          </p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">{r.title}</h2>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {onStudentPreview ? (
            <button
              type="button"
              onClick={() => onStudentPreview(course._id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-bold uppercase text-violet-800 hover:bg-violet-100"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Trang học viên
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Đóng
          </button>
        </div>
      </div>

      <img src={thumb} alt="" className="mb-4 h-48 w-full rounded-lg object-cover border border-slate-200" />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <MentorBlock mentor={course.mentor} />
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p>
            <span className="font-semibold text-slate-700">Giá:</span> {r.priceLabel}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-700">Cấp độ:</span> {LEVEL_LABELS[r.level] || r.level}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-700">Video:</span> {r.videoCount}/{r.lessonCount} bài ·{" "}
            {formatDuration(r.durationMinutes)}
          </p>
          <p className="mt-1">
            <span className="font-semibold text-slate-700">Mua khóa:</span>{" "}
            {formatEnrollmentStats(course.stats)}
            <span className="mx-2 text-slate-300">·</span>
            <span className="font-semibold text-slate-700">Đánh giá:</span> {formatRatingStats(course.stats)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {isPublished && course.publishedAt
              ? `Xuất bản: ${formatDate(course.publishedAt)}`
              : `Cập nhật: ${formatDate(course.updatedAt)}`}
          </p>
        </div>
      </div>

      {!readOnly && course.pendingChanges?.length ? (
        <PendingChangesBanner changes={course.pendingChanges} />
      ) : null}

      <div className="space-y-4">
        <div>
          <p className="text-xs font-bold uppercase text-violet-700">Mô tả đầy đủ</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{r.description || "—"}</p>
        </div>

        {r.whatYoullLearn?.length ? (
          <div>
            <p className="text-xs font-bold uppercase text-violet-700">Học viên sẽ học được</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {r.whatYoullLearn.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <ChapterList chapters={r.chapters} defaultOpen allowVideoPreview />
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
        {canUnpublish && onArchive ? (
          <button
            type="button"
            disabled={busy}
            onClick={onArchive}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-bold uppercase text-amber-900 disabled:opacity-50"
          >
            <Archive className="h-4 w-4" />
            Gỡ marketplace
          </button>
        ) : null}
        {!readOnly ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={onReject}
              className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold uppercase text-red-800 disabled:opacity-50"
            >
              Từ chối
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onApprove}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-bold uppercase text-white disabled:opacity-50"
            >
              Duyệt & xuất bản
            </button>
          </>
        ) : null}
      </div>
    </AdminModal>
  );
}

function VideoCountCell({ review }) {
  const lessons = Number(review?.lessonCount || 0);
  const videos = Number(review?.videoCount || 0);
  const complete = lessons > 0 && videos >= lessons;
  return (
    <span
      className={`inline-flex items-center justify-center gap-1 font-black ${complete ? "text-emerald-700" : "text-amber-700"}`}
    >
      <Film className="h-3.5 w-3.5" />
      {videos}/{lessons}
    </span>
  );
}

function PublishedCoursesTable({ courses, loading, busyId, onPreview, onArchive, onStudentPreview }) {
  return (
    <div className={adminGlassTable}>
      <div className="max-w-full overflow-x-auto overscroll-x-contain">
        <table className="w-full min-w-0 table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-[22%]" />
            <col className="w-[16%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[12%]" />
            <col className="w-[16%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/90">
              <th className={adminThCell}>Khóa học</th>
              <th className={adminThCell}>Cố vấn</th>
              <th className={adminThCell}>Giá</th>
              <th className={`${adminThCell} text-center`}>Mua khóa</th>
              <th className={`${adminThCell} text-center`}>Đánh giá</th>
              <th className={`${adminThCell} text-center`}>Video</th>
              <th className={adminThCell}>Xuất bản</th>
              <th className={`${adminThCell} text-right`}>Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading ? (
              <tr>
                <td
                  colSpan={8}
                  className={`${adminTdCell} py-20 text-center text-[10px] font-black uppercase italic tracking-widest text-slate-500`}
                >
                  Đang tải…
                </td>
              </tr>
            ) : courses.length === 0 ? (
              <tr>
                <td colSpan={8} className={`${adminTdCell} py-16 text-center text-slate-500`}>
                  Không có khóa đã xuất bản.
                </td>
              </tr>
            ) : (
              courses.map((course) => {
                const r = course.review || {};
                return (
                  <tr key={course._id} className="hover:bg-violet-50/20">
                    <td className={adminTdCell}>
                      <p className="truncate font-semibold text-slate-900">{r.title || "—"}</p>
                      <p className="text-xs text-slate-500">
                        {r.chapterCount ?? 0} chương · {r.lessonCount ?? 0} bài
                      </p>
                    </td>
                    <td className={adminTdCell}>
                      <p className="truncate font-medium text-slate-800">{course.mentor?.name || "—"}</p>
                      <p className="truncate text-xs text-slate-500">{course.mentor?.email || ""}</p>
                    </td>
                    <td className={`${adminTdCell} font-black text-violet-700`}>{r.priceLabel || "—"}</td>
                    <td className={`${adminTdCell} text-center font-semibold text-slate-800`}>
                      {formatEnrollmentStats(course.stats)}
                    </td>
                    <td className={`${adminTdCell} text-center text-slate-700`}>
                      <span className="inline-flex items-center justify-center gap-0.5">
                        <Star className="h-3 w-3 text-amber-500" />
                        {formatRatingStats(course.stats)}
                      </span>
                    </td>
                    <td className={`${adminTdCell} text-center`}>
                      <VideoCountCell review={r} />
                    </td>
                    <td className={`${adminTdCell} whitespace-nowrap text-slate-600`}>
                      {formatDate(course.publishedAt || course.updatedAt)}
                    </td>
                    <td className={`${adminTdCell} text-right`}>
                      <div className="ml-auto flex justify-end gap-1">
                        {onStudentPreview ? (
                          <button
                            type="button"
                            onClick={() => onStudentPreview(course._id)}
                            className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                            aria-label="Xem trang học viên"
                            title="Xem trang marketplace (có nút quay lại admin)"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onPreview(course)}
                          className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-violet-50 hover:text-violet-700"
                          aria-label="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {onArchive ? (
                          <button
                            type="button"
                            disabled={busyId === course._id}
                            onClick={() => onArchive(course)}
                            className="flex size-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                            aria-label="Gỡ khỏi marketplace"
                            title="Gỡ khỏi marketplace"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PendingCoursesSection({
  courses,
  loading,
  busyId,
  onApprove,
  onReject,
  onPreview,
  showHeading = false,
  emptyMessage = "Không có khóa chờ duyệt",
}) {
  if (loading) {
    return (
      <p className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">Đang tải…</p>
    );
  }
  if (!courses.length) {
    if (!showHeading) {
      if (!emptyMessage) return null;
      return (
        <div className="glass-card border-slate-200/90 px-6 py-16 text-center [&:hover]:transform-none">
          <BookOpen className="mx-auto h-10 w-10 text-violet-300" />
          <p className="mt-3 font-semibold text-slate-800">{emptyMessage}</p>
        </div>
      );
    }
    return null;
  }
  return (
    <div className="space-y-4">
      {showHeading ? (
        <p className="text-[10px] font-black uppercase tracking-widest text-amber-800">Chờ duyệt</p>
      ) : null}
      {courses.map((course) => (
        <CourseReviewCard
          key={course._id}
          course={course}
          busy={busyId === course._id}
          onApprove={() => onApprove(course._id)}
          onReject={() => onReject(course)}
          onPreview={() => onPreview(course)}
        />
      ))}
    </div>
  );
}

export function AdminContentCourses() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [listView, setListView] = useState(() =>
    searchParams.get("view") === "incomplete" ? "incomplete" : "all",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [items, setItems] = useState([]);
  const [publishedItems, setPublishedItems] = useState([]);
  const [counts, setCounts] = useState({ total: 0, pendingReview: 0, pendingUpdate: 0 });
  const [publishedCount, setPublishedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [previewCourse, setPreviewCourse] = useState(null);
  const [rejectModal, setRejectModal] = useState({ open: false, course: null });
  const [archiveModal, setArchiveModal] = useState({ open: false, course: null });

  const goStudentPreview = useCallback(
    (courseId) => {
      markAdminCoursePreviewReturn("/admin/content/courses");
      navigate(`/courses/${courseId}?adminPreview=1`);
    },
    [navigate],
  );

  const filteredPending = useMemo(
    () => filterCoursesBySearch(items, searchTerm),
    [items, searchTerm],
  );
  const filteredPublished = useMemo(
    () => filterCoursesBySearch(publishedItems, searchTerm),
    [publishedItems, searchTerm],
  );
  const filteredPendingIncomplete = useMemo(
    () => filterCoursesBySearch(items.filter(isCourseVideoIncomplete), searchTerm),
    [items, searchTerm],
  );
  const filteredPublishedIncomplete = useMemo(
    () => filterCoursesBySearch(publishedItems.filter(isCourseVideoIncomplete), searchTerm),
    [publishedItems, searchTerm],
  );

  const publishedIncompleteCount = useMemo(
    () => publishedItems.filter(isCourseVideoIncomplete).length,
    [publishedItems],
  );

  const activeShown =
    listView === "published"
      ? filteredPublished.length
      : listView === "pending"
        ? filteredPending.length
        : listView === "incomplete"
          ? filteredPendingIncomplete.length + filteredPublishedIncomplete.length
          : filteredPending.length + filteredPublished.length;
  const activeTotal =
    listView === "published"
      ? publishedItems.length
      : listView === "pending"
        ? items.length
        : listView === "incomplete"
          ? items.filter(isCourseVideoIncomplete).length +
            publishedItems.filter(isCourseVideoIncomplete).length
          : items.length + publishedItems.length;

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [pendingRes, publishedRes, statsRes] = await Promise.all([
      tryApi(() => adminApi.getPendingCourses(), {
        fallback: "Không tải được khóa học chờ duyệt.",
        silent: true,
      }),
      tryApi(() => adminApi.getPublishedCourses(100), {
        fallback: "Không tải được khóa đã xuất bản.",
      }),
      tryApi(() => adminApi.getContentStats(), {
        fallback: "",
        silent: true,
      }),
    ]);
    if (pendingRes.success) {
      setItems(pendingRes.courses || []);
      setCounts(
        pendingRes.counts || {
          total: (pendingRes.courses || []).length,
          pendingReview: 0,
          pendingUpdate: 0,
        },
      );
    }
    if (publishedRes.success) {
      setPublishedItems(publishedRes.courses || []);
    }
    if (statsRes.success) {
      setPublishedCount(Number(statsRes.content?.publishedCourses ?? 0));
    } else if (publishedRes.success) {
      setPublishedCount((publishedRes.courses || []).length);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleApprove = async (id) => {
    if (!window.confirm("Duyệt khóa học này và xuất bản (hoặc áp dụng bản cập nhật)?")) return;
    setBusyId(id);
    const res = await tryApi(() => adminApi.approveCourse(id), {
      fallback: "Không duyệt được khóa học.",
      successMessage: "Đã duyệt khóa học.",
    });
    setBusyId("");
    if (res.success) {
      setPreviewCourse(null);
      await loadAll();
    }
  };

  const openRejectModal = (course) => {
    setRejectModal({ open: true, course });
  };

  const openArchiveModal = (course) => {
    setArchiveModal({ open: true, course });
  };

  const confirmReject = async (reason) => {
    const course = rejectModal.course;
    if (!course?._id) return;
    const isUpdate = course.status === "pending_update";
    setBusyId(course._id);
    const res = await tryApi(() => adminApi.rejectCourse(course._id, reason), {
      fallback: "Không từ chối được khóa học.",
      successMessage: isUpdate ? "Đã bỏ bản cập nhật." : "Đã từ chối, trả về nháp.",
    });
    setBusyId("");
    if (res.success) {
      setRejectModal({ open: false, course: null });
      setPreviewCourse(null);
      await loadAll();
    }
  };

  const confirmArchive = async (reason) => {
    const course = archiveModal.course;
    if (!course?._id) return;
    setBusyId(course._id);
    const res = await tryApi(() => adminApi.archiveCourse(course._id, reason), {
      fallback: "Không gỡ được khóa khỏi marketplace.",
      successMessage: "Đã gỡ khóa khỏi marketplace.",
    });
    setBusyId("");
    if (res.success) {
      setArchiveModal({ open: false, course: null });
      setPreviewCourse(null);
      await loadAll();
    }
  };

  return (
    <div className={adminPageWrap}>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={adminHeaderRow}>
        <div className="min-w-0 flex-1">
          <h2 className="font-headline text-3xl font-black uppercase tracking-tighter text-slate-900">
            <span className="text-violet-700">Khóa</span> học
          </h2>
        </div>
        <AdminPageToolbar
          loading={loading}
          onRefresh={() => void loadAll()}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Tìm khóa học, cố vấn…"
        />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={adminStatGrid3}>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-900">Chờ duyệt</p>
          <p className="mt-1 text-2xl font-black text-amber-950">{counts.total}</p>
          {counts.total > 0 ? (
            <p className="mt-1 text-sm font-semibold text-amber-900">
              {counts.pendingReview} khóa mới
              {counts.pendingUpdate > 0 ? ` · ${counts.pendingUpdate} cập nhật` : ""}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900">Đã xuất bản</p>
          <p className="mt-1 text-2xl font-black text-emerald-950">{publishedCount}</p>
        </div>
        <div className="rounded-2xl border border-orange-200 bg-orange-50/80 p-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-orange-900">Thiếu video (đã public)</p>
          <p className="mt-1 text-2xl font-black text-orange-950">{publishedIncompleteCount}</p>
        </div>
      </motion.div>

      <AdminListFilterBar
        countText={`Hiển thị ${activeShown} / ${activeTotal} khóa`}
        showReset={Boolean(searchTerm.trim()) || listView !== "all"}
        onReset={() => {
          setSearchTerm("");
          if (listView !== "all") setListView("all");
        }}
      >
        <AdminFilterSelect
          id="course-list-view"
          label="Danh sách"
          value={listView}
          options={LIST_OPTIONS}
          onChange={setListView}
        />
      </AdminListFilterBar>

      {listView === "all" ? (
        loading ? (
          <p className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">Đang tải…</p>
        ) : activeShown === 0 ? (
          <div className="glass-card border-slate-200/90 px-6 py-16 text-center [&:hover]:transform-none">
            <BookOpen className="mx-auto h-10 w-10 text-violet-300" />
            <p className="mt-3 font-semibold text-slate-800">Không có khóa</p>
          </div>
        ) : (
          <div className="space-y-8">
            <PendingCoursesSection
              courses={filteredPending}
              loading={false}
              busyId={busyId}
              onApprove={handleApprove}
              onReject={openRejectModal}
              onPreview={setPreviewCourse}
              showHeading
            />
            {filteredPublished.length > 0 ? (
              <div className="space-y-3">
                {filteredPending.length > 0 ? (
                  <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">
                    Đã xuất bản
                  </p>
                ) : null}
                <PublishedCoursesTable
                  courses={filteredPublished}
                  loading={false}
                  busyId={busyId}
                  onPreview={setPreviewCourse}
                  onArchive={openArchiveModal}
                  onStudentPreview={goStudentPreview}
                />
              </div>
            ) : null}
          </div>
        )
      ) : listView === "pending" ? (
        <PendingCoursesSection
          courses={filteredPending}
          loading={loading}
          busyId={busyId}
          onApprove={handleApprove}
          onReject={openRejectModal}
          onPreview={setPreviewCourse}
        />
      ) : listView === "incomplete" ? (
        loading ? (
          <p className="text-[10px] font-black uppercase italic tracking-widest text-slate-500">Đang tải…</p>
        ) : activeShown === 0 ? (
          <div className="glass-card border-slate-200/90 px-6 py-16 text-center [&:hover]:transform-none">
            <Film className="mx-auto h-10 w-10 text-emerald-400" />
            <p className="mt-3 font-semibold text-slate-800">Tất cả khóa đã có đủ link video bài học.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {filteredPendingIncomplete.length > 0 ? (
              <PendingCoursesSection
                courses={filteredPendingIncomplete}
                loading={false}
                busyId={busyId}
                onApprove={handleApprove}
                onReject={openRejectModal}
                onPreview={setPreviewCourse}
                showHeading
              />
            ) : null}
            {filteredPublishedIncomplete.length > 0 ? (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-800">
                  {filteredPendingIncomplete.length > 0 ? "Đã xuất bản, thiếu video" : "Khóa đã public, thiếu video"}
                </p>
                <PublishedCoursesTable
                  courses={filteredPublishedIncomplete}
                  loading={false}
                  busyId={busyId}
                  onPreview={setPreviewCourse}
                  onArchive={openArchiveModal}
                  onStudentPreview={goStudentPreview}
                />
              </div>
            ) : null}
          </div>
        )
      ) : (
        <PublishedCoursesTable
          courses={filteredPublished}
          loading={loading}
          busyId={busyId}
          onPreview={setPreviewCourse}
          onArchive={openArchiveModal}
          onStudentPreview={goStudentPreview}
        />
      )}

      {rejectModal.open && rejectModal.course ? (
        <CourseModerationModal
          mode="reject"
          course={rejectModal.course}
          busy={busyId === rejectModal.course._id}
          onClose={() => setRejectModal({ open: false, course: null })}
          onConfirm={confirmReject}
        />
      ) : null}

      {archiveModal.open && archiveModal.course ? (
        <CourseModerationModal
          mode="archive"
          course={archiveModal.course}
          busy={busyId === archiveModal.course._id}
          onClose={() => setArchiveModal({ open: false, course: null })}
          onConfirm={confirmArchive}
        />
      ) : null}

      {previewCourse ? (
        <CourseDetailModal
          course={previewCourse}
          busy={busyId === previewCourse._id}
          readOnly={previewCourse.status === "published"}
          onClose={() => setPreviewCourse(null)}
          onApprove={() => handleApprove(previewCourse._id)}
          onReject={() => openRejectModal(previewCourse)}
          onArchive={() => openArchiveModal(previewCourse)}
          onStudentPreview={goStudentPreview}
        />
      ) : null}
    </div>
  );
}
