# CLAUDE.md

Tài liệu hướng dẫn cho Claude Code khi làm việc trong repo này. Viết bằng tiếng Anh để tương thích tối đa, tài liệu sản phẩm (README, ROADMAP, API_INDEX, DATABASE) bằng **tiếng Việt**.

---

## Tổng quan dự án

**ProInterview** — SaaS luyện phỏng vấn xin việc, kiến trúc monorepo:

| Thư mục | Stack | Port dev |
|:--------|:------|:---------|
| `frontend/` | Vite + React 18 + Tailwind CSS + shadcn/ui | 5173 |
| `backend/` | Express 5 + MongoDB (Mongoose 9) + JWT | 5000 |
| `cv_jd_matching/` | Python FastAPI + Uvicorn | 8000 |

**Ngôn ngữ sản phẩm:** Tiếng Việt (giao diện user-facing, tài liệu nội bộ).  
**Tài liệu contract API:** `ROADMAP.md` + `API_INDEX.md` — cập nhật cả hai khi thêm/sửa route.

---

## Lệnh phát triển

### Backend (`backend/`)

```bash
npm run dev                    # nodemon → src/server.js (port 5000)
npm start                      # node src/server.js (production)
npm run seed:users             # Seed users dev (chỉ khi collection rỗng)
npm run seed:all               # Seed toàn bộ dữ liệu mock
npm run seed:ui-mock           # Seed mock cho UI
npm run db:prune-fake-mentors  # Xóa Mentor docs không có User tương ứng
npm run sync:mentor-profiles   # Đồng bộ Mentor profiles với Users
```

**Node:** `>=20` (xem `backend/package.json` → `engines`).

### Frontend (`frontend/`)

```bash
npm run dev       # Vite dev server (5173); proxy /api → http://localhost:5000
npm run build     # Production build → dist/
npm run dev:full  # Chạy cả frontend + backend song song
```

### CV/JD Matcher (`cv_jd_matching/`)

```bash
cd cv_jd_matching
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

API docs khi chạy local: `http://127.0.0.1:8000/docs`

### Tài khoản dev (sau `seed:users`)

Mật khẩu mặc định tất cả: **`Dev123456`**

| Email | Role / Plan |
|:------|:-----------|
| `customer@dev.local` | customer, plan: free |
| `mentor@dev.local` | mentor |
| `admin@dev.local` | admin |

---

## Cấu hình môi trường

### Backend `backend/.env`

```env
MONGO_URI=mongodb://127.0.0.1:27017/prointerview
JWT_SECRET=<chuỗi dài ngẫu nhiên>
CORS_ORIGIN=http://localhost:5173
JWT_ACCESS_EXPIRES_IN=15m   # tên cũ JWT_EXPIRES_IN vẫn được đọc làm fallback; mặc định code: 15m
REFRESH_TOKEN_DAYS=30
GOOGLE_CLIENT_ID=<từ GCP>
ADMIN_INVITE_CODE=<optional>
CV_ANALYZER_URL=https://your-cv-analyzer.example.com   # Python FastAPI URL (prod)
# LLM — AI question generation (OpenAI-compatible)
LLM_API_KEY=<your-key>
LLM_BASE_URL=https://api.openai.com/v1   # hoặc DS2API / GLM / DeepSeek endpoint
LLM_MODEL=gpt-4o-mini
# AI avatar stack — xem "D-ID / ElevenLabs / Cloudinary — Avatar phỏng vấn" bên dưới
ELEVENLABS_API_KEY=<sk_...>
ELEVENLABS_VOICE_ID_MALE=<voice id>
ELEVENLABS_VOICE_ID_FEMALE=<voice id>
D_ID_API_KEY=<base64 key:>
UPSTASH_REDIS_REST_URL=<https://...upstash.io>   # KHÔNG có dấu "" — xem gotcha Render bên dưới
UPSTASH_REDIS_REST_TOKEN=<token>
```

Xem `backend/.env.example` để biết đầy đủ biến.

### Frontend `frontend/.env.local`

