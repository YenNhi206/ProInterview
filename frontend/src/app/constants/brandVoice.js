/**
 * Copy & xưng hô ProInterview (brand guideline TONE & MOOD).
 * - Thương hiệu: ProInterview (hoặc Pio) + "bạn". Không xưng "Mình" cho ProInterview.
 * - Mentor (khu mentor): Em + anh/chị
 * Tone: thân thiện, khích lệ, thực tế, có định hướng, không hứa quá đà.
 */

export const HOME_COPY = {
  badge: "Nền tảng luyện phỏng vấn dành cho IT",
  titleLine1: "Phỏng vấn",
  titleHighlight: "1:1 với AI",
  titleLine2Suffix: "qua",
  titleExtraLines: ["mô phỏng", "hội thoại", "thông\u00A0minh"],
  cta: "Thử phỏng vấn miễn phí",
  stats: [
    { value: "10,000+", label: "Lượt luyện trên ProInterview" },
    { value: "500+", label: "Mentor HR/Manager thật" },
    { value: "STAR", label: "Góp ý từng câu, áp dụng ngay" },
    { value: "4.8/5", label: "Mức hài lòng trung bình" },
  ],
};

/** Home: mọi section trừ hero (tiêu đề + badge + CTA hero giữ trong JSX). */
export const HOME_SECTION_COPY = {
  howItWorks: {
    titleLine1: "Luyện phỏng vấn hôm nay,",
    titleLine2: "tự tin chinh phục job ngày\u00a0mai.",
  },
  /** Bản gốc sếp — tham chiếu, không xóa. */
  stepsBossOriginal: [
    {
      step: "01",
      title: "Tối ưu CV theo vị trí ứng tuyển",
      desc: "ProInterview giúp bạn đối chiếu CV với vị trí ứng tuyển, chỉ ra điểm khớp, điểm thiếu và những phần nên cải thiện trước khi nộp hồ sơ.",
    },
    {
      step: "02",
      title: "Luyện phỏng vấn với AI",
      desc: "Phỏng vấn với AI theo vị trí ứng tuyển, nhận góp ý sau từng câu trả lời và biết mình cần sửa gì để trả lời rõ ràng hơn.",
    },
    {
      step: "03",
      title: "Kết nối Mentor 1:1",
      desc: "Kết nối với Mentor để được góp ý cụ thể và có chiến lược chuẩn bị phù hợp.",
    },
    {
      step: "04",
      title: "Khóa học từ Mentor",
      desc: "Video từ Mentor giúp bạn bổ sung kiến thức, luyện kỹ năng và chuẩn bị bài bản hơn cho hành trình ứng tuyển.",
    },
  ],
  /** Cùng ý bản gốc — 2 câu/card, độ dài cân bằng để hiển thị đều. */
  steps: [
    {
      step: "01",
      title: "Tối ưu CV theo vị trí ứng tuyển",
      desc: "ProInterview giúp bạn đối chiếu CV với vị trí ứng tuyển, chỉ rõ điểm khớp và điểm thiếu. Bạn biết phần nào nên cải thiện trước khi nộp hồ\u00a0sơ.",
    },
    {
      step: "02",
      title: "Luyện phỏng vấn với AI",
      desc: "Phỏng vấn với AI theo đúng vị trí ứng tuyển, nhận góp ý sau từng câu trả lời. Bạn biết mình cần sửa gì để trả lời rõ ràng hơn.",
    },
    {
      step: "03",
      title: "Kết nối Mentor 1:1",
      desc: "Kết nối với Mentor để nhận góp ý cụ thể qua từng buổi mock. Bạn có chiến lược chuẩn bị phù hợp với mục tiêu ứng tuyển.",
    },
    {
      step: "04",
      title: "Khóa học từ Mentor",
      desc: "Video từ Mentor giúp bạn bổ sung kiến thức và luyện kỹ năng thực tế. Bạn chuẩn bị bài bản hơn cho hành trình ứng tuyển sắp tới.",
    },
  ],
  features: [
    {
      title: "Phân tích CV với JD",
      desc: "Tải lên là thấy độ khớp, có gợi ý sửa từng vị trí, không đoán mò.",
      cta: "Phân tích ngay",
    },
    {
      title: "Phỏng vấn thử với AI",
      desc: "Câu hỏi sát JD, góp ý STAR từng câu. Bạn biết chỗ cần chỉnh sau mỗi lượt.",
      cta: "Vào phòng luyện",
    },
    {
      title: "Mentor 1:1 thật",
      desc: "Đặt lịch HR/Manager. Kinh nghiệm thực chiến, không hứa quá đà.",
      cta: "Chọn Mentor",
    },
    {
      title: "Theo dõi tiến độ",
      desc: "Lịch sử luyện và tiến bộ trên một chỗ. Bạn thấy rõ bạn đã tiến bộ đến đâu.",
      cta: "Xem lịch hẹn",
    },
  ],
  testimonials: {
    titleLine: "Phản hồi từ người dùng",
    body: "Luyện với AI, nhận góp ý từ Mentor và cải thiện rõ hơn sau từng buổi.",
    socialProof: "Bạn đã luyện và nhận offer.",
    badge: "Đánh giá nổi bật.",
    items: [
      {
        name: "Phạm Anh Tuấn",
        role: "Software Engineer @ Shopee",
        text: "Mình luyện AI vài buổi rồi mock với Mentor Shopee, tự tin hơn rõ. Câu hỏi sát thực tế, góp ý đúng chỗ cần sửa.",
        tag: "Đã nhận việc",
      },
      {
        name: "Nguyễn Thị Hoa",
        role: "Marketing Executive @ Unilever",
        text: "Phân tích CV với JD xong mới thấy thiếu từ khóa quan trọng. Điểm STAR từ 2.4 lên 4.1 sau ba tuần, tiến bộ đo được.",
        tag: "STAR +70%",
      },
      {
        name: "Trần Minh Đức",
        role: "Business Analyst @ KPMG",
        text: "Phân tích CV với JD chỉ đúng điểm yếu. Mentor KPMG chia sẻ kinh nghiệm thật, khác hẳn đọc blog cho có.",
        tag: "Mentor 5 sao",
      },
    ],
  },
};

