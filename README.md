# ProInterview

> Nền tảng SaaS luyện phỏng vấn xin việc với AI avatar, đặt lịch mentor, phân tích CV/JD và khóa học trực tuyến.

[![Node](https://img.shields.io/badge/Node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5-lightgrey)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_9-green)](https://mongoosejs.com/)
[![Python](https://img.shields.io/badge/Python-FastAPI-009688)](https://fastapi.tiangolo.com/)

---

## Tổng quan

**ProInterview** là ứng dụng web giúp ứng viên chuẩn bị phỏng vấn xin việc thông qua:

- **Phỏng vấn AI** — avatar D-ID đặt câu hỏi (giọng ElevenLabs), phân tích hành vi & khuôn mặt, chấm điểm theo SHRM/DDI
- **Đặt lịch mentor** — booking 1-1, thanh toán chuyển khoản, phòng họp Jitsi, đánh giá sau buổi
- **Phân tích CV/JD** — 2 chế độ: đối chiếu CV ↔ JD và phân tích CV theo lĩnh vực
- **Khóa học** — giỏ hàng nhiều khóa, checkout 1 QR, học video, Q&A
- **Dashboard & Achievements** — theo dõi tiến trình, lịch sử phỏng vấn, huy hiệu

---

## Kiến trúc Monorepo

```
ProInterview/
├── frontend/          # Vite + React 18 + Tailwind CSS v4 + shadcn/ui   (port 5173)
├── backend/           # Express 5 + MongoDB (Mongoose 9) + JWT           (port 5000)
├── cv_jd_matching/    # Python FastAPI + Uvicorn                         (port 8000)
└── docs/              # Sơ đồ nghiệp vụ, context diagram, port notes
```

---

## Yêu cầu

| Công cụ | Phiên bản |
|:--------|:----------|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| MongoDB | ≥ 6 (local hoặc Atlas) |
| Python | ≥ 3.10 (chỉ cho CV/JD service) |
| Redis | Upstash REST — **bắt buộc ở production**, tùy chọn ở dev |

---

## Cài đặt & Chạy Dev

### 1. Clone repo

```bash
git clone https://github.com/YenNhi206/ProInterview.git
cd ProInterview
```

### 2. Cấu hình môi trường

**Backend** — tạo file `backend/.env` (repo không commit `.env.example`):

```env
# ── Bắt buộc — thiếu thì server exit(1) lúc khởi động ────────────────────────
MONGO_URI=mongodb://127.0.0.1:27017/prointerview
LLM_API_KEY=<key của provider LLM>
LLM_BASE_URL=https://api.openai.com/v1

# ── Rất nên có ───────────────────────────────────────────────────────────────
JWT_SECRET=<chuỗi ngẫu nhiên dài ≥ 32 ký tự>
CORS_ORIGIN=http://localhost:5173
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_DAYS=30
GOOGLE_CLIENT_ID=<từ Google Cloud Console>
LLM_MODEL=gpt-4o-mini

# ── Tùy chọn — thiếu thì tính năng degrade, server vẫn chạy ──────────────────
CV_ANALYZER_URL=http://localhost:8000     # Python CV service
D_ID_API_KEY=<key D-ID>                   # avatar lipsync
ELEVENLABS_API_KEY=<sk_...>               # giọng nói avatar
ELEVENLABS_VOICE_ID_MALE=<voice id>
ELEVENLABS_VOICE_ID_FEMALE=<voice id>
GOOGLE_VISION_API_KEY=<key>               # phân tích cảm xúc khuôn mặt
CLOUDINARY_URL=<cloudinary://...>         # lưu media; thiếu → fallback /uploads
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=<token>
JAAS_APP_ID=<...>                         # phòng họp mentor; thiếu → meet.jit.si (giới hạn ~5 phút)
JAAS_API_KEY_ID=<...>
JAAS_PRIVATE_KEY=<base64>
SEPAY_WEBHOOK_API_KEY=<...>               # tự xác nhận chuyển khoản
SENTRY_DSN=<...>
MAIL_USER=<...>                           # email xác thực / thông báo
MAIL_PASS=<...>
```

> ⚠️ **LLM đa provider:** `interviewQuestionService.js` tự nhận diện provider từ `LLM_BASE_URL` —
> OpenAI-compatible (DeepSeek, GLM, DS2API…), Anthropic, Gemini, hoặc Ollama local.

**Frontend** — tạo `frontend/.env.local`:

```env
VITE_GOOGLE_CLIENT_ID=<giống backend>
# VITE_API_URL chỉ cần khi muốn trỏ thẳng một backend khác.
# Dev bỏ trống → Vite proxy /api → localhost:5000
# Prod trên Vercel bỏ trống → vercel.json rewrite /api → Render
```

### 3. Cài dependencies

```bash
cd backend  && npm install
cd ../frontend && npm install
```

### 4. Seed dữ liệu dev

```bash
cd backend
npm run seed:all        # users dev (chỉ khi collection rỗng) + hồ sơ mentor
npm run seed:samples    # mentor + khóa học mẫu (tùy chọn)
```

Backend cũng **tự seed demo data** lúc khởi động nếu DB chưa có review nào (xem `server.js`).

### 5. Khởi động

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev

# Terminal 3 — CV/JD Service (tùy chọn)
cd cv_jd_matching
python -m pip install -r requirements.txt
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

> `npm run dev:full` trong `frontend/` chạy cả 3 service song song, nhưng script `dev:ai`
> hiện hard-code `DEVELOPER_DIR` của macOS — **trên Windows hãy chạy 3 terminal riêng**.

### Tài khoản dev mặc định (sau seed)

Mật khẩu: **`Dev123456`**

| Email | Role |
|:------|:-----|
| `customer@dev.local` | Customer (plan: free) |
| `mentor@dev.local` | Mentor |
| `admin@dev.local` | Admin |
| `moderator@dev.local` | Moderator (kiểm duyệt) |
| `enterprise@dev.local` | Enterprise (tổ chức) |

### Chạy test

```bash
cd backend  && npm test        # node:test + jest DTO + unittest Python
cd backend  && npm run test:node
cd frontend && npm test
```

---

## Tính năng chính

### Người dùng (Customer)
- Đăng ký / đăng nhập email (có xác thực email), Google OAuth
- **Free trial phỏng vấn** không cần CV — 3 câu hỏi baseline cố định (`/interview/trial`)
- Phỏng vấn đầy đủ với AI avatar + phân tích hành vi (`/interview`)
- Phân tích CV: đối chiếu với JD hoặc chấm theo lĩnh vực, có lịch sử
- Tìm kiếm & đặt lịch mentor, phòng họp Jitsi, đánh giá sau buổi
- Giỏ hàng khóa học, checkout nhiều khóa bằng 1 mã QR, áp coupon
- Lịch sử thanh toán + hóa đơn PDF, dashboard cá nhân, huy hiệu

### Mentor
- Dashboard, lịch, booking, tài chính & yêu cầu payout
- Tạo / quản lý khóa học (có luồng admin duyệt cập nhật)
- Peer review với mentor khác, analytics buổi tư vấn
- Gửi feedback sau buổi cho học viên

### Admin
- Quản lý người dùng (có import hàng loạt), mentor, bookings, duyệt mentor mới
- Vận hành tài chính: giao dịch, payout, xác nhận chuyển khoản khóa học & gói
- Rà soát booking quá giờ, check-in, audit log
- Quản lý nội dung khóa học, câu hỏi, review, hỗ trợ, achievements
- Dashboard thống kê + analytics toàn hệ thống

---

## Core Flow: AI Interview Room Virtual

Tính năng trung tâm của sản phẩm. Hai luồng vào:

| Luồng | Route | Yêu cầu | Câu hỏi |
|:------|:------|:--------|:--------|
| **Free trial** | `/interview/trial` | Chỉ cần đăng nhập, không cần CV | 3 câu baseline cố định |
| **Phỏng vấn đầy đủ** | `/interview` | CV hoặc thông tin vị trí | 3 baseline + 2 follow-up cá nhân hóa (Pro) |

### Sơ đồ tổng quan

```
/interview          /interview/room              /interview/feedback
[Setup]     ──────► [Phòng phỏng vấn]   ──────► [Kết quả & Phân tích]
   │                       │                              │
   ▼                       ▼                              ▼
Chọn CV            HR AI đặt câu hỏi            SHRM/DDI scores
Chọn HR AI         User trả lời (giọng nói)     Behavioral radar chart
Tạo session        Phân tích hành vi realtime   Emotion timeline
Pregen video       Sinh 2 câu follow-up (Pro)   Gợi ý cải thiện LLM
```

---

### Giai đoạn 1 — Thiết lập phỏng vấn (`/interview`)

```
User truy cập /interview  →  Interview.jsx
        │
        ├─► BƯỚC 1: Chọn nguồn CV
        │     • Upload PDF mới  →  POST /api/interviews/extract-cv-text
        │     • Dùng CV đã phân tích  →  GET /api/cv/analyses/:id
        │     • Nhập thủ công: vị trí + công ty + cấp bậc
        │
        ├─► BƯỚC 2: Chọn HR AI  →  Sarah (Nữ) / David (Nam)
        │
        └─► BƯỚC 3: Tạo session  →  POST /api/interviews/sessions
              │
              │  Session khởi tạo với 3 câu BASELINE CỐ ĐỊNH
              │  (backend/src/config/baselineQuestions.js) — không tốn LLM:
              │    1. Giới thiệu bản thân & định hướng nghề nghiệp
              │    2. Thử thách đã gặp và cách xử lý  (layer: behavior, có STAR guidance)
              │    3. Vì sao quan tâm vị trí + điểm mạnh phù hợp
              │
              └─► POST /api/ai/interview/pregen-baseline
                    Pregen video avatar cho 3 câu (cache dùng chung toàn hệ thống,
                    vì text cố định → gần như instant từ lần thứ 2 trở đi)
                    →  Navigate /interview/room
```

**Vì sao baseline cố định?** Sinh câu hỏi bằng LLM ngay từ đầu vừa tốn credit vừa chậm, trong khi
3 câu mở đầu gần như giống nhau với mọi ứng viên. Cá nhân hóa được dời sang **giữa buổi**, khi đã
có câu trả lời thật làm ngữ cảnh — chất lượng cao hơn hẳn.

---

### Giai đoạn 2 — Phòng phỏng vấn thực tế (`/interview/room`)

```
Mount InterviewRoom  →  các hệ thống khởi tạo song song
  │
  ├─► [A] Avatar HR
  │       Ưu tiên 1: Pregen video (ElevenLabs TTS → Cloudinary → D-ID /talks lipsync)
  │       Ưu tiên 2: D-ID WebRTC live  →  POST /api/ai/did/streams  (BE proxy, key server-side)
  │       Fallback : Web Speech API (TTS trình duyệt) + ảnh avatar tĩnh, không lipsync
  │
  ├─► [B] Web Audio API  (phân tích giọng nói)
  │       getUserMedia({ audio }) → AudioContext + AnalyserNode
  │       Sampling 100ms khi mic bật  →  RMS amplitude 0–1
  │
  └─► [C] MediaPipe FaceMesh  (phân tích khuôn mặt, CDN lazy-load)
          cdn.jsdelivr.net/npm/@mediapipe/face_mesh  (~3MB WASM)
          useFaceAnalysis hook  →  sampling 500ms khi đang trả lời


VÒNG LẶP MỖI CÂU HỎI
══════════════════════════════════════════════════════

  [①] HR đặt câu hỏi
      Phát pregen video, hoặc D-ID stream speak(), hoặc browser TTS
      ─── latencyStartRef = Date.now() ───────────────────────────► BẮT ĐẦU ĐO

  [②] User trả lời  (isListening = true)
      │
      ├─ STT (Web Speech API, vi-VN, continuous):
      │    onresult → accumulate transcript
      │    First result → responseLatencyMs = now − latencyStart  ◄─ ĐO XONG
      │    (fallback server-side: POST /api/ai/transcribe)
      │
      ├─ Web Audio (100ms):
      │    getFloatTimeDomainData → RMS amplitude
      │    Tích lũy: avgAmplitude, amplitudeVariance
      │              silenceRatio (<10% = silent), silenceEvents (>2s)
      │
      └─ MediaPipe FaceMesh (500ms):
           468 landmarks → tính:
             eyeContactScore    (mũi cân giữa 2 mắt = nhìn camera)
             headStabilityScore (variance vị trí trung tâm khuôn mặt)
             facePresenceRatio  (% frames detect được mặt)
             distractionEvents  (số lần eye contact < 0.35)

  [③] User nhấn "Câu tiếp theo"
      │
      ├─ PATCH /api/interviews/sessions/:id
      │    { transcript, durationSeconds, behavioralData }   [fire & forget]
      │
      └─ POST /api/interviews/sessions/:id/analyze-face      [fire & forget]
           canvas.toDataURL(JPEG 0.75) → base64  (BE chặn ảnh > ~1MB, rate-limited)
           Backend → Google Cloud Vision API:
             joy/sorrow/anger/surpriseLikelihood, panAngle, tiltAngle, underExposed
           → Lưu emotion (1–5 scale) vào session.answers[i].behavioralData


  ★ SAU 3 CÂU BASELINE — chỉ với user Pro/Elite:
      POST /api/interviews/sessions/:id/generate-followup-questions
        Context: CV/JD  +  câu trả lời THẬT của 3 câu baseline
        → 2 câu hỏi cá nhân hóa, pregen video qua /api/ai/interview/pregenerate
        → Nối tiếp vào vòng lặp trên
      (User free kết thúc sau câu 3)


KẾT THÚC PHỎNG VẤN  →  goToFeedback()
══════════════════════════════════════════════════════

  computeBehavioralSummary(perQuestionData):
    avgResponseLatencyMs, avgSilenceRatio, avgEyeContactScore
    avgHeadStabilityScore, totalHedgeWords, avgVocabularyDiversity
    avgAmplitudeVariance
    overallConfidenceScore (0–5):
      eyeContact×0.20 + headStability×0.15 + fluency×0.15
      + expression×0.15 + hedgeScore×0.15 + vocabulary×0.10 + latency×0.10
    dominantEmotion  (joy / sorrow / anger / surprise / neutral)

  POST /api/interviews/sessions/:id/complete
    { answers[], totalDurationSeconds, behavioralSummary }
    → MongoDB: status = "completed"
    → Navigate /interview/feedback
```

---

### Giai đoạn 3 — Đánh giá LLM (`POST /api/interviews/sessions/:id/evaluate`)

Được gọi tự động khi Feedback page load. Idempotent — kết quả cache trong DB sau lần đầu.

```
evaluateTranscripts({ questions, answers })
  │
  ├─ LLM System Prompt bao gồm:
  │    SHRM competency definitions  +  DDI Key Actions  (competencyFramework.js)
  │    shrmRubricExcellent (tiêu chí xuất sắc từng competency)
  │    Yêu cầu output JSON cấu trúc chặt
  │
  └─ Output per question:
       scores:  { clarity, structure, relevance, credibility }  (0–5)
       overall: float 0–5
       shrmLevel: "excellent" | "proficient" | "developing"
       strengths[]:    điểm mạnh cụ thể
       improvements[]: điểm cần cải thiện
       suggestion:     câu trả lời mẫu tốt hơn từ LLM

Response trả về Frontend:
  evaluation.perQuestion[], overallScore, generalComment, inferredRole
  behavioralSummary        ← đọc từ MongoDB (lưu lúc complete)
  behavioralPerQuestion[]  ← emotion + metrics từng câu từ MongoDB
```

---

### Giai đoạn 4 — Trang kết quả Feedback (`/interview/feedback`)

```
┌──────────────────────────────────────────────────────────────────┐
│ A. Overall Score Banner                                          │
│    Điểm tổng (0–5 sao)  +  4 thanh STAR                        │
│    SHRM Distribution: Xuất sắc / Đạt yêu cầu / Cần cải thiện  │
│    Speaking metrics (WPM, filler words, độ dài TB)             │
├──────────────────────────────────────────────────────────────────┤
│ B. Nhận xét tổng quan từ AI  (generalComment)                   │
├──────────────────────────────────────────────────────────────────┤
│ C. Phân tích hành vi & Ngôn ngữ cơ thể  [khi có data]         │
│                                                                  │
│  ┌─────────────────────┐    ┌────────────────────────────────┐  │
│  │  Radar Chart 6 chiều│    │  6 Metric Cards                │  │
│  │  (Recharts)         │    │  Giao tiếp mắt  XX%   [Tốt]   │  │
│  │   Giao tiếp mắt     │    │  Tư thế đầu     XX%   [Tốt]   │  │
│  │ Phản xạ  Tư thế đầu │    │  Sự lưu loát    XX%   [Khá]   │  │
│  │  Vốn từ Tự tin giọng│    │  Tự tin giọng   Biểu cảm      │  │
│  │     Sự lưu loát     │    │  Phản xạ        X.Xs  [Tốt]   │  │
│  └─────────────────────┘    │  Từ dè dặt      X lần [Khá]   │  │
│                              │  Cảm xúc:   [Tự tin/Lo lắng] │  │
│                              └────────────────────────────────┘  │
│  Vocabulary Diversity: ████████░░  XX%  [Tốt]                  │
├──────────────────────────────────────────────────────────────────┤
│ D. Phân tích từng câu (accordion — mỗi câu mở ra gồm):        │
│    • Transcript giọng nói                                       │
│    • Behavioral mini-card: Phản xạ | Im lặng | Từ dè dặt      │
│                             Eye contact | Cảm xúc Vision AI    │
│    • SHRM scores (Clarity / Structure / Relevance / Credibility)│
│    • Điểm mạnh  +  Cần cải thiện  +  Gợi ý câu trả lời LLM   │
├──────────────────────────────────────────────────────────────────┤
│ E. Nút hành động + Gợi ý khóa học (dựa trên điểm yếu thực)    │
└──────────────────────────────────────────────────────────────────┘
```

---

### Behavioral Analysis — Chi tiết kỹ thuật

| Nguồn | Metrics | Tần suất | Xử lý |
|:------|:--------|:---------|:------|
| Web Audio API | avgAmplitude, amplitudeVariance, silenceRatio, silenceEvents | 100ms | In-browser |
| Web Speech API | responseLatencyMs, hedgeWordCount (12 patterns VN), vocabularyDiversity (TTR) | Mỗi câu | In-browser |
| MediaPipe FaceMesh | eyeContactScore, headStabilityScore, facePresenceRatio, distractionEvents | 500ms | In-browser WASM |
| Google Cloud Vision | joy/sorrow/anger/surprise (1–5), headPanAngle, lightingOk | 1x/câu hỏi | API call qua backend |

**Chi phí Google Vision:** ~$0.0075/session · Free tier: 1,000 ảnh/tháng ≈ 200 sessions.
**Privacy:** Không lưu video. Chỉ lưu analytics metrics vào MongoDB.

---

### Avatar pipeline — lưu ý vận hành

Pipeline chính là **pre-generated video**, không phải live stream:

```
ElevenLabs TTS (giọng theo gender)
   → upload audio lên Cloudinary
   → D-ID /talks lipsync với audio đó
   → poll tới status=done  →  result_url
   → mirror về Cloudinary (prointerview/avatar-videos/)  →  cache Redis
```

- ⚠️ `result_url` của D-ID là **presigned S3 URL tự hết hạn (~24h)**. Chỉ link đã mirror sang
  Cloudinary mới được cache TTL dài (180 ngày); link D-ID gốc chỉ cache 1h để lần sau tự retry.
- **Circuit breaker:** mở sau 3 lỗi D-ID liên tiếp, tự reset sau 5 phút. Pregen luôn probe câu đầu
  trước khi chạy song song các câu còn lại → fail-fast, không đốt credit khi D-ID down.
- Nếu ElevenLabs chưa cấu hình, D-ID tự dùng Azure TTS (text script).
- Kiểm tra trạng thái tổng hợp: `GET /api/ai/config`.
- Warmup cache baseline: `cd backend && npm run warmup:baseline-videos`.

---

## API

Base URL: `/api` · Auth: `Authorization: Bearer <jwt>`

| Nhóm | Endpoint |
|:-----|:---------|
| Auth | `/api/auth/*` |
| Users / Plans | `/api/users/*`, `/api/plans/*` |
| Mentors | `/api/mentors/*`, `/api/mentor/*` (dashboard mentor) |
| Bookings | `/api/bookings/*` |
| Courses | `/api/courses/*`, `/api/enrollments/*` |
| Giỏ hàng & Coupon | `/api/cart/*`, `/api/coupons/validate` |
| CV & JD | `/api/cv/*` |
| Interviews | `/api/interviews/*` |
| AI providers | `/api/ai/*` (TTS, STT, emotion, avatar pregen, D-ID proxy) |
| Payments | `/api/payments/*` |
| Reviews / Reports | `/api/reviews/*`, `/api/reports/*` |
| Notifications | `/api/notifications/*` |
| Achievements | `/api/achievements/*` |
| Analytics | `/api/analytics/*` |
| Upload | `/api/upload/*` |
| Public | `/api/public/home-data` (không cần auth) |
| Admin | `/api/admin/*` |
| Moderator | `/api/moderator/*` (duyệt khóa học, kiểm định chất lượng AI) |
| Health | `GET /api/health` |

Xem toàn bộ contract tại [API_INDEX.md](./API_INDEX.md).
Docs CV/JD service (khi chạy local): `http://127.0.0.1:8000/docs`

### Background jobs (tự chạy khi backend kết nối DB)

| Job | Chu kỳ | Việc |
|:----|:-------|:-----|
| `bookingReminderJob` | định kỳ | Nhắc lịch buổi tư vấn sắp diễn ra |
| `bookingStaleSweepJob` | 20 phút | Hủy booking pending chưa trả tiền quá giờ; gắn cờ booking đã trả tiền quá giờ kết thúc + 60 phút |
| `earningsClearanceJob` | định kỳ | Giải phóng thu nhập mentor sau thời gian giữ |
| `ttsCleanupJob` | định kỳ | Dọn audio TTS tạm trên Cloudinary |

---

## Cấu trúc code

### Backend (`backend/src/`)

```
server.js        Load env → validate env (fail-fast) → Sentry → connect Mongo → start jobs → listen
app.js           createApp(): helmet/hpp/rate-limit/CORS → /api/health → mount 24 router
routes/          25 router theo domain
controllers/     Xử lý request/response
services/        Business logic (~45 service)
models/          26 Mongoose schema
middleware/      authJwt, requireMentor, requireAdmin, requireRole (requireModerator /
                 requireEnterprise), rateLimiters, injectionRateLimit, adminAuditLog,
                 asyncHandler, errorHandler, optionalAuth, upload
jobs/            4 background job
config/          loadEnv, logger, sentry, baselineQuestions
scripts/         Seed / migration / audit CLI
```

Pattern chuẩn: `Route → Controller → Service → Mongoose Model`. Một số domain đơn giản
(notifications, courses, enrollments, CV CRUD, upload) gọi Model trực tiếp từ Controller.

**Response shape:**

```js
{ success: true,  <key>: data }       // key: user, mentors, bookings, cart, ...
{ success: false, error: "message" }
```

**Auth:** Access JWT 15m (claim `tv` phải khớp `User.tokenVersion`) + refresh token opaque
dạng `sessionObjectId:secret`, hash lưu trong `User.authSessions` (tối đa 10 phiên), sống 30 ngày.
Logout / đổi mật khẩu → `tokenVersion++` và xóa toàn bộ refresh session.

### Frontend (`frontend/src/app/`)

```
routes.js        createBrowserRouter — path thường, KHÔNG dùng hash
api/             19 module *Api.js + http.js (apiUrl, API_BASE_URL, isExpressBackendConfigured)
pages/           auth, home, account, booking, courses, cv, interview, mentor, mentors,
                 payment, admin
components/      ui (shadcn), layout, auth, interview, cv, courses, mentor, admin,
                 account, booking, brand, decor, home, legal, modals, profile, reviews, shared
hooks/           useAuthSession, useCart, useDIDStream, useFaceAnalysis, useMeetingLiveCapture,
                 useNavbarNotifications, usePageAnalytics, useUserPresence, ...
utils/           Chia theo domain: admin/ analytics/ auth/ booking/ course/ cv/
                 interview/ meeting/ mentor/ plans/ profile/ shared/
```

**Auth state:** `localStorage` keys `prointerview_access_token`, `prointerview_auth`.
Session khôi phục qua `GET /api/auth/me` khi app load. Route guard: `requireAuthLoader`,
`requireCustomerAuthLoader`, `adminLoader`, `ProtectedOutlet`.
Gọi API cần auth: dùng `authFetch()` từ `utils/auth/auth.js` (tự gắn Bearer token + refresh).

---

## Khái niệm domain chính

### Role & phân quyền

5 role trên `User.role`:

| Role | Phạm vi | Trạng thái |
|:--|:--|:--|
| `customer` | Luyện phỏng vấn, CV/JD, booking, khóa học | ✅ |
| `mentor` | Lịch, thu nhập, khóa học, peer review | ✅ |
| `admin` | Người dùng, mentor, booking, tài chính, audit | ✅ |
| `moderator` | **Duyệt khóa học** + kiểm định chất lượng AI | 🔧 duyệt khóa học xong; ngân hàng câu hỏi + review queue đang làm |
| `enterprise` | Cohort, credit, talent pool của tổ chức | 📋 chưa triển khai (role + cổng đã có) |

Cổng: `requireRole(...roles)` trong `backend/src/middleware/requireRole.js`, kèm
`requireModerator` / `requireEnterprise`. **Admin cố ý KHÔNG đi vòng được cổng moderator** —
kiểm định nội dung tách khỏi quyền vận hành; admin muốn duyệt thì phải được cấp role moderator.

Gán role: `PATCH /api/users/:id/role` (`customer | mentor | moderator | enterprise`).
Không nâng `admin` qua API — phải sửa trực tiếp DB, tránh một tài khoản admin bị chiếm tự nhân quyền.

`QuestionBank` (`models/QuestionBank.js`) là substrate dùng chung: câu hỏi LLM sinh ra được thu
hoạch vào đây ở `pending_review` cho moderator duyệt, còn interview template của tổ chức là cùng
schema nhưng gắn `orgId` nên không lẫn vào pool chung.

### Plans & Quota

| Plan key | Tên hiển thị | Giá | Ưu đãi booking/khóa học |
|:---------|:-------------|:----|:------------------------|
| `free` | Free | 0 | — |
| `starter_pro` | Pro | 99.000đ/tháng | 5% |
| `elite_pro` | Elite | 199.000đ/tháng | 10% |

Gói năm = giá tháng × 12 (không giảm thêm). Nguồn sự thật: `backend/src/constants/planCatalog.js`.
Quota lưu trực tiếp trên `User`: `plan`, `planExpiresAt`, `cvAnalysisUsed`, `interviewUsed`.

### Thanh toán

Kênh production là **chuyển khoản ngân hàng**:

```
Tạo đơn → QR + mã tham chiếu (recordTransferPending)
   → user submit-transfer
   → SePay webhook tự xác nhận  HOẶC  admin confirm-transfer-payment
   → recordAdminTransferSuccess → mở quyền
```

Áp dụng cho booking mentor, ghi danh khóa học, giỏ hàng nhiều khóa (`CartOrder` — 1 QR cho cả đơn)
và subscription. MoMo / ZaloPay / VNPay chỉ có stub sandbox trong `paymentsService` — ngoài phạm vi mặc định.

### Mentor

- User `role=mentor` phải có document `Mentor` (`userId`); đồng bộ bằng `npm run sync:mentor-profiles`
- Public URL dùng `publicId`, **không** dùng `_id`
- Cấp role mentor: admin qua `PATCH /api/users/:id/role`

### Bookings

Lifecycle: `pending` → `confirmed` → `completed` / `cancelled`.
Fields: `price`, `platformFee`, `vat`, `totalAmount`, `paymentStatus`, `status`, `rescheduleHistory`, `staleFlaggedAt`.
Hủy: `DELETE /api/bookings/:id`.

---

## Bảo mật & Observability

| Lớp | Triển khai |
|:----|:-----------|
| HTTP headers | `helmet` (COOP `same-origin-allow-popups` cho Google FedCM) |
| Param pollution | `hpp` |
| Rate limit | Global `/api` (500 req/15ph prod), riêng login/register/analyze-face/baseline-trial |
| Prompt injection | `injectionRateLimit` — chặn user có ≥3 lần thử injection/giờ |
| NoSQL injection | `sanitizeObjectKeys` trên body/params/query |
| Audit | `adminAuditLog` middleware + `SecurityLog` model, trang `/admin/audit-log` |
| Error tracking | Sentry (`config/sentry.js`), bắt cả `uncaughtException`/`unhandledRejection` |
| Alerting | `alertService` + `errorRateMonitor` — cảnh báo cost spike / error rate |
| Cost ledger | `costLedgerService` + `CostEvent` — theo dõi chi phí LLM/D-ID/TTS |

**Redis fail-fast:** ở production `cacheService.js` **throw** khi Redis lỗi thay vì âm thầm fallback
sang in-memory Map; `server.js` exit(1) nếu thiếu `UPSTASH_REDIS_*`. Lý do: mỗi instance Render có
Map riêng, mất khi restart → cache hit rate tụt không ai biết, đốt credit D-ID/LLM.

---

## Deployment

| Service | Platform | Ghi chú |
|:--------|:---------|:--------|
| Backend | Render | `render.yaml` (Blueprint); region Singapore; health check `/api/health` |
| Frontend | Vercel | `frontend/vercel.json`; rewrite `/api/*` và `/uploads/*` → Render |
| CV Service | Heroku / Render | `Procfile` + `runtime.txt` |

**Frontend trên Vercel không cần `VITE_API_URL`** — `vercel.json` đã rewrite `/api/*` sang
backend Render (tránh CORS). Chỉ set `VITE_GOOGLE_CLIENT_ID`.

**Backend trên Render** — set: `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `CORS_ORIGIN`,
`GOOGLE_CLIENT_ID`, `LLM_API_KEY`, `LLM_BASE_URL`, `CV_ANALYZER_URL`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`, `D_ID_API_KEY`, `ELEVENLABS_API_KEY` + voice IDs, `JAAS_*`.

> ⚠️ **Gotcha Render:** nhập giá trị **không kèm dấu ngoặc kép**, dù `.env` local viết `KEY="value"`.
> Render lưu nguyên văn (không strip quote như `dotenv`). Đã từng gây sự cố: `UPSTASH_REDIS_REST_URL`
> chứa dấu `"` literal → `fetch()` lỗi `Failed to parse URL` → Redis fail-fast → toàn bộ avatar pregen
> trả `null` (mất lipsync và giọng nói).

### CV/JD production checklist

Cần cả hai, nếu không sẽ gặp `404` (sai host) hoặc `503` (analyzer unreachable):
1. FE gọi đúng `/api` (qua rewrite Vercel hoặc `VITE_API_URL`)
2. `CV_ANALYZER_URL` trỏ về Python FastAPI reachable từ backend Node

---

## Tech Stack

| Layer | Công nghệ |
|:------|:----------|
| Frontend | React 18, Vite 6, React Router 7 (browser router), Tailwind CSS v4, shadcn/ui (Radix), MUI, Recharts, Three.js / R3F, motion, react-pdf |
| Backend | Express 5 (ESM), Node ≥ 20, Mongoose 9, JWT, bcrypt, Multer, Joi, helmet, hpp, Sharp, PDFKit, Nodemailer |
| Database | MongoDB (26 schema) · Cache: Upstash Redis |
| CV Analysis | Python FastAPI, pdf parsing, NLP skill extraction, semantic matcher |
| LLM | Đa provider — OpenAI-compatible / Anthropic / Gemini / Ollama |
| Avatar & Voice | D-ID (`/talks` pregen + WebRTC stream), ElevenLabs TTS, Google Cloud Vision |
| Meeting | Jitsi / JaaS (fallback `meet.jit.si`) |
| Media | Cloudinary (fallback local `/uploads`) |
| Auth | Google Identity Services (FedCM), JWT + refresh session |
| Payments | Chuyển khoản ngân hàng + SePay webhook (chính); MoMo / ZaloPay / VNPay (stub) |
| Monitoring | Sentry, Langfuse (LLM trace), cost ledger nội bộ |

---

## Tài liệu

| File | Nội dung |
|:-----|:---------|
| [API_INDEX.md](./API_INDEX.md) | Contract đầy đủ tất cả endpoints (đang chạy + roadmap) |
| [ROADMAP.md](./ROADMAP.md) | Lộ trình theo phase, trạng thái từng endpoint |
| [CLAUDE.md](./CLAUDE.md) | Hướng dẫn cho AI coding agent làm việc trong repo |
| [backend/DATABASE.md](./backend/DATABASE.md) | Schema MongoDB chi tiết, seed scripts |
| [POSTMAN_TESTING.md](./POSTMAN_TESTING.md) | Hướng dẫn test API với Postman |
| [docs/BUSINESS_FLOW_GUIDE.md](./docs/BUSINESS_FLOW_GUIDE.md) | Sơ đồ luồng nghiệp vụ |
| [docs/CONTEXT_DIAGRAM.md](./docs/CONTEXT_DIAGRAM.md) | Context diagram hệ thống |
| [docs/CART_BOOKING_PORT.md](./docs/CART_BOOKING_PORT.md) | Chi tiết giỏ hàng + job rà soát booking |
| [docs/FINANCE_OPERATIONS_PORT.md](./docs/FINANCE_OPERATIONS_PORT.md) | Vận hành tài chính admin |

---

## Đóng góp

1. Fork repo và tạo branch từ `main`
2. Khi thêm API mới: cập nhật [API_INDEX.md](./API_INDEX.md) và [ROADMAP.md](./ROADMAP.md)
3. Dùng `apiUrl()` từ `frontend/src/app/api/http.js`, không hardcode URL
4. Route cần auth: dùng `authFetch()` từ `frontend/src/app/utils/auth/auth.js`
5. Thêm/sửa gọi API trong `frontend/src/app/api/*Api.js` tương ứng
6. Response shape chuẩn: `{ success: true, <key>: data }` / `{ success: false, error: "msg" }`
7. Chạy `npm test` ở `backend/` và `frontend/` trước khi mở PR
8. Tạo Pull Request vào `main` với mô tả rõ ràng

---

## Giấy phép

Dự án thuộc sở hữu nội bộ. Liên hệ nhóm phát triển để biết thêm thông tin.
