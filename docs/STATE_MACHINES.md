# State Machine Diagrams — ProInterview

> Cập nhật: 2026-11-01 · nguồn: các hàm ghi `status` trong `backend/src/services`, `controllers`, `jobs`.
> Mỗi sơ đồ kèm bảng "chuyển → hàm/endpoint" để lần ngược về code. Khi thêm giá trị enum mới, cập nhật cả sơ đồ lẫn bảng.

Ký hiệu: `[*]` trạng thái đầu/cuối · nhãn mũi tên = sự kiện `[điều kiện]` / tác nhân.

---

## 1. Booking — `Booking.status`

```mermaid
stateDiagram-v2
    [*] --> pending : Ứng viên đặt lịch<br/>(chưa trả tiền)
    [*] --> confirmed : Đặt bằng rebook credit<br/>(paymentStatus=paid ngay)

    pending --> confirmed : Admin xác nhận CK<br/>hoặc SePay webhook khớp paymentRef
    pending --> confirmed : Mentor xác nhận<br/>[đã thanh toán]
    pending --> cancelled : Ứng viên hủy
    pending --> cancelled : Job stale sweep<br/>[chưa trả tiền & đã qua giờ bắt đầu]

    confirmed --> in_progress : Vào phòng họp<br/>[trong khung giờ, mentor đã check-in]
    in_progress --> confirmed : Vào phòng ngoài khung giờ<br/>(tự sửa trạng thái)
    in_progress --> completed : Mentor kết thúc buổi
    confirmed --> completed : Tự hoàn tất buổi cũ<br/>[đã trả tiền & quá giờ kết thúc]

    confirmed --> cancelled : Ứng viên hủy<br/>(hoàn % theo thời điểm hủy)
    confirmed --> cancelled : Mentor hủy
    cancelled --> confirmed : Ứng viên chọn "đổi lịch"<br/>[mentor hủy ≥ 24h, resolution=awaiting_user]
    confirmed --> confirmed : Mentor dời lịch<br/>(ghi rescheduleHistory)

    confirmed --> no_show : Báo vắng mặt<br/>(admin / ứng viên báo mentor)
    in_progress --> no_show : Báo vắng mặt

    completed --> [*]
    cancelled --> [*]
    no_show --> [*]
```

| Chuyển | Hàm (`services/bookingsService.js` trừ khi ghi khác) | Endpoint |
|:-------|:------------------------------------------------------|:---------|
| `[*] → pending / confirmed` | `createBooking` | `POST /api/bookings` |
| `pending → confirmed` (thanh toán) | `confirmBankTransferPaymentByAdmin` (SePay gọi lại cùng hàm qua `sepayWebhookService`) | `PATCH /api/admin/.../confirm-transfer-payment`, `POST /api/payments/webhook/sepay` |
| `pending → confirmed` (mentor) | `confirmMentorBooking` — chặn nếu chưa qua cổng thanh toán | `PATCH /api/bookings/:id/confirm` |
| `confirmed ⇄ in_progress` | `startBookingMeeting` → `prepareBookingForMeetingEntry` | `PATCH /api/bookings/:id/start`, `/mentor/:id/start` |
| `in_progress → completed` | `completeMentorBooking` | `PATCH /api/bookings/:id/complete` |
| `confirmed → completed` (tự động) | `maybeAutoCompleteStaleBooking` | — |
| `* → cancelled` (ứng viên) | `cancelMyBooking` + `applyUserCancellationLedger` | `DELETE /api/bookings/:id` |
| `* → cancelled` (mentor) | `cancelMentorBooking` — đặt `mentorCancelResolution` = `late_cancel_refund` (< 24h) hoặc `awaiting_user` (≥ 24h) | `PATCH /api/bookings/mentor/:id/cancel` |
| `cancelled → confirmed` | `resolveMentorCancelBooking` (choice `reschedule`) | `PATCH /api/bookings/:id/mentor-cancel-resolution` |
| `confirmed → confirmed` (dời) | `rescheduleMentorBooking` | `PATCH /api/bookings/mentor/:id/reschedule` |
| `* → no_show` | `processBookingNoShow` | `POST /api/bookings/:id/report-no-show` |
| `pending → cancelled` (job) | `jobs/bookingStaleSweepJob.js` — đồng thời `Payment` pending → `cancelled` | — |

