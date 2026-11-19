# Logical ERD — ProInterview

> Cập nhật: 2026-11-18 · nguồn: `backend/src/models/*.js` (30 model).
> Script tạo DB tương ứng: [database/prointerview_schema.mongodb.js](database/prointerview_schema.mongodb.js).
> Mức khái niệm (chỉ tên thực thể): [CONCEPTUAL_DIAGRAM_GUIDE.md](CONCEPTUAL_DIAGRAM_GUIDE.md).

## Quy ước

- Hệ quản trị là **MongoDB**: mỗi thực thể chính là một collection, khóa chính `_id` (ObjectId), khóa ngoại là trường `ObjectId` có `ref`.
- **Thực thể yếu (embedded)** — đánh dấu `«embedded»` — là mảng/sub-document lưu bên trong document cha, không có collection riêng (vd. `MODULE`, `LESSON` trong `Course`). Ở mức logic vẫn vẽ tách để thấy bội số.
- Chỉ liệt kê thuộc tính có ý nghĩa nghiệp vụ hoặc ràng buộc; đầy đủ từng trường xem model hoặc `backend/DATABASE.md`.
- `createdAt`, `updatedAt` có ở mọi collection (`timestamps: true`) nên không ghi lại.
- Ký hiệu: `PK` khóa chính · `FK` khóa ngoại · `UK` duy nhất.

---

## A. Tài khoản · Mentor · Đặt lịch · Tài chính

