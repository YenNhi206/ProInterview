import path from "node:path";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import { Payment } from "../models/Payment.js";
import { Booking } from "../models/Booking.js";
import { Enrollment } from "../models/Enrollment.js";
import { Course } from "../models/Course.js";
import { Mentor } from "../models/Mentor.js";
import { User } from "../models/User.js";
import { planKeyFromSubscriptionMeta } from "../utils/planKeys.js";
import { vnMoneyInWords } from "../utils/vnMoneyWords.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** pdfkit dùng Standard 14 fonts (WinAnsi) không hiển thị đúng dấu tiếng Việt — nhúng DejaVu Sans (full Unicode). */
const FONT_REGULAR_PATH = path.join(__dirname, "../assets/fonts/DejaVuSans.ttf");
const FONT_BOLD_PATH = path.join(__dirname, "../assets/fonts/DejaVuSans-Bold.ttf");
/** Logo chữ ProInterview màu tím, nền trong suốt (bản sao frontend/public/Logo.png; backend deploy riêng). */
const LOGO_PATH = path.join(__dirname, "../assets/brand/logo.png");

const SESSION_TYPE_LABELS = {
  mock_interview: "Phỏng vấn thử",
  cv_review: "Review CV",
  career_consulting: "Tư vấn định hướng",
  custom: "Buổi tư vấn",
};

