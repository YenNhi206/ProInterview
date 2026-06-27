import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

import dns from "node:dns";
import net from "node:net";

const DEFAULT_SMTP_HOST = "smtp.gmail.com";

if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

export function isMailConfigured() {
  const user = (process.env.MAIL_USER || process.env.EMAIL_USER || "").trim();
  const pass = (process.env.MAIL_PASS || process.env.EMAIL_PASS || "").trim();
  return Boolean(user && pass);
}

function smtpHostname() {
  const h = (process.env.MAIL_HOST || DEFAULT_SMTP_HOST).trim();
  return h || DEFAULT_SMTP_HOST;
}

/** Render không route IPv6 tới Gmail — resolve A record rồi connect bằng IPv4. */
async function resolveSmtpConnectHost(hostname) {
  if (net.isIPv4(hostname)) return hostname;
  if (net.isIPv6(hostname)) {
    throw new Error(
      `MAIL_HOST là IPv6 (${hostname}); đặt MAIL_HOST=${DEFAULT_SMTP_HOST} trên Render.`,
    );
  }
  const addrs = await dns.promises.resolve4(hostname);
  const ip = addrs?.[0];
  if (!ip) throw new Error(`Không resolve IPv4 cho SMTP host: ${hostname}`);
  return ip;
}

function tlsServername(hostname) {
  return net.isIP(hostname) ? DEFAULT_SMTP_HOST : hostname;
}

let transporterCache = null;

async function getTransporter() {
  if (transporterCache) return transporterCache;

  const user = (process.env.MAIL_USER || process.env.EMAIL_USER || "").trim();
  const pass = (process.env.MAIL_PASS || process.env.EMAIL_PASS || "").trim();

  if (!user || !pass) {
    throw new Error(
      "Thiếu MAIL_USER hoặc MAIL_PASS trong backend/.env (Gmail: dùng App Password, không phải mật khẩu đăng nhập thường).",
    );
  }

  const hostname = smtpHostname();
  const connectHost = await resolveSmtpConnectHost(hostname);
  const servername = tlsServername(hostname);

  transporterCache = nodemailer.createTransport({
    host: connectHost,
    port: Number(process.env.MAIL_PORT) || 587,
    secure: false,
    tls: { servername },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
    auth: { user, pass },
  });

  if (connectHost !== hostname) {
    console.log(`[emailService] SMTP → ${connectHost}:587 (TLS servername: ${servername})`);
  }

  return transporterCache;
}

