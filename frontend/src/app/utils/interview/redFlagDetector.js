/**
 * redFlagDetector.js
 * Phát hiện các cụm từ "red flag" trong câu trả lời phỏng vấn — real-time coaching để
 * ứng viên tự điều chỉnh trước khi để lại ấn tượng xấu với nhà tuyển dụng thật.
 *
 * Module thuần (không phụ thuộc React/DOM) — dùng được ở bất kỳ nơi nào cần quét
 * transcript/text trong hệ thống (hiện tại: InterviewRoom.jsx real-time; lưu kết quả vào
 * InterviewSession.answers[].redFlags để hiện lại ở InterviewFeedback.jsx).
 *
 * Dùng substring/regex matching đơn giản theo đúng yêu cầu "trả lời trúng từ khóa" — không
 * phải phân tích sentiment/NLP. Giữ diacritics khi so khớp (không strip dấu như
 * competencyFramework.js bên backend) vì các cụm nhạy cảm cần độ chính xác cao hơn để
 * tránh false positive.
 */
import { BANNED_PATTERNS } from "./aiDialogue.js";

export const RED_FLAG_CATEGORIES = {
  badmouthing: {
    label: "Nói xấu công ty/sếp cũ",
    severity: "medium",
    // Cụm cố định — khớp trực tiếp, độ tin cậy cao nhất.
    keywords: [
      "sếp cũ tệ", "sếp cũ rất tệ", "sếp cũ rất tồi", "sếp cũ ngu", "sếp cũ vô lý",
      "sếp cũ thiên vị", "sếp cũ toxic",
      "công ty cũ tệ", "công ty cũ rất tệ", "công ty đó tệ", "công ty cũ vô lý",
      "công ty cũ bóc lột", "công ty cũ lừa đảo", "công ty cũ chả ra gì", "công ty cũ toxic",
      "ghét sếp cũ", "ghét công ty cũ", "ghét đồng nghiệp cũ",
      "đồng nghiệp cũ vô dụng", "môi trường độc hại", "công ty đó độc hại", "bóc lột nhân viên",
    ],
    // Co-occurrence: câu nói tự nhiên hiếm khi dùng đúng cụm cố định ở trên (vd thực tế: "...tôi
    // cảm thấy ghét... ghét sếp của mình" — không khớp "ghét sếp cũ" vì thiếu chữ "cũ" ở giữa).
    // Bắt bằng cách kết hợp 1 từ cảm xúc tiêu cực + 1 từ chỉ sếp/công ty/đồng nghiệp (cũ), xuất
    // hiện bất kỳ đâu trong câu trả lời — không cần liền kề. "xếp" thêm vào vì STT tiếng Việt hay
    // phiên âm "sếp" thành "xếp" (biến thể phát âm phổ biến).
    sentimentWords: [
      "ghét", "khó ưa", "khó chịu", "chán", "tệ", "tồi", "dở", "ức chế", "bực",
      "không thích", "ngán", "toxic", "độc hại", "vô lý", "thiên vị", "bóc lột",
      "lừa đảo", "vô dụng", "chả ra gì", "khó tính", "cay nghiệt",
    ],
    referentWords: [
      "sếp", "xếp", "quản lý cũ", "trưởng phòng cũ", "leader cũ",
      "công ty cũ", "công ty đó", "chỗ làm cũ", "nơi làm cũ", "đồng nghiệp cũ", "đồng nghiệp",
    ],
  },
  accountability: {
    label: "Đổ lỗi / thiếu trách nhiệm",
    severity: "medium",
    keywords: [
      "không phải lỗi của tôi", "không phải lỗi tôi", "không phải do tôi", "không phải tôi sai",
      "tôi không có lỗi", "đó là lỗi của sếp", "đó là lỗi của đồng nghiệp", "đó là lỗi của công ty",
      "lỗi của người khác", "lỗi của họ", "không phải trách nhiệm của tôi", "không liên quan đến tôi",
    ],
  },
  unprofessional: {
    label: "Ngôn từ không chuyên nghiệp / phân biệt đối xử",
    severity: "high",
    keywords: [
      "kỳ thị", "phân biệt chủng tộc", "phân biệt giới tính", "phân biệt tôn giáo",
      "phân biệt vùng miền", "phân biệt đối xử", "phân biệt người",
    ],
  },
};

function normalize(text) {
  return ` ${text.toLowerCase().replace(/\s+/g, " ").trim()} `;
}

/**
 * Quét text, trả về danh sách các red flag khớp (có thể trùng categoryId nếu nhiều từ khóa
 * cùng loại khớp — caller tự khử trùng lặp qua redFlagKey() nếu cần).
 * @param {string} text
 * @returns {Array<{categoryId: string, label: string, severity: "medium"|"high", matchedKeyword: string}>}
 */
export function detectRedFlags(text) {
  if (!text || !text.trim()) return [];
  const normalized = normalize(text);
  const matches = [];

  for (const [categoryId, cfg] of Object.entries(RED_FLAG_CATEGORIES)) {
    let hitInCategory = false;
    for (const keyword of cfg.keywords) {
      if (normalized.includes(keyword)) {
        matches.push({ categoryId, label: cfg.label, severity: cfg.severity, matchedKeyword: keyword });
        hitInCategory = true;
      }
    }

    // Co-occurrence fallback (nếu category có khai báo) — chỉ chạy khi chưa khớp cụm cố định
    // nào ở trên, tránh bắn 2 toast cho cùng 1 lý do.
    if (!hitInCategory && cfg.sentimentWords && cfg.referentWords) {
      const sentimentHit = cfg.sentimentWords.find((w) => normalized.includes(w));
      const referentHit  = cfg.referentWords.find((w) => normalized.includes(w));
      if (sentimentHit && referentHit) {
        matches.push({
          categoryId, label: cfg.label, severity: cfg.severity,
          matchedKeyword: `${referentHit} + ${sentimentHit}`,
        });
      }
    }
  }

  // Ngôn từ tục tĩu — dùng chung BANNED_PATTERNS với aiDialogue.js (mascot chatbot), tránh
  // duy trì 2 danh sách từ cấm song song trong codebase.
  for (const pattern of BANNED_PATTERNS) {
    const m = text.match(pattern);
    if (m) {
      matches.push({
        categoryId:     "unprofessional",
        label:          RED_FLAG_CATEGORIES.unprofessional.label,
        severity:       "high",
        matchedKeyword: m[0],
      });
    }
  }

  return matches;
}

/** Key để khử trùng lặp giữa các lần detect liên tiếp (tránh cảnh báo lặp lại cùng 1 cụm). */
export function redFlagKey(flag) {
  return `${flag.categoryId}::${flag.matchedKeyword}`;
}
