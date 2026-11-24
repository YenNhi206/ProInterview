# ProInterview

> **ProInterview — AI-Powered Interview Coaching & Mentor Platform** (Capstone FA26, mã đề tài GFA26SE160).
> Nền tảng nối liền luyện phỏng vấn với AI avatar, lộ trình mentor cá nhân hóa, kho nhiều CV + đối chiếu JD,
> khóa học video và tin tuyển dụng của doanh nghiệp đối tác, xoay quanh một Hồ sơ ứng viên duy nhất.

[![Node](https://img.shields.io/badge/Node-%3E%3D22-brightgreen)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5-lightgrey)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose_9-green)](https://mongoosejs.com/)
[![Python](https://img.shields.io/badge/Python-FastAPI-009688)](https://fastapi.tiangolo.com/)

---

## Tổng quan

**ProInterview** là ứng dụng web giúp ứng viên (đặc biệt sinh viên mới tốt nghiệp) chuẩn bị phỏng vấn
và kết nối với việc làm thật. Năm thành phần chính:

- **Phỏng vấn AI** — avatar D-ID đặt câu hỏi (giọng ElevenLabs): 3 câu baseline cố định + 2 câu follow-up sinh
  giữa buổi từ CV/JD và câu trả lời thật (Pro); câu hỏi của doanh nghiệp được đưa vào buổi phỏng vấn khi ứng viên
  luyện cho một tin tuyển dụng. Chấm theo bộ tiêu chí năng lực **SHRM/DDI**, kèm rubric riêng của công ty.
- **Lộ trình mentor cá nhân hóa** — ứng viên gửi yêu cầu, mentor đánh giá ở buổi đầu miễn phí, đề xuất lộ trình
  nhiều buổi; buổi chưa đạt thì học lại trước khi đi tiếp. Booking 1-1, phòng họp Jitsi, feedback sau buổi.
- **Kho nhiều CV & Best-Fit JD** — lưu nhiều phiên bản CV, phân tích JD để gợi ý CV phù hợp nhất, chỉ ra khoảng
  trống kỹ năng; thêm chế độ phân tích CV theo lĩnh vực.
- **Thư viện khóa học video** — mentor tạo khóa (AI sàng lọc + Platform Moderator duyệt), giỏ hàng nhiều khóa, 1 QR.
- **Doanh nghiệp & tin tuyển dụng** — Company Moderator quản lý câu hỏi, rubric, tin tuyển dụng và đơn ứng tuyển;
  công ty xem kết quả theo rubric khi ứng viên ứng tuyển và đồng ý chia sẻ.

**Human-in-the-loop hai tầng:** Platform Moderator duyệt nội dung AI sinh ra; câu hỏi công ty phải qua cả Company
Moderator và Platform Moderator. Quyết định kiểm duyệt được gom lại thành đề xuất cải tiến prompt AI
(`aiImprovementMinerJob` + `PromptVersion`). **Hồ sơ ứng viên** ghi lại mọi kết quả đã xác minh (phỏng vấn AI,
đánh giá mentor, tiến độ lộ trình) dưới dạng hồ sơ năng lực.

---

## Kiến trúc Monorepo

```
ProInterview/
├── frontend/          # Vite + React 18 + Tailwind CSS v4 + shadcn/ui   (port 5173)
├── backend/           # Express 5 + MongoDB (Mongoose 9) + JWT           (port 5000)
├── cv_jd_matching/    # Python FastAPI + Uvicorn                         (port 8000)
└── docs/              # Kế hoạch capstone (plan/), ERD, state machine, activity diagram, báo cáo
```

---

## Yêu cầu

| Công cụ | Phiên bản |
|:--------|:----------|
| Node.js | ≥ 22 (`engines` trong `backend/package.json`) |
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
SLACK_ALERT_WEBHOOK_URL=<https://hooks.slack.com/...>   # thiếu → alert chỉ ghi log
LLM_PRESCREEN_MODEL=<model rẻ>            # AI sàng lọc khóa học; trống → LLM_MODEL
AI_IMPROVEMENT_MIN_EVIDENCE=5             # số lượt kiểm duyệt cùng nhóm để tạo đề xuất cải tiến AI
# Ngưỡng cảnh báo chi phí theo ngày: COST_ALERT_RUBRIC_SCORING_DAILY_USD / _COUNT,
#                                    COST_ALERT_COURSE_PRESCREEN_DAILY_USD / _COUNT
```

Production cần thêm `REFRESH_TOKEN_PEPPER` (server exit nếu thiếu) và `UPSTASH_REDIS_*`.

> ⚠️ **LLM đa provider:** backend tự nhận diện provider từ `LLM_BASE_URL` —
> OpenAI-compatible (DeepSeek, GLM…), Anthropic, Gemini, hoặc Ollama local.

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

> `npm run dev:full` trong `frontend/` chạy cả 3 service song song, nhưng script AI
> hiện hard-code đường dẫn macOS (sẽ sửa ở task N-14) — **trên Windows hãy chạy 3 terminal riêng**.

### Tài khoản dev mặc định (sau seed)

Mật khẩu: **`Dev123456`**

| Email | Role trong code | Hiển thị trên UI | Trang chính |
|:------|:----------------|:-----------------|:------------|
| `customer@dev.local` | `customer` (plan free) | Candidate | `/dashboard` |
| `mentor@dev.local` | `mentor` | Mentor | `/mentor/dashboard` |
| `admin@dev.local` | `admin` | Admin | `/admin` |
| `moderator@dev.local` | `moderator` | Platform Moderator | `/moderator/queue` |
| `enterprise@dev.local` | `company_moderator` | Company Moderator | `/company` |

> DB cũ còn user role `enterprise`: chạy `npm run db:migrate-enterprise-role:dry` rồi `npm run db:migrate-enterprise-role`.

### Script vận hành / migration hay dùng (`backend/`)

| Lệnh | Việc |
|:-----|:-----|
| `npm run sync:mentor-profiles` | Đồng bộ `Mentor` với User role mentor |
| `npm run warmup:baseline-videos` | Làm nóng cache video 3 câu baseline |
| `npm run warmup:company-videos[:dry]` | Render video câu hỏi công ty đã duyệt |
| `npm run db:sync-booking-indexes[:dry]` | Đồng bộ index Booking (LP-02) |
| `npm run db:sync-prompt-versions[:dry]` | Đồng bộ bảng `PromptVersion` với prompt trong code |
| `node src/scripts/activatePromptVersion.js <key> <version>` | Đổi bản prompt đang chạy, không cần deploy |
| `npm run db:recompute-competency-profiles[:dry]` | Gộp lại hồ sơ năng lực ứng viên |

Lệnh có hậu tố `:dry` chỉ đếm/xem trước, không ghi DB. Chạy trên DB khác `.env` thì đặt `TARGET_MONGO_URI`.
Danh sách đầy đủ: `backend/package.json` và [CLAUDE.md](./CLAUDE.md).

### Chạy test

```bash
cd backend  && npm test        # node:test + jest DTO + unittest Python
cd backend  && npm run test:node
cd frontend && npm test        # node:test cho utils
```

Test integration dùng `mongodb-memory-server`, không cần MongoDB thật. `test:node` (backend) và `test`
(frontend) liệt kê từng file test — thêm file test mới vào script tương ứng.

---

## Tính năng chính

### Candidate (`customer`)
- Đăng ký / đăng nhập email (có xác thực email), Google OAuth
- **Free trial phỏng vấn** không cần CV — 3 câu hỏi baseline cố định (`/interview/trial`)
- Phỏng vấn đầy đủ với AI avatar + phân tích hành vi (`/interview`), luyện theo tin tuyển dụng có câu hỏi công ty
- **Hồ sơ ứng viên** (`/profile`): thông tin, vị trí mục tiêu, hồ sơ năng lực SHRM/DDI đã xác minh
- **Kho CV** (`/cvs`, `/cvs/:id/edit`): nhiều phiên bản CV, chọn CV phù hợp nhất với JD
- Phân tích CV: đối chiếu với JD hoặc chấm theo lĩnh vực, có lịch sử
- **Tin tuyển dụng** (`/jobs`): tìm, xem chi tiết, ứng tuyển kèm đồng ý chia sẻ kết quả, báo cáo tin vi phạm
- Gửi yêu cầu mentor (`/mentor-requests`), theo dõi **lộ trình học** (`/learning-paths`), thanh toán lộ trình
- Đặt lịch mentor lẻ, phòng họp Jitsi, đánh giá sau buổi
- Giỏ hàng khóa học, checkout nhiều khóa bằng 1 mã QR, áp coupon
- Gợi ý mentor / khóa học / job theo điểm yếu thực (`/api/recommendations`)
- Lịch sử thanh toán + hóa đơn PDF, dashboard cá nhân, huy hiệu

### Mentor
- Dashboard, lịch, nhận yêu cầu mentor, buổi đánh giá đầu, booking, tài chính & yêu cầu payout
- **Soạn lộ trình học** nhiều buổi, ghi kết quả từng buổi (đạt / học lại) theo bộ tiêu chí năng lực
- Tạo / quản lý khóa học (AI sàng lọc trước, Platform Moderator duyệt)
- Peer review với mentor khác, analytics buổi tư vấn, feedback sau buổi

### Platform Moderator (`moderator`)
- Hàng đợi kiểm định AI (`/moderator/queue`): đánh giá thiếu, chấm điểm cần xem lại; sửa điểm (override)
- Duyệt ngân hàng câu hỏi chung, **duyệt tầng hai câu hỏi công ty**, duyệt rubric, xử lý báo cáo tin tuyển dụng
- Duyệt khóa học, Quality Dashboard (KPI chất lượng AI theo `PromptVersion`)

### Company Moderator (`company_moderator`)
- Mời thành viên công ty (`/company-invite/:token`), tổng quan công ty (`/company/overview`)
- Duyệt câu hỏi AI sinh hoặc tải câu hỏi riêng cho từng vị trí (`/company/questions`)
- Định nghĩa rubric chấm điểm riêng (`/company/rubrics`), đăng và quản lý tin tuyển dụng (`/company/jobs`)
- Xem đơn ứng tuyển và kết quả theo rubric khi ứng viên đồng ý (`/company/applications`)

### Admin
- Quản lý người dùng (có import hàng loạt, gán role), mentor, bookings, duyệt mentor mới
- Vận hành tài chính: giao dịch, payout, xác nhận chuyển khoản khóa học, gói và lộ trình học
- Rà soát booking quá giờ, check-in, audit log
- Review, hỗ trợ, achievements; analytics toàn hệ thống + doanh thu theo nguồn

---

## Core Flow: AI Interview Room Virtual

Tính năng trung tâm của sản phẩm. Hai luồng vào:

| Luồng | Route | Yêu cầu | Câu hỏi |
|:------|:------|:--------|:--------|
| **Free trial** | `/interview/trial` | Chỉ cần đăng nhập, không cần CV | 3 câu baseline cố định |
| **Phỏng vấn đầy đủ** | `/interview` | CV hoặc thông tin vị trí | 3 baseline + 2 follow-up cá nhân hóa (Pro) |
| **Luyện theo tin tuyển dụng** | `/interview` (từ `/jobs/:id`) | Tin có câu hỏi công ty đã duyệt | Câu công ty có ngay từ đầu, chấm thêm theo rubric công ty |

> Code đọc câu hỏi theo `questions[].source` (baseline / follow-up / company), **không** giả định
> "3 baseline + 2 follow-up" theo vị trí.

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
       shrmLevel: "excellent" | "proficient" | "developing" | ""  (rỗng = "Chưa đủ dữ liệu";
                  quy đổi mức bằng aiAnswerToLevel(), không đọc trực tiếp shrmLevel)
       strengths[]:    điểm mạnh cụ thể
       improvements[]: điểm cần cải thiện
       suggestion:     câu trả lời mẫu tốt hơn từ LLM

Response trả về Frontend:
  evaluation.perQuestion[], overallScore, generalComment, inferredRole
  behavioralSummary        ← đọc từ MongoDB (lưu lúc complete)
  behavioralPerQuestion[]  ← emotion + metrics từng câu từ MongoDB
```

- Prompt chấm điểm lấy từ `PromptVersion` đang active (`eval-v1`, …); `promptVersion` ghi theo bản thực sự chạy.
- Thiếu trường sau 1 lần retry → tạo `ModerationItem` `evaluation_incomplete` cho Platform Moderator.
- Câu hỏi công ty được chấm thêm theo `CompanyRubric` (ghi chi phí `rubric_scoring` vào `CostEvent`).
- Kết quả được gộp vào `CandidateProfile.competencies` (hồ sơ năng lực) qua `competencyProfileService`.

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
| Tài khoản | `/api/auth/*`, `/api/users/*`, `/api/notifications/*`, `/api/analytics/*` |
| Hồ sơ & CV | `/api/profile/*` (hồ sơ ứng viên), `/api/cvs/*` (kho CV) |
| Mentor & đặt lịch | `/api/mentors/*`, `/api/mentor/*` (khu vực mentor), `/api/bookings/*`, `/api/mentorship-requests/*` |
| Lộ trình học | `/api/learning-paths/*` (đề xuất, thanh toán, đặt lịch buổi, ghi kết quả) |
| Công ty & tuyển dụng | `/api/company/*` (câu hỏi, rubric, jobs, đơn ứng tuyển), `/api/company-invites/*`, `/api/jobs/*` (công khai) |
| Danh mục chuẩn | `/api/role-categories` (nhóm vị trí), `/api/competencies` (bộ tiêu chí SHRM/DDI) |
| Khóa học & bán hàng | `/api/courses/*`, `/api/enrollments/*`, `/api/cart/*`, `/api/coupons/*`, `/api/plans/*`, `/api/payments/*` |
| CV/JD | `/api/cv/*` (lịch sử, quota + proxy sang Python) |
| Phỏng vấn & AI | `/api/interviews/*`, `/api/ai/*` (TTS, STT, emotion, avatar pregen, D-ID proxy), `/api/recommendations/*` |
| Reviews / Reports | `/api/reviews/*`, `/api/reports/*` |
| Vận hành | `/api/admin/*`, `/api/moderator/*`, `/api/upload/*`, `/api/achievements/*`, `/api/public/*` |
| Chỉ dev | `/api/mock/*` (không mount khi `NODE_ENV=production`) |
| Health | `GET /api/health` |

Xem toàn bộ contract tại [API_INDEX.md](./API_INDEX.md).
Docs CV/JD service (khi chạy local): `http://127.0.0.1:8000/docs`

### Background jobs (tự chạy khi backend kết nối DB)

| Job | Chu kỳ | Việc |
|:----|:-------|:-----|
| `bookingReminderJob` | định kỳ | Nhắc lịch buổi tư vấn sắp diễn ra |
| `bookingStaleSweepJob` | 20 phút | Hủy booking pending chưa trả tiền quá giờ; gắn cờ booking đã trả tiền quá giờ kết thúc + 60 phút; đóng tin tuyển dụng quá hạn; đánh `abandoned` buổi phỏng vấn AI `in_progress` quá 24h |
| `earningsClearanceJob` | định kỳ | Giải phóng thu nhập mentor sau thời gian giữ |
| `ttsCleanupJob` | định kỳ | Dọn audio TTS tạm trên Cloudinary |
| `aiImprovementMinerJob` | mỗi ngày | Gom `ModerationItem` đã xử lý thành `AIImprovementProposal` + `PromptVersion` chưa bật |

---

## Cấu trúc code

### Backend (`backend/src/`)

```
server.js        Load env → validate env (fail-fast) → Sentry → connect Mongo → start jobs → listen
app.js           createApp(): helmet/hpp/rate-limit/CORS → /api/health → mount router
routes/          Router theo domain (~35 file)
controllers/     Xử lý request/response
services/        Business logic (~90 file)
models/          38 Mongoose schema (export qua models/index.js)
prompts/         Prompt mặc định; bản chạy thật lấy từ PromptVersion trong DB
middleware/      authJwt, requireMentor, requireAdmin, requireRole (requireModerator /
                 requireEnterprise), rateLimiters, injectionRateLimit, adminAuditLog,
                 asyncHandler, errorHandler, optionalAuth, upload
jobs/            5 background job
config/          loadEnv, validateEnv, logger, sentry, baselineQuestions,
                 competencies.json (SHRM/DDI), roleCategories.json (nhóm vị trí)
constants/       planCatalog, costEventKinds, ...
scripts/         Seed / migration / audit CLI
integration/     Test integration (mongodb-memory-server)
```

Model capstone mới: `LearningPath`, `LearningPathSession`, `Company`, `CompanyInvite`, `CompanyRubric`,
`CandidateProfile`, `CVDocument`, `JobPost`, `PromptVersion`, `AIImprovementProposal`, `MentorKnowledge`.
Chi tiết field: [backend/DATABASE.md](./backend/DATABASE.md), [docs/LOGICAL_ERD.md](./docs/LOGICAL_ERD.md).

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
api/             ~30 module *Api.js + http.js (apiUrl, API_BASE_URL)
pages/           auth, home, account, booking, company, courses, cv, interview, jobs,
                 learningPaths, mentor, mentors, mentorship, moderator, payment, admin
components/      ui (shadcn), layout, auth, interview, cv, courses, mentor, admin,
                 account, booking, brand, decor, home, legal, modals, profile, reviews, shared
hooks/           useAuthSession, useCart, useDIDStream, useFaceAnalysis, useMeetingLiveCapture,
                 useNavbarNotifications, usePageAnalytics, useUserPresence, ...
utils/           Chia theo domain: admin/ analytics/ auth/ booking/ company/ course/ cv/
                 interview/ jobs/ learningPath/ meeting/ mentor/ moderator/ plans/
                 profile/ recommendations/ shared/
```

**Auth state:** `localStorage` keys `prointerview_access_token`, `prointerview_auth`.
Session khôi phục qua `GET /api/auth/me` khi app load. Route guard: `requireAuthLoader`,
`requireCustomerAuthLoader`, `adminLoader`, `createRoleLoader(...)` (moderator, company), `ProtectedOutlet`.
Tên role hiển thị qua `roleLabel()` (`utils/auth/roleLabels.js`) — không in thẳng `user.role` ra UI.
Gọi API cần auth: dùng `authFetch()` từ `utils/auth/auth.js` (tự gắn Bearer token + refresh).

---

## Khái niệm domain chính

### Role & phân quyền

5 role trên `User.role`:

| Role (code) | Tên hiển thị | Phạm vi |
|:--|:--|:--|
| `customer` | Candidate | Hồ sơ, kho CV, phỏng vấn AI, lộ trình mentor, khóa học, ứng tuyển |
| `mentor` | Mentor | Yêu cầu mentor, lộ trình học, lịch, thu nhập, khóa học, peer review |
| `admin` | Admin | Người dùng, mentor, booking, tài chính, audit, analytics |
| `moderator` | Platform Moderator | Hàng đợi kiểm định AI, ngân hàng câu hỏi, duyệt tầng hai câu công ty, rubric, báo cáo job, khóa học |
| `company_moderator` | Company Moderator | Câu hỏi, rubric, tin tuyển dụng, đơn ứng tuyển của công ty (`User.companyId`) |

Cổng: `requireRole(...roles)` trong `backend/src/middleware/requireRole.js`, kèm
`requireModerator` / `requireEnterprise`. **Admin cố ý KHÔNG đi vòng được cổng moderator** —
kiểm định nội dung tách khỏi quyền vận hành; admin muốn duyệt thì phải được cấp role moderator.

Gán role: `PATCH /api/users/:id/role` (`customer | mentor | moderator | company_moderator`).
Không nâng `admin` qua API — phải sửa trực tiếp DB, tránh một tài khoản admin bị chiếm tự nhân quyền.
Chữ `enterprise` còn trong `CVAnalysis.planAtTime` là **giá trị gói**, không phải role.

`QuestionBank` (`models/QuestionBank.js`) là substrate dùng chung: câu hỏi LLM sinh ra được thu
hoạch vào đây ở `pending_review` cho moderator duyệt; câu hỏi công ty cùng schema nhưng gắn `orgId`
(ref `Company`) nên không lẫn vào pool chung. Nhóm vị trí (`roleCategory`) phải lấy từ
`config/roleCategories.json`; key năng lực từ `config/competencies.json`.

### Lộ trình học (Learning Path)

```
Ứng viên gửi yêu cầu mentor (MentorshipRequest)
   → chọn mentor → buổi đánh giá đầu miễn phí (Booking assessment, 0đ)
   → mentor đề xuất LearningPath nhiều buổi → ứng viên thanh toán (Payment learning_path)
   → đặt lịch từng buổi (LearningPathSession ↔ Booking) → mentor ghi kết quả
   → buổi chưa đạt: tạo buổi học lại, mở đặt lịch ngay; đạt: mở buổi kế tiếp
```

Booking lộ trình và buổi 0đ không hoàn tiền / không sinh rebook credit theo từng buổi và không tính vào
doanh thu booking. Công thức chia tiền: [docs/plan/DECISIONS.md](./docs/plan/DECISIONS.md).

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

Áp dụng cho booking mentor, ghi danh khóa học, giỏ hàng nhiều khóa (`CartOrder` — 1 QR cho cả đơn),
subscription và lộ trình học (`POST /api/learning-paths/:id/checkout`). Mã tham chiếu dạng `PI…`.
MoMo / ZaloPay / VNPay chỉ có stub sandbox, trả 400 ở production. Khoản thu mới phải tái dùng đường ray này.

### Mentor

- User `role=mentor` phải có document `Mentor` (`userId`); đồng bộ bằng `npm run sync:mentor-profiles`
- Public URL dùng `publicId`, **không** dùng `_id`
- Cấp role mentor: admin qua `PATCH /api/users/:id/role`

### Bookings

Lifecycle: `pending` → `confirmed` → `in_progress` → `completed`; ngoài ra `cancelled`, `no_show`.
`paymentStatus`: `pending | paid | refund_pending | refunded | partial_refund | failed`.
Fields: `price`, `platformFee`, `vat`, `totalAmount`, `paymentStatus`, `status`, `rescheduleHistory`, `staleFlaggedAt`.
Ứng viên hủy: `DELETE /api/bookings/:id` (không tự dời lịch). Trước khi tạo/đổi giờ booking phải gọi
`findCandidateBookingConflict` để chặn ứng viên trùng giờ giữa nhiều mentor.
Chi tiết mọi chuyển trạng thái: [docs/STATE_MACHINES.md](./docs/STATE_MACHINES.md).

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
| Alerting | `alertService` + `errorRateMonitor` — cảnh báo cost spike / error rate qua Slack webhook |
| Cost ledger | `costLedgerService` + `CostEvent` — chi phí LLM/D-ID/TTS, chấm rubric, AI sàng lọc khóa học |

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
`UPSTASH_REDIS_REST_TOKEN`, `REFRESH_TOKEN_PEPPER`, `D_ID_API_KEY`, `ELEVENLABS_API_KEY` + voice IDs, `JAAS_*`.

Sau khi merge thay đổi liên quan, nhớ chạy migration một lần trên production
(`db:sync-booking-indexes`, `db:sync-prompt-versions`, `db:migrate-enterprise-role`, …) — xem [CLAUDE.md](./CLAUDE.md).

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
| Backend | Express 5 (ESM), Node ≥ 22, Mongoose 9, JWT, bcrypt, Multer, Joi, helmet, hpp, Sharp, PDFKit, Nodemailer |
| Database | MongoDB (38 schema) · Cache: Upstash Redis |
| Đánh giá năng lực | Bộ tiêu chí SHRM/DDI (`config/competencies.json`) + rubric riêng của công ty |
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
| [docs/plan/START_HERE.md](./docs/plan/START_HERE.md) | Quy trình làm task capstone với code agent, luật task phát sinh |
| [docs/plan/REGISTRATION_V3.md](./docs/plan/REGISTRATION_V3.md) | Đơn đăng ký đề tài V3 — phạm vi đã cam kết với hội đồng |
| [docs/plan/REQUIREMENTS.md](./docs/plan/REQUIREMENTS.md) | Mã REQ cho chức năng + NFR, ánh xạ REQ ↔ task |
| [docs/plan/TASKS.md](./docs/plan/TASKS.md) | Task, trạng thái, phụ thuộc, điều kiện "Xong khi" — nguồn đúng duy nhất về tiến độ |
| [docs/plan/DECISIONS.md](./docs/plan/DECISIONS.md) | Quyết định đã chốt, chia tiền lộ trình |
| [docs/plan/DESIGN.md](./docs/plan/DESIGN.md) | Thiết kế model/API/màn hình, bẫy trong code |
| [API_INDEX.md](./API_INDEX.md) | Contract đầy đủ tất cả endpoints (đang chạy + roadmap) |
| [ROADMAP.md](./ROADMAP.md) | Lộ trình theo phase, trạng thái từng endpoint |
| [CLAUDE.md](./CLAUDE.md) / [AGENTS.md](./AGENTS.md) | Hướng dẫn cho code agent (Claude Code / Gemini) |
| [backend/DATABASE.md](./backend/DATABASE.md) | Schema MongoDB chi tiết, seed scripts |
| [docs/LOGICAL_ERD.md](./docs/LOGICAL_ERD.md) | Logical ERD + ràng buộc / unique index |
| [docs/STATE_MACHINES.md](./docs/STATE_MACHINES.md) | State machine các field `status` |
| [docs/ACTIVITY_DIAGRAMS.md](./docs/ACTIVITY_DIAGRAMS.md) | Activity diagram các luồng nghiệp vụ chính |
| [docs/SYSTEM_OVERVIEW.md](./docs/SYSTEM_OVERVIEW.md) | Sơ đồ kiến trúc tổng quan |
| [POSTMAN_TESTING.md](./POSTMAN_TESTING.md) | Hướng dẫn test API với Postman |
| [docs/BUSINESS_FLOW_GUIDE.md](./docs/BUSINESS_FLOW_GUIDE.md) | Sơ đồ luồng nghiệp vụ |
| [docs/CONTEXT_DIAGRAM.md](./docs/CONTEXT_DIAGRAM.md) | Context diagram hệ thống |
| [docs/CART_BOOKING_PORT.md](./docs/CART_BOOKING_PORT.md) | Chi tiết giỏ hàng + job rà soát booking |
| [docs/FINANCE_OPERATIONS_PORT.md](./docs/FINANCE_OPERATIONS_PORT.md) | Vận hành tài chính admin |

---

## Đóng góp

1. Nhận việc qua [docs/plan/TASKS.md](./docs/plan/TASKS.md); mỗi task gắn ít nhất một mã REQ, task đang
   Doing/Review của người khác thì không làm. Chỉ làm đủ cột "Xong khi".
2. Tạo branch từ `main` theo mẫu `feat/<mã-task>-<tên-ngắn>` (mã: `N`, `LP`, `CO`, `PR`, `JB`, `AI`, `QA`, `DOC`).
3. Khi thêm API mới: Model → Service → Controller → Route (`authJwt` + `requireRole`), test integration,
   cập nhật [API_INDEX.md](./API_INDEX.md) và [ROADMAP.md](./ROADMAP.md); model / status mới thì cập nhật
   ERD, `DATABASE.md`, `STATE_MACHINES.md`.
4. FE: dùng `apiUrl()` từ `frontend/src/app/api/http.js` và `authFetch()` từ `utils/auth/auth.js`;
   gọi API qua `frontend/src/app/api/*Api.js`; không đưa dữ liệu giả vào màn hình.
5. Response shape chuẩn: `{ success: true, <key>: data }` / `{ success: false, error: "thông báo tiếng Việt" }`.
6. Chạy `npm test` ở `backend/` và `frontend/` trước khi mở PR.
7. Tên PR mở đầu bằng mã task; mô tả PR có dòng `REQ: <mã, mã>`.

---

## Giấy phép

Dự án thuộc sở hữu nội bộ. Liên hệ nhóm phát triển để biết thêm thông tin.