**Lưu ý:**
- Ứng viên **không** tự đổi lịch: `rescheduleMyBooking` luôn trả 400 theo chính sách (hủy rồi đặt lại).
- Giá trị `rescheduled` còn trong enum nhưng **không hàm nào ghi** — chỉ được đọc ở `dashboardStatsService`. Có thể dọn khi refactor.
- Booking đã trả tiền nhưng quá giờ mà chưa kết thúc: job stale sweep **không đổi status**, chỉ gắn `staleFlaggedAt` để admin xử lý.
- Hai lựa chọn còn lại khi mentor hủy ≥ 24h: `change_mentor` → sinh `rebookCreditStatus=available`; `refund` → `paymentStatus=refund_pending`.

---

## 2. Thanh toán booking — `Booking.paymentStatus`

```mermaid
stateDiagram-v2
    [*] --> pending : Tạo booking
    [*] --> paid : Dùng rebook credit
    pending --> paid : Admin xác nhận CK / SePay
    pending --> failed : Job stale sweep<br/>[quá giờ bắt đầu]
    paid --> refund_pending : Hủy có hoàn tiền<br/>(chờ ứng viên khai báo TK nhận)
    paid --> partial_refund : Hủy hoàn một phần
    refund_pending --> refunded : Admin hoàn tất chuyển tiền
    paid --> refunded : Hoàn 100% đã xử lý ngay
    failed --> [*]
    refunded --> [*]
    partial_refund --> [*]
```

`refund-destination` (`PATCH /api/bookings/:id/refund-destination`) là bước ứng viên khai báo tài khoản nhận hoàn tiền, trạng thái vẫn `refund_pending` cho tới khi admin ghi `refundCompletedAt`.

---

## 3. Giao dịch — `Payment.status`

```mermaid
stateDiagram-v2
    [*] --> pending : recordTransferPending<br/>(booking / subscription / enrollment)
    pending --> success : Admin xác nhận / SePay khớp
    pending --> held_inactive_account : SePay nhận tiền<br/>[tài khoản người trả đã đóng]
    pending --> cancelled : Booking quá hạn / đơn giỏ hàng hết hạn
    pending --> failed : Cổng thanh toán báo lỗi (stub)
    success --> refund_pending : Hủy có hoàn
    success --> partial_refund : Hoàn một phần
    refund_pending --> refunded : Admin chuyển hoàn
    success --> refunded : Hoàn ngay
    held_inactive_account --> refunded : Admin xử lý tiền treo
```

| Chuyển | Code |
|:-------|:-----|
| `pending → held_inactive_account` | `services/heldPaymentService.js`; webhook log ghi `SepayWebhookEvent.status = held_inactive_account` |
| `pending → cancelled` | `jobs/bookingStaleSweepJob.js`, `services/cartService.js` (`expireCartOrder`) |
| Idempotent | `SepayWebhookEvent.sepayId` unique — webhook gửi lại → `ignored` |

---

## 4. Đơn giỏ hàng — `CartOrder.status`

```mermaid
stateDiagram-v2
    [*] --> preparing : POST /api/cart/checkout<br/>(đang tạo enrollment + payment)
    preparing --> pending : Tạo xong, hiển thị mã CK (orderRef)
    preparing --> expired : Lỗi khi chuẩn bị<br/>(rollback)
    pending --> paid : Admin xác nhận / SePay khớp orderRef
    pending --> expired : Quá paymentExpiresAt<br/>hoặc người dùng hủy đơn
    paid --> [*]
    expired --> [*]
```

`active=true` chỉ đúng ở `preparing`/`pending` (partial unique index → mỗi user một đơn mở). Khi `expired`, các `Payment` pending của từng enrollment trong đơn chuyển `cancelled`. Khi `paid`, từng `Enrollment.paymentStatus` → `paid` và mở khóa học.

---

## 5. Khóa học — `Course.status` (Mentor soạn, Moderator duyệt)

```mermaid
stateDiagram-v2
    [*] --> draft : Mentor tạo khóa
    draft --> pending_review : Mentor gửi duyệt<br/>[có title & ≥ 1 module]
    pending_review --> published : Moderator duyệt
    pending_review --> draft : Moderator từ chối<br/>(bắt buộc lý do)

    published --> pending_update : Mentor sửa khóa đang bán<br/>(lưu vào pendingUpdate)
    pending_update --> published : Moderator duyệt<br/>(áp pendingUpdate)
    pending_update --> published : Moderator từ chối<br/>(bỏ pendingUpdate, giữ bản cũ)

    published --> archived : Moderator / Mentor lưu trữ
    pending_update --> archived : Lưu trữ
    archived --> [*]
```

