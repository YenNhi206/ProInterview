const DRIVE_ID_PATTERNS = [/\/file\/d\/([-\w]{10,})/, /[?&]id=([-\w]{10,})/, /\/d\/([-\w]{10,})/];

export function extractGoogleDriveFileId(url) {
  const str = String(url || "").trim();
  for (const re of DRIVE_ID_PATTERNS) {
    const m = str.match(re);
    if (m?.[1]) return m[1];
  }
  return null;
}

function extractConfirmToken(html) {
  const m = String(html).match(/confirm=([0-9A-Za-z_-]+)/);
  return m?.[1] || null;
}

/**
 * Tải file PDF public từ Google Drive share link (yêu cầu chia sẻ "Bất kỳ ai có link").
 * Trả { buffer, fileId }. Ném lỗi nếu không truy cập được / không phải PDF.
 */
export async function downloadGoogleDriveFile(shareUrl) {
  const fileId = extractGoogleDriveFileId(shareUrl);
  if (!fileId) {
    throw new Error("Không nhận diện được ID file từ link Google Drive.");
  }

  const baseUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
  let res = await fetch(baseUrl);
  let buffer = Buffer.from(await res.arrayBuffer());
  let contentType = res.headers.get("content-type") || "";

  // File lớn hoặc Drive không quét virus được → trả trang HTML xác nhận, cần retry kèm confirm token
  if (contentType.includes("text/html")) {
    const token = extractConfirmToken(buffer.toString("utf-8"));
    if (token) {
      res = await fetch(`https://drive.google.com/uc?export=download&confirm=${token}&id=${fileId}`);
      buffer = Buffer.from(await res.arrayBuffer());
      contentType = res.headers.get("content-type") || "";
    }
  }

  // "%PDF" không luôn nằm đúng byte 0 — 1 số công cụ xuất PDF (vd. TopCV.vn) chèn byte rác/dòng trắng
  // trước signature, vẫn hợp lệ theo chuẩn PDF. Quét trong 1KB đầu thay vì so khớp cứng 4 byte đầu.
  const isPdf = contentType.includes("application/pdf") || buffer.subarray(0, 1024).toString("latin1").includes("%PDF");
  if (!isPdf) {
    throw new Error(
      'Không tải được PDF từ link Google Drive — kiểm tra quyền chia sẻ đã đặt "Bất kỳ ai có link" và file đúng định dạng PDF.',
    );
  }

  return { buffer, fileId };
}