```mermaid
erDiagram
    USER ||--o| MENTOR : "là (role=mentor)"
    USER ||--o| SUBSCRIPTION : "đăng ký gói"
    USER ||--o{ AUTH_SESSION : "«embedded» phiên refresh"
    USER ||--o{ BOOKING : "đặt"
    MENTOR ||--o{ BOOKING : "nhận"
    BOOKING ||--o{ RESCHEDULE_ENTRY : "«embedded» lịch sử dời"
    BOOKING |o--o| REVIEW : "được đánh giá"
    BOOKING ||--o| MENTOR_KNOWLEDGE : "đúc kết"
    BOOKING |o--o| BOOKING : "credit dời lịch"
    USER ||--o{ MENTORSHIP_REQUEST : "đăng"
    MENTORSHIP_REQUEST ||--o{ MENTORSHIP_OFFER : "«embedded» offers"
    MENTOR ||--o{ MENTORSHIP_OFFER : "gửi"
    MENTORSHIP_REQUEST |o--o| BOOKING : "sinh ra"
    USER ||--o{ PAYMENT : "trả"
    BOOKING ||--o{ PAYMENT : "type=booking"
    SUBSCRIPTION ||--o{ PAYMENT : "type=subscription"
    MENTOR ||--o{ PAYOUT_REQUEST : "rút tiền"
    COUPON ||--o{ COUPON_USAGE : "«embedded» usedBy"
    USER ||--o{ COUPON_USAGE : "dùng"

    USER {
        ObjectId _id PK
        string email UK
        string name
        string passwordHash "select:false"
        string googleId UK "sparse"
        enum role "customer|mentor|admin|moderator|enterprise"
        enum plan "free|starter_pro|elite_pro (+legacy)"
        date planExpiresAt
        object quota "cvAnalysisUsed/Limit, interviewUsed/Limit, interviewQuestionsAllowed"
        int tokenVersion "khớp claim tv"
        int failedLoginAttempts
        date lockUntil
        bool isEmailVerified
        bool isActive
        object journeyProgress
        object consent "camera.acceptedAt, version"
    }
    AUTH_SESSION {
        string tokenHash
        date expiresAt
        string userAgent
        string ip
        string fingerprint
    }
    MENTOR {
        ObjectId _id PK
        ObjectId userId FK,UK "→ USER"
        string publicId UK "dùng ở URL public"
        string name
        string title
        string company
        number pricePerHour
        number pendingPricePerHour
        array sessionTypes "type, durationMinutes, price"
        map availableSlots
        array recurringSchedule
        object stats "rating, reviewCount, sessionCount, ..."
        object finance "availableBalance, clearingBalance, pendingBalance, totalEarned, bankAccount"
        enum status "active|suspended|closed"
        object adminReview "status pending|approved|rejected, reviewedBy → USER"
        object pricing "platformFeeRate, coursePlatformFeeRate, isEarlyMentor"
        bool isVerified
    }
    SUBSCRIPTION {
        ObjectId _id PK
        ObjectId userId FK,UK "→ USER"
        enum plan "free|starter_pro|elite_pro"
        enum billingCycle "monthly|yearly"
        date startedAt
        date expiresAt
        array history
        bool isAutoRenew
    }
    BOOKING {
        ObjectId _id PK
        ObjectId userId FK "→ USER"
        ObjectId mentorId FK "→ MENTOR"
        ObjectId mentorshipRequestId FK "→ MENTORSHIP_REQUEST"
        ObjectId learningPathId FK "→ LEARNING_PATH (LP-04)"
        ObjectId learningPathSessionId FK "→ LEARNING_PATH_SESSION (LP-04)"
        string date "YYYY-MM-DD"
        string timeSlot "HH:mm"
        int durationMinutes
        enum sessionType "mock_interview|cv_review|career_consulting|custom|assessment"
        enum status "pending|confirmed|in_progress|completed|cancelled|rescheduled|no_show"
        number price
        number platformFee
        number vat
        number totalAmount
        string couponCode
        enum paymentStatus "pending|paid|refund_pending|refunded|partial_refund|failed"
        enum paymentMethod "transfer|momo|zalopay|vnpay|card|learning_path"
        string paymentRef "UK khi pending"
        date paymentExpiresAt
        ObjectId transferConfirmedBy FK "→ USER (admin)"
        enum cancelledBy "user|mentor|system"
        enum mentorCancelResolution
        enum rebookCreditStatus "available|consumed"
        ObjectId creditSourceBookingId FK "→ BOOKING"
        ObjectId reviewId FK "→ REVIEW"
        date earningsClearAt
        number earningsNetAmount
        object mentorSessionCapture
    }
    RESCHEDULE_ENTRY {
        string oldDate
        string oldTimeSlot
        string newDate
        string newTimeSlot
        enum changedBy "user|mentor"
        date changedAt
    }
    MENTORSHIP_REQUEST {
        ObjectId _id PK
        ObjectId userId FK "→ USER"
        string title
        string position
        enum sessionType
        number budget
        enum status "open|selected|assessing|path_proposed|closed"
        ObjectId jobPostId FK "→ JOB_POST (tùy chọn, LP-05)"
        ObjectId assessmentBookingId FK "→ BOOKING (buổi 0đ, LP-05)"
        ObjectId selectedOfferId
        ObjectId selectedMentorId FK "→ MENTOR"
        binary cvData "select:false"
        binary jdData "select:false"
    }
    MENTORSHIP_OFFER {
        ObjectId _id PK
        ObjectId mentorId FK "→ MENTOR"
        string message
        number priceEstimate
        enum status "pending|withdrawn"
    }
    MENTOR_KNOWLEDGE {
        ObjectId _id PK
        ObjectId bookingId FK,UK "→ BOOKING"
        ObjectId mentorId FK "→ MENTOR"
        ObjectId mentorUserId FK "→ USER"
        string field
        array questionsAsked
        array commonMistakes
        array keyInsights
    }
    PAYMENT {
        ObjectId _id PK
        ObjectId userId FK "→ USER"
        enum type "booking|subscription|course"
        ObjectId referenceId FK "đa hình"
        enum referenceModel "Booking|Subscription|Enrollment"
        number amount
        enum provider "transfer|momo|zalopay|vnpay|card"
        string providerRef UK
        enum status "pending|success|failed|refund_pending|refunded|partial_refund|cancelled|held_inactive_account"
        number refundAmount
        object invoiceSnapshot
    }
    PAYOUT_REQUEST {
        ObjectId _id PK
        ObjectId mentorId FK "→ MENTOR"
        number amount
        enum status "pending|approved|rejected|processing|paid"
        object payoutAccount
        ObjectId reviewedBy FK "→ USER (admin)"
        string transferRef
        date paidAt
    }
    COUPON {
        ObjectId _id PK
        string code UK
        enum discountType "percent|fixed"
        number discountValue
        array applicableTo "all|booking|enrollment|subscription"
        date expiresAt
        bool isActive
    }
    COUPON_USAGE {
        ObjectId userId FK "→ USER"
        enum referenceModel "Booking|Enrollment|Subscription"
        ObjectId referenceId
        date usedAt
    }
```