| Chuyển | Code | Endpoint |
|:-------|:-----|:---------|
| `published → pending_update` (sửa) | `CoursesController.update` | `PUT /api/courses/:id` |
| `draft → pending_review` / `→ pending_update` (gửi duyệt) | `CoursesController.publish` | `PATCH /api/courses/:id/publish` |
| Mentor lưu trữ | `CoursesController.archive` | `DELETE /api/courses/:id` |
| Duyệt / từ chối / lưu trữ | `adminController.approveCourse/rejectCourse/archiveCourse` (mount dưới moderator router) | `PATCH /api/moderator/courses/:id/approve`, `/reject`, `/archive` |

Khóa học chỉ bán được (`cartService`, `reviewsService`) khi `status = published`; khóa `pending_update` vẫn bán bản đang public.

---

## 6. Ngân hàng câu hỏi — `QuestionBank.status`

```mermaid
stateDiagram-v2
    [*] --> pending_review : LLM sinh follow-up<br/>(harvest, source=llm_followup)
    [*] --> approved : Moderator tạo tay (source=moderator)<br/>hoặc seed baseline / fallback

    pending_review --> approved : Moderator duyệt<br/>(đơn lẻ hoặc bulk)
    pending_review --> deprecated : Moderator khai tử
    approved --> deprecated : Khai tử (từ trang câu hỏi<br/>hoặc từ hàng đợi HITL)
    deprecated --> approved : Duyệt lại (khôi phục)
    approved --> approved : Moderator sửa nội dung<br/>(ghi revisions + history, giữ status)
```

| Chuyển | Hàm (`services/questionBankService.js`) | Endpoint |
|:-------|:----------------------------------------|:---------|
| `[*] → pending_review` | `harvest` (upsert theo `textHash`; trùng → giữ nguyên bản cũ) | gọi nội bộ từ `generateFollowUpQuestions` |
| `[*] → approved` | `createQuestion`, `syncFallbackQuestions` | `POST /api/moderator/questions` |
| `→ approved` | `approveQuestion`, `bulkUpdateQuestions` | `PATCH /api/moderator/questions/:id/approve`, `POST .../questions/bulk` |
| `→ deprecated` | `deprecateQuestion`, `bulkUpdateQuestions` | `PATCH /api/moderator/questions/:id/deprecate` |
| Sửa nội dung | `editQuestion` | `PATCH /api/moderator/questions/:id` |

**Tác động lúc chạy phỏng vấn:** chỉ câu `approved` (và `orgId=null`) được phục vụ làm fallback; `applyDeprecationPolicy` loại câu LLM vừa sinh nếu trùng `textHash` một câu `deprecated` và sinh lại tối đa `REGENERATE_ATTEMPTS = 2` lần.

Giá trị `draft`, `rejected` có trong enum nhưng **chưa có luồng nào ghi** — dành cho Enterprise template sau này.

---

## 7. Hàng đợi kiểm định — `ModerationItem.status` (+ `Report.status` đồng bộ)

```mermaid
stateDiagram-v2
    [*] --> open : Ứng viên "Báo sai" câu hỏi/đánh giá<br/>(question_report / evaluation_report)
    [*] --> open : Chấm điểm vẫn thiếu trường sau retry<br/>(evaluation_incomplete, upsert)

    open --> in_review : Moderator nhận (claim)<br/>[chưa ai nhận hoặc chính mình]
    in_review --> in_review : Claim lại bởi chính người đó
    open --> resolved : Resolve trực tiếp
    open --> dismissed : Bỏ qua

    in_review --> resolved : override_score · edit_question<br/>· deprecate_question
    in_review --> dismissed : dismiss

    resolved --> [*]
    dismissed --> [*]
```

| Sự kiện | Hàm (`services/moderationQueueService.js`) | Endpoint |
|:--------|:-------------------------------------------|:---------|
| Tạo từ báo cáo | `createItemForReport` (unique theo `refs.reportId`) | `POST /api/reports` (targetType `interview_question` / `interview_evaluation`) |
| Tạo từ đánh giá thiếu | `upsertIncompleteEvaluationItem` (unique theo session + questionIndex) | gọi trong `POST /api/interviews/sessions/:id/evaluate` |
| Nhận | `claimItem` — người khác đang giữ → 409 | `PATCH /api/moderator/queue/:id/claim` |
| Xử lý | `resolveItem` — mục đã đóng → 409 | `PATCH /api/moderator/queue/:id/resolve` |

Khi resolve: `Report` liên kết → `resolved`/`dismissed` + `resolvedBy`; `override_score` ghi `InterviewSession.answers[i].moderatorOverride`; người báo cáo nhận `Notification` (link `/interview/feedback?sessionId=`).

Trạng thái `Report` cho báo cáo mentor/booking/review/course (không qua hàng đợi): `pending → reviewing → resolved | dismissed`, do admin xử lý ở `/api/admin`.