```env
VITE_GOOGLE_CLIENT_ID=<giống backend>
VITE_API_URL=https://your-api.example.com   # Chỉ cần khi prod SPA ≠ API host
```

`frontend/src/app/utils/api.js` resolve `API_BASE_URL`: ưu tiên `VITE_API_URL`, fallback `http://localhost:5000` (dev), rồi `""` (same-origin prod).

---

## Kiến trúc Backend (`backend/src/`)

### Entry points

- **`server.js`** — load env, kết nối MongoDB, gọi `createApp()`, listen `PORT` (default 5000).
- **`app.js`** — `createApp()`: middleware, `GET /api/health`, mount tất cả routers `/api/*`.

### Pattern chuẩn

```
Route → Controller → Service → Mongoose Model
```

Thực tế: auth, bookings, payments, plans, mentor dashboard, reviews, reports, dashboard stats, user role → có Service. Admin, notifications, courses, enrollments, CV CRUD, interviews, upload, mock courses → Controller gọi Model trực tiếp (không qua Service).

### Routers mounted trong `app.js`

| Prefix | File (`routes/`) | Ghi chú |
|:-------|:-----------------|:--------|
| `/api/auth` | `auth.js` | |
| `/api/mentors` | `mentors.js` | |
| `/api/bookings` | `bookings.js` | |
| `/api/plans` | `plans.js` | |
| `/api/payments` | `payments.js` | |
| `/api/users` | `users.js` | |
| `/api/courses` | `courses.js` | |
| `/api/reviews` | `reviews.js` | |
| `/api/reports` | `reports.js` | |
| `/api/mentor` | `mentor.js` | Dashboard/finance/analytics mentor |
| `/api/notifications` | `notifications.js` | |
| `/api/admin` | `admin.js` | |
| `/api/enrollments` | `enrollments.js` | |
| `/api/cv` | `cv.js` + `cvMatch.js` | cv.js: CRUD/quota; cvMatch.js: proxy sang Python |
| `/api/interviews` | `interviews.js` | |
| `/api/upload` | `upload.js` | Cloudinary + fallback `/uploads` |
| `/api/ai` | `aiProviders.js` | STT/TTS/emotion/avatar pregen — xem chi tiết ở "D-ID / ElevenLabs" bên dưới |
| `/api/mock` | `mockCourses.js` | Mock data cho dev/test |
| `/api/achievements` | `achievements.js` | Badge/achievement user |
| `/api/analytics` | `analytics.js` | Tracking event FE (`trackAction()`) |

### Services (`services/`)

- **Domain chính:** `authService`, `bookingsService`, `dashboardStatsService`, `mentorDashboardService`, `mentorMeService`, `mentorProfileService`, `mentorsService`, `paymentsService`, `plansService`, `reportsService`, `reviewsService`, `userRoleService`
- **Mentor analytics/payout:** `mentorCommissionService`, `mentorEarningsService`, `courseMentorInsightsService`, `courseStatsService`, `notificationDeliveryService`
- **Payment ops:** `sepayWebhookService`, `transferPaymentExpiryService`, `normalizeTransferRefsService`
- **AI / Avatar / Cost stack** (xem "D-ID / ElevenLabs / Cloudinary" bên dưới): `interviewQuestionService`, `competencyFramework`, `avatarService`, `videoPregenService`, `ttsService`, `sttService`, `emotionService`, `cacheService`, `langfuseService`, `costLedgerService`, `costCalculator`, `alertService`, `errorRateMonitor`
- **Khác:** `analyticsService`, `emailService`, `jaasService`, `accessTokenBlacklist`

### Models (`models/`) — 21 Mongoose schemas

`User`, `Mentor`, `Booking`, `Payment`, `Course`, `Enrollment`, `Review`, `Notification`, `CVAnalysis`, `InterviewSession`, `Report`, `Subscription`, `Activity`, `CourseQA`, `MentorPeerReview`, `PayoutRequest`, `MentorKnowledge`, `SecurityLog`, `SepayWebhookEvent`, `CostEvent`, `Achievement`, `UserEvent`, `index.js`

