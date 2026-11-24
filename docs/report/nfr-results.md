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

**Chưa có số đo.** Script `backend/tests/load/k6-load-100vus.js` đã sửa đường dẫn tạo phiên phỏng vấn
(`POST /api/interviews/sessions`; bản cũ gọi `POST /api/interviews`, route không tồn tại). Cách đo:

1. Chạy trên **staging** (không chạy trên production), bật chế độ mock của QA-01 để không phát sinh chi phí AI, báo nhóm trước.
   Cả 100 VU đăng nhập chung tài khoản `candidate.demo@prointerview.vn` và mỗi lượt tạo phiên trừ 1 lượt phỏng vấn: nâng
   `quota.interviewLimit` của tài khoản này đủ lớn trước khi chạy, và nới rate limit đăng nhập cho môi trường test (QA-02),
   nếu không sẽ nhận 403 / 429 và tỉ lệ lỗi không phản ánh hệ thống.
2. `k6 run --summary-export docs/report/nfr-raw/k6-<thời điểm>.json backend/tests/load/k6-load-100vus.js`
3. Ghi p95 và tỉ lệ lỗi từ file JSON vào bảng trên; commit file JSON.