---

## A2. Learning Path (capstone FA26, LP-03)

```mermaid
erDiagram
    USER ||--o{ LEARNING_PATH : "học (candidateId)"
    MENTOR ||--o{ LEARNING_PATH : "soạn"
    MENTORSHIP_REQUEST ||--o| LEARNING_PATH : "dẫn tới (1 lộ trình chưa hủy)"
    BOOKING |o--o| LEARNING_PATH : "buổi đánh giá 0đ"
    LEARNING_PATH ||--|{ LEARNING_PATH_SESSION : "gồm"
    LEARNING_PATH_SESSION |o--o| BOOKING : "đặt lịch"
    LEARNING_PATH_SESSION |o--o{ LEARNING_PATH_SESSION : "học lại (retakeOf)"
    LEARNING_PATH {
        ObjectId _id PK
        ObjectId candidateId FK "→ USER"
        ObjectId mentorId FK "→ MENTOR"
        ObjectId mentorshipRequestId FK "→ MENTORSHIP_REQUEST, UK khi chưa hủy"
        ObjectId jobPostId FK "→ JOB_POST (tùy chọn)"
        ObjectId assessmentBookingId FK "→ BOOKING"
        string goal
        enum status "draft|proposed|revision_requested|pending_payment|active|completed|cancelled"
        int version
        string revisionNote
        int totalAmount "VND, trọn gói"
        number platformFeeRate "0..1"
        string paymentRef "UK khi pending_payment"
        date proposedAt
        date acceptedAt
        date paidAt
        date completedAt
        date cancelledAt
    }
    LEARNING_PATH_SESSION {
        ObjectId _id PK
        ObjectId pathId FK "→ LEARNING_PATH"
        int order "UK cùng pathId, attempt"
        string title
        array objectives
        array shrmKeys "key SHRM/DDI (LP-01)"
        int shareAmount "VND; học lại miễn phí = 0"
        enum status "planned|scheduled|done|cancelled"
        ObjectId bookingId FK,UK "→ BOOKING"
        int attempt "1 = lần đầu"
        ObjectId retakeOf FK "→ LEARNING_PATH_SESSION"
        enum outcome "passed|not_passed|null"
        object feedback "summary, strengths[], improvements[]"
        date doneAt
    }
```

Booking của buổi lộ trình gắn `learningPathId` + `learningPathSessionId`, không gắn `mentorshipRequestId`, và ghi sẵn field tiền (`paymentStatus: paid`, `price = totalAmount = shareAmount`, `platformFee = round(shareAmount × rate)`, `vat = 0`, `paymentMethod: learning_path`) bằng `utils/learningPathBookingMoney.js`. Buổi đánh giá 0đ là Booking `sessionType: assessment`, mọi field tiền bằng 0. Báo cáo tài chính booking loại cả hai (`EXCLUDE_LEARNING_PATH_BOOKINGS`).

---

## B. Khóa học · Giỏ hàng · Đánh giá

