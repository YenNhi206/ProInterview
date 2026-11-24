# Báo cáo kết quả đo lường phi chức năng (NFR Performance Results)

> **Dự án**: Nền tảng luyện phỏng vấn ProInterview (Capstone FA26)
> **Người thực hiện**: Nguyễn Việt Văn
> **Cập nhật**: 24/11/2026

> ⚠️ **Trạng thái: đang đo lại, chưa dùng để nộp.**
> Bản trước (19/11/2026) ghi các số p50/p95, số request k6 và biểu đồ phân bổ **không phải số đo thật**: script cũ
> `measureNfrPerformance.js` tự sinh thời gian CV / avatar bằng `Math.sin`, `Math.cos`, `Math.random`, và gõ cứng kết quả
> k6 (14850 request, lỗi 0.08%, p95 680ms). Bản đó cũng tự mâu thuẫn (biểu đồ có CV 40–50 giây trong khi max ghi 34,69 giây).
> Các số đó đã được gỡ khỏi báo cáo này (đề xuất (ae), PR #275). QA-02 và QA-03 chuyển lại `Doing` cho tới khi có số đo thật.

---

## 1. Tóm tắt

| Mã | Mục tiêu cam kết | Kết quả | Trạng thái |
|:---|:---|:---|:---:|
| **QA-01** | Bật chế độ mock thì không phát sinh chi phí | Không phát sinh `CostEvent` khi bật `MOCK_AI_SERVICES` (test tự động `mockAiServices.integration.test.js`) | ✅ Đạt |
| **QA-02** (NFR-04) | 100 người dùng đồng thời, p95 < 2000 ms, lỗi < 1% | **Chưa đo** (mục 4) | ⏳ Đang đo |
| **QA-03** CV (NFR-01) | Phân tích CV/JD ≤ 60 giây (30 CV) | **Chưa đo** (mục 2) | ⏳ Đang đo |
| **QA-03** Avatar (NFR-02) | Video avatar ≤ 130 giây (20 câu mới, 20 câu đã cache) | **Chưa đo** (mục 3) | ⏳ Đang đo |
| **QA-04** (NFR-03) | Đối soát chuyển khoản SePay, p95 ≤ 5 giây (đề xuất, cần chốt) trên 20 giao dịch | **Chưa đo** (mục QA-04 cuối file) | ⏳ Đang đo |

---

## 2. Thời gian phân tích CV/JD (QA-03, NFR-01)

**Chưa có số đo.** Cách đo (script đã viết lại ở PR #275, chỉ tính từ số đo thật, thiếu mẫu thì báo `THIẾU MẪU`):

1. Tải log Render (staging hoặc production) có dòng `cv_analysis_timing` (N-11).
2. `node src/scripts/measureNfrPerformance.js cv --log <file log>`: cộng các lượt cùng `analysisId` = thời gian người dùng thực sự chờ. Cần ít nhất 30 lần phân tích.
3. Ghi p50 / p95 / max vào bảng trên; commit file mẫu gốc `docs/report/nfr-raw/cv-<thời điểm>.json` do script sinh.

## 3. Thời gian sinh video avatar (QA-03, NFR-02)

**Chưa có số đo.** Cách đo:

1. Tải log Render có dòng `avatar_video_timing` (N-11).
2. `node src/scripts/measureNfrPerformance.js avatar --log <file log>`: tách video mới và video đã cache, đếm riêng video mới bị lỗi. Cần ít nhất 20 câu mới và 20 câu đã cache.
3. Ghi kết quả kèm provider đang chạy (D-ID hoặc ElevenLabs sau AI-15); commit `docs/report/nfr-raw/avatar-<thời điểm>.json`.

## 4. Kiểm thử tải 100 người dùng đồng thời (QA-02, NFR-04)

**Chưa có số đo.** Script `backend/tests/load/k6-load-100vus.js` đã sửa (PR #277):
- Đăng nhập đọc trường `token` (bản cũ đọc `accessToken` nên mọi lần đăng nhập đều tính lỗi); mỗi VU đăng nhập một lần rồi dùng lại.
- Tạo phiên qua `POST /api/interviews/sessions` (bản cũ gọi `POST /api/interviews`, route không tồn tại), gửi 3 câu baseline lấy từ `GET /api/interviews/baseline-questions`.
- Trang job phải trả 200 (bỏ kiểu chấp nhận cả 404).
- 403 hết lượt phỏng vấn là phản hồi nghiệp vụ đúng: không tính lỗi, đếm riêng ở `interview_quota_limited` để báo cáo ghi rõ.

Cách đo:

1. Chạy trên **staging** (không chạy trên production), báo nhóm trước. Backend staging bật tạm `LOAD_TEST=true` (bỏ rate limit,
   `middleware/rateLimiters.js`) và `MOCK_AI_SERVICES=true` (không gọi AI thật, QA-01). Cả 100 VU dùng chung một tài khoản và mỗi
   lượt tạo phiên trừ 1 lượt phỏng vấn: nâng `quota.interviewLimit` của tài khoản test đủ lớn, nếu không phần lớn lượt sẽ là 403
   (không tính lỗi nhưng không đo được thời gian tạo phiên thật).
2. `k6 run -e TARGET_URL=https://<staging-backend> -e K6_EMAIL=<email> -e K6_PASSWORD=<mật khẩu> --summary-export docs/report/nfr-raw/k6-<thời điểm>.json backend/tests/load/k6-load-100vus.js`
3. Ghi p95 `http_req_duration`, `error_rate`, p95 từng bước và số `interview_quota_limited` vào bảng trên; commit file JSON. Tắt `LOAD_TEST` và `MOCK_AI_SERVICES` sau khi đo.

---

<!-- QA-04:start -->
## QA-04: Đối soát chuyển khoản SePay (NFR-03)

> **Chưa có số đo.** Mục này do `npm run qa:sepay-reconcile:write` (`backend/src/scripts/measureSepayReconcile.js`) ghi đè, không điền tay.
> Mốc đo: từ lúc `POST /api/payments/webhook/sepay` vào handler tới lúc đơn đã xác nhận và webhook ghi `processed` (`SepayWebhookEvent.processingMs`, có từ QA-04).
> Ngưỡng đề xuất p95 ≤ 5 giây (REQUIREMENTS ghi "CẦN CHỐT", nhóm cần chốt con số).

Cách đo:

1. Deploy bản có QA-04 lên môi trường đo (production hoặc staging có SePay thật).
2. Thực hiện 20 giao dịch chuyển khoản thật khớp mã `PI…` (booking, khóa học, gói Pro, giỏ hàng hoặc lộ trình).
3. Chạy `$env:TARGET_MONGO_URI="<URI DB đã đo>"; $env:SINCE="<ngày bắt đầu đo, YYYY-MM-DD>"; npm run qa:sepay-reconcile:write` trong `backend/`.
<!-- QA-04:end -->