export const CV_SHOWCASE_COPY = {
  badge: "Tối ưu CV theo vị trí ứng tuyển",
  titleAccent: "Làm sao để CV ấn tượng",
  titleRest: "trong mắt nhà tuyển dụng?",
  body: "ProInterview giúp bạn kiểm tra, góp ý và cải thiện CV trước khi gửi đến nhà tuyển dụng.",
  cta: "Tối ưu CV theo vị trí ứng tuyển ngay",
};

/** Hub `/cv-analysis` — hero trái (khác section Home). */
export const CV_HUB_HERO_COPY = {
  titleAccent: "Làm sao để CV ấn tượng",
  titleRest: "trong mắt nhà tuyển dụng?",
  bodyLine1: "ProInterview giúp bạn kiểm tra, góp ý và cải thiện CV",
  bodyLine2: "trước khi gửi đến nhà tuyển dụng.",
  ctaJd: "Tối ưu CV theo vị trí ứng tuyển",
  ctaField: "Phân tích CV theo ngành nghề",
};

export const MENTOR_SHOWCASE_COPY = {
  badge: "Kết nối Mentor 1:1",
  titleLine1: "Từ luyện tập với AI",
  titleLine2: "đến trao đổi thực tế cùng\u00a0Mentor",
  steps: [
    {
      title: "Chọn Mentor phù hợp",
      description:
        "Chọn Mentor theo ngành, kinh nghiệm và mục tiêu luyện phỏng vấn của bạn.",
    },
    {
      title: "Đặt lịch luyện tập 1:1",
      description:
        "Chọn thời gian phù hợp và bắt đầu buổi luyện phỏng vấn cùng Mentor.",
    },
    {
      title: "Nhận góp ý cụ thể",
      description: "Nhận góp ý về CV, cách trả lời và hướng luyện tiếp theo.",
    },
  ],
  afterMockLead: "Sau buổi mock, bạn nhận được.",
  afterMockPoints: [
    { title: "Góp ý dễ hiểu", detail: "Mentor chỉ rõ điểm mạnh và phần cần chỉnh." },
    { title: "Tự tin hơn", detail: "Biết cách trả lời khi vào vòng phỏng vấn thật." },
    { title: "Lưu trên ProInterview", detail: "Báo cáo buổi mock, xem lại bất cứ lúc nào." },
    { title: "Biết bước tiếp", detail: "Rõ nên ôn gì và luyện tiếp phần nào." },
  ],
};