```mermaid
erDiagram
    MENTOR ||--o{ COURSE : "sở hữu"
    COURSE ||--o{ MODULE : "«embedded» modules"
    MODULE ||--o{ LESSON : "«embedded» lessons"
    USER ||--o{ ENROLLMENT : "ghi danh"
    COURSE ||--o{ ENROLLMENT : "có"
    ENROLLMENT ||--o{ LESSON_NOTE : "«embedded» ghi chú"
    ENROLLMENT ||--o| PAYMENT : "type=course"
    USER ||--o| CART : "có"
    CART }o--o{ COURSE : "courseIds[]"
    USER ||--o{ CART_ORDER : "đặt"
    CART_ORDER ||--|{ CART_ORDER_ITEM : "«embedded» items"
    CART_ORDER_ITEM }o--|| COURSE : "mua"
    CART_ORDER_ITEM ||--|| ENROLLMENT : "tạo"
    COURSE ||--o{ COURSE_QA : "hỏi đáp"
    USER ||--o{ COURSE_QA : "hỏi"
    COURSE_QA ||--o{ QA_ANSWER : "«embedded» answers"
    MENTOR ||--o{ MENTOR_PEER_REVIEW : "chấm chéo"
    COURSE ||--o{ MENTOR_PEER_REVIEW : "được chấm"
    USER ||--o{ REVIEW : "viết"
    REVIEW }o--o| MENTOR : "targetType=mentor"
    REVIEW }o--o| COURSE : "targetType=course"

    COURSE {
        ObjectId _id PK
        ObjectId mentorId FK "→ MENTOR"
        string title
        enum level "basic|intermediate|advanced"
        array topics "Technical|Behavioral|Resume|Negotiation|Other"
        number price
        number discountPrice
        bool isFree "tự tính từ price"
        enum status "draft|pending_review|pending_update|published|archived"
        mixed pendingUpdate "bản sửa chờ duyệt"
        object adminReview "reason, reviewedBy → USER (moderator), lastAction"
        object settings "autoEnroll, certificateEnabled, qaEnabled"
        object stats
        int totalLessons "tự tính"
        int totalDurationMinutes "tự tính"
        date publishedAt
    }
    MODULE {
        ObjectId _id PK
        string title
        int order
    }
    LESSON {
        ObjectId _id PK
        string title
        enum type "video|document|quiz"
        string videoUrl
        string documentUrl
        int durationMinutes
        bool isFree "xem thử"
        int order
    }
    ENROLLMENT {
        ObjectId _id PK
        ObjectId userId FK "→ USER"
        ObjectId courseId FK "→ COURSE"
        ObjectId cartOrderId FK "→ CART_ORDER"
        array completedLessons "→ LESSON._id"
        int progressPercent
        bool isCompleted
        string certificateUrl
        number pricePaid
        number platformFee
        enum paymentStatus "pending|paid"
        string paymentRef "UK khi pending"
        date earningsClearAt
    }
    LESSON_NOTE {
        ObjectId lessonId "→ LESSON"
        string content
    }
    CART {
        ObjectId _id PK
        ObjectId userId FK,UK "→ USER"
        array courseIds "→ COURSE"
    }
    CART_ORDER {
        ObjectId _id PK
        ObjectId userId FK "→ USER; UK khi active"
        string orderRef UK "nội dung CK"
        number totalAmount
        string couponCode
        enum status "preparing|pending|paid|expired"
        bool active
        date paymentExpiresAt
        ObjectId confirmedBy FK "→ USER (admin)"
    }
    CART_ORDER_ITEM {
        ObjectId courseId FK "→ COURSE"
        ObjectId enrollmentId FK "→ ENROLLMENT"
        number originalPrice
        number price
        number platformFee
    }
    COURSE_QA {
        ObjectId _id PK
        ObjectId courseId FK "→ COURSE"
        ObjectId lessonId "→ LESSON"
        ObjectId userId FK "→ USER"
        string question
        bool isAnswered
        bool isPinned
    }
    QA_ANSWER {
        ObjectId _id PK
        ObjectId userId FK "→ USER"
        bool isMentor
        string content
    }
    MENTOR_PEER_REVIEW {
        ObjectId _id PK
        ObjectId reviewerId FK "→ MENTOR"
        ObjectId courseId FK "→ COURSE"
        int contentRating "1-5"
        int qualityRating "1-5"
        int priceValueRating "1-5"
    }
    REVIEW {
        ObjectId _id PK
        ObjectId userId FK "→ USER"
        enum targetType "mentor|course"
        ObjectId targetId FK "đa hình"
        ObjectId bookingId FK "→ BOOKING"
        int rating "1-5"
        string comment
        object reply
        bool isVisible
    }
```

---

## C. AI · Kiểm duyệt (Moderator HITL)

