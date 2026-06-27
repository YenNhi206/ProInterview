import { useState } from "react";
import {
  BookOpen,
  Image as ImageIcon,
  Layers,
  Plus,
  Trash2,
  Upload,
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
    <div className="mb-3 flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-violet-100 text-violet-700">
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="text-lg font-bold text-slate-900 sm:text-base">{title}</h2>
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
    <li className="py-3.5 first:pt-0 last:pb-0">
      <div className="flex gap-3">
        <span className="mt-2.5 w-5 shrink-0 text-center text-sm font-bold text-violet-600 sm:text-xs">
          {lessonIdx + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            value={lesson.title}
            onChange={(e) => updateLessonTitle(chapterId, lesson.id, e.target.value)}
            className={mentorInputClass}
            placeholder={`Bài ${lessonIdx + 1}: Tên bài học`}
          />

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <label
              className={`inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-[8px] border px-3 py-1.5 text-sm font-semibold transition sm:text-xs ${
                hasVideo
                  ? "border-slate-200 bg-white text-slate-700 hover:border-violet-300"
                  : "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
              }`}
            >
              <Upload className="h-3.5 w-3.5" />
              {hasVideo ? "Đổi video" : "Chọn video"}
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

            <p className="min-w-0 flex-1 truncate text-sm text-slate-500 sm:text-xs">
              {hasVideo ? (
                <>
                  <span className="font-medium text-slate-700">{lesson.videoFileName}</span>
                  <span className="text-slate-400"> · </span>
                  <span className="text-emerald-700">
                    {formatLessonDurationMinutes(lesson.duration)}
                  </span>
                </>
              ) : (
                "MP4, MOV, WEBM, tối đa 2GB"
              )}
            </p>

            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600 sm:ml-auto sm:text-xs">
              <input
                type="checkbox"
                checked={Boolean(lesson.isPreview)}
                onChange={() => toggleLessonPreview(chapterId, lesson.id)}
                className={mentorCheckboxClass}
              />
              Cho học viên xem thử
            </label>
          </div>
        </div>

        <button
          type="button"
          onClick={() => removeLesson(chapterId, lesson.id)}
          className="mt-1 shrink-0 rounded-[8px] p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
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
    <div className="space-y-5">
      <section className={mentorSectionCardClass}>
        <SectionHeader icon={Layers} title="Chương & bài học" />

        {chapters.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
            <BookOpen className="mx-auto mb-3 h-10 w-10 text-violet-300" />
            <p className="text-base text-slate-600 sm:text-sm">Thêm chương đầu tiên, rồi upload video cho từng bài.</p>
            <button type="button" onClick={addChapter} className={`${mentorPrimaryBtnClass} mt-4`}>
              <Plus className="h-4 w-4" />
              Thêm chương
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {chapters.map((chapter, chapterIdx) => (
              <div
                key={chapter.id}
                className="overflow-hidden rounded-[10px] border border-slate-200 bg-white"
              >
                <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2.5 sm:px-4">
                  <span className="text-sm font-bold uppercase tracking-wide text-violet-700 sm:text-xs">
                    Chương {chapterIdx + 1}
                  </span>
                  <input
                    value={chapter.title}
                    onChange={(e) => updateChapterTitle(chapter.id, e.target.value)}
                    className={`${mentorInputClass} min-w-0 flex-1 border-slate-200 bg-white py-2`}
                    placeholder="Tên chương"
                  />
                  <button
                    type="button"
                    onClick={() => removeChapter(chapter.id)}
                    className="shrink-0 px-2 py-1 text-sm font-medium text-slate-500 hover:text-red-600 sm:text-xs"
                  >
                    Xóa
                  </button>
                </div>

                <ul className="divide-y divide-slate-100 px-3 sm:px-4">
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

                <div className="border-t border-slate-100 px-3 py-2 sm:px-4">
                  <button
                    type="button"
                    onClick={() => addLessonToChapter(chapter.id)}
                    className="flex w-full items-center justify-center gap-1.5 py-2 text-base font-medium text-violet-700 hover:text-violet-900 sm:text-sm"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm bài học
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addChapter}
              className={`${mentorGhostBtnClass} w-full justify-center border-dashed py-3`}
            >
              <Plus className="h-4 w-4" />
              Thêm chương
            </button>
          </div>
        )}
      </section>

      <section className={mentorSectionCardClass}>
        <SectionHeader icon={ImageIcon} title="Ảnh bìa khóa học" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {thumbnailUrl ? (
            <img
              src={mediaSrc(thumbnailUrl)}
              alt="Ảnh bìa"
              className="h-28 w-44 shrink-0 rounded-[10px] border border-slate-200 object-cover"
            />
          ) : null}
          <div className="flex-1 rounded-[10px] border border-dashed border-slate-300 bg-white p-4">
            <label className={`${mentorPrimaryBtnClass} cursor-pointer`}>
              {uploadingThumb ? "Đang tải…" : "Chọn ảnh"}
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
            <p className="mt-2 text-sm text-slate-500 sm:text-xs">
              {thumbnailFileName || "PNG, JPG, WEBP, tối đa 5MB"}
            </p>
          </div>
        </div>
      </section>

      {warn && !canContinue ? (
        <p
          className={`rounded-[10px] border px-4 py-2 text-base sm:text-sm ${
            shake ? mentorValidationShakeClass : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
          role="alert"
        >
          Cần ít nhất 1 bài học và 1 video đã upload.
        </p>
      ) : null}

      <CourseCreateFooter onPrimary={handleNext} />
    </div>
  );
}
