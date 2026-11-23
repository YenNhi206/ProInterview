# CLAUDE.md

Hướng dẫn cho Claude Code khi làm việc trong repo này. Tài liệu sản phẩm (README, ROADMAP, API_INDEX, DATABASE) và giao diện người dùng viết bằng **tiếng Việt**.

Cập nhật: 18/11/2026, khớp code nhánh `feat/mentor-workspace-polish-course-archive`. Khi tài liệu và code mâu thuẫn, tin code và sửa lại file này.

---

## Tổng quan dự án

**ProInterview** — nền tảng luyện phỏng vấn xin việc ứng dụng AI (capstone FA26, mã GFA26SE160). Monorepo 3 service:

| Thư mục | Stack | Port dev |
|:--------|:------|:---------|
| `frontend/` | Vite 6 + React 18 + Tailwind CSS v4 + shadcn/ui, React Router 7 (`createBrowserRouter`) | 5173 |
| `backend/` | Express 5 (ESM) + MongoDB (Mongoose 9) + JWT, Node 22 | 5000 |
| `cv_jd_matching/` | Python FastAPI + Uvicorn | 8000 |

**Tài liệu contract API:** `ROADMAP.md` + `API_INDEX.md` — cập nhật cả hai khi thêm/sửa route.
**Công việc đang làm:** xem mục [Capstone FA26](#capstone-fa26-gfa26se160--kế-hoạch-và-quy-ước).

---

## Lệnh phát triển

Trên Windows chạy 3 terminal riêng (`npm run dev:full` hard-code đường dẫn macOS, sẽ sửa ở task N-14).

### Backend (`backend/`)

```bash
npm run dev                    # nodemon → src/server.js (port 5000)
npm start                      # node src/server.js (production)
npm run seed:all               # users dev (chỉ khi collection rỗng) + hồ sơ mentor
npm run seed:samples           # mentor + khóa học mẫu
npm run sync:mentor-profiles   # đồng bộ Mentor với User role mentor
npm run db:prune-fake-mentors  # xóa Mentor không có User tương ứng
npm run warmup:baseline-videos # làm nóng cache video 3 câu baseline
npm run warmup:company-videos:dry  # đếm câu công ty đã duyệt cần render video (CO-06, không render)
npm run warmup:company-videos      # render video câu công ty đã duyệt × 2 giới tính; chạy lại sau khi đổi provider video (AI-15)
npm run db:sync-booking-indexes:dry  # xem trước thay đổi index Booking (không ghi DB)
npm run db:sync-booking-indexes      # drop index cũ mentorshipRequestId_1, tạo index mới (LP-02)
npm run db:migrate-lp-shrm-keys:dry  # xem trước đổi key năng lực tạm của LP-20 sang bộ tiêu chí LP-01 (không ghi DB)
npm run db:migrate-lp-shrm-keys      # đổi thật (PR #204); chạy 1 lần trên production sau khi merge
npm run db:sync-prompt-versions:dry  # xem trước đồng bộ bảng PromptVersion (AI-02, không ghi DB)
npm run db:sync-prompt-versions      # tạo eval-v1/followup-v1/companyq-v1 + chuỗi cũ legacy; chạy lại được (chạy lại sau khi merge CO-04)
node src/scripts/activatePromptVersion.js <key> <version> [--note "..."]   # đổi bản prompt active, không cần deploy
npm test                       # node:test + jest DTO + unittest Python
```

`test:node` trong `package.json` đang liệt kê từng file test: thêm file test mới vào script này cho tới khi xong task N-05 (đổi sang glob, cần Node ≥ 21). Test integration dùng `mongodb-memory-server` (`src/test_helpers/mongoTestHarness.js`), không cần MongoDB thật.

### Frontend (`frontend/`)

```bash
npm run dev       # Vite dev server (5173); proxy /api → http://localhost:5000
npm run build     # production build → dist/
npm test          # node:test cho utils
```

### CV/JD Matcher (`cv_jd_matching/`)

```bash
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000   # docs: /docs
```

### Tài khoản dev (sau `seed:all`)

Mật khẩu: **`Dev123456`**

| Email | Role |
|:------|:-----|
| `customer@dev.local` | customer, plan free |
| `mentor@dev.local` | mentor |
| `admin@dev.local` | admin |
| `moderator@dev.local` | moderator (→ `/moderator/queue`) |
| `enterprise@dev.local` | enterprise — đổi thành `company_moderator` ở task N-02/N-03 |

---

## Cấu hình môi trường

Repo không commit file `.env.example`. Biến tối thiểu:

### Backend `backend/.env`

```env
# Bắt buộc — thiếu thì server exit(1)
MONGO_URI=mongodb://127.0.0.1:27017/prointerview
LLM_API_KEY=<key>
LLM_BASE_URL=https://api.openai.com/v1      # OpenAI-compatible / Anthropic / Gemini / Ollama, tự nhận diện
# Nên có
JWT_SECRET=<chuỗi ngẫu nhiên ≥ 32 ký tự>
CORS_ORIGIN=http://localhost:5173
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_DAYS=30
GOOGLE_CLIENT_ID=<từ GCP>
LLM_MODEL=gpt-4o-mini
CV_ANALYZER_URL=http://localhost:8000
# Tùy chọn — thiếu thì tính năng degrade
ELEVENLABS_API_KEY=<sk_...>  ELEVENLABS_VOICE_ID_MALE=<id>  ELEVENLABS_VOICE_ID_FEMALE=<id>
D_ID_API_KEY=<key>
GOOGLE_VISION_API_KEY=<key>
CLOUDINARY_URL=<cloudinary://...>           # thiếu → lưu public/uploads
UPSTASH_REDIS_REST_URL=<https://...>  UPSTASH_REDIS_REST_TOKEN=<token>   # bắt buộc ở production
JAAS_APP_ID=  JAAS_API_KEY_ID=  JAAS_PRIVATE_KEY=   # thiếu → meet.jit.si
SEPAY_WEBHOOK_API_KEY=<key>
SENTRY_DSN=  MAIL_USER=  MAIL_PASS=
SLACK_ALERT_WEBHOOK_URL=<https://hooks.slack.com/...>   # thiếu → alert chỉ ghi log
# Ngưỡng Slack theo ngày (UTC) cho CostEvent rubric_scoring / course_prescreen (AI-12); mặc định $2·300 lần / $1·50 lần
COST_ALERT_RUBRIC_SCORING_DAILY_USD=  COST_ALERT_RUBRIC_SCORING_DAILY_COUNT=
COST_ALERT_COURSE_PRESCREEN_DAILY_USD=  COST_ALERT_COURSE_PRESCREEN_DAILY_COUNT=
```

Lời gọi LLM cho chấm rubric (JB-07) hoặc sàng lọc khóa (AI-08) truyền `costKind: COST_EVENT_KIND.RUBRIC_SCORING` / `COURSE_PRESCREEN` vào `logGeneration()` (`constants/costEventKinds.js`). Kind không có trong danh sách bị ledger bỏ qua (log `cost_ledger_unknown_kind`).

Production cần thêm `REFRESH_TOKEN_PEPPER` (server exit nếu thiếu).

### Frontend `frontend/.env.local`

```env
VITE_GOOGLE_CLIENT_ID=<giống backend>
# VITE_API_URL: để trống ở dev (Vite proxy) và trên Vercel (vercel.json rewrite /api → Render)
```

`API_BASE_URL` và `apiUrl()` nằm ở `frontend/src/app/api/http.js`.

---

## Kiến trúc Backend (`backend/src/`)

### Entry points

- **`server.js`** — load env → kiểm tra env bắt buộc → Sentry → kết nối MongoDB → tự seed demo (chỉ dev) → bật 4 job → `listen(PORT)`.
- **`app.js`** — `createApp()`: helmet, hpp, `sanitizeObjectKeys`, rate limit `/api`, CORS, `GET /api/health`, mount router.

### Pattern

```
Route → Controller → Service → Mongoose Model
```

Domain nhiều logic có service (auth, bookings, payments, plans, cart, mentor dashboard/earnings/payout, reviews, reports, question bank, moderation queue, AI/avatar). Notifications, courses, enrollments, CV CRUD, upload cho controller gọi model trực tiếp.

### Router mount trong `app.js`

| Nhóm | Prefix |
|:-----|:-------|
| Tài khoản | `/api/auth`, `/api/users`, `/api/notifications`, `/api/analytics` |
| Mentor & đặt lịch | `/api/mentors`, `/api/mentor` (khu vực mentor), `/api/bookings`, `/api/mentorship-requests`, `/api/learning-paths` (capstone), `/api/reviews`, `/api/reports` |
| Công ty & tuyển dụng (capstone) | `/api/company` (Company Mod: câu hỏi, rubric, `jobs`), `/api/company-invites`, `/api/jobs` (công khai, JB-03), `/api/role-categories` (nhóm vị trí từ `config/roleCategories.json`), `/api/profile`, `/api/cvs` |
| Khóa học & bán hàng | `/api/courses`, `/api/enrollments`, `/api/cart`, `/api/coupons`, `/api/plans`, `/api/payments` |
| AI | `/api/cv` (`cv.js` CRUD/quota + `cvMatch.js` proxy Python), `/api/interviews`, `/api/ai`, `/api/competencies` (bộ tiêu chí SHRM/DDI từ `config/competencies.json`, LP-01) |
| Vận hành | `/api/admin`, `/api/moderator`, `/api/upload`, `/api/achievements`, `/api/public` |
| Chỉ dev | `/api/mock` (không mount khi `NODE_ENV=production`) |

`/api/moderator` (`requireModerator` + `adminAuditLog`): duyệt khóa học (`/courses/*`), ngân hàng câu hỏi (`/questions/*`), hàng đợi kiểm định (`/queue/*`), KPI chất lượng (`/quality/stats`), `/content/stats`.

### Models (`models/`) — 37 schema

`User`, `Mentor`, `Booking`, `MentorshipRequest`, `MentorKnowledge`, `Payment`, `PayoutRequest`, `Subscription`, `Coupon`, `SepayWebhookEvent`, `Course`, `Enrollment`, `Cart`, `CartOrder`, `CourseQA`, `MentorPeerReview`, `Review`, `Report`, `CVAnalysis`, `InterviewSession`, `QuestionBank`, `ModerationItem`, `Notification`, `Activity`, `UserEvent`, `SecurityLog`, `CostEvent`, `Achievement`, `LearningPath`, `LearningPathSession`, `PromptVersion`, `Company`, `CompanyInvite`, `CompanyRubric`, `CandidateProfile`, `CVDocument`, `JobPost`. Export qua `models/index.js`. Chi tiết field: `docs/LOGICAL_ERD.md`, `backend/DATABASE.md`.

Plan và quota lưu trên `User` (`plan`, `planExpiresAt`, quota `cvAnalysisUsed`, `interviewUsed`, …).

### Jobs (`jobs/`)

`bookingReminderJob` (nhắc lịch) · `bookingStaleSweepJob` (20 phút: hủy booking `pending` chưa trả đã qua giờ bắt đầu; gắn `staleFlaggedAt` booking đã trả quá giờ kết thúc + 60 phút) · `earningsClearanceJob` (`clearingBalance` → `availableBalance`) · `ttsCleanupJob`.

### Middleware

- `authJwt` — verify Bearer JWT, gắn `req.user` / `req.userId`; `optionalAuth`.
- `requireRole(...roles)`, `requireModerator`, `requireEnterprise` (`requireRole.js`), `requireMentor`, `requireAdmin`. **Admin không đi vòng cổng moderator** (cố ý tách vận hành khỏi kiểm định nội dung).
- `rateLimiters`, `injectionRateLimit` (chặn prompt injection), `adminAuditLog`, `asyncHandler`, `errorHandler`, `upload` (multer).
- `User.role`: `customer | mentor | admin | moderator | enterprise`. Admin gán qua `PATCH /api/users/:id/role` (`ASSIGNABLE_ROLES` không có `admin`).

### Response shape

```js
{ success: true, <key>: data }        // key: user, mentors, bookings, ...
{ success: false, error: "thông báo tiếng Việt" }
```

### Auth & tokens

- Access JWT 15 phút; claim `tv` phải khớp `User.tokenVersion`.
- Refresh token opaque `sessionObjectId:secret`, lưu hash trong `User.authSessions` (tối đa 10 phiên), sống 30 ngày.
- Logout / đổi mật khẩu (`PATCH /api/auth/me`) → `tokenVersion++`, xóa mọi refresh session.
- Sai mật khẩu nhiều lần → `lockUntil`.

---

## Kiến trúc Frontend (`frontend/src/app/`)

```
routes.js     createBrowserRouter (URL thường, không dùng #)
api/          http.js (apiUrl, API_BASE_URL) + module *Api.js theo domain (bookingsApi, cvApi,
              interviewsApi, moderatorApi, adminApi, cartApi, mentorshipRequestsApi, ...)
pages/        auth, home, account, booking, mentors, courses, cv, interview, mentor,
              mentorship, payment, admin, moderator
components/   ui (shadcn), layout, auth, interview, cv, courses, mentor, admin, booking,
              account, profile, reviews, modals, shared, home, brand, decor, legal
hooks/        useAuthSession, useCart, useDIDStream, useFaceAnalysis, useMeetingLiveCapture,
              useNavbarNotifications, usePageAnalytics, useUserPresence, ...
utils/        theo domain: auth/ (auth.js — authFetch, token; requireAuthLoader; roleLoader),
              booking/, course/, cv/, interview/, mentor/, moderator/, plans/, shared/, ...
```

**Auth state:** `localStorage` `prointerview_access_token`, `prointerview_auth`; khôi phục qua `GET /api/auth/me`. `authFetch()` tự gắn Bearer và refresh khi 401.

### Routes chính (`routes.js`)

| Nhóm | Đường dẫn | Bảo vệ |
|:-----|:----------|:-------|
| Công khai (`AppLayout`) | `/`, `/mentors`, `/mentors/:id`, `/courses`, `/courses/:id`, `/pricing`, `/about`, `/blog`, `/achievements`, `/terms`, `/privacy`, `/cv-analysis/*`, `/interview` | `/` chuyển mentor/admin/moderator về khu vực riêng (`roleHomeLoader`) |
| Phỏng vấn | `/interview/room`, `/interview/feedback`, `/interview/trial`, `/interview/trial/done` | `requireCustomerAuthLoader` |
| Ứng viên | `/dashboard`, `/my-bookings`, `/mentor-requests`, `/my-courses`, `/payment-history`, `/cart`, `/booking/:id`, `/session/:id`, `/review/:sessionId`, `/profile`, `/settings` | `requireAuthLoader` + `ProtectedOutlet` |
| Mentor (`MentorArea`) | `/mentor/dashboard`, `schedule`, `requests`, `learning-paths`, `learning-paths/new`, `learning-paths/:pathId/edit`, `finance`, `analytics`, `reviews`, `courses`, `courses/:id/edit`, `peer-review`, `meeting-detail/:id`; `/mentor/session-feedback/:sessionId` | như trên |
| Toàn màn hình | `/checkout`, `/courses/:id/learn`, `/meeting/:sessionId`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/payment-*` | tùy trang |
| Admin | `/admin`, `users`, `users/:id`, `mentors`, `mentors/pending`, `mentors/:id`, `bookings`, `bookings/check-ins`, `bookings/:id`, `finance`, `finance/operations`, `transactions`, `payouts`, `course-payments`, `subscription-payments`, `learning-path-payments`, `audit-log`, `analytics`, `content/questions`, `reviews`, `support`, `achievements`, `settings` | `adminLoader` |
| Moderator | `/moderator/queue`, `queue/:id`, `questions`, `quality`, `courses` | `createRoleLoader("moderator")` |

Các trang admin trong `AdminPlaceholders.jsx` (`users/:id`, `finance`, `transactions`, `payouts`, `content/questions`, `settings`) đều gọi API thật; tên file là di sản cũ.

⚠️ `/admin/analytics`, `/admin/users`, `/admin/users/:id`, `/admin/content/questions` và `components/admin/UserJourneyPanel.jsx` đang **bơm số liệu giả ở trình duyệt** qua `utils/analytics/mock*.js`. Không dùng các hàm này cho màn mới; gỡ ở task N-09.

---

## Tích hợp bên ngoài

### CV Analysis — Express + Python

- Lịch sử/quota: `api/cvApi.js` → `GET/POST/DELETE /api/cv/analyses`, `GET /api/cv/quota`.
- Phân tích: `POST /api/cv/analyze`, `/analyze/full`, `/analyze/suggestions`, `/analyze/field` (`cvMatch.js` proxy sang Python qua `CV_ANALYZER_URL`). Thiếu/sai → `503`.
- Chế độ "theo lĩnh vực" tự rơi về `data/cvFieldAnalysisMock.js` khi API lỗi (ghi `fallbackTriggered`).

### D-ID / ElevenLabs / Cloudinary — Avatar phỏng vấn

Pipeline pre-generated: ElevenLabs TTS (giọng theo gender) → upload audio Cloudinary → D-ID `/talks` lipsync → poll `status=done` → `result_url`. Thiếu ElevenLabs thì D-ID dùng Azure TTS.

- **Baseline (3 câu cố định, `config/baselineQuestions.js`):** `persistVideo: true`, mirror về Cloudinary (`prointerview/avatar-videos/`), cache Redis dùng chung toàn hệ thống.
- **Follow-up (2 câu Pro):** `POST /api/ai/interview/pregenerate`, không cache lâu dài.
- ⚠️ `result_url` của D-ID là presigned S3 URL hết hạn ~24h. Chỉ link đã mirror Cloudinary mới cache dài (180 ngày); link gốc chỉ cache 1h (`RAW_DID_URL_FALLBACK_TTL`). Không bao giờ cache link tự hết hạn với TTL dài.
- **Circuit breaker** (`avatarService.js`): mở sau 3 lỗi D-ID liên tiếp, reset sau 5 phút; pregen luôn thử câu đầu trước khi chạy song song.
- Fallback cuối: Web Speech API (TTS trình duyệt) + ảnh tĩnh.
- Trạng thái tổng hợp: `GET /api/ai/config`.
- Luồng phỏng vấn: `POST /api/interviews/sessions` (3 câu baseline) → `PATCH /sessions/:id` mỗi câu + `analyze-face` → `POST /sessions/:id/generate-followup-questions` (chỉ Pro) → `complete` → `evaluate`. Đánh giá thiếu trường sau 1 lần retry → `ModerationItem` `evaluation_incomplete`. Route cũ `POST /api/interviews/generate-questions` còn nhưng FE không gọi.

### Thanh toán

Kênh chính thức là **chuyển khoản ngân hàng**: `recordTransferPending` → user `submit-transfer` → SePay webhook (`POST /api/payments/webhook/sepay`) khớp mã `PI…` **hoặc** admin xác nhận → `recordAdminTransferSuccess`. Dùng cho booking, khóa học, giỏ hàng (`CartOrder`, 1 QR cho cả đơn), gói Pro và lộ trình học (Payment `learning_path`, `POST /api/learning-paths/:id/checkout`, LP-10). MoMo/ZaloPay/VNPay chỉ là stub, trả 400 ở production. Thêm khoản thu mới thì tái dùng đường ray này.

### Google Identity

ID token → `POST /api/auth/google`. Vercel cần header `Cross-Origin-Opener-Policy: same-origin-allow-popups` (đã có trong `vercel.json`).

### Jitsi / JaaS

Phòng họp mentor (`/meeting/:sessionId`). Thiếu `JAAS_*` → `meet.jit.si` (giới hạn ~5 phút).

---

## Khái niệm domain chính

### Plans & Quota

| Plan key | Tên | Giá | Ưu đãi booking/khóa |
|:---------|:----|:----|:--------------------|
| `free` | Free | 0 | — |
| `starter_pro` | Pro | 99.000đ/tháng | 5% |
| `elite_pro` | Elite | 199.000đ/tháng | 10% |

Nguồn sự thật: `backend/src/constants/planCatalog.js`.

### Mentor

- User `role=mentor` phải có document `Mentor` (`userId`); hook `User.post("save")` tự tạo. Lệch thì chạy `sync:mentor-profiles`.
- URL công khai dùng `publicId`, không dùng `_id`.
- Thu nhập: `clearingBalance` → (`earningsClearanceJob`) → `availableBalance` → payout → `pendingBalance`.

### Bookings

- `status`: `pending → confirmed → in_progress → completed`; ngoài ra `cancelled`, `no_show` (`rescheduled` còn trong enum nhưng không hàm nào ghi).
- `paymentStatus`: `pending | paid | refund_pending | refunded | partial_refund | failed`.
- Ứng viên hủy: `DELETE /api/bookings/:id` (không tạo `PATCH .../cancel`); ứng viên không tự dời lịch.
- Chi tiết mọi chuyển trạng thái: `docs/STATE_MACHINES.md`.

---

## Deployment

| Service | Nơi | Ghi chú |
|:--------|:----|:--------|
| Backend | Render (`render.yaml`, region singapore, `rootDir: backend`) | Health check `/api/health` |
| Frontend | Vercel (`frontend/vercel.json`) | Rewrite `/api/*` và `/uploads/*` → `https://prointerview-backend.onrender.com`; không cần `VITE_API_URL` |
| CV service | Render/Heroku (`Procfile`, `runtime.txt`) | Set `CV_ANALYZER_URL` cho backend |

⚠️ Nhập biến môi trường trên Render **không kèm dấu ngoặc kép** (Render lưu nguyên văn, không strip như dotenv). Đã gặp: `UPSTASH_REDIS_REST_URL` dính dấu `"` → Redis lỗi → toàn bộ avatar pregen trả `null`.

### Quyết định kiến trúc vận hành (V5, 21/06/2026)

1. Trial chỉ 3 câu baseline, chấm điểm nhẹ.
2. MVP chỉ dùng chuyển khoản + SePay, không tích hợp cổng thanh toán.
3. Câu hỏi: 3 baseline cố định (free) + 2 follow-up sinh giữa buổi từ CV/JD và câu trả lời thật (Pro).
4. Redis bắt buộc ở production (`cacheService.js` throw, server fail-fast khi thiếu); Sentry + Slack alert + cost ledger (`CostEvent`).

---

## Capstone FA26 (GFA26SE160) — kế hoạch và quy ước

Công việc hiện tại bám theo đơn đăng ký capstone V2. Trước khi code một tính năng mới, đọc:

- **[docs/capstone/TASKS.md](docs/capstone/TASKS.md)**: 107 task, người phụ trách, phụ thuộc, điều kiện "Xong khi", cổng giai đoạn, Definition of Done.
- **[docs/capstone/DECISIONS.md](docs/capstone/DECISIONS.md)**: 14 quyết định đã chốt, công thức chia tiền lộ trình, state machine mới, ánh xạ tên role.
- **[docs/capstone/DESIGN.md](docs/capstone/DESIGN.md)**: thiết kế tham khảo — 11 model mới, 12 model cần sửa, API/màn hình, mục 7 "Bẫy trong code" (đọc trước khi sửa vùng liên quan).

### Quy ước

- **Mã task**: `N` nền tảng · `LP` Learning Path · `CO` Company/Rubric · `PR` Profile/CV · `JB` Job Post/Ứng tuyển · `AI` vòng AI · `QA` · `DOC`. Nhánh `feat/<mã>-<tên-ngắn>`, tên PR mở đầu bằng mã task.
- **Tên role**: code giữ `customer` và `moderator`; UI hiển thị Candidate, Platform Moderator. Role `enterprise` được đổi thành `company_moderator` (task N-02). Chữ `enterprise` trong `CVAnalysis.planAtTime` là **giá trị gói**, không phải role, không đổi.
- **Tái dùng, không dựng song song**: Booking cho mọi buổi gặp; đường ray chuyển khoản + SePay cho mọi khoản thu; mở rộng router có sẵn (`/api/mentorship-requests`, không tạo `/api/mentor-requests`).
- Thêm loại thông báo mới thì thêm vào `NOTIFICATION_TYPE_GROUPS` (`models/Notification.js`) trước, nếu không Mongoose từ chối bản ghi và `deliverNotification` chỉ log lỗi. Ref mới trong `metadata` cũng phải khai báo (sub-document strict). FE chọn icon theo tiền tố trong `utils/shared/notificationKind.js`.

### Bẫy trong code (đã kiểm tra 18/11/2026)

| Chỗ | Bẫy | Cách xử lý |
|:----|:----|:-----------|
| `backend/src/models/Booking.js` (index `mentorshipRequestId_regular_unique`) | Đã sửa ở LP-02: chỉ chặn trùng booking thường (`REQUEST_UNIQUE_SESSION_TYPES`), buổi `assessment` không bị chặn; booking lộ trình không gắn `mentorshipRequestId` | Đổi index trên Booking thì phải chạy `npm run db:sync-booking-indexes` trên DB thật (production đã chạy 18/11/2026). Chạy DB khác `.env` dùng `TARGET_MONGO_URI` (`loadEnv` ghi đè `MONGO_URI`); trên PowerShell dùng lệnh `:dry`, không dùng `-- --dry-run` |
| `services/mentorEarningsService.js:21` | `mentorNetFromBooking` = `totalAmount − platformFee`, không đọc `platformFeeRate` | Booking nào không qua checkout thường phải ghi sẵn `platformFee`: booking lộ trình / buổi 0đ dùng `learningPathBookingMoney()` / `assessmentBookingMoney()` trong `utils/learningPathBookingMoney.js` (LP-04) |
| `controllers/adminController.js` `getPlatformFinanceSummary` | Cộng mọi booking `paid` vào doanh thu | Đã loại booking lộ trình và buổi 0đ bằng `EXCLUDE_LEARNING_PATH_BOOKINGS` (LP-04); báo cáo doanh thu booking mới cũng phải loại như vậy |
| `jobs/bookingStaleSweepJob.js` | Hủy mọi booking `pending` chưa trả tiền đã qua giờ bắt đầu | Booking không cần thanh toán riêng phải tạo với `paymentStatus: "paid"` |
| `services/bookingsService.js` (`cancelMyBooking`, `cancelMentorBooking`, `processBookingNoShow`, `resolveMentorCancelBooking`) | Booking `paid` bị hoàn tiền / sinh rebook credit theo từng buổi | Đã chặn ở LP-22: `isLearningPathOrAssessmentBooking()` → `closeLearningPathOrAssessmentBooking()` (không hoàn tiền, không credit, buổi lộ trình quay về `planned`). Luồng hủy/hoàn tiền mới cũng phải kiểm tra hàm này |
| `LearningPathSession` + Booking lộ trình (LP-12) | Tạo Booking lộ trình bằng tay (seed, task khác) dễ quên gắn `learningPathSessionId`, quên giữ buổi, hoặc mở buổi khi buổi trước chưa đạt | Đặt lịch qua `scheduleLearningPathSession` (`services/learningPathSessionsService.js`); buổi nào đang mở tính bằng `findSchedulableSession` (`utils/learningPathSchedule.js`). Buổi `planned` tạo ra (học lại, buổi bổ sung) **mở đặt lịch ngay** nếu là lần học mới nhất của `order` đó |
| Booking của ứng viên (mọi luồng tạo / dời giờ) | Unique index `mentorId + date + timeSlot` chỉ chặn trùng **cùng mentor, cùng giờ bắt đầu**; ứng viên vẫn đặt được 2 mentor chồng giờ, hoặc 19:00 và 19:30 | Gọi `findCandidateBookingConflict` (`services/bookingConflictService.js`) trước khi tạo hoặc đổi giờ booking; trả `candidateConflictMessage` cho ứng viên, `MENTEE_BUSY_MESSAGE` cho mentor (không lộ lịch). Luồng tạo booking mới cũng phải gọi. Test tạo nhiều buổi cho cùng ứng viên phải cách nhau ≥ thời lượng buổi |
| `services/sepayWebhookService.js` | `findPendingTargets` chỉ nhận cart, booking, booking_group, course, subscription, learning_path (LP-10); `parsePiOrderFromText` chỉ nhận mã `PI…` | Loại thanh toán mới cần target riêng, thêm vào `TRANSFER_REFERENCE_MODELS` (`paymentsService.js`), `PAYMENT_TYPES` (`Payment.js`), `SEPAY_ENTITY_TYPES` (`SepayWebhookEvent.js`), và sinh mã bằng `generatePiOrderRef()` (`utils/orderRef.js`). Mẫu đầy đủ: `services/learningPathPaymentService.js` |
| `services/mentorshipRequestsService.js` `resolveRequestBooking` | Trước LP-05 chỉ cho tạo booking khi `request.status === "selected"` | Đã sửa ở LP-05: dùng `REQUEST_MENTOR_CHOSEN_STATUSES` (`selected`, `assessing`, `path_proposed`). Thêm status mới sau khi chọn mentor thì thêm vào hằng số này |
| `controllers/interviewsController.js:476` | Trả `alreadyGenerated` khi `questions.length >= 5`; `questionsAllowed` lấy theo quota | Buổi có sẵn hơn 3 câu từ đầu (luyện theo job) phải xét theo câu follow-up thực tế |
| `services/moderationQueueService.js:39, :83` | `createItemForReport` map mọi `targetType` khác thành `evaluation_report`; danh sách hàng đợi không lọc `type` | Loại mới cần map riêng; hàng đợi HITL chỉ lấy 3 loại phỏng vấn |
| `models/QuestionBank.js` | `orgId` đang `ref: "Organization"` (model không tồn tại); `status` đã có `draft`, `rejected`; `roleCategory` đã có index | Đổi ref sang `"Company"`; dùng lại field có sẵn, không thêm field mới |
| `frontend/src/app/utils/analytics/mock*.js` | 4 trang admin + `UserJourneyPanel.jsx` bơm số liệu giả ở trình duyệt | Không dùng cho màn mới; gỡ ở N-09 |
| `config/roleCategories.json` | Trước 22/11/2026 mỗi nơi tự đặt `roleCategory` (phỏng vấn AI dùng key của `ROLE_COMPETENCY_MAP`, khu công ty dùng danh sách riêng ở FE) nên câu hỏi, rubric, job không khớp nhau | BE kiểm bằng `isValidRoleCategory` (`services/roleCategories.js`), FE đọc `GET /api/role-categories` (hook `useRoleCategories`). Map sang phỏng vấn AI qua `interviewRole`. Không đặt danh sách vị trí riêng trong code |
| `config/competencies.json` (LP-01) | Đặt danh sách năng lực riêng, hoặc chỉ kiểm key bằng regex, thì lưu được key không có trong bộ tiêu chí: chấm điểm, `suggestOutcome` và hồ sơ năng lực không tra được | Backend kiểm bằng `isValidCompetencyKey`; frontend đọc `GET /api/competencies`. Quy tắc đầy đủ: DECISIONS.md mục "Bộ tiêu chí năng lực SHRM/DDI (LP-01)" |
| `InterviewSession` | 3 câu baseline có `competencyId = ""`; `moderatorOverride` và `evaluationIncomplete` nằm trên `answers[i]`, không nằm trên `feedback.perQuestion[i]`; `shrmLevel` có fallback `"proficient"` | Quy đổi điểm AI sang mức bằng `aiAnswerToLevel(item, { answer })`, không đọc `shrmLevel` (AI-13 sẽ bỏ fallback) |
| `backend/src/prompts/*.js` (AI-02) | Sửa thẳng chữ prompt trong code: production vẫn chạy bản trong DB, Quality Dashboard không tách được version | Tạo `PromptVersion` mới rồi `activate`; `db:sync-prompt-versions` cảnh báo khi template trong DB khác code ở cùng version. Loader lỗi thì dùng bản mặc định, `promptVersion` ghi theo bản thực sự chạy |
| Script trong `src/scripts/` được test import | `import "../config/loadEnv.js"` ở đầu file nạp `.env` với `override: true`, ghi đè `JWT_SECRET` và biến của môi trường test → test HTTP lỗi 401 | Nạp `loadEnv` trong `main()` (xem `syncPromptVersions.js`) |
| `package.json` `test:node` | Liệt kê từng file test; `node --test` chỉ nhận glob từ Node 21 | Cho tới khi xong N-05: thêm file test mới vào script này |

---

## Quy tắc phát triển

### Khi thêm API mới

1. Model (export ở `models/index.js`) → service (nếu có logic) → controller → route gắn `authJwt` + `requireRole(...)`.
2. Mount router trong `backend/src/app.js` nếu là prefix mới; ưu tiên mở rộng router có sẵn.
3. Test integration trong `backend/src/integration/` (và thêm vào `test:node` cho tới khi xong N-05).
4. Cập nhật `API_INDEX.md` (Phần A) và `ROADMAP.md`. Model mới → `docs/LOGICAL_ERD.md`, `backend/DATABASE.md`, `docs/database/prointerview_schema.mongodb.js`. Enum `status` mới → `docs/STATE_MACHINES.md`, và kiểm tra các job trong `backend/src/jobs` có lọc theo status đó không.

### Khi nối FE với API

1. Thêm/sửa hàm trong `frontend/src/app/api/*Api.js` tương ứng.
2. Dùng `apiUrl(path)` từ `api/http.js`, không hardcode URL.
3. Route cần đăng nhập dùng `authFetch()` từ `utils/auth/auth.js`.
4. Không đưa dữ liệu giả hay state demo vào màn hình.

### Conventions

- Response `{ success: true, <key> }` / `{ success: false, error }`, thông báo lỗi tiếng Việt.
- Mentor public URL dùng `publicId`.
- Hủy booking: `DELETE /api/bookings/:id`. Đổi mật khẩu: `PATCH /api/auth/me`.
- Script seed/reset nguy hiểm dùng `scripts/_devOnlyGuard.js` để chặn production.

---

## Tài liệu liên quan

| File | Nội dung |
|:-----|:---------|
| `docs/capstone/TASKS.md` | Kế hoạch 107 task capstone FA26, phân công, cổng giai đoạn |
| `docs/capstone/DECISIONS.md` | 14 quyết định thiết kế capstone, chia tiền lộ trình, state machine mới |
| `docs/capstone/DESIGN.md` | Thiết kế tham khảo capstone: model mới/sửa, API và màn hình, bẫy trong code |
| `ROADMAP.md` | Endpoint theo phase, trạng thái ✅/📋 |
| `API_INDEX.md` | Contract đầy đủ: Phần A (đang chạy), B (ngoài Express), C (roadmap) |
| `backend/DATABASE.md` | Schema MongoDB chi tiết từng field |
| `docs/SYSTEM_OVERVIEW.md` | Sơ đồ kiến trúc tổng quan |
| `docs/LOGICAL_ERD.md` | Logical ERD các collection + ràng buộc/unique index |
| `docs/database/prointerview_schema.mongodb.js` | Script mongosh tạo collection + validator + index |
| `docs/STATE_MACHINES.md` | State machine các field `status` + hàm/endpoint gây chuyển trạng thái |
| `docs/ACTIVITY_DIAGRAMS.md` | Activity diagram 9 luồng nghiệp vụ chính |
| `docs/report/` | SRS, SDD, đăng ký capstone, kiểm thử |
| `POSTMAN_TESTING.md` | Hướng dẫn test API với Postman |


## Kế hoạch capstone (docs/plan/)

- Phạm vi đã đăng ký: docs/plan/REGISTRATION_V2.md. Mã REQ: docs/plan/REQUIREMENTS.md.
- Tiến độ và task: docs/plan/TASKS.md (nguồn đúng duy nhất). Quyết định: docs/plan/DECISIONS.md. Thiết kế và bẫy: docs/plan/DESIGN.md.
- Thứ tự đọc trước mỗi task: REQUIREMENTS.md → TASKS.md → DECISIONS.md → DESIGN.md.
- Mỗi task gắn ít nhất một mã REQ. Task không có REQ: dừng và báo.
- Việc phát sinh: phân loại bat-buoc / chi-tiet / ngoai-don / no-ky-thuat (START_HERE.md mục "Luật task phát sinh"). Không tự thêm task vào bảng chính; ghi vào "Đề xuất thay đổi kế hoạch".
- Chỉ làm đủ cột "Xong khi". Không mở rộng sang REQ khác trong cùng PR.
- Tài liệu và code mâu thuẫn: tin code, ghi đề xuất, không tự đổi phạm vi.
- Tên role: code customer / mentor / admin / moderator / company_moderator; báo cáo Candidate / Mentor / Admin / Platform Moderator / Company Moderator.
- Repo có 2 agent (Claude Code và Gemini trong Antigravity). Luật cho Gemini nằm ở AGENTS.md; sửa luật kế hoạch thì sửa cả hai file.
- Một task chỉ một agent làm: task đang Doing hoặc Review thì dừng và báo.
- Sửa TASKS.md, REQUIREMENTS.md, DECISIONS.md: pull nhánh chính trước, chỉ sửa dòng của task mình và thêm dòng mới vào cuối bảng, không định dạng lại bảng.
- Mô tả PR có 2 dòng: "REQ: <mã, mã>" và "Agent: Claude".