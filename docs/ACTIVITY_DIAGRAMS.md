# Activity Diagrams — ProInterview

> Cập nhật: 2026-11-01 · nguồn: `backend/src/controllers`, `services`, `jobs` và các trang FE tương ứng.
> Trạng thái của từng thực thể trong các luồng này: [STATE_MACHINES.md](STATE_MACHINES.md).

Mỗi sơ đồ chia **làn (swimlane)** theo tác nhân bằng `subgraph`. Hình thoi = rẽ nhánh; nhánh lỗi ghi mã HTTP trả về.

| # | Luồng | Tác nhân chính |
|:-:|:------|:---------------|
| 1 | [Phỏng vấn AI end-to-end](#1-phỏng-vấn-ai-end-to-end) | Ứng viên · Backend · LLM · Moderator |
| 2 | [Sinh video avatar (pregen)](#2-sinh-video-avatar-pregen) | Backend · ElevenLabs · D-ID · Cloudinary · Redis |
| 3 | [Phân tích CV/JD](#3-phân-tích-cvjd) | Ứng viên · Backend · Python |
| 4 | [Đặt lịch mentor + chuyển khoản](#4-đặt-lịch-mentor--thanh-toán-chuyển-khoản) | Ứng viên · Backend · SePay · Admin · Mentor |
| 5 | [Mua khóa học qua giỏ hàng](#5-mua-khóa-học-qua-giỏ-hàng) | Ứng viên · Backend · SePay/Admin |
| 6 | [Soạn & duyệt khóa học](#6-mentor-soạn-khóa-học--moderator-duyệt) | Mentor · Moderator |
| 7 | [Xử lý hàng đợi kiểm định HITL](#7-moderator-xử-lý-hàng-đợi-kiểm-định-hitl) | Moderator · Backend |
| 8 | [Thu nhập & rút tiền mentor](#8-thu-nhập--rút-tiền-mentor) | Job · Mentor · Admin |
| 9 | [Đăng nhập & làm mới phiên](#9-đăng-nhập--làm-mới-phiên) | Người dùng · Backend |

---

## 1. Phỏng vấn AI end-to-end

```mermaid
flowchart TD
    subgraph UV["Ứng viên (FE /interview → /interview/gender → /interview/room)"]
        A0([Bắt đầu]) --> A1[Chọn vị trí / dán CV-JD]
        A1 --> A2[Chọn giọng HR nam/nữ]
        A2 --> A3[Đồng ý quyền camera]
    end

    subgraph BE["Backend /api/interviews"]
        B1{"Còn lượt phỏng vấn?<br/>quota.interviewUsed < limit"}
        B1 -- Không --> B1x[/403 Hết lượt miễn phí/]
        B1 -- Có --> B2[Tạo InterviewSession<br/>status=in_progress<br/>3 câu baseline cố định]
        B2 --> B3[Lấy video avatar pregen<br/>cho 3 câu — xem sơ đồ 2]
    end

    A3 --> B1
    B3 --> R1

    subgraph ROOM["Phòng phỏng vấn"]
        R1[Avatar đọc câu i] --> R2[Ứng viên trả lời<br/>ghi âm + camera]
        R2 --> R3[STT → transcript<br/>analyze-face → behavioralData]
        R3 --> R4[PATCH /sessions/:id<br/>lưu answers i]
        R4 --> R5{"Đã xong 3 câu baseline?"}
        R5 -- Chưa --> R1
        R5 -- Rồi --> R6{"Gói Pro còn hạn?<br/>starter_pro / elite_pro"}
        R6 -- Không --> R9
        R6 -- Có --> R7
        R8{"Còn câu follow-up?"}
        R8 -- Còn --> R1
        R8 -- Hết --> R9[POST /sessions/:id/complete<br/>status=completed]
    end

    subgraph FU["Sinh follow-up (chỉ Pro)"]
        R7[POST generate-followup-questions] --> F1{"Đã có 5 câu?"}
        F1 -- Có --> F4
        F1 -- Chưa --> F2[LLM sinh 2 câu<br/>từ CV/JD + 3 câu trả lời thật]
        F2 --> F3[applyDeprecationPolicy<br/>trùng câu deprecated → sinh lại ≤ 2 lần]
        F3 --> F3b[harvest vào QuestionBank<br/>status=pending_review]
        F3b --> F4[Trả 2 câu + pregen video]
    end
    F4 --> R8

    subgraph EV["Chấm điểm POST /sessions/:id/evaluate"]
        R9 --> E1{"Đã có feedback?"}
        E1 -- Có --> E9
        E1 -- Chưa --> E2[Claim khóa đánh giá<br/>đang chạy → 429]
        E2 --> E3[LLM chấm từng câu<br/>clarity · structure · relevance · credibility]
        E3 --> E4{"Đủ trường?"}
        E4 -- Thiếu --> E5[Retry 1 lần]
        E5 --> E6{"Vẫn thiếu?"}
        E6 -- Có --> E7[evaluationIncomplete=true<br/>upsert ModerationItem<br/>evaluation_incomplete, priority high]
        E6 -- Không --> E8
        E4 -- Đủ --> E8[Ghi feedback + perQuestion]
        E7 --> E8
        E8 --> E9[Trả kết quả]
    end

    subgraph FB["Ứng viên — /interview/feedback"]
        E9 --> G1[Xem điểm tổng + từng câu]
        G1 --> G2{"Thấy câu hỏi/điểm sai?"}
        G2 -- Có --> G3[Báo sai: POST /api/reports<br/>reasonCode + note]
        G3 --> G4[ModerationItem open<br/>→ sơ đồ 7]
        G2 -- Không --> G5([Kết thúc])
        G4 --> G5
    end
```

**Chưa làm (bước 7 của S1):** FE chưa hiện nút "Báo sai", nhãn "Đang chờ kiểm định" khi `evaluationIncomplete`, và điểm moderator thay điểm AI khi có `moderatorOverride`. Backend đã trả đủ các trường này.

---

## 2. Sinh video avatar (pregen)

```mermaid
flowchart TD
    S([Yêu cầu video cho câu hỏi]) --> C1{"Redis có cache?"}
    C1 -- Có --> OUT[Trả result_url]
    C1 -- Không --> C2{"Circuit breaker D-ID mở?<br/>≥ 3 lỗi liên tiếp, reset sau 5 phút"}
    C2 -- Mở --> NUL[Trả null → FE dùng<br/>Web Speech + ảnh tĩnh]
    C2 -- Đóng --> T1{"Có ElevenLabs?"}
    T1 -- Có --> T2[ElevenLabs TTS theo giới tính<br/>→ upload audio Cloudinary]
    T1 -- Không --> T3[D-ID dùng Azure TTS<br/>từ text]
    T2 --> D1[D-ID /talks lipsync]
    T3 --> D1
    D1 --> D2[Poll tới status=done]
    D2 --> D3{"Lỗi?"}
    D3 -- Có --> D4[Tăng bộ đếm lỗi breaker] --> NUL
    D3 -- Không --> K1{"Câu baseline?<br/>persistVideo=true"}
    K1 -- Không --> OUT
    K1 -- Có --> M1[Mirror sang Cloudinary<br/>prointerview/avatar-videos/]
    M1 --> M2{"Mirror thành công?"}
    M2 -- Có --> M3[Cache 180 ngày<br/>key dùng chung toàn hệ thống] --> OUT
    M2 -- Không --> M4[Cache link D-ID gốc chỉ 1h<br/>vì presigned S3 tự hết hạn] --> OUT
```

Khi pregen nhiều câu, `pregenerateVideos` gọi câu đầu trước làm phép thử; chỉ khi thành công mới chạy song song các câu còn lại — D-ID đang lỗi thì không tốn credit cho cả loạt.

---

## 3. Phân tích CV/JD

```mermaid
flowchart TD
    subgraph UV["Ứng viên — /cv-analysis"]
        A1([Bắt đầu]) --> A2[GET /api/cv/quota]
        A2 --> A3{"Còn lượt?"}
        A3 -- Không --> A4[/Gợi ý nâng gói Pro/]
        A3 -- Có --> A5[Upload CV PDF<br/>+ JD hoặc chọn lĩnh vực]
    end
    subgraph BE["Backend — cvMatch.js (proxy)"]
        A5 --> B1{"mode"}
        B1 -- jd --> B2["/analyze → /analyze/full<br/>→ /analyze/suggestions<br/>theo tier của gói"]
        B1 -- field --> B3["/analyze/field"]
    end
    subgraph PY["Python FastAPI"]
        B2 --> P1[Trích text PDF · trích kỹ năng<br/>chấm khớp · LLM gợi ý]
        B3 --> P1
        P1 --> P2{"Python/LLM phản hồi?"}
        P2 -- Không --> P3[/503 analyzer unreachable/]
    end
    P2 -- Có --> F1[FE hiển thị: điểm khớp,<br/>kỹ năng thiếu, bullet viết lại]
    F1 --> F2[POST /api/cv/analyses<br/>lưu CVAnalysis status=completed]
    F2 --> F3[Xem lại ở /cv-analysis/history]
    F3 --> F4([Kết thúc])
```

`CVAnalysis.status` hiện chỉ được ghi `completed` (lúc FE lưu kết quả). `processing` / `failed` có trong schema nhưng chưa dùng — muốn theo dõi job treo cần ghi bản ghi `processing` trước khi gọi Python.

---

## 4. Đặt lịch mentor + thanh toán chuyển khoản

```mermaid
flowchart TD
    subgraph UV["Ứng viên"]
        U1([Bắt đầu]) --> U2[Chọn mentor /mentors/:publicId]
        U2 --> U3[Chọn loại buổi + slot trống]
        U3 --> U4[Áp coupon / rebook credit]
        U4 --> U5[POST /api/bookings]
    end
    subgraph BE["Backend"]
        U5 --> B1{"Slot còn trống?<br/>unique mentorId+date+timeSlot"}
        B1 -- Không --> B1x[/409 Khung giờ đã có người đặt/]
        B1 -- Có --> B2{"Rebook credit đủ?"}
        B2 -- Có --> B3[status=confirmed<br/>paymentStatus=paid]
        B2 -- Không --> B4[status=pending<br/>tạo paymentRef + Payment pending]
    end
    B4 --> U6[Checkout: hiện STK + nội dung CK]
    U6 --> U7[Chuyển khoản ngân hàng]
    U7 --> U8[PATCH /:id/submit-transfer]
    U8 --> W0

    subgraph PAY["Xác nhận thanh toán"]
        W0{"SePay webhook khớp<br/>paymentRef + số tiền?"}
        W0 -- Có --> W1[Ghi SepayWebhookEvent<br/>sepayId unique]
        W0 -- Không / chưa tới --> W2[Admin đối chiếu sao kê<br/>confirm-transfer-payment]
        W1 --> W3[confirmBankTransferPaymentByAdmin]
        W2 --> W3
        W3 --> W4[paymentStatus=paid · status=confirmed<br/>Payment success · thông báo 2 bên]
    end

    J1[[Job stale sweep]] -. "chưa trả & qua giờ bắt đầu" .-> J2[cancelled + failed]
    B4 -.-> J1

    subgraph MT["Mentor & buổi họp"]
        W4 --> M1[Mentor check-in ảnh]
        B3 --> M1
        M1 --> M2[Vào phòng Jitsi/JaaS<br/>status=in_progress]
        M2 --> M3[Mentor ghi session capture<br/>→ MentorKnowledge]
        M3 --> M4[Kết thúc buổi: completed<br/>thu nhập vào clearingBalance]
    end
    M4 --> U9[Ứng viên đánh giá<br/>POST /:id/review]
    U9 --> U10([Kết thúc])
```

Nhánh hủy/vắng mặt/đổi mentor: xem bảng chuyển trạng thái Booking trong [STATE_MACHINES.md §1](STATE_MACHINES.md#1-booking--bookingstatus).

---

## 5. Mua khóa học qua giỏ hàng

```mermaid
flowchart TD
    A([Bắt đầu]) --> B[POST /api/cart/items<br/>khóa phải published]
    B --> C{"Thêm khóa khác?"}
    C -- Có --> B
    C -- Không --> D[POST /api/cart/checkout]
    D --> E{"Đã có đơn active?"}
    E -- Có --> E1[Trả đơn đang mở]
    E -- Không --> F[CartOrder preparing<br/>tạo Enrollment pending + Payment<br/>cho từng khóa]
    F --> G{"Khóa nào đổi giá /<br/>ngừng bán trong lúc tạo?"}
    G -- Có --> G1[/409 + đơn expired, rollback/]
    G -- Không --> H[CartOrder pending<br/>hiện orderRef để CK]
    E1 --> H
    H --> I{"Thanh toán trước<br/>paymentExpiresAt?"}
    I -- Không / hủy --> I1[expired · active=false<br/>Payment cancelled]
    I -- Có --> J[SePay khớp orderRef<br/>hoặc admin xác nhận]
    J --> K[CartOrder paid<br/>mọi Enrollment paid<br/>xóa khóa khỏi Cart]
    K --> L[Học /courses/:id/learn<br/>cập nhật completedLessons]
    L --> M{"progressPercent = 100<br/>& certificateEnabled?"}
    M -- Có --> N[Cấp chứng chỉ<br/>certificateUrl]
    M -- Không --> L
    N --> O([Kết thúc])
    I1 --> O
```

Khóa miễn phí (`isFree`) ghi danh thẳng qua `POST /api/courses/:id/enroll`, không qua giỏ.

---

## 6. Mentor soạn khóa học → Moderator duyệt

```mermaid
flowchart TD
    subgraph MT["Mentor — /mentor/courses"]
        A([Bắt đầu]) --> B[Tạo khóa: draft]
        B --> C[Soạn module/lesson<br/>upload video Cloudinary]
        C --> D[PATCH /:id/publish]
        D --> D1{"Có title & ≥ 1 module?"}
        D1 -- Không --> D2[/400 thiếu nội dung/] --> C
    end
    D1 -- Có --> E{"Khóa đang published?"}
    E -- Không --> F[status=pending_review]
    E -- Có --> G[Lưu vào pendingUpdate<br/>status=pending_update<br/>bản cũ vẫn bán]

    subgraph MO["Moderator — /moderator/courses"]
        F --> H[Xem hàng chờ<br/>GET /courses/pending]
        G --> H
        H --> I{"Đạt chuẩn?"}
        I -- Đạt --> J[approve]
        I -- Không --> K[reject + lý do bắt buộc]
    end
    J --> J1{"Là bản cập nhật?"}
    J1 -- Có --> J2[Áp pendingUpdate → published]
    J1 -- Không --> J3[published · publishedAt]
    K --> K1{"Là bản cập nhật?"}
    K1 -- Có --> K2[Bỏ pendingUpdate<br/>giữ bản published cũ]
    K1 -- Không --> K3[Về draft] --> C
    J2 --> Z[Thông báo mentor<br/>ghi adminAuditLog]
    J3 --> Z
    K2 --> Z
    Z --> END([Kết thúc])
```

---

## 7. Moderator xử lý hàng đợi kiểm định (HITL)

```mermaid
flowchart TD
    subgraph SRC["Nguồn tạo mục"]
        S1[Ứng viên báo sai câu hỏi<br/>question_report]
        S2[Ứng viên báo sai điểm<br/>evaluation_report]
        S3[LLM chấm thiếu sau retry<br/>evaluation_incomplete · high]
    end
    S1 --> Q[ModerationItem open<br/>snapshot câu hỏi + transcript + AI eval]
    S2 --> Q
    S3 --> Q

    subgraph MO["Moderator — /moderator/queue"]
        Q --> L[GET /queue<br/>ưu tiên cao trước, cũ trước]
        L --> C[PATCH /queue/:id/claim]
        C --> C1{"Người khác đang giữ?"}
        C1 -- Có --> C2[/409/] --> L
        C1 -- Không --> V[in_review · xem chi tiết]
        V --> D{"Quyết định"}
        D -- Báo cáo không đúng --> R1[dismiss]
        D -- Điểm AI sai / thiếu --> R2[override_score<br/>chấm 4 tiêu chí 0–5 + SHRM level]
        D -- Câu hỏi diễn đạt kém --> R3[edit_question<br/>ghi revision]
        D -- Câu hỏi không dùng được --> R4[deprecate_question]
    end

    R1 --> X[dismissed]
    R2 --> Y1[answers i .moderatorOverride] --> Y[resolved]
    R3 --> Y2[QuestionBank sửa text<br/>giữ approved] --> Y
    R4 --> Y3[QuestionBank deprecated<br/>không phục vụ lại] --> Y
    X --> N[Report liên kết đồng bộ trạng thái<br/>+ Notification cho người báo]
    Y --> N
    N --> K[KPI /quality/stats:<br/>tỉ lệ duyệt/sửa câu AI, thời gian xử lý]
    K --> END([Kết thúc])
```

---

## 8. Thu nhập & rút tiền mentor

```mermaid
flowchart TD
    A([Buổi completed / khóa paid]) --> B[Tính net = giá − phí nền tảng<br/>theo platformFeeRate của mentor]
    B --> C[clearingBalance += net<br/>đặt earningsClearAt]
    C --> D[[earningsClearanceJob]]
    D --> E{"Tới earningsClearAt<br/>& không có Report mở?"}
    E -- Chưa --> D
    E -- Rồi --> F{"clearingBalance ≥ net?"}
    F -- Không --> F1[earningsClearFailedAt<br/>log đối soát lệch]
    F -- Có --> G[clearingBalance −= net<br/>availableBalance += net]

    G --> H[Mentor: POST /api/mentor/payout]
    H --> I{"amount ≤ availableBalance<br/>& có tài khoản ngân hàng?"}
    I -- Không --> I1[/400/]
    I -- Có --> J[PayoutRequest pending<br/>availableBalance −= amount<br/>pendingBalance += amount]
    J --> K{"Admin duyệt?"}
    K -- Từ chối --> K1[rejected + lý do<br/>pendingBalance → availableBalance]
    K -- Duyệt --> L[approved]
    L --> M[Admin chuyển khoản thủ công]
    M --> N[Xác nhận paid<br/>transferRef ≥ 3 ký tự<br/>pendingBalance −= amount]
    N --> END([Kết thúc])
```

---

## 9. Đăng nhập & làm mới phiên

```mermaid
flowchart TD
    A([Bắt đầu]) --> B{"Phương thức"}
    B -- Email --> C[POST /api/auth/login]
    B -- Google --> G[POST /api/auth/google<br/>verify ID token]
    C --> C1{"Đang bị khóa?<br/>lockUntil > now"}
    C1 -- Có --> C2[/403 tài khoản bị khóa tạm/]
    C1 -- Không --> C3{"Mật khẩu đúng?"}
    C3 -- Sai --> C4[failedLoginAttempts++<br/>vượt ngưỡng → lockUntil] --> C2
    C3 -- Đúng --> T
    G --> T[Phát access JWT 15m claim tv<br/>+ refresh token sessionId:secret<br/>lưu hash vào authSessions ≤ 10]
    T --> U[FE lưu localStorage<br/>gọi API kèm Bearer]
    U --> V{"401 access hết hạn?"}
    V -- Không --> U
    V -- Có --> W[POST /api/auth/refresh]
    W --> W1{"Refresh hợp lệ<br/>& chưa hết 30 ngày?"}
    W1 -- Có --> T
    W1 -- Không --> X[Xóa phiên FE → /login]
    U --> Y[Logout / đổi mật khẩu]
    Y --> Z[tokenVersion++<br/>xóa toàn bộ authSessions<br/>mọi access token cũ mất hiệu lực]
    Z --> END([Kết thúc])
    X --> END
```
