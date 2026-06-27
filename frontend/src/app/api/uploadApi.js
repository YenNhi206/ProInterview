import { authFetch } from "../utils/auth/auth.js";

const DIRECT_UPLOAD_THRESHOLD_BYTES = 50 * 1024 * 1024; // 50MB

/** File video > 50MB thì upload thẳng lên Cloudinary thay vì qua backend (tránh timeout Render). */
export function shouldUseDirectUpload(file) {
  return file.size > DIRECT_UPLOAD_THRESHOLD_BYTES;
}

/**
 * Upload video khóa học trực tiếp lên Cloudinary (bỏ qua backend server).
 * Dùng cho file > 50MB để tránh timeout Render.
 * @param {File} file
 * @param {(percent: number) => void} [onProgress] - callback tiến trình 0–100
 */
export async function uploadVideoDirectly(file, onProgress) {
  // 1. Lấy chữ ký từ backend (request nhỏ, không có file)
  const signRes = await authFetch("/api/upload/sign-video", { method: "POST" });
  const signBody = await signRes.json().catch(() => ({}));
  if (!signRes.ok || !signBody.success) {
    return { success: false, error: signBody.error || "Không lấy được chữ ký upload." };
  }
  const { signature, timestamp, apiKey, cloudName, folder } = signBody;

  // 2. Upload thẳng lên Cloudinary (không qua Render server)
  return new Promise((resolve) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", apiKey);
    formData.append("timestamp", String(timestamp));
    formData.append("signature", signature);
    formData.append("folder", folder);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`);

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status === 200 && data.secure_url) {
          resolve({ success: true, url: data.secure_url, fileName: file.name });
        } else {
          resolve({ success: false, error: data.error?.message || "Upload Cloudinary thất bại." });
        }
      } catch {
        resolve({ success: false, error: "Phản hồi Cloudinary không hợp lệ." });
      }
    };
    xhr.onerror = () => resolve({ success: false, error: "Lỗi kết nối khi upload lên Cloudinary." });
    xhr.send(formData);
  });
}

/**
 * Upload một file lên backend.
 * @param {File} file - Đối tượng File từ input.
 * @param {'avatar' | 'cv' | 'jd' | 'course-thumbnail' | 'course-video' | 'meeting-checkin'} type - Loại upload.
 */
export async function uploadFile(file, type) {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await authFetch(`/api/upload/${type}`, {
      method: "POST",
      body: formData,
      // Lưu ý: Không set Content-Type header khi dùng FormData, trình duyệt sẽ tự set kèm boundary
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: body.error || `Lỗi ${res.status}` };
    }

    return {
      success: true,
      url: body.url,
      fileId: body.fileId,
      fileName: body.fileName || file.name,
    };
  } catch (err) {
    console.error("Upload error:", err);
    return { success: false, error: "Không kết nối được backend để upload." };
  }
}
