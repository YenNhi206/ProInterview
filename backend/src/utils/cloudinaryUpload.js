import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

function isConfigured() {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

let _configured = false;
function ensureConfig() {
  if (_configured) return;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure:     true,
  });
  _configured = true;
}

/**
 * Upload file lên Cloudinary từ disk path hoặc Buffer.
 * Trả { url, publicId } khi thành công, null khi chưa cấu hình.
 * Ném lỗi khi Cloudinary trả lỗi thật (để caller quyết định fallback).
 *
 * @param {string|Buffer} source - path trên disk hoặc Buffer
 * @param {object} options - cloudinary upload options (folder, resource_type, transformation...)
 */
export async function uploadToCloudinary(source, options = {}) {
  if (!isConfigured()) return null;
  ensureConfig();

  return new Promise((resolve, reject) => {
    if (typeof source === "string") {
      cloudinary.uploader.upload(source, options, (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, publicId: result.public_id });
      });
    } else {
      const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
        if (err) return reject(err);
        resolve({ url: result.secure_url, publicId: result.public_id });
      });
      stream.end(source);
    }
  });
}

/** Xóa file local sau khi upload CDN thành công. Silent fail. */
export function deleteLocalFile(filepath) {
  try { fs.unlinkSync(filepath); } catch (_) {}
}

/**
 * Liệt kê toàn bộ resource trong 1 folder Cloudinary (tự động phân trang qua next_cursor).
 * @param {string} folder - vd: "prointerview/tts-audio"
 * @param {string} [resourceType="video"] - "image" | "video" | "raw" (audio upload dùng "video")
 * @returns {Promise<Array<{public_id: string, created_at: string}>>}
 */
export async function listResourcesInFolder(folder, resourceType = "video") {
  if (!isConfigured()) return [];
  ensureConfig();

  const all = [];
  let nextCursor;
  do {
    const result = await cloudinary.api.resources({
      type:          "upload",
      resource_type: resourceType,
      prefix:        folder,
      max_results:   500,
      next_cursor:   nextCursor,
    });
    all.push(...(result.resources ?? []));
    nextCursor = result.next_cursor;
  } while (nextCursor);

  return all;
}

/**
 * Xóa nhiều resource Cloudinary theo public_id (batch tối đa 100/lần — tự chia batch).
 * @param {string[]} publicIds
 * @param {string} [resourceType="video"]
 */
export async function deleteCloudinaryResources(publicIds, resourceType = "video") {
  if (!isConfigured() || publicIds.length === 0) return;
  ensureConfig();

  for (let i = 0; i < publicIds.length; i += 100) {
    const batch = publicIds.slice(i, i + 100);
    await cloudinary.api.delete_resources(batch, { resource_type: resourceType });
  }
}

/**
 * Tạo chữ ký Cloudinary cho direct upload từ browser.
 * paramsToSign phải chứa tất cả params sẽ gửi lên (trừ file, api_key, resource_type, cloud_name).
 * Ít nhất cần: { folder, timestamp }.
 */
export function generateUploadSignature(paramsToSign) {
  if (!isConfigured()) return null;
  ensureConfig();
  return cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);
}

export { isConfigured as isCloudinaryConfigured };