Plan và quota được lưu trực tiếp trên **`User`** (field `plan`, `planExpiresAt`, `cvAnalysisUsed`, `interviewUsed`, v.v.).

### Middleware

- `authJwt` — verify Bearer JWT, set `req.user` / `req.userId`
- `requireMentor` — `role === "mentor"`
- `requireAdmin` — `role === "admin"`
- `rateLimiters.js` — rate limit login, register, …

### Response shape

```js
// Thành công
{ success: true, user: {...} }      // key: user, mentors, bookings, ...
// Lỗi
{ success: false, error: "message" }
```

### Auth & tokens

- **Access JWT:** claim `tv` phải khớp `User.tokenVersion`. Hết hạn theo `JWT_ACCESS_EXPIRES_IN` (fallback `JWT_EXPIRES_IN` cũ), mặc định **15m**.
- **Refresh token:** dạng `sessionObjectId:secret` (opaque), lưu hash trong `User.authSessions` (tối đa 10 phiên/user), sống `REFRESH_TOKEN_DAYS` (mặc định 30 ngày).
- Logout → `tokenVersion++`, xóa toàn bộ refresh sessions.
- Đổi mật khẩu → tương tự logout + trả token mới.

---

## Kiến trúc Frontend (`frontend/src/app/`)

### Cấu trúc thư mục

```
pages/
  auth/          Login, Register, ForgotPassword, ResetPassword
  home/          Home, Pricing
  account/       Dashboard, Profile, Settings
  booking/       Booking, Checkout, SessionDetail, MentorReview
  courses/       Courses, CourseDetail, CourseLearning, MyCourses
  cv/            CVAnalysis, AnalysisHistory
  interview/     Interview, AIGenderSelection, InterviewRoom,
                 InterviewFeedback, AvatarDemo
  mentor/        MentorDashboard, MentorSchedule, MentorAnalytics,
                 MentorMeetingDetail, MentorReviews, MeetingRoom,
                 MentorFinance, MentorCourseManagement, MentorCourseEdit,
                 MentorPeerReview, MentorArea
  mentors/       Mentors, MentorProfile
  payment/       PaymentReturn, SuccessPage, FailurePage
  admin/         AdminLayout, AdminDashboard, AdminMentors, AdminUsers,
                 AdminBookings, AdminMentorsPending, AdminPlaceholders,
                 adminLoader

components/
  ui/            40+ shadcn/ui primitives
  layout/        AppLayout, AdminSidebar, Navbar, Sidebar, Footer, TopNavShell
  auth/          AuthShell, GoogleSignInBlock
  mentor/        MentorPageShell
  interview/     AILipSyncAvatar, AvatarInterviewer*, BehavioralCamera, HRVideoPlayer
  cv/            CVDocumentPreview
  courses/       CourseRecommendations
  home/          RecommendedJourney
  modals/        ReportMentorModal, RescheduleModal
  shared/        HistoryPanel, PageHeader, SupportContact
  brand/         BrandLogo

hooks/
  useDIDStream.js   D-ID streaming avatar

utils/
  api.js            apiUrl(), API_BAS
  
  
  E_URL
  auth.js           JWT lưu/đọc localStorage
  authGate.js       Route guard
  bookingMappers.js
  bookingsApi.js, courseApi.js, courseStats.js, dashboardApi.js,
  enrollmentApi.js, interviewsApi.js, mentorApi.js, notificationApi.js,
  paymentsApi.js, plansApi.js
  bookings.js, meetings.js, history.js   (local/mock helpers — chưa migrate hết)
  aiDialogue.js
```

### Routing (`routes.js`)

- **Hash-based** (`createHashRouter`)
- `AppLayout` bọc hầu hết routes user
- `AdminLayout` (+ `adminLoader`) bọc `/admin/*`
- `CourseLearning` full-screen, không có sidebar
- Wildcard `*` redirect về `/`

**Auth state:** `localStorage` keys `prointerview_access_token`, `prointerview_auth`. Session khôi phục qua `GET /api/auth/me` khi app load.

### Tất cả routes hiện có

