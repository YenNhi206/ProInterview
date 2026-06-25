const LOCAL_BACKEND = /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?/i;
const ALLOWED_MEDIA_HOSTS = new Set(["res.cloudinary.com"]);

function publicBase() {
  return (process.env.BACKEND_URL || "").replace(/\/$/, "");
}

/**
 * Chỉ cho phép URL trỏ tới file đã upload thật qua hệ thống (local /uploads hoặc
 * Cloudinary) — chặn mentor dán link ảnh/video ngoài (hotlink) vào nội dung khóa học.
 * Rỗng luôn hợp lệ (field optional).
 */
export function isAllowedMediaUrl(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return true;
  if (raw.startsWith("/uploads/")) return true;
  try {
    const u = new URL(raw);
    if (u.pathname.startsWith("/uploads/")) return true;
    return ALLOWED_MEDIA_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

/** Lưu MongoDB dạng `/uploads/...` — tránh gắn cứng host/port. */
export function normalizeUploadPathForStorage(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";

  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      const u = new URL(raw);
      path = u.pathname || raw;
    } catch {
      const idx = raw.indexOf("/uploads/");
      path = idx >= 0 ? raw.slice(idx) : raw;
    }
  }

  if (path.startsWith("/uploads/")) return path;
  if (path.startsWith("uploads/")) return `/${path}`;
  if (/\.(png|jpe?g|gif|webp|mov|mp4)$/i.test(path) || path.startsWith("file-")) {
    return `/uploads/${path.replace(/^\/+/, "")}`;
  }
  return raw;
}

/**
 * Chuẩn hóa đường dẫn upload lưu trong MongoDB → URL đầy đủ tới backend hiện tại.
 * - `file-xxx.png` → `https://api.../uploads/file-xxx.png`
 * - `http://localhost:5000/uploads/...` → BACKEND_URL (prod)
 */
export function resolveStoredUploadUrl(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";

  if (/^https?:\/\//i.test(raw)) {
    const uploadsIdx = raw.indexOf("/uploads/");
    if (uploadsIdx >= 0) {
      const rel = raw.slice(uploadsIdx);
      const base = publicBase();
      if (base) return `${base}${rel}`;
      return rel;
    }
    const base = publicBase();
    if (base && LOCAL_BACKEND.test(raw)) {
      return raw.replace(LOCAL_BACKEND, base);
    }
    return raw;
  }

  const rel = raw.startsWith("/uploads/")
    ? raw
    : `/uploads/${raw.replace(/^uploads\//, "").replace(/^\/+/, "")}`;
  const port = Number(process.env.PORT) || 5000;
  const base =
    publicBase() || (process.env.NODE_ENV !== "production" ? `http://127.0.0.1:${port}` : "");
  return base ? `${base}${rel}` : rel;
}

export function serializeCourseForApi(course) {
  if (!course) return course;
  const doc = course.toObject ? course.toObject({ getters: true }) : { ...course };
  if (doc.thumbnail) doc.thumbnail = resolveStoredUploadUrl(doc.thumbnail);
  if (Array.isArray(doc.modules)) {
    doc.modules = doc.modules.map((mod) => ({
      ...mod,
      lessons: (mod.lessons || []).map((lesson) => ({
        ...lesson,
        videoUrl: lesson.videoUrl ? resolveStoredUploadUrl(lesson.videoUrl) : lesson.videoUrl,
        documentUrl: lesson.documentUrl ? resolveStoredUploadUrl(lesson.documentUrl) : lesson.documentUrl,
      })),
    }));
  }
  const uid = doc.mentorId?.userId;
  if (uid && typeof uid === "object" && uid.avatar) {
    uid.avatar = resolveStoredUploadUrl(uid.avatar);
  }
  if (doc.mentorId && typeof doc.mentorId === "object" && doc.mentorId.avatar) {
    doc.mentorId.avatar = resolveStoredUploadUrl(doc.mentorId.avatar);
  }
  return doc;
}