const BRAND = {
  purple: "#8037f4",
  purpleDark: "#630ed4",
  purpleLight: "#a66ff8",
  lilacBg: "#dcd2eb",
  text: "#1a1b23",
  textMuted: "#64748b",
  supportEmail: "supportprointerview@gmail.com",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mailFrom() {
  return process.env.MAIL_FROM || '"ProInterview" <prointerview.ai@gmail.com>';
}

function buildBrandedEmailHtml({
  preheader = "",
  eyebrow = "ProInterview",
  title,
  bodyHtml,
  ctaLabel,
  ctaUrl,
  footerNote = "",
  fallbackUrl = "",
}) {
  const safeTitle = escapeHtml(title);
  const safeEyebrow = escapeHtml(eyebrow);
  const safePreheader = escapeHtml(preheader);
  const safeFallback = escapeHtml(fallbackUrl || ctaUrl || "");

  const ctaBlock =
    ctaLabel && ctaUrl
      ? `
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 28px auto 8px;">
            <tr>
              <td align="center" style="border-radius: 999px; background: ${BRAND.purple};">
                <a href="${ctaUrl}" target="_blank" rel="noopener noreferrer"
                  style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 999px;">
                  ${escapeHtml(ctaLabel)}
                </a>
              </td>
            </tr>
          </table>`
      : "";

  const fallbackBlock = safeFallback
    ? `
          <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.6; color: ${BRAND.textMuted};">
            Nếu nút không hoạt động, copy link sau vào trình duyệt:<br />
            <a href="${fallbackUrl || ctaUrl}" style="color: ${BRAND.purple}; word-break: break-all;">${safeFallback}</a>
          </p>`
    : "";

  const footerExtra = footerNote
    ? `<p style="margin: 0 0 12px; font-size: 13px; line-height: 1.65; color: ${BRAND.textMuted};">${footerNote}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${safeTitle}</title>
</head>
<body style="margin: 0; padding: 0; background-color: ${BRAND.lilacBg};">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${safePreheader}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: ${BRAND.lilacBg}; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 560px; background: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid rgba(128,55,244,0.12); box-shadow: 0 12px 40px rgba(128,55,244,0.10);">
          <tr>
            <td style="padding: 28px 32px 24px; background: linear-gradient(135deg, ${BRAND.purpleDark} 0%, ${BRAND.purple} 55%, ${BRAND.purpleLight} 100%); text-align: center;">
              <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(255,255,255,0.82); font-family: 'Segoe UI', system-ui, sans-serif;">
                ${safeEyebrow}
              </p>
              <h1 style="margin: 0; font-size: 24px; font-weight: 800; line-height: 1.25; color: #ffffff; letter-spacing: -0.02em; font-family: 'Segoe UI', system-ui, sans-serif;">
                ${safeTitle}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px 32px 28px; font-family: 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif; color: ${BRAND.text}; font-size: 15px; line-height: 1.65;">
              ${bodyHtml}
              ${ctaBlock}
              ${fallbackBlock}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px 28px; border-top: 1px solid rgba(128,55,244,0.10); background: #faf8ff; font-family: 'Segoe UI', system-ui, sans-serif;">
              ${footerExtra}
              <p style="margin: 0 0 6px; font-size: 12px; line-height: 1.6; color: ${BRAND.textMuted};">
                Cần hỗ trợ? <a href="mailto:${BRAND.supportEmail}" style="color: ${BRAND.purple}; font-weight: 600; text-decoration: none;">${BRAND.supportEmail}</a>
              </p>
              <p style="margin: 0; font-size: 11px; line-height: 1.5; color: #94a3b8;">
                © ${new Date().getFullYear()} ProInterview · Email tự động, vui lòng không trả lời trực tiếp.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function createBrandedMailOptions({ to, subject, ...htmlParams }) {
  return {
    from: mailFrom(),
    to,
    subject,
    html: buildBrandedEmailHtml(htmlParams),
  };
}

/**
 * Gửi email xác nhận tài khoản
 */
export async function sendVerificationEmail(to, name, verifyUrl) {
  const safeName = escapeHtml(name);
  const mailOptions = createBrandedMailOptions({
    to,
    subject: "Xác thực tài khoản ProInterview của bạn",
    preheader: "Xác nhận email để bắt đầu luyện phỏng vấn cùng ProInterview.",
    title: "Xác thực email",
    bodyHtml: `
        <p style="margin: 0 0 16px;">Chào <strong>${safeName}</strong>,</p>
        <p style="margin: 0 0 8px; color: ${BRAND.textMuted};">
          Cảm ơn bạn đã đăng ký ProInterview. Nhấn nút bên dưới để kích hoạt tài khoản và bắt đầu luyện phỏng vấn, phân tích CV.
        </p>`,
    ctaLabel: "Xác thực email",
    ctaUrl: verifyUrl,
    fallbackUrl: verifyUrl,
    footerNote: "Nếu bạn không tạo tài khoản, bạn có thể bỏ qua email này.",
  });

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail(mailOptions);
    return { ok: true, info };
  } catch (error) {
    console.error("[emailService] sendVerificationEmail error:", error);
    return { ok: false, error: error.message };
  }
}

/**
 * Gửi email đặt lại mật khẩu
 */
export async function sendResetPasswordEmail(to, name, resetUrl) {
  const safeName = escapeHtml(name);
  const mailOptions = createBrandedMailOptions({
    to,
    subject: "Đặt lại mật khẩu ProInterview",
    preheader: "Yêu cầu đặt lại mật khẩu tài khoản ProInterview của bạn.",
    title: "Đặt lại mật khẩu",
    bodyHtml: `
        <p style="margin: 0 0 16px;">Chào <strong>${safeName}</strong>,</p>
        <p style="margin: 0 0 8px; color: ${BRAND.textMuted};">
          Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản ProInterview của bạn. Nhấn nút bên dưới để tạo mật khẩu mới.
        </p>
        <p style="margin: 16px 0 0; padding: 12px 14px; border-radius: 12px; background: rgba(128,55,244,0.06); border: 1px solid rgba(128,55,244,0.14); font-size: 13px; color: ${BRAND.textMuted};">
          Link có hiệu lực trong <strong style="color: ${BRAND.text};">20 phút</strong>. Sau thời gian này, bạn cần yêu cầu link mới tại trang Quên mật khẩu.
        </p>`,
    ctaLabel: "Đặt lại mật khẩu",
    ctaUrl: resetUrl,
    fallbackUrl: resetUrl,
    footerNote:
      "Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — tài khoản của bạn vẫn an toàn.",
  });

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail(mailOptions);
    return { ok: true, info };
  } catch (error) {
    console.error("[emailService] sendResetPasswordEmail error:", error);
    return { ok: false, error: error.message };
  }
}

/**
 * Gửi email thông báo có nhận xét mới từ Mentor
 */
export async function sendMentorFeedbackEmail(to, studentName, mentorName, sessionType, notes) {
  const safeStudent = escapeHtml(studentName);
  const safeMentor = escapeHtml(mentorName);
  const safeNotes = escapeHtml(notes);
  const sessionLabel =
    sessionType === "mock_interview" ? "Phỏng vấn giả định" : "Tư vấn lộ trình";
  const dashboardUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/`;

  const mailOptions = createBrandedMailOptions({
    to,
    subject: `[ProInterview] Nhận xét buổi học từ Mentor ${mentorName}`,
    preheader: `Mentor ${mentorName} đã gửi nhận xét cho buổi ${sessionLabel}.`,
    eyebrow: "Báo cáo từ Mentor",
    title: "Nhận xét buổi học",
    bodyHtml: `
        <p style="margin: 0 0 16px;">Chào <strong>${safeStudent}</strong>,</p>
        <p style="margin: 0 0 20px; color: ${BRAND.textMuted};">
          Mentor <strong>${safeMentor}</strong> đã hoàn tất đánh giá cho buổi <strong>${escapeHtml(sessionLabel)}</strong> của bạn.
        </p>
        <div style="padding: 20px; border-radius: 14px; background: #faf8ff; border: 1px solid rgba(128,55,244,0.12); white-space: pre-wrap; font-size: 14px; line-height: 1.75; color: ${BRAND.text};">
          ${safeNotes}
        </div>`,
    ctaLabel: "Xem trên ProInterview",
    ctaUrl: dashboardUrl,
    fallbackUrl: dashboardUrl,
    footerNote: "Email này được gửi tự động khi Mentor hoàn tất nhận xét buổi học.",
  });

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail(mailOptions);
    console.log("[EmailService] Feedback email sent successfully:", info.messageId);
    return { ok: true, info };
  } catch (error) {
    console.error("[EmailService] Error sending feedback email:", error);
    return { ok: false, error: error.message };
  }
}