| Path | Component |
|:-----|:---------|
| `/` | Home |
| `/login`, `/register` | Login, Register |
| `/forgot-password`, `/reset-password` | ForgotPassword, ResetPassword |
| `/pricing` | Pricing |
| `/checkout` | Checkout |
| `/payment-return`, `/payment-success`, `/payment-failure` | Payment pages |
| `/avatar-demo` | AvatarDemo |
| `/courses/:id/learn` | CourseLearning (full-screen) |
| `/admin/*` | Admin section (AdminLayout) |
| `/dashboard` | Dashboard |
| `/cv-analysis`, `/cv-analysis/history` | CVAnalysis, AnalysisHistory |
| `/interview`, `/interview/gender`, `/interview/room`, `/interview/feedback` | Interview flow |
| `/mentors`, `/mentors/:id` | Mentors, MentorProfile |
| `/booking/:id`, `/booking` | Booking |
| `/session/:id` | SessionDetail |
| `/review/:sessionId` | MentorReview |
| `/profile`, `/settings` | Profile, Settings |
| `/mentor/dashboard` | MentorDashboard |
| `/mentor/schedule` | MentorSchedule |
| `/mentor/finance` | MentorFinance |
| `/mentor/analytics` | MentorAnalytics |
| `/mentor/reviews` | MentorReviews |
| `/mentor/meeting/:sessionId` | MeetingRoom |
| `/mentor/meeting-detail/:sessionId` | MentorMeetingDetail |
| `/mentor/courses`, `/mentor/courses/:id/edit` | MentorCourseManagement, MentorCourseEdit |
| `/mentor/peer-review` | MentorPeerReview |
| `/courses`, `/courses/:id` | Courses, CourseDetail |

### Admin routes (placeholders — chưa implement đầy đủ)

`/admin/analytics`, `/admin/users/:id`, `/admin/mentors/:id`, `/admin/finance`, `/admin/transactions`, `/admin/payouts`, `/admin/bookings/:id`, `/admin/content/questions`, `/admin/content/courses` (video khóa gộp trong trang này), `/admin/settings`, `/admin/reviews`, `/admin/support`

---

## Tích hợp bên ngoài

### CV Analysis — Express + Python (chính)

- **Lịch sử:** `cvApi.js` → `GET/POST/DELETE /api/cv/analyses`, `GET /api/cv/quota`
- **Phân tích:** `CVAnalysis.jsx` → `POST /api/cv/analyze`, `/analyze/full`, `/analyze/suggestions`, `/analyze/field` (proxy `cvMatch.js` → Python)
- Python: `cv_jd_matching/` (port 8000); prod: `CV_ANALYZER_URL` trên backend

### Supabase Edge — CV (fallback, tùy env)

- Chỉ khi có `VITE_SUPABASE_PROJECT_ID` — `CVAnalysis.jsx` vẫn có nhánh Edge legacy
- **Production khuyến nghị:** không set Supabase env; chỉ Express + Python

### D-ID / ElevenLabs / Cloudinary — Avatar phỏng vấn

**Pipeline chính (pre-generated video, không phải live stream):** ElevenLabs TTS (`ttsService.js`, giọng theo gender qua `ELEVENLABS_VOICE_ID_MALE/FEMALE`) → upload audio lên Cloudinary → D-ID `/talks` lipsync với audio đó (`avatarService.js generateVideoForQuestion`) → poll tới `status=done` → trả `result_url`. Nếu ElevenLabs chưa cấu hình, D-ID tự dùng Azure TTS (text script, không qua ElevenLabs).

