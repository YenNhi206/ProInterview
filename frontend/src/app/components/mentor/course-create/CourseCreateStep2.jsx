import { useState } from "react";
import {
  BookOpen,
  Image as ImageIcon,
  Layers,
  Plus,
  Trash2,
  Upload,
  Video,
  Clock,
  Sparkles,
} from "lucide-react";
import { formatLessonDurationMinutes } from "../../../utils/shared/videoDuration.js";
import { uploadFile } from "../../../api/uploadApi.js";
import { mediaSrc } from "../../../utils/shared/mediaUrl.js";
import { toastApiError, toastApiSuccess } from "../../../utils/shared/apiToast.js";
import { CourseCreateFooter } from "./CourseCreateStep1";
import {
  mentorCheckboxClass,
  mentorGhostBtnClass,
  mentorInputClass,
  mentorPrimaryBtnClass,
  mentorSectionCardClass,
  mentorValidationShakeClass,
} from "./mentorCourseCreateTheme";

function SectionHeader({ icon: Icon, title }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#93f72b]/15 text-[#93f72b]">
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="text-base font-bold text-white tracking-tight">{title}</h2>
    </div>
  );
}

function LessonRow({
  lesson,
  lessonIdx,
  chapterId,
  updateLessonTitle,
  updateLessonVideo,
  toggleLessonPreview,
  removeLesson,
}) {
  const hasVideo = Boolean(lesson.videoFileName);

  return (
    <li className="py-4 first:pt-0 last:pb-0">
      <div className="flex gap-3">
        <span className="mt-2.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs font-bold text-[#93f72b]">
          {lessonIdx + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <input
            value={lesson.title}
            onChange={(e) => updateLessonTitle(chapterId, lesson.id, e.target.value)}
            className={mentorInputClass}
            placeholder={`Bài ${lessonIdx + 1}: Tên bài học`}
          />

          <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
            <label
              className={`inline-flex w-fit cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition ${
                hasVideo
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  : "border-[#93f72b]/40 bg-[#93f72b]/10 text-[#93f72b] hover:bg-[#93f72b]/20"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              {hasVideo ? "Đổi video" : "Tải video lên"}
              <input
                type="file"
                accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) updateLessonVideo(chapterId, lesson.id, file);
                  e.target.value = "";
                }}
              />
            </label>

            <div className="min-w-0 flex-1 truncate text-xs text-slate-400">
              {hasVideo ? (
                <div className="flex items-center gap-2 truncate">
                  <span className="truncate font-medium text-slate-200">{lesson.videoFileName}</span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    <Clock size={11} /> {formatLessonDurationMinutes(lesson.duration)}
                  </span>
                </div>
              ) : (
                <span className="text-slate-500">Định dạng hỗ trợ: MP4, MOV, WEBM (tối đa 2GB)</span>
              )}
            </div>

            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-300 sm:ml-auto">
              <input
                type="checkbox"
                checked={Boolean(lesson.isPreview)}
                onChange={() => toggleLessonPreview(chapterId, lesson.id)}
                className={mentorCheckboxClass}
              />
              Cho xem thử miễn phí
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={() => removeLesson(chapterId, lesson.id)}
          className="mt-1 shrink-0 rounded-xl p-2 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-400"
          aria-label="Xóa bài học"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}

export function CourseCreateStep2({
  chapters,
  addChapter,
  removeChapter,
  updateChapterTitle,
  addLessonToChapter,
  updateLessonTitle,
  toggleLessonPreview,
  removeLesson,
  updateLessonVideo,
  thumbnailUrl,
  thumbnailFileName,
  onThumbnailUploaded,
  canContinue,
  onNext,
}) {
  const [warn, setWarn] = useState(false);
  const [shake, setShake] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);

  const handleNext = () => {
    if (!canContinue) {
      setWarn(true);
      setShake(true);
      window.setTimeout(() => setShake(false), 520);
      return;
    }
    onNext();
  };

  const handleThumbnail = async (file) => {
    if (!file) return;
    setUploadingThumb(true);
    try {
      const res = await uploadFile(file, "course-thumbnail");
      if (res.success) {
        onThumbnailUploaded(res.url, file.name);
        toastApiSuccess("Đã upload ảnh bìa!");
      } else {
        toastApiError(res.error, "Upload ảnh thất bại.");
      }
    } catch {
      toastApiError("Lỗi kết nối khi upload ảnh bìa.");
    } finally {
      setUploadingThumb(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className={mentorSectionCardClass}>
        <SectionHeader icon={Layers} title="Cấu trúc chương & Video bài giảng" />

        {chapters.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/[0.02] px-4 py-12 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-[#93f72b]/60" />
            <p className="text-sm font-semibold text-slate-300">Khóa học chưa có chương nào.</p>
            <p className="mt-1 text-xs text-slate-500">Tạo chương học đầu tiên, sau đó tải video bài giảng lên từng bài.</p>
            <button type="button" onClick={addChapter} className={`${mentorPrimaryBtnClass} mt-5`}>
              <Plus className="h-4 w-4" />
              Thêm chương mới
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {chapters.map((chapter, chapterIdx) => (
              <div
                key={chapter.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-[#120a20]"
              >
                <div className="flex items-center gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#93f72b]">
                    Chương {chapterIdx + 1}
                  </span>
                  <input
                    value={chapter.title}
                    onChange={(e) => updateChapterTitle(chapter.id, e.target.value)}
                    className={`${mentorInputClass} min-w-0 flex-1 py-1.5 text-sm font-semibold`}
                    placeholder="Tên chương học"
                  />
                  <button
                    type="button"
                    onClick={() => removeChapter(chapter.id)}
                    className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-400"
                  >
                    Xóa chương
                  </button>
                </div>

                <ul className="divide-y divide-white/5 px-4">
                  {chapter.lessons.map((lesson, lessonIdx) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      lessonIdx={lessonIdx}
                      chapterId={chapter.id}
                      updateLessonTitle={updateLessonTitle}
                      updateLessonVideo={updateLessonVideo}
                      toggleLessonPreview={toggleLessonPreview}
                      removeLesson={removeLesson}
                    />
                  ))}
                </ul>

                <div className="border-t border-white/5 bg-white/[0.01] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => addLessonToChapter(chapter.id)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-2.5 text-xs font-bold uppercase tracking-wider text-[#93f72b] transition hover:border-[#93f72b]/50 hover:bg-[#93f72b]/10"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm bài học vào chương
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addChapter}
              className={`${mentorGhostBtnClass} w-full justify-center border-dashed py-3.5 text-xs font-bold uppercase tracking-wider`}
            >
              <Plus className="h-4 w-4" />
              Thêm chương mới
            </button>
          </div>
        )}
      </section>

      <section className={mentorSectionCardClass}>
        <SectionHeader icon={ImageIcon} title="Ảnh bìa khóa học (Thumbnail)" />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          {thumbnailUrl ? (
            <div className="relative group/thumb shrink-0">
              <img
                src={mediaSrc(thumbnailUrl)}
                alt="Ảnh bìa khóa học"
                className="h-32 w-52 rounded-xl border border-white/15 object-cover shadow-lg"
              />
              <span className="absolute bottom-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                Ảnh hiện tại
              </span>
            </div>
          ) : null}
          <div className="flex-1 rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-5 text-center sm:text-left">
            <label className={`${mentorPrimaryBtnClass} cursor-pointer`}>
              {uploadingThumb ? "Đang tải ảnh lên…" : "Chọn ảnh bìa từ máy"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={uploadingThumb}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleThumbnail(file);
                }}
              />
            </label>
            <p className="mt-3 text-xs text-slate-400">
              {thumbnailFileName || "Định dạng hỗ trợ: PNG, JPG, WEBP (khuyên dùng tỷ lệ 16:9, tối đa 5MB)"}
            </p>
          </div>
        </div>
      </section>

      {warn && !canContinue ? (
        <div
          className={`rounded-xl border px-5 py-3.5 text-sm ${
            shake ? mentorValidationShakeClass : "border-amber-500/40 bg-amber-950/40 text-amber-200"
          }`}
          role="alert"
        >
          <p className="flex items-center gap-2 font-bold text-amber-300">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
            Yêu cầu nội dung tối thiểu: Cần có ít nhất 1 bài học và 1 video bài giảng đã tải lên.
          </p>
        </div>
      ) : null}

      <CourseCreateFooter onPrimary={handleNext} primaryLabel="Tiếp theo: Xem lại & Gửi duyệt" />
    </div>
  );
}