const SESSION_TYPE_LABELS = {
  mock_interview: "Phỏng vấn giả định",
  cv_review: "Review CV",
  career_consulting: "Tư vấn nghề nghiệp",
  custom: "Buổi coaching",
};

function frontendUrl() {
  return (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
}

/**
 * Gửi email xác nhận đặt lịch thành công cho mentee (khi thanh toán được xác nhận)
 */
export async function sendBookingConfirmedEmailToMentee(
  to,
  { menteeName, mentorName, sessionType, date, timeSlot, bookingId },
) {
  if (!to) return { ok: false, error: "Thiếu email người nhận." };
  const safeMentee = escapeHtml(menteeName || "Bạn");
  const safeMentor = escapeHtml(mentorName || "Mentor");
  const sessionLabel = escapeHtml(SESSION_TYPE_LABELS[sessionType] || sessionType || "Buổi học");
  const safeDate = escapeHtml(date || "");
  const safeTime = escapeHtml(timeSlot || "");
  const sessionUrl = `${frontendUrl()}/#/session/${encodeURIComponent(bookingId || "")}`;

  const mailOptions = createBrandedMailOptions({
    to,
    subject: `[ProInterview] Đặt lịch thành công với Mentor ${mentorName}`,
    preheader: `Buổi ${sessionLabel} ngày ${date} lúc ${timeSlot} đã được xác nhận.`,
    eyebrow: "Xác nhận đặt lịch",
    title: "Đặt lịch thành công!",
    bodyHtml: `
        <p style="margin: 0 0 16px;">Chào <strong>${safeMentee}</strong>,</p>
        <p style="margin: 0 0 20px; color: ${BRAND.textMuted};">
          Thanh toán của bạn đã được xác nhận. Buổi học với Mentor <strong>${safeMentor}</strong> đã chính thức được đặt lịch.
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
          style="border-radius: 14px; background: #faf8ff; border: 1px solid rgba(128,55,244,0.12); margin-bottom: 8px;">
          <tr>
            <td style="padding: 20px 24px;">
              <table width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: ${BRAND.textMuted}; width: 130px;">Loại buổi</td>
                  <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: ${BRAND.text};">${sessionLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: ${BRAND.textMuted};">Mentor</td>
                  <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: ${BRAND.text};">${safeMentor}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: ${BRAND.textMuted};">Ngày</td>
                  <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: ${BRAND.text};">${safeDate}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: ${BRAND.textMuted};">Giờ bắt đầu</td>
                  <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: ${BRAND.text};">${safeTime}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`,
    ctaLabel: "Xem buổi hẹn",
    ctaUrl: sessionUrl,
    fallbackUrl: sessionUrl,
    footerNote: "Bạn có thể xem và quản lý lịch hẹn trong mục Dashboard trên ProInterview.",
  });

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail(mailOptions);
    return { ok: true, info };
  } catch (error) {
    console.error("[emailService] sendBookingConfirmedEmailToMentee:", error?.message || error);
    return { ok: false, error: error.message };
  }
}