- **Baseline (3 câu free, cố định text):** `videoPregenService.pregenerateSync` với `persistVideo: true` — mirror `result_url` về Cloudinary (`prointerview/avatar-videos/`) rồi cache **vĩnh viễn** trong Redis. Cache key dùng chung toàn hệ thống (không theo user) vì text cố định.
- **Follow-up (2 câu Pro, cá nhân hóa):** `POST /api/ai/interview/pregenerate` — không `persistVideo`, không cache permanent.
- ⚠️ **Gotcha đã vá (xem `avatarService.js`):** `result_url` của D-ID là presigned S3 URL, tự hết hạn theo `X-Amz-Expires` (~24h). Chỉ link đã mirror sang Cloudinary mới được cache TTL dài (180 ngày). Nếu bước mirror lỗi, link D-ID gốc chỉ cache TTL ngắn (`RAW_DID_URL_FALLBACK_TTL` = 1h) để lần gọi sau tự retry — KHÔNG bao giờ cache link tự-hết-hạn với TTL dài, vì FE sẽ load video chết (403 từ S3) sau khi hết hạn.
- **Circuit breaker:** `avatarService.js` mở sau 3 lỗi D-ID liên tiếp (`isCircuitOpen()`), tự reset sau 5 phút — `pregenerateVideos` luôn probe câu đầu trước khi chạy song song các câu còn lại, để fail-fast không tốn credit nếu D-ID đang down.
- **Live WebRTC fallback** (ít dùng): FE `useDIDStream.js` → `https://api.d-id.com` (Basic auth) trực tiếp — chỉ kích hoạt khi không có pregen video VÀ có `VITE_DID_API_KEY` ở FE; nếu không có cả hai, room rơi về Web Speech API (browser TTS, KHÔNG phải ElevenLabs) với ảnh avatar tĩnh (không lipsync).
- BE status tổng hợp: `GET /api/ai/config` (provider nào đang enabled, circuit breaker, redis mode).
- Interview flow: `POST /api/interviews/sessions` (tạo + baseline questions) → `POST /api/interviews/sessions/:id/generate-followup-questions` (2 câu cá nhân hóa giữa buổi, chỉ Pro — xem quyết định #3 trong "V5 plan" bên dưới) → `analyze-face`. `POST /api/interviews/generate-questions` còn route nhưng KHÔNG còn được FE gọi (rollback path cũ, giữ lại chưa xoá).

### Google Identity Services

- ID token → `POST /api/auth/google` (backend verify qua `google-auth-library`)
- Frontend: `frontend/.env.local` → `VITE_GOOGLE_CLIENT_ID`
- Vercel header `Cross-Origin-Opener-Policy: same-origin-allow-popups` cần cho FedCM

---

## Khái niệm domain chính

### Plans & Quota

| Plan | |
|:-----|:-|
| `free` | Quota cơ bản |
| `starter_pro` | Quota mở rộng |
| `elite_pro` | Quota tối đa |

Fields trên `User`: `plan`, `planExpiresAt`, `cvAnalysisUsed`, `interviewUsed` (đối chiếu plan limits).

### Mentor

- User có `role=mentor` phải có document **`Mentor`** (`userId`).
- Public URL dùng `publicId` (không dùng `_id`).
- Dùng `npm run sync:mentor-profiles` để đồng bộ nếu lệch.
- Cấp role mentor: Admin dùng `PATCH /api/users/:id/role` (không tự đổi qua `/me`).

### Bookings

Fields quan trọng: `price`, `platformFee`, `vat`, `totalAmount`, `paymentStatus`, `status`, `rescheduleHistory`.

Lifecycle status: `pending` → `confirmed` → `completed` / `cancelled`.

Hủy booking: `DELETE /api/bookings/:id` (không dùng `PATCH .../cancel`).

### Payments

- **Phạm vi sản phẩm:** Frontend production dùng **chuyển khoản ngân hàng** (checkout / ghi danh khóa + admin xác nhận qua ledger `payments`). **Không ưu tiên** MoMo, ZaloPay, thẻ làm kênh khách hàng trừ khi được yêu cầu rõ. Backend vẫn có stub initiate/webhook — coi là ngoài phạm vi mặc định.
- CK: `recordTransferPending` → user `submit-transfer` → admin `confirm-transfer-payment` → `recordAdminTransferSuccess`.
- MoMo, ZaloPay, VNPay: sandbox/stub trong `paymentsService` — kiểm tra trước khi bật prod.

---

## Trạng thái dự án hiện tại

### Backend ✅

Phase 1–4 + **Phase 5 (mở rộng)** đã có route trong Express (100+ endpoint). Chi tiết: `ROADMAP.md` (✅ BE) + `API_INDEX.md` Phần A.

**BE hoàn tất theo roadmap gốc;** còn hardening prod (env, monitoring), không còn endpoint 📋 trong bảng Phase 1–4.

### Frontend — trạng thái từng domain

*(Đồng bộ `ROADMAP.md` → Trạng thái Frontend.)*

| Domain | Trạng thái |
|:-------|:-----------|
| Auth (login/register/Google/reset/verify/delete account) | ✅ API thật |
| Dashboard (`/dashboard`) | ✅ `GET /api/users/dashboard-stats` |
| Mentors list + profile + booking + checkout CK | ✅ API thật (ưu tiên chuyển khoản / SePay) |
| Session detail (`/session/:id`) | 🔧 chủ yếu API; một số UI demo |
| CV Analysis | 🔧 phân tích: Express `/api/cv/analyze*`; lịch sử: `cvApi.js`; Supabase chỉ khi có env |
| Analysis history | ✅ `/api/cv/analyses` |
| Interview (AI avatar) | ✅ 3 baseline (free) + 2 follow-up cá nhân hóa (Pro) qua `/api/interviews/*`; avatar qua D-ID pregen video (ElevenLabs audio), TTS browser khi không có pregen |
| Courses | ✅ list/detail/enrollment API |
| Mentor dashboard/schedule/finance | ✅ `/api/mentor/*` |
| Mentor meeting room | 🔧 một phần state local |
| Admin list pages | ✅ `adminApi.js` |
| Admin detail placeholders | 📋 routes placeholder (finance, user/:id, …) |
| Notifications | 🔧 API có; kiểm tra badge trên prod |
| Upload | 🔧 BE Cloudinary/local; FE gọi `POST /api/upload/*` |
| Payment return/success/failure | ✅ redirect gateway / poll transfer-status |

### CV/JD Production Checklist

Cần cả hai để hoạt động đúng:
1. `VITE_API_URL` set đúng host prod (FE gọi đúng `/api`)
2. `CV_ANALYZER_URL` set URL Python FastAPI reachable từ backend Node

Nếu thiếu → `404` (sai host) hoặc `503` (analyzer unreachable).

---

## Deployment

### Backend (Render)

```yaml
# render.yaml
service: prointerview-backend
runtime: node
rootDir: backend/
buildCommand: npm install
startCommand: npm start
healthCheckPath: /api/health
region: singapore
```

Env vars cần set trên Render: `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGIN`, `GOOGLE_CLIENT_ID`, `CV_ANALYZER_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `D_ID_API_KEY`, `ELEVENLABS_API_KEY` + voice IDs.

⚠️ Nhập giá trị **không kèm dấu ngoặc kép** dù `.env` local có viết `KEY="value"` — Render lưu nguyên văn, không tự strip quote như `dotenv` (xem gotcha chi tiết ở "V5 plan" → quyết định #4).

### Frontend (Vercel)

```json
// vercel.json
{ "headers": [{ "key": "Cross-Origin-Opener-Policy", "value": "same-origin-allow-popups" }] }
```

Build: `vite build` → `dist/`. Set `VITE_API_URL` và `VITE_GOOGLE_CLIENT_ID` trong Vercel env.

### Python CV Service

Có `Procfile` + `runtime.txt` — deploy được lên Heroku/Render. Sau deploy set `CV_ANALYZER_URL` vào backend env.

---

## Quyết định kiến trúc V5 plan (2026-06-21)

Plan tối ưu hóa 8 sprint / 16 tuần, 4 quyết định đã chốt (chi tiết: memory `project_v5_roadmap`):

1. **Trial flow có scoring nhẹ** — 3 câu baseline ở free trial hiển thị điểm + nhận xét ngắn (không phải feedback đầy đủ như session thật).
2. **Bank transfer cho MVP launch** — không tích hợp VNPay/MoMo/Stripe trong giai đoạn này. Flow chuyển khoản + admin xác nhận + auto-confirm qua SePay webhook (`sepayWebhookService.js`) đã có sẵn cho booking/enrollment/subscription — khi thêm gói mới (câu hỏi/phân tích sâu), tái dùng rail này, không build lại từ đầu.
3. ✅ **Đã merge (PR #109, `main`)** — Refactor sinh câu hỏi: 5 câu liền → 3 baseline cố định (free, `backend/src/config/baselineQuestions.js`) + 2 personalized sinh GIỮA buổi qua `POST /api/interviews/sessions/:id/generate-followup-questions` (chỉ Pro, dùng CV/JD + câu trả lời thật của 3 câu baseline làm context — xem `generateFollowUpQuestions` trong `interviewsController.js`). Route `generate-questions` cũ vẫn còn nhưng không còn được FE gọi.
4. **Cache/observability fail-fast, không trì hoãn rủi ro vận hành** — Redis bắt buộc ở production (`cacheService.js` throw khi Redis lỗi, không fallback im lặng sang Map, server fail-fast lúc start nếu thiếu cấu hình); Sentry + Slack alert (cost spike, error rate, baseline render bất thường) tích hợp từ Sprint 1 (`config/sentry.js`, `services/alertService.js`, `services/costLedgerService.js`).
   - ⚠️ **Gotcha Render đã gặp thực tế:** `.env` local dùng cú pháp `KEY="value"` (dotenv tự strip dấu `"`), nhưng Render dashboard lưu **nguyên văn** giá trị paste vào — nếu copy cả dấu `"` từ `.env` dán vào ô Value trên Render, biến sẽ chứa luôn dấu `"` (vd: `UPSTASH_REDIS_REST_URL` thành `"https://...upstash.io"` với dấu ngoặc literal) → `fetch()` lỗi `Failed to parse URL` → mọi request Redis fail-fast → toàn bộ avatar pregen trả `null` (không lipsync, không voice). Khi nhập env var nhạy cảm dạng URL/token lên Render, gõ/paste KHÔNG kèm dấu ngoặc kép.

## Quy tắc phát triển

### Khi thêm API mới

1. Tạo route → controller (→ service nếu có business logic phức tạp) → model
2. Mount router trong `backend/src/app.js`
3. Cập nhật **`ROADMAP.md`** (đổi 📋 → ✅) và **`API_INDEX.md`** (thêm vào Phần A hoặc Phần C tương ứng)

### Khi nối FE với API

1. Thêm/sửa function trong `frontend/src/app/utils/*Api.js` tương ứng
2. Dùng `apiUrl(path)` từ `utils/api.js` (không hardcode URL)
3. Dùng `authFetch` (Bearer token) cho route cần auth

### Conventions

- Response: `{ success: true, <key>: data }` / `{ success: false, error: "msg" }`
- Auth middleware: `authJwt` (Bearer JWT), `requireMentor`, `requireAdmin`
- Mentor public URL: dùng `publicId`, không dùng `_id` trực tiếp
- Booking cancel: `DELETE /api/bookings/:id` (không tạo `PATCH .../cancel`)
- Change password: `PATCH /api/auth/me` (không cần route riêng)

### Tech stack tham chiếu nhanh

| | |
|:-|:-|
| Frontend | React 18, Vite, React Router v7 (hash), Tailwind CSS, shadcn/ui, Recharts, @react-three/* |
| Backend | Express 5 (ESM), Node 20+, Mongoose 9, JWT, bcrypt, multer, google-auth-library |
| DB | MongoDB (collections: 17 schemas) |
| CV Analysis | Python FastAPI, pdf parsing, NLP skill extraction |
| Payments | MoMo, ZaloPay (sandbox), VNPay partial |
| External | Google Identity Services, D-ID API, Supabase Edge (CV fallback), LLM/CV Python |

---

## Tài liệu liên quan

| File | Nội dung |
|:-----|:---------|
| `ROADMAP.md` | Endpoint theo Phase 1–4, trạng thái ✅/📋, gợi ý sprint |
| `API_INDEX.md` | Contract đầy đủ: Phần A (đang chạy), B (Supabase/D-ID), C (roadmap) |
| `backend/DATABASE.md` | Schema MongoDB chi tiết từng field |
| `POSTMAN_TESTING.md` | Hướng dẫn test API với Postman |