const PLAN_LABELS = {
  free: "Free",
  starter_pro: "Pro",
  elite_pro: "Elite",
};

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function vnDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("vi-VN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

async function loadReferenceDescription(payment) {
  const t = payment.type;
  if (t === "booking") {
    const booking = await Booking.findById(payment.referenceId).lean();
    if (!booking) return { description: "Buổi mentor", subtotal: payment.amount, vat: 0 };
    const mentor = await Mentor.findById(booking.mentorId).select("name").lean();
    const label = SESSION_TYPE_LABELS[booking.sessionType] || "Buổi mentor";
    const description = `${label} với ${mentor?.name || "mentor"} — ${booking.date} ${booking.timeSlot}`;
    const total = Math.round(Number(booking.totalAmount ?? payment.amount) || 0);
    const vat = Math.round(Number(booking.vat) || 0);
    return { description, subtotal: total - vat, vat };
  }
  if (t === "course") {
    const enrollment = await Enrollment.findById(payment.referenceId).select("courseId").lean();
    const course = enrollment ? await Course.findById(enrollment.courseId).select("title").lean() : null;
    const description = `Khóa học — ${course?.title || "Khóa học"}`;
    return { description, subtotal: payment.amount, vat: 0 };
  }
  if (t === "subscription") {
    const plan = planKeyFromSubscriptionMeta(payment.providerResponse?.plan) || "starter_pro";
    const billing = payment.providerResponse?.billing === "yearly" ? "Hàng năm" : "Hàng tháng";
    const description = `Gói ${PLAN_LABELS[plan] || plan} (${billing})`;
    return { description, subtotal: payment.amount, vat: 0 };
  }
  return { description: "Giao dịch", subtotal: payment.amount, vat: 0 };
}

/**
 * Tìm payment + xác thực quyền xem hóa đơn, trả về context đủ để render PDF.
 * Chỉ giao dịch `status: "success"` mới có hóa đơn.
 */
export async function resolveInvoiceContext({
  paymentId,
  type,
  referenceId,
  requesterUserId,
  requesterIsAdmin,
}) {
  if (!isMongoReady()) return { ok: false, status: 503, error: "MongoDB chưa kết nối." };

  let payment;
  if (paymentId) {
    if (!mongoose.isValidObjectId(paymentId)) return { ok: false, status: 400, error: "paymentId không hợp lệ." };
    payment = await Payment.findById(paymentId).lean();
  } else {
    if (!mongoose.isValidObjectId(referenceId)) return { ok: false, status: 400, error: "id không hợp lệ." };
    payment = await Payment.findOne({ type, referenceId, status: "success" })
      .sort({ paidAt: -1, createdAt: -1 })
      .lean();
  }

  if (!payment) return { ok: false, status: 404, error: "Không tìm thấy giao dịch." };
  if (payment.status !== "success") {
    return { ok: false, status: 400, error: "Giao dịch chưa thanh toán thành công." };
  }
  if (!requesterIsAdmin && String(payment.userId) !== String(requesterUserId)) {
    return { ok: false, status: 403, error: "Bạn không có quyền xem hóa đơn này." };
  }

  if (payment.invoiceSnapshot) return { ok: true, payment, ...payment.invoiceSnapshot };

  const buyerUser = await User.findById(payment.userId).select("name email").lean();
  const buyer = {
    name: payment.invoiceName || buyerUser?.name || "",
    email: payment.invoiceEmail || buyerUser?.email || "",
    address: payment.invoiceAddress || "",
  };

  const { description, subtotal, vat } = await loadReferenceDescription(payment);
  const total = Math.round(Number(payment.amount) || 0);

  const context = {
    buyer,
    description,
    subtotal: Math.max(0, subtotal),
    vat: Math.max(0, vat),
    total,
    paidAt: payment.paidAt || payment.createdAt,
  };
  const saved = await Payment.findOneAndUpdate({ _id: payment._id, invoiceSnapshot: null },
    { $set: { invoiceSnapshot: context } }, { returnDocument: "after" }).lean();
  const snapshot = saved?.invoiceSnapshot || (await Payment.findById(payment._id).select("invoiceSnapshot").lean())?.invoiceSnapshot || context;
  return { ok: true, payment, ...snapshot };
}

const SELLER_NAME = process.env.INVOICE_SELLER_NAME || "ProInterview";
const SELLER_ADDRESS = process.env.INVOICE_SELLER_ADDRESS || "";
const SELLER_EMAIL = process.env.INVOICE_SELLER_EMAIL || "prointerview.ai@gmail.com";
const SELLER_WEBSITE = process.env.INVOICE_SELLER_WEBSITE || "www.prointerviewvn.com";

function invoiceNumberFor(payment) {
  return `INV-${String(payment._id).toUpperCase()}`;
}

const PROVIDER_LABELS = {
  momo: "MoMo",
  zalopay: "ZaloPay",
  vnpay: "VNPay",
  card: "Thẻ",
  transfer: "Chuyển khoản ngân hàng",
};

function vnd(n) {
  return `${Math.round(Number(n || 0)).toLocaleString("vi-VN")} VND`;
}

/** Màu theo docs/UI_STYLE_GUIDE.md (tím thương hiệu, lime nhấn, nền / viền tím nhạt, xanh thành công). */
const C = {
  brand: "#8037f4",
  brandStrong: "#6d28d9",
  lime: "#93f72b",
  text: "#23252f",
  muted: "#5b5772",
  border: "#ddd3f5",
  tint: "#f6f3fc",
  zebra: "#fbfaff",
  okText: "#047857",
  okBg: "#ecfdf5",
  okBorder: "#a7f3d0",
};

/**
 * Hóa đơn A4: đầu trang có logo và thông tin bên bán, khối khách hàng / thanh toán, bảng nội dung, tổng tiền kèm số
 * tiền bằng chữ, chân trang. Dòng nội dung dài tự xuống dòng; nhiều dòng (giỏ hàng) tự sang trang và vẽ lại đầu bảng.
 */
export function buildInvoicePdfBuffer(ctx) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: { Title: `Hóa đơn ${invoiceNumberFor(ctx.payment)}`, Author: SELLER_NAME },
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.registerFont("App", FONT_REGULAR_PATH).registerFont("Bold", FONT_BOLD_PATH);

    const L = 50;
    const R = doc.page.width - 50;
    const W = R - L;
    const BOTTOM = doc.page.height - 90; // chừa chỗ chân trang

    // Dải màu thương hiệu trên cùng + chân trang, vẽ ở mỗi trang.
    // Chân trang nằm dưới lề dưới: tạm bỏ lề để pdfkit không tự sang trang mới, vẽ xong trả lại lề và vị trí con trỏ.
    const decorate = () => {
      const { x: cx, y: cy } = doc;
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.save().rect(0, 0, doc.page.width, 6).fill(C.brand).rect(0, 0, 90, 6).fill(C.lime).restore();
      const fy = doc.page.height - 62;
      doc.save().moveTo(L, fy).lineTo(R, fy).lineWidth(0.5).strokeColor(C.border).stroke().restore();
      doc.font("Bold").fontSize(8.5).fillColor(C.text)
        .text("Cảm ơn bạn đã tin dùng ProInterview.", L, fy + 9, { width: W, align: "center", lineBreak: false });
      doc.font("App").fontSize(7.5).fillColor(C.muted).text(
        `Chứng từ điện tử xác nhận thanh toán, không cần chữ ký. Tra cứu và hỗ trợ: ${[SELLER_WEBSITE, SELLER_EMAIL].filter(Boolean).join(" · ")}`,
        L, fy + 22, { width: W, align: "center", lineBreak: false },
      );
      doc.page.margins.bottom = bottomMargin;
      doc.x = cx;
      doc.y = cy;
    };

    // ── Đầu trang: logo + bên bán (trái); tiêu đề, số hóa đơn, nhãn "Đã thanh toán" (phải)
    decorate();
    let y = 44;
    try {
      doc.image(LOGO_PATH, L, y, { width: 150 });
    } catch {
      doc.font("Bold").fontSize(20).fillColor(C.brand).text(SELLER_NAME, L, y);
    }
    doc.font("Bold").fontSize(9).fillColor(C.text).text(SELLER_NAME, L, y + 36, { width: 230 });
    doc.font("App").fontSize(8.5).fillColor(C.muted);
    for (const line of [SELLER_ADDRESS, SELLER_EMAIL, SELLER_WEBSITE].filter(Boolean)) {
      doc.text(line, L, doc.y + 1, { width: 230 });
    }
    const leftBottom = doc.y;

    const RX = L + W / 2;
    const RW = W / 2;
    doc.font("Bold").fontSize(18).fillColor(C.text).text("HÓA ĐƠN THANH TOÁN", RX, y, { width: RW, align: "right" });
    doc.font("App").fontSize(9).fillColor(C.muted);
    doc.text(`Số: ${invoiceNumberFor(ctx.payment)}`, RX, doc.y + 4, { width: RW, align: "right" });
    doc.text(`Ngày: ${vnDate(ctx.paidAt)}`, RX, doc.y + 1, { width: RW, align: "right" });
    const badge = "ĐÃ THANH TOÁN";
    doc.font("Bold").fontSize(8.5);
    const bw = doc.widthOfString(badge) + 22;
    const by = doc.y + 8;
    doc.save().roundedRect(R - bw, by, bw, 18, 9).fillAndStroke(C.okBg, C.okBorder).restore();
    doc.fillColor(C.okText).text(badge, R - bw, by + 5, { width: bw, align: "center", lineBreak: false });
    y = Math.max(leftBottom, by + 18) + 22;

    // ── Hai khối: khách hàng | thông tin thanh toán
    const gap = 14;
    const half = (W - gap) / 2;
    const pad = 12;
    const innerW = half - pad * 2;
    const blocks = [
      {
        title: "KHÁCH HÀNG",
        lines: [
          { text: ctx.buyer.name || "Khách hàng", bold: true },
          ctx.buyer.email && { text: ctx.buyer.email },
          ctx.buyer.address && { text: ctx.buyer.address },
        ].filter(Boolean),
      },
      {
        title: "THÔNG TIN THANH TOÁN",
        lines: [
          { label: "Ngày thanh toán", text: vnDate(ctx.paidAt) },
          { label: "Phương thức", text: PROVIDER_LABELS[ctx.payment.provider] || ctx.payment.provider || "—" },
          { label: "Mã giao dịch", text: String(ctx.payment.providerRef || ctx.payment._id) },
        ],
      },
    ];
    const lineText = (l) => (l.label ? `${l.label}: ${l.text}` : l.text);
    doc.font("Bold").fontSize(9);
    const blockH = Math.max(...blocks.map((b) =>
      16 + b.lines.reduce((h, l) => h + doc.heightOfString(lineText(l), { width: innerW }) + 3, 0))) + pad * 2;
    blocks.forEach((b, i) => {
      const bx = L + i * (half + gap);
      doc.save().roundedRect(bx, y, half, blockH, 8).fillAndStroke(C.tint, C.border).restore();
      doc.font("Bold").fontSize(7.5).fillColor(C.brandStrong)
        .text(b.title, bx + pad, y + pad, { width: innerW, characterSpacing: 0.6 });
      let ly = y + pad + 16;
      for (const l of b.lines) {
        doc.fontSize(9);
        if (l.label) {
          doc.font("App").fillColor(C.muted).text(`${l.label}: `, bx + pad, ly, { width: innerW, continued: true });
          doc.font("Bold").fillColor(C.text).text(l.text);
        } else {
          doc.font(l.bold ? "Bold" : "App").fillColor(l.bold ? C.text : C.muted).text(l.text, bx + pad, ly, { width: innerW });
        }
        ly = doc.y + 3;
      }
    });
    y += blockH + 22;

    // ── Bảng nội dung
    const colNo = 34;
    const colAmt = 120;
    const colDesc = W - colNo - colAmt;
    const cellPad = 9;
    const header = () => {
      doc.save().roundedRect(L, y, W, 24, 6).fill(C.brand).restore();
      doc.font("Bold").fontSize(8.5).fillColor("#ffffff");
      doc.text("STT", L, y + 8, { width: colNo, align: "center" });
      doc.text("NỘI DUNG", L + colNo + cellPad, y + 8, { width: colDesc - cellPad * 2 });
      doc.text("THÀNH TIỀN", L + colNo + colDesc, y + 8, { width: colAmt - cellPad, align: "right" });
      y += 24;
    };
    const newPage = () => {
      doc.addPage();
      decorate();
      y = 50;
    };
    header();
    const items = ctx.items || [{ title: ctx.description, price: ctx.total }];
    items.forEach((item, index) => {
      const title = String(item.title || "");
      doc.font("App").fontSize(9.5);
      const rowH = Math.max(28, doc.heightOfString(title, { width: colDesc - cellPad * 2 }) + 16);
      if (y + rowH > BOTTOM) {
        newPage();
        header();
      }
      if (index % 2 === 1) doc.save().rect(L, y, W, rowH).fill(C.zebra).restore();
      doc.font("App").fontSize(9.5).fillColor(C.muted).text(String(index + 1), L, y + 8, { width: colNo, align: "center" });
      doc.fillColor(C.text).text(title, L + colNo + cellPad, y + 8, { width: colDesc - cellPad * 2 });
      doc.font("Bold").text(vnd(item.price), L + colNo + colDesc, y + 8, { width: colAmt - cellPad, align: "right" });
      y += rowH;
      doc.save().moveTo(L, y).lineTo(R, y).lineWidth(0.5).strokeColor(C.border).stroke().restore();
    });

    // ── Tổng tiền + số tiền bằng chữ
    if (y + 118 > BOTTOM) newPage();
    y += 14;
    const TW = 290;
    const TX = R - TW;
    const row = (label, value) => {
      doc.font("App").fontSize(9.5).fillColor(C.muted).text(label, TX, y, { width: TW / 2 });
      doc.fillColor(C.text).text(value, TX + TW / 2, y, { width: TW / 2, align: "right" });
      y += 17;
    };
    row("Tạm tính", vnd(ctx.subtotal));
    row("VAT", vnd(ctx.vat));
    y += 4;
    doc.save().roundedRect(TX, y, TW, 34, 8).fill(C.tint).restore();
    doc.save().rect(TX, y, 4, 34).fill(C.brand).restore();
    doc.font("Bold").fontSize(10).fillColor(C.text).text("Tổng đã thanh toán", TX + 14, y + 11, { width: TW / 2 });
    doc.font("Bold").fontSize(13).fillColor(C.brandStrong)
      .text(vnd(ctx.total), TX + TW / 2, y + 9, { width: TW / 2 - 12, align: "right" });
    y += 44;
    doc.font("App").fontSize(8.5).fillColor(C.muted).text("Bằng chữ: ", TX, y, { width: TW, continued: true });
    doc.font("Bold").fillColor(C.text).text(vnMoneyInWords(ctx.total));

    doc.end();
  });
}