/** Sidebar đặt lịch / thẻ giá mentor (không dùng “Mock interview”). */
export const MENTOR_BOOKING_COPY = {
  sessionTitle: "Buổi Mentor 1:1",
  sessionVia: "Buổi 1:1 qua Zoom / Google Meet",
  flexibleSchedule: "Tự chọn khung giờ linh hoạt.",
  feedbackAfter: "Góp ý sau buổi Mentor.",
};

/** Copy ngắn — chi tiết bảng: `constants/bookingPolicy.js` + `BookingPolicySummary`. */
export const BOOKING_POLICY_COPY = {
  refundTitle: "Chính sách khi bạn hủy",
  refundDetail:
    "Từ 24 giờ trước buổi: hoàn 100%. 12–24 giờ: hoàn 50%. Dưới 12 giờ hoặc không tham gia: không hoàn.",
  mentorCancelTitle: "Chính sách khi Mentor hủy / no-show",
  mentorCancelRefund:
    "Mentor hủy từ 24 giờ trở lên: đổi lịch, đổi Mentor hoặc hoàn 100% · Dưới 24 giờ: hoàn 100% ưu tiên · No-show: hoàn 100% + vi phạm Mentor.",
  userChangeSlotNote: "Đổi giờ: hủy buổi rồi đặt lại.",
};

export const COURSES_SHOWCASE_COPY = {
  badge: "Khóa học từ Mentor",
  titleLine1: "Học từ kinh nghiệm Mentor",
  titleLine2: "qua khóa học thực tế",
  body: "Khóa học do Mentor xây dựng, giúp bạn học theo từng chủ đề và cải thiện những kỹ năng cần thiết cho hành trình ứng tuyển.",
  bodyLine1:
    "Khóa học do Mentor xây dựng, giúp bạn học theo từng chủ đề và cải thiện",
  bodyLine2: "những kỹ năng cần thiết cho hành trình ứng tuyển.",
  bullets: [
    "Chủ đề đa dạng.",
    "Video ngắn, dễ học theo lộ trình.",
    "Chọn khóa đúng kỹ năng cần luyện.",
  ],
  cta: "Xem tất cả khóa học",
  panelVideoTitle: "Video từng bài",
  panelVideoBody: "Ghi danh xong, mở hết bài trong khóa.",
  panelVideoNote: "Ghi chú theo bài, học tiếp đúng chỗ.",
};

export const FOOTER_TAGLINE =
  "ProInterview là nền tảng luyện phỏng vấn với AI và hỗ trợ kết nối Mentor.";