```mermaid
erDiagram
    USER ||--o{ CV_ANALYSIS : "phân tích"
    USER ||--o{ INTERVIEW_SESSION : "phỏng vấn"
    INTERVIEW_SESSION ||--|{ INTERVIEW_QUESTION : "«embedded» questions"
    INTERVIEW_SESSION ||--o{ INTERVIEW_ANSWER : "«embedded» answers"
    INTERVIEW_SESSION ||--o| FEEDBACK : "«embedded» feedback"
    QUESTION_BANK |o--o{ INTERVIEW_QUESTION : "questionBankId"
    QUESTION_BANK |o--o{ INTERVIEW_ANSWER : "questionBankId"
    INTERVIEW_SESSION |o--o{ QUESTION_BANK : "provenance.originSessionId"
    QUESTION_BANK ||--o{ QB_HISTORY : "«embedded» history"
    USER ||--o{ REPORT : "báo cáo"
    REPORT |o--o| MODERATION_ITEM : "refs.reportId"
    INTERVIEW_SESSION |o--o{ MODERATION_ITEM : "refs.sessionId"
    QUESTION_BANK |o--o{ MODERATION_ITEM : "refs.questionBankId"
    USER |o--o{ MODERATION_ITEM : "assignee (moderator)"
    PROMPT_VERSION |o..o{ INTERVIEW_QUESTION : "promptVersion (chuỗi)"
    PROMPT_VERSION |o..o{ FEEDBACK : "promptVersion (chuỗi)"
    PROMPT_VERSION |o..o{ QUESTION_BANK : "generatedBy/provenance.promptVersion"
    USER |o--o{ PROMPT_VERSION : "activatedBy"

    CV_ANALYSIS {
        ObjectId _id PK
        ObjectId userId FK "→ USER"
        string cvFileName
        string cvFileUrl
        string jdText
        enum mode "jd|field"
        enum tier "basic|full|suggestions"
        object result "skills, match.score, scores, suggestions"
        enum status "processing|completed|failed|legacy_mock"
        enum planAtTime "free|pro|enterprise"
        object meta "llmProvider, pythonEndpoint, fallbackTriggered"
        enum feedback_rating "helpful|not_helpful"
    }
    INTERVIEW_SESSION {
        ObjectId _id PK
        ObjectId userId FK "→ USER"
        enum hrGender "male|female"
        string planAtTime
        int questionsAllowed "3 free / 5 Pro"
        string inferredRole
        string inferredSeniority
        object competencyProfile
        object behavioralSummary
        enum status "in_progress|completed|abandoned"
        int totalDurationSeconds
        string shareToken
        date feedbackGeneratedAt
    }
    INTERVIEW_QUESTION {
        string id
        enum layer "theory|project|behavior"
        enum seniority "intern|junior|middle|senior"
        string competencyId
        string question
        object starGuidance
        ObjectId questionBankId FK "→ QUESTION_BANK"
        string promptVersion
    }
    INTERVIEW_ANSWER {
        int questionIndex
        string transcript
        int durationSeconds
        ObjectId questionBankId FK "→ QUESTION_BANK"
        bool evaluationIncomplete
        array incompleteFields
        object moderatorOverride "scores, overall, shrmLevel, by → USER"
        array redFlags
        object behavioralData
    }
    FEEDBACK {
        int overallScore "0-100"
        int communication
        int confidence
        int structure
        int content
        array perQuestion "score, badge, scores 0-5, shrmLevel"
        bool isLockedForFree
        string promptVersion
    }
    QUESTION_BANK {
        ObjectId _id PK
        string text
        string textHash "UK cùng orgId"
        enum language "vi|en"
        enum layer
        enum seniority
        string competencyId
        string roleCategory
        enum source "baseline|llm_followup|moderator|org_template"
        ObjectId orgId FK "→ ORGANIZATION (chưa có)"
        enum status "draft|pending_review|approved|rejected|deprecated"
        object review "by → USER, at, note"
        object deprecation "by → USER, reason"
        array revisions
        object provenance "originSessionId, llmModel, promptVersion"
        object stats "timesServed, avgAnswerScore, flagCount"
        ObjectId createdBy FK "→ USER"
    }
    QB_HISTORY {
        enum action "create|approve|reject|edit|deprecate|restore"
        ObjectId actorId FK "→ USER"
        string reason
        string previousQuestion
        date at
    }
    REPORT {
        ObjectId _id PK
        ObjectId reportedBy FK "→ USER"
        enum targetType "mentor|booking|review|course|interview_question|interview_evaluation"
        ObjectId targetId FK "đa hình"
        int questionIndex "chỉ cho báo cáo AI"
        enum reason "late|unprofessional|inappropriate|no_show|fraud|other"
        enum reasonCode "irrelevant|inaccurate_scoring|hallucination|offensive|other"
        enum status "pending|reviewing|resolved|dismissed"
        ObjectId resolvedBy FK "→ USER"
    }
    MODERATION_ITEM {
        ObjectId _id PK
        enum type "question_report|evaluation_report|evaluation_incomplete"
        enum status "open|in_review|resolved|dismissed"
        enum priority "low|normal|high"
        int priorityRank "tự tính"
        ObjectId refs_sessionId FK "→ INTERVIEW_SESSION"
        int refs_questionIndex
        ObjectId refs_questionBankId FK "→ QUESTION_BANK"
        ObjectId refs_reportId FK,UK "→ REPORT"
        ObjectId refs_userId FK "→ USER"
        object snapshot "questionText, transcript, aiEvaluation"
        ObjectId assignee FK "→ USER (moderator)"
        object resolution "action dismiss|deprecate_question|edit_question|override_score"
    }
    PROMPT_VERSION {
        ObjectId _id PK
        string key "evaluation|question_gen (AI-02)"
        string version UK "<tiền tố>-vN, duy nhất toàn bảng"
        object template "phần → chuỗi|mảng chuỗi; null nếu legacy"
        array fewShotExamples "input, output, note"
        bool active "tối đa 1 bản mỗi key"
        bool legacy "chuỗi cũ không còn nội dung"
        date activatedAt
        ObjectId activatedBy FK "→ USER"
        string note
    }
```

