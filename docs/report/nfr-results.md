# Kết quả đo phi chức năng (NFR)

> **Dự án**: ProInterview (Capstone FA26, GFA26SE160)
> **Phụ trách đo**: Nguyễn Việt Văn (QA-02, QA-03) · Janet (QA-08, đo lại avatar sau khi đổi provider)
> **Cập nhật**: 24/11/2026

> ⚠️ **Bản 19/11/2026 của file này đã bị gỡ (đề xuất ae).** Các số QA-02 và QA-03 trong bản đó **không phải số đo**:
> `backend/src/scripts/measureNfrPerformance.js` tự sinh thời gian CV / avatar bằng `Math.sin`, `Math.cos`, `Math.random`
> và gõ cứng kết quả k6. Script k6 khi đó còn gọi sai đường dẫn (`POST /api/interviews`) và đọc sai trường token, nên không
> thể cho ra tỉ lệ lỗi đã ghi. Không dùng bất kỳ số nào của bản cũ trong báo cáo nộp. Mọi số dưới đây phải kèm file mẫu gốc
> trong `docs/report/nfr-raw/`.

## 1. Tóm tắt

| Mã | Mục tiêu | Kết quả | Bằng chứng | Trạng thái |
|:---|:---|:---|:---|:---:|
| QA-01 | Bật `MOCK_AI_SERVICES` thì không phát sinh chi phí AI | Không ghi CostEvent, không gọi D-ID / ElevenLabs | Test `backend/src/integration/mockAiServices.integration.test.js` (chạy trong `npm test`) | ✅ Đạt |
| QA-02 (NFR-04) | 100 người dùng đồng thời: p95 < 2000 ms, lỗi < 1% | **Chưa đo** | Cần file `nfr-raw/k6-*.json` từ lần chạy thật trên staging | ⏳ |
| QA-03 (NFR-01) | Phân tích CV/JD ≤ 60 giây (30 lần phân tích) | **Chưa đo** | Cần file `nfr-raw/cv-*.json` | ⏳ |
| QA-03 (NFR-02) | Video avatar ≤ 130 giây (20 câu mới, 20 câu đã cache) | **Chưa đo** | Cần file `nfr-raw/avatar-*.json` | ⏳ |

## 2. Cách đo

### QA-03: CV/JD (NFR-01)

Mỗi lần gọi Python, backend ghi một dòng log `cv_analysis_timing` (N-11). Một lần phân tích có thể gọi nhiều bậc
(suggestions → full → basic), nên **thời gian người dùng chờ = tổng các lượt cùng `analysisId`**; vì vậy đo từ log, không
đo từ DB (DB chỉ giữ lượt cuối).

1. Trên staging, phân tích đủ ít nhất 30 lần với CV và JD khác nhau.
2. Tải log backend từ Render (Logs → Download), lưu ví dụ `render-backend.log`.
3. `cd backend && node src/scripts/measureNfrPerformance.js cv --log render-backend.log --limit 30`
4. Chép bảng in ra vào mục 3 và commit file `docs/report/nfr-raw/cv-*.json`.

Khi không có log: `node src/scripts/measureNfrPerformance.js cv --since <ngày>` đọc `CVAnalysis.meta.processingTimeMs`
(đặt `TARGET_MONGO_URI` cho DB staging). Cách này chỉ tính lượt gọi cuối, phải ghi rõ trong báo cáo.

### QA-03: Avatar (NFR-02)

Mỗi video ghi một dòng `avatar_video_timing` (`fromCache`, `ok`, `durationMs`).

1. Trên staging, chạy phỏng vấn sao cho có ít nhất 20 câu chưa có video (câu follow-up hoặc câu doanh nghiệp mới) và 20 câu đã cache (câu baseline sau khi `npm run warmup:baseline-videos`).
2. `node src/scripts/measureNfrPerformance.js avatar --log render-backend.log --limit 20`
3. Ghi rõ provider đang chạy (`GET /api/ai/config`). Sau khi đổi sang ElevenLabs (AI-15), đo lại ở QA-08.

### QA-02: 100 người dùng đồng thời (NFR-04)

1. Staging backend bật `LOAD_TEST=true` (bỏ rate limit, `middleware/rateLimiters.js`) và `MOCK_AI_SERVICES=true` (không gọi AI thật, QA-01), có tài khoản demo (`npm run seed:demo-staging`) hoặc tài khoản riêng cho test tải.
2. Cài k6 (`winget install k6` hoặc https://k6.io/docs/get-started/installation/).
3. `k6 run -e TARGET_URL=https://<staging-backend> -e K6_EMAIL=<email> -e K6_PASSWORD=<mật khẩu> --summary-export=docs/report/nfr-raw/k6-<ngày>.json backend/tests/load/k6-load-100vus.js`
4. Ghi p95 `http_req_duration`, `error_rate`, p95 từng bước và số lần `interview_quota_limited` (hết lượt phỏng vấn, phản hồi 403 nghiệp vụ, không tính lỗi) vào mục 3.
5. Tắt `LOAD_TEST` và `MOCK_AI_SERVICES` sau khi đo.

## 3. Kết quả

*(Chưa có lần đo thật. Điền sau khi chạy các lệnh ở mục 2, ghi kèm ngày đo, môi trường, provider AI và đường dẫn file mẫu gốc.)*