export const AUTH_COPY = {
  loginSubtitle: "Chào bạn trở lại! Tiếp tục luyện cùng ProInterview nhé.",
  loginRegisteredTitle: "Đăng ký thành công!",
  loginRegisteredBody: "Bạn đăng nhập để tiếp tục luyện nhé.",
  registerSubtitle: "Tạo tài khoản, bắt đầu phỏng vấn với AI.",
  registerPerks: [
    "3 buổi phỏng vấn AI để làm quen và luyện tập.",
    "Phân tích CV/JD, biết chỗ cần chỉnh trước.",
    "Câu hỏi theo ngành và vị trí bạn chọn.",
    "Lịch Mentor và lịch sử luyện, theo dõi tiến bộ.",
  ],
  registerFreeBadge: "Bắt đầu luyện miễn phí",
  registerFreeCta: "Tạo tài khoản và luyện nhé",
  registerSocialProof: "Bạn đang luyện cùng ProInterview.",
  verifyEmailLead:
    "ProInterview đã gửi link xác thực đến email của bạn. Bạn mở email, nhấn link để kích hoạt tài khoản, rồi đăng nhập nhé.",
  googleErrorLocked:
    "Tài khoản của bạn đang bị khóa. Bạn liên hệ prointerview.ai@gmail.com hoặc thử đăng nhập bằng email và mật khẩu.",
  googleErrorForbidden:
    "Không đăng nhập được bằng Google (403). Thường do tài khoản bị khóa, hoặc frontend chưa trỏ đúng API. Kiểm tra VITE_API_URL và GOOGLE_CLIENT_ID khớp giữa Vercel/Render.",
  googleErrorUnauthorized:
    "Google chưa xác thực được. Kiểm tra GOOGLE_CLIENT_ID giống nhau ở frontend (.env.local) và backend (.env), và thêm localhost:5173 vào Authorized JavaScript origins trong Google Cloud.",
  forgotPasswordSubtitle:
    "Nhập email đã đăng ký. Nếu tài khoản có mật khẩu, ProInterview sẽ gửi link đặt lại qua email.",
  forgotPasswordSentTitle: "Kiểm tra hộp thư",
  forgotPasswordSentBody:
    "Nếu email tồn tại và tài khoản có mật khẩu, bạn sẽ nhận hướng dẫn đặt lại trong vài phút. Nhớ kiểm tra cả hộp thư spam.",
  resetPasswordSubtitle: "Nhập mật khẩu mới cho tài khoản ProInterview của bạn.",
  resetPasswordDoneTitle: "Mật khẩu đã được cập nhật",
  resetPasswordDoneBody: "Bạn có thể đăng nhập ngay bằng mật khẩu mới.",
};

export const DASHBOARD_GREETING_SUB =
  "Hôm nay bạn muốn luyện bước nào tiếp theo?";

export const PRICING_SUBTITLE =
  "Lựa chọn gói luyện tập, nhận góp ý và cải thiện kỹ năng qua từng buổi.";

/**
 * FAQ trang Bảng giá — paragraphs + bullets (tùy chọn) để hiển thị hướng dẫn chi tiết.
 */