---

## D. Thông báo · Nhật ký · Vận hành

```mermaid
erDiagram
    USER ||--o{ NOTIFICATION : "nhận"
    USER ||--o{ ACTIVITY : "hoạt động"
    USER ||--o{ USER_EVENT : "tracking FE"
    USER |o--o{ SECURITY_LOG : "sự kiện bảo mật"
    USER |o--o{ COST_EVENT : "chi phí AI (userId dạng string)"

    NOTIFICATION {
        ObjectId _id PK
        ObjectId userId FK "→ USER"
        enum type "booking_* | payment_* | plan_* | course_* | feedback | system | learning_path_* | application_* | company_invite | rubric_* | job_post_hidden | ai_improvement_proposed"
        string title
        string body
        bool isRead
        object metadata "bookingId, mentorId, courseId, learningPathId, learningPathSessionId, jobPostId, applicationId, companyId, rubricId, proposalId, actionUrl"
    }
    ACTIVITY {
        ObjectId _id PK
        ObjectId userId FK "→ USER"
        enum type "interview_completed|cv_analyzed|booking_*|course_*|plan_upgraded|review_submitted"
        string description
        object metadata "refId, refModel"
    }
    USER_EVENT {
        ObjectId _id PK
        ObjectId userId FK "→ USER"
        enum type "page_view|action"
        string route
        string action
        int durationMs
    }
    SECURITY_LOG {
        ObjectId _id PK
        ObjectId userId FK "→ USER"
        enum type "prompt_injection_attempt|rate_limit_hit|suspicious_output|admin_action"
        object details
        string ipAddress
    }
    COST_EVENT {
        ObjectId _id PK
        string kind "llm_call|tts_elevenlabs|avatar_video_did"
        string userId
        string model
        number costUsd
        number costVnd
        bool fromCache
    }
    SEPAY_WEBHOOK_EVENT {
        ObjectId _id PK
        string sepayId UK "idempotency"
        number transferAmount
        string orderRef
        enum status "received|processed|ignored|unmatched|failed|held_inactive_account"
        string entityType
        string entityId
    }
    ACHIEVEMENT {
        ObjectId _id PK
        string title
        string content
        enum category "Tin tức|Hoạt động|Sự kiện"
        bool isPublished
        date date
    }
```

`SEPAY_WEBHOOK_EVENT` và `ACHIEVEMENT` không có khóa ngoại cứng: webhook khớp đối tượng qua `orderRef` → `Booking.paymentRef` / `Enrollment.paymentRef` / `CartOrder.orderRef`, rồi ghi lại `entityType` + `entityId`.

---

## Bảng quan hệ và ràng buộc