/**
 * Gửi email thông báo buổi hẹn mới cho mentor (khi thanh toán được xác nhận)
 */
export async function sendBookingConfirmedEmailToMentor(
  to,
  { mentorName, menteeName, sessionType, date, timeSlot, bookingId },
) {
  if (!to) return { ok: false, error: "Thiếu email người nhận." };
  const safeMentor = escapeHtml(mentorName || "Mentor");
  const safeMentee = escapeHtml(menteeName || "Học viên");
  const sessionLabel = escapeHtml(SESSION_TYPE_LABELS[sessionType] || sessionType || "Buổi học");
  const safeDate = escapeHtml(date || "");
  const safeTime = escapeHtml(timeSlot || "");
  const detailUrl = `${frontendUrl()}/#/mentor/meeting-detail/${encodeURIComponent(bookingId || "")}`;

  const mailOptions = createBrandedMailOptions({
    to,
    subject: `[ProInterview] Bạn có buổi hẹn mới từ ${menteeName}`,
    preheader: `${menteeName} đặt buổi ${sessionLabel} ngày ${date} lúc ${timeSlot}.`,
    eyebrow: "Lịch hẹn mới",
    title: "Bạn có buổi hẹn mới!",
    bodyHtml: `
        <p style="margin: 0 0 16px;">Chào <strong>${safeMentor}</strong>,</p>
        <p style="margin: 0 0 20px; color: ${BRAND.textMuted};">
          <strong>${safeMentee}</strong> đã đặt lịch và thanh toán thành công cho buổi học với bạn. Vui lòng chuẩn bị cho buổi hẹn.
        </p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"
          style="border-radius: 14px; background: #faf8ff; border: 1px solid rgba(128,55,244,0.12); margin-bottom: 8px;">
          <tr>
            <td style="padding: 20px 24px;">
              <table width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: ${BRAND.textMuted}; width: 130px;">Loại buổi</td>
                  <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: ${BRAND.text};">${sessionLabel}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: ${BRAND.textMuted};">Học viên</td>
                  <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: ${BRAND.text};">${safeMentee}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: ${BRAND.textMuted};">Ngày</td>
                  <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: ${BRAND.text};">${safeDate}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-size: 13px; color: ${BRAND.textMuted};">Giờ bắt đầu</td>
                  <td style="padding: 6px 0; font-size: 14px; font-weight: 600; color: ${BRAND.text};">${safeTime}</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>`,
    ctaLabel: "Xem chi tiết buổi hẹn",
    ctaUrl: detailUrl,
    fallbackUrl: detailUrl,
    footerNote: "Vào trang Lịch Mentor để xem đầy đủ danh sách buổi hẹn sắp tới.",
  });

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail(mailOptions);
    return { ok: true, info };
  } catch (error) {
    console.error("[emailService] sendBookingConfirmedEmailToMentor:", error?.message || error);
    return { ok: false, error: error.message };
  }
}

// Kiểm tra SMTP khi khởi động — bỏ qua nếu chưa cấu hình (dev vẫn chạy API/DB)
(async function verifyMailConfig() {
  if (!isMailConfigured()) {
    console.warn(
      "⚠️ SMTP chưa cấu hình (MAIL_USER / MAIL_PASS trống). Quên mật khẩu / xác thực email sẽ không gửi được.",
    );
    return;
  }
  try {
    const initTransporter = await getTransporter();
    await initTransporter.verify();
    console.log("✔️ Server đã sẵn sàng gửi mail (SMTP OK)!");
  } catch (error) {
    const msg = String(error?.message || error);
    console.error("❌ LỖI CẤU HÌNH MAIL TRÊN SERVER:", msg);
    if (/ENETUNREACH|ECONNREFUSED|EHOSTUNREACH/i.test(msg) && /:587/.test(msg)) {
      console.error(
        "   Gợi ý: host PaaS không ra IPv6 tới Gmail — dùng MAIL_HOST=smtp.gmail.com và deploy bản code ép IPv4 (smtpLookup).",
      );
    } else {
      console.error(
        "   Gợi ý: Gmail → bật 2FA → tạo App Password → dán vào MAIL_PASS (có thể bọc ngoặc kép nếu có dấu cách).",
      );
    }
  }
})();