export const PRICING_FAQ = [
  {
    q: "Gói Basic, Pro và Elite khác nhau như thế nào?",
    paragraphs: [
      "Ba gói được thiết kế cho ba mức nhu cầu khác nhau — từ trải nghiệm thử đến luyện tập chuyên sâu trước phỏng vấn thật.",
    ],
    bullets: [
      "Basic (miễn phí): 1 phiên phỏng vấn AI trải nghiệm (3 câu hỏi), 5 lượt phân tích CV/JD, truy cập bộ câu hỏi theo ngành nghề — phù hợp làm quen với ProInterview.",
      "Pro (99.000đ/tháng): 3 phiên phỏng vấn AI/tháng (5 câu hỏi/phiên), 20 lượt phân tích CV/JD, nhận diện giọng nói và phản hồi chi tiết từng câu — dành cho ứng viên luyện đều xuyên suốt.",
      "Elite (199.000đ/tháng): 8 phiên phỏng vấn AI/tháng (5 câu hỏi/phiên), 40 lượt phân tích CV/JD, nhận diện giọng nói nhanh hơn, hỗ trợ ưu tiên 24/7 — phù hợp khi bạn cần luyện dày trước vòng phỏng vấn quan trọng.",
    ],
    note: "Bạn có thể bắt đầu với Basic, nâng cấp Pro hoặc Elite bất cứ lúc nào khi cần thêm quota.",
  },
  {
    q: "Gói Basic có thật sự miễn phí không?",
    paragraphs: [
      "Có. Gói Basic miễn phí vĩnh viễn — không cần thẻ tín dụng, không bắt buộc nâng cấp.",
      "Sau khi đăng ký tài khoản, bạn có thể dùng ngay phỏng vấn AI thử và một lượt phân tích CV/JD để đánh giá mức độ phù hợp với vị trí ứng tuyển. Khi cần luyện nhiều hơn, bạn chọn Pro hoặc Elite trên trang này.",
    ],
  },
  {
    q: "Thanh toán gói Pro/Elite qua kênh nào?",
    paragraphs: [
      "ProInterview hiện hỗ trợ thanh toán chuyển khoản ngân hàng qua VietQR — nhanh, an toàn và không cần cài thêm ứng dụng ví điện tử.",
    ],
    bullets: [
      "Chọn gói Pro hoặc Elite, chọn chu kỳ Hàng tháng hoặc Hàng năm, rồi bấm nút nâng cấp.",
      "Trang thanh toán hiển thị mã QR, số tài khoản, số tiền và nội dung chuyển khoản — hãy chuyển đúng cả ba thông tin này.",
      "Mở app ngân hàng, quét QR hoặc nhập thủ công, xác nhận giao dịch.",
      "Hệ thống SePay tự đối soát giao dịch; gói được kích hoạt sau vài phút nếu thông tin chuyển khoản khớp.",
    ],
    note: "Nếu quá 15 phút chưa thấy gói được kích hoạt, kiểm tra lại số tiền và nội dung CK, hoặc liên hệ hỗ trợ kèm ảnh biên lai.",
  },
  {
    q: "Trả Hàng năm khác gì Hàng tháng?",
    paragraphs: [
      "Chỉ khác cách thanh toán: Hàng năm bạn trả một lần cho 12 tháng; Hàng tháng bạn trả từng tháng. Mức giá tháng giữ nguyên, không giảm khi trả năm.",
    ],
    bullets: [
      "Pro: 99.000đ/tháng hoặc 1.188.000đ/năm (99.000đ × 12).",
      "Elite: 199.000đ/tháng hoặc 2.388.000đ/năm (199.000đ × 12).",
    ],
    note: "Quyền lợi Pro và Elite giống nhau dù bạn chọn trả tháng hay trả năm.",
  },
  {
    q: "Tôi có thể hủy hoặc không gia hạn gói không?",
    paragraphs: [
      "Có. Bạn chủ động quản lý gói trong mục Cài đặt tài khoản.",
    ],
    bullets: [
      "Hủy gia hạn: gói hiện tại vẫn dùng được đến hết ngày hết hạn đã thanh toán — không bị cắt ngay.",
      "Sau khi hết hạn, tài khoản tự chuyển về Basic với quota miễn phí tương ứng.",
      "Bạn có thể nâng cấp lại Pro hoặc Elite bất cứ lúc nào nếu muốn tiếp tục luyện với quota cao hơn.",
    ],
  },
  {
    q: "Chính sách hoàn tiền như thế nào?",
    paragraphs: [
      "ProInterview áp dụng hoàn tiền trong 7 ngày kể từ ngày thanh toán gói Pro hoặc Elite, nếu bạn chưa hài lòng với trải nghiệm.",
    ],
    bullets: [
      "Hoàn 100% số tiền gói nếu bạn chưa sử dụng quá 2 buổi phỏng vấn AI kể từ khi nâng cấp.",
      "Gửi yêu cầu qua email hỗ trợ, kèm email đăng ký và mã giao dịch chuyển khoản.",
      "Sau khi xác minh, hoàn tiền về tài khoản ngân hàng bạn cung cấp trong 5–7 ngày làm việc.",
    ],
    note: "Hoàn tiền áp dụng cho gói đăng ký Pro/Elite, không áp dụng cho phí đặt lịch Mentor hoặc học phí khóa học riêng lẻ.",
  },
  {
    q: "Quota phân tích CV và phỏng vấn AI được tính như thế nào?",
    paragraphs: [
      "Mỗi gói có giới hạn lượt sử dụng riêng. Hệ thống trừ quota khi bạn hoàn tất một lần phân tích CV/JD hoặc một buổi phỏng vấn AI.",
    ],
    bullets: [
      "Basic: 5 lượt phân tích CV/JD và 1 phiên phỏng vấn AI (3 câu hỏi).",
      "Pro: 20 lượt phân tích CV/JD và 3 phiên phỏng vấn AI (5 câu hỏi/phiên) trong mỗi chu kỳ gói đang hoạt động.",
      "Elite: 40 lượt phân tích CV/JD và 8 phiên phỏng vấn AI (5 câu hỏi/phiên) trong thời hạn gói.",
    ],
    note: "Bạn xem quota còn lại trên Dashboard. Khi hết quota, nâng cấp gói hoặc chờ chu kỳ gói mới để tiếp tục.",
  },
  {
    q: "Phỏng vấn AI trên ProInterview hoạt động ra sao?",
    paragraphs: [
      "Phỏng vấn AI mô phỏng buổi phỏng vấn xin việc thật: avatar AI đặt câu hỏi, bạn trả lời bằng văn bản hoặc giọng nói (tùy gói), rồi nhận phản hồi theo khung STAR.",
    ],
    bullets: [
      "Chọn vị trí/ngành nghề và bắt đầu buổi luyện — AI điều chỉnh câu hỏi theo hồ sơ và JD bạn cung cấp.",
      "Sau mỗi câu, hệ thống chấm điểm rõ ràng, cấu trúc, mức liên quan và độ thuyết phục.",
      "Gói Pro/Elite có thêm nhận diện giọng nói để luyện gần với phỏng vấn trực tiếp hơn.",
    ],
  },
  {
    q: "Đặt lịch Mentor hoặc mua khóa học có nằm trong gói không?",
    paragraphs: [
      "Gói Basic/Pro/Elite bao gồm các tính năng phỏng vấn AI và phân tích CV/JD. Đặt lịch Mentor 1:1 và ghi danh khóa học là dịch vụ riêng, thanh toán theo từng buổi hoặc từng khóa.",
    ],
    bullets: [
      "Mentor: chọn mentor trên trang Tìm Mentor, đặt khung giờ và thanh toán qua chuyển khoản tương tự gói đăng ký.",
      "Khóa học: xem chi tiết khóa, bấm ghi danh và thanh toán học phí riêng — không trừ vào quota phỏng vấn AI.",
      "Gói Elite có hỗ trợ ưu tiên khi bạn cần trợ giúp về tài khoản hoặc kỹ thuật, không miễn phí buổi Mentor.",
    ],
  },
  {
    q: "Dữ liệu CV và buổi phỏng vấn của tôi có được bảo mật không?",
    paragraphs: [
      "ProInterview chỉ dùng CV và nội dung buổi luyện để phân tích, góp ý và cải thiện trải nghiệm cho bạn — không bán dữ liệu cho bên thứ ba.",
    ],
    bullets: [
      "File CV được lưu trên hệ thống an toàn; bạn có thể cập nhật hoặc xóa trong hồ sơ cá nhân.",
      "Buổi phỏng vấn AI chỉ hiển thị trong lịch sử tài khoản của bạn.",
      "Khi cần xóa tài khoản hoàn toàn, liên hệ hỗ trợ để được hướng dẫn.",
    ],
  },
  {
    q: "Cần hỗ trợ thêm, liên hệ ở đâu?",
    paragraphs: [
      "Đội ngũ ProInterview sẵn sàng hỗ trợ qua email trong giờ hành chính (8h–18h, thứ Hai – thứ Sáu). Gói Elite được ưu tiên phản hồi nhanh hơn.",
    ],
    note: "Gửi email kèm tên tài khoản, mô tả vấn đề và ảnh chụp màn hình (nếu có) để được xử lý nhanh nhất.",
  },
];

/** Email hỗ trợ khách hàng — hiển thị SupportContact, footer, v.v. */
export const SUPPORT_EMAIL = "supportprointerview@gmail.com";