---

## 8. Buổi phỏng vấn AI — `InterviewSession.status` và đánh giá từng câu

```mermaid
stateDiagram-v2
    [*] --> in_progress : POST /sessions<br/>(3 câu baseline)
    in_progress --> in_progress : Ghi câu trả lời (PATCH)<br/>· sinh 2 follow-up [Pro]
    in_progress --> completed : POST complete
    completed --> completed : POST /evaluate<br/>(sinh feedback)
    completed --> [*]

    state "Đánh giá mỗi câu trả lời" as Eval {
        [*] --> scored : LLM trả đủ trường
        [*] --> incomplete : Thiếu trường<br/>(đã retry 1 lần)
        incomplete --> overridden : Moderator chấm lại
        scored --> overridden : Moderator chấm lại<br/>(sau báo cáo)
    }
```

- `abandoned` có trong enum nhưng **chưa có job/handler nào ghi** — buổi bỏ dở hiện nằm mãi ở `in_progress`. Ứng viên cho job dọn dẹp sau này.
- `incomplete` = `answers[i].evaluationIncomplete = true`; `overridden` = `answers[i].moderatorOverride != null`. FE phải ưu tiên `moderatorOverride.overall` khi hiển thị (bước 7 của S1 — chưa làm).

---

## 9. Rút tiền mentor — `PayoutRequest.status` và số dư

```mermaid
stateDiagram-v2
    [*] --> pending : Mentor yêu cầu rút<br/>[amount ≤ availableBalance]
    pending --> approved : Admin duyệt
    pending --> rejected : Admin từ chối (lý do)
    approved --> paid : Admin xác nhận đã chuyển<br/>[transferRef ≥ 3 ký tự]
    rejected --> [*]
    paid --> [*]
```

Số dư mentor đi theo chiều: buổi/khóa đã thanh toán → `finance.clearingBalance` → job `earningsClearanceJob` khi tới `earningsClearAt` và không có Report mở → `finance.availableBalance` (guard `clearingBalance >= net`, `mentorEarningsService.js`). Tạo payout: `availableBalance → pendingBalance`; `rejected` trả lại `availableBalance`; `paid` trừ hẳn `pendingBalance` (`payoutService.js`). `processing` có trong enum nhưng `payoutService` chỉ dùng `approve / reject / paid`.

---

## 10. Yêu cầu mentorship — `MentorshipRequest.status` / `offers[].status`

```mermaid
stateDiagram-v2
    [*] --> open : Ứng viên đăng yêu cầu<br/>(kèm CV + JD)
    open --> open : Mentor gửi / rút offer
    open --> selected : Ứng viên chọn một offer
    open --> closed : Ứng viên đóng yêu cầu
    selected --> [*] : Mentor được chọn tạo Booking<br/>(mentorshipRequestId)
    closed --> [*]
```

Offer: `pending → withdrawn` (mentor rút). Chọn offer chỉ thành công khi request còn `open` và offer còn `pending` (`findOneAndUpdate` có điều kiện — chống chọn hai lần).

---

## 11. Hồ sơ mentor — `Mentor.adminReview.status` và `Mentor.status`

```mermaid
stateDiagram-v2
    state "Duyệt hồ sơ" as Review {
        [*] --> pending : User được gán role mentor
        pending --> approved : Admin duyệt
        pending --> rejected : Admin từ chối
        rejected --> approved : Admin duyệt lại
    }
    state "Hoạt động" as Ops {
        [*] --> active
        active --> suspended : Admin khóa
        suspended --> active : Admin mở
        active --> closed : Đóng tài khoản
        suspended --> closed : Đóng tài khoản
        closed --> [*] : Không mở lại được (409)
    }
```

---

## 12. Tài khoản người dùng

```mermaid
stateDiagram-v2
    [*] --> unverified : Đăng ký email
    [*] --> active : Đăng nhập Google<br/>(email đã xác minh)
    unverified --> active : Xác minh email
    active --> locked : Sai mật khẩu nhiều lần<br/>(lockUntil)
    locked --> active : Hết lockUntil
    active --> active : Logout / đổi mật khẩu<br/>(tokenVersion++, xóa authSessions)
    active --> closed : Đóng tài khoản<br/>(isActive=false, accountClosedAt)
    closed --> [*]
```

Đây là trạng thái **suy ra** từ các trường (`isEmailVerified`, `lockUntil`, `isActive`), không có field `status` riêng trên `User`. Tiền chuyển tới sau khi tài khoản đóng → `Payment.held_inactive_account`.