| Quan hệ | Bội số | Cài đặt trong code |
|:--------|:------:|:-------------------|
| USER – MENTOR | 1 – 0..1 | `Mentor.userId` unique sparse; hook `User.post("save")` tự tạo/đồng bộ Mentor khi `role=mentor` |
| USER – SUBSCRIPTION | 1 – 0..1 | `Subscription.userId` unique |
| USER – CART | 1 – 0..1 | `Cart.userId` unique |
| USER – CART_ORDER (đang mở) | 1 – 0..1 | Partial unique `{userId}` khi `active: true` |
| MENTOR – BOOKING theo slot | — | Partial unique `{mentorId, date, timeSlot}` khi status ∈ pending/confirmed/in_progress → chống đặt trùng |
| MENTORSHIP_REQUEST – BOOKING | 0..1 – 0..n | Partial unique `{mentorshipRequestId}` (tên `mentorshipRequestId_regular_unique`) khi booking còn hiệu lực và `sessionType` ∈ mock_interview/cv_review/career_consulting/custom: tối đa 1 booking thường, buổi đánh giá 0đ (`assessment`) không bị chặn. Buổi lộ trình không gắn `mentorshipRequestId` (LP-02) |
| MENTORSHIP_REQUEST – LEARNING_PATH | 1 – 0..1 (chưa hủy) | Partial unique `{mentorshipRequestId}` (tên `mentorshipRequestId_open_unique`) khi `status` ≠ `cancelled` |
| LEARNING_PATH – LEARNING_PATH_SESSION | 1 – 1..n | Unique `{pathId, order, attempt}`: buổi học lại cùng `order`, `attempt` + 1 |
| LEARNING_PATH_SESSION – BOOKING | 0..1 – 0..1 | Partial unique `{bookingId}` khi có `bookingId` |
| Mã CK lộ trình đang chờ | — | Partial unique `LearningPath.paymentRef` khi `status=pending_payment` |
| BOOKING – MENTOR_KNOWLEDGE | 1 – 0..1 | `MentorKnowledge.bookingId` unique |
| USER – COURSE (ENROLLMENT) | n – n | Unique `{userId, courseId}` |
| USER – REVIEW – target | — | Unique `{userId, targetType, targetId}`: mỗi người đánh giá một mentor/khóa một lần |
| MENTOR – COURSE (peer review) | n – n | Unique `{reviewerId, courseId}` |
| PAYMENT – đối tượng | n – 1 | Đa hình `type` + `referenceModel` + `referenceId`; unique `{provider, type, referenceId}` |
| Mã chuyển khoản đang chờ | — | Partial unique `paymentRef` khi `paymentStatus=pending` (Booking, Enrollment) |
| REPORT (AI) – câu hỏi | — | Partial unique `{reportedBy, targetType, targetId, questionIndex}` khi có `questionIndex` → mỗi user báo một câu một lần |
| REPORT – MODERATION_ITEM | 1 – 0..1 | Partial unique `refs.reportId` |
| Đánh giá chưa đủ – MODERATION_ITEM | — | Partial unique `{type, refs.sessionId, refs.questionIndex}` khi `type=evaluation_incomplete` → upsert không nhân bản |
| QUESTION_BANK nội dung | — | Unique `{textHash, orgId}`: chuẩn hóa chữ thường, gộp khoảng trắng, bỏ dấu câu cuối |
| SEPAY_WEBHOOK_EVENT | — | Unique `sepayId` → webhook gửi lại không xử lý hai lần |
| PROMPT_VERSION – chuỗi `promptVersion` | 1 – 0..n | Không có FK: session và QuestionBank lưu nguyên chuỗi `version`. Unique `{key, version}` và unique `{version}` (`version_unique`, vì Quality Dashboard nhóm theo chuỗi không kèm key) |
| PROMPT_VERSION bản active | — | Partial unique `{key}` khi `active: true` (`key_single_active`) → mỗi key tối đa 1 bản active (AI-02) |

## Thay đổi so với Conceptual ERD cũ

Conceptual ERD (`PROINTERVIEW_CONCEPTUAL.drawio`) có 17 thực thể và ghi "chưa có role kiểm duyệt viên". Từ đó đến nay đã thêm:

- `User.role` có thêm `moderator`, `enterprise`.
- Collection mới: `QuestionBank`, `ModerationItem`, `MentorshipRequest`, `MentorKnowledge`, `Coupon`, `LearningPath`, `LearningPathSession` (capstone FA26, LP-03), `PromptVersion` (AI-02).
- `Report` mở rộng `targetType` cho câu hỏi/đánh giá AI (`reasonCode` riêng).
- `InterviewSession.answers` có `evaluationIncomplete`, `moderatorOverride`; `questions`/`answers` trỏ `questionBankId`.
- `Course.adminReview.reviewedBy` giờ là moderator (route chuyển từ `/api/admin` sang `/api/moderator`).
