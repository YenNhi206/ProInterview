# Context diagram — ProInterview

Tài liệu này mô tả toàn bộ ProInterview như **một hệ thống duy nhất**. Vai trò **Kiểm duyệt viên** và các luồng kiểm duyệt trong ảnh yêu cầu là **tính năng dự kiến**: hiện tại `User.role` chỉ có `customer`, `mentor`, `admin`. Đường nét đứt biểu thị luồng dự kiến.

**Bản theo mẫu học thuật (trắng đen, vòng tròn trung tâm, mũi tên một chiều):** [`PROINTERVIEW_CONTEXT_MAU.drawio`](PROINTERVIEW_CONTEXT_MAU.drawio). Xem nhanh qua [`PNG`](PROINTERVIEW_CONTEXT_MAU.png) hoặc [`SVG`](PROINTERVIEW_CONTEXT_MAU.svg). Bản này gồm 40 luồng dữ liệu riêng và mở trực tiếp để chỉnh sửa trong draw.io.

**Mở trực tiếp trong draw.io:** dùng file [`PROINTERVIEW_CONTEXT.drawio`](PROINTERVIEW_CONTEXT.drawio). File có ba trang, tất cả ô và đường nối đều chỉnh sửa được. Vào **File → Open From → Device**, chọn file, rồi đổi trang bằng thanh tab ở cuối cửa sổ.

## 1. Sơ đồ ngữ cảnh (DFD mức 0)

```mermaid
flowchart LR
    UV["Ứng viên"]
    MT["Mentor"]
    AD["Admin"]
    KD["Kiểm duyệt viên<br/>(dự kiến)"]

    PI(("0. ProInterview"))

    GG["Google Sign-In"]
    AI["Nhà cung cấp LLM"]
    VISION["Google Vision / Hume AI"]
    DID["D-ID"]
    MEDIA["Cloudinary"]
    STT["AssemblyAI / ElevenLabs"]
    PAY["VNPay / SePay"]
    MAIL["Dịch vụ SMTP"]
    MEET["Jitsi / JaaS"]

    UV <-->|"1. Tài khoản và hồ sơ"| PI
    UV <-->|"2. Phân tích CV-JD"| PI
    UV <-->|"3. Phỏng vấn AI"| PI
    UV <-->|"4. Tìm mentor"| PI
    UV <-->|"5. Đặt lịch và họp mentor"| PI
    UV <-->|"6. Mua và học khóa học"| PI
    UV <-->|"7. Gói dịch vụ và thanh toán"| PI
    UV <-->|"8. Đánh giá, báo cáo và thông báo"| PI

    MT -->|"Hồ sơ, lịch rảnh, khóa học,<br/>nội dung buổi tư vấn"| PI
    PI -->|"Booking, đánh giá, thống kê,<br/>thu nhập và thông báo"| MT

    AD -->|"Duyệt mentor, quản lý tài khoản,<br/>xác nhận giao dịch, cấu hình"| PI
    PI -->|"Báo cáo vận hành, danh sách chờ,<br/>thống kê thanh toán"| AD

    PI -.->|"Câu hỏi AI chờ duyệt, kết quả CV-JD,<br/>Review Queue, Quality Dashboard"| KD
    KD -.->|"Duyệt / từ chối câu hỏi;<br/>duyệt logic CV-JD; ghi nhận nhận xét"| PI

    PI -->|"Token đăng nhập"| GG
    GG -->|"Thông tin xác thực"| PI

    PI -->|"Prompt, CV/JD, câu trả lời"| AI
    AI -->|"Câu hỏi, gợi ý, điểm và phản hồi"| PI

    PI -->|"Ảnh khuôn mặt / dữ liệu phân tích"| VISION
    VISION -->|"Kết quả nhận diện / cảm xúc"| PI

    PI -->|"Kịch bản lời nói / yêu cầu avatar"| DID
    DID -->|"Video hoặc luồng avatar"| PI

    PI -->|"Tệp ảnh, CV, video, âm thanh"| MEDIA
    MEDIA -->|"URL tệp đã lưu"| PI

    PI -->|"Âm thanh hoặc văn bản"| STT
    STT -->|"Bản chép lời hoặc giọng nói"| PI

    PI -->|"Tạo giao dịch / mã thanh toán"| PAY
    PAY -->|"Kết quả giao dịch / webhook"| PI

    PI -->|"Email xác thực, nhắc lịch,<br/>thông báo giao dịch"| MAIL

    PI -->|"Yêu cầu vào phòng tư vấn"| MEET
    MEET -->|"Phiên họp trực tuyến"| UV
    MEET -->|"Phiên họp trực tuyến"| MT

    classDef planned fill:#f2e8ff,stroke:#7c3aed,stroke-width:2px;
    class KD planned;
```

### Tám luồng dữ liệu của Ứng viên

| Nhóm | Ứng viên gửi vào hệ thống | Hệ thống trả về |
|---|---|---|
| Tài khoản | Đăng ký, đăng nhập, xác thực email/Google, sửa hồ sơ | Phiên đăng nhập, trạng thái tài khoản, hồ sơ |
| CV-JD | File CV/JD, ngành nghề cần phân tích | Điểm phù hợp, kỹ năng, gợi ý cải thiện, lịch sử phân tích |
| Phỏng vấn AI | Vị trí ứng tuyển, CV, câu trả lời, âm thanh/hình ảnh khi bật tính năng | Câu hỏi, avatar, transcript, điểm, nhận xét, lịch sử phiên |
| Tìm mentor | Từ khóa, bộ lọc, mentor được chọn | Hồ sơ mentor, đánh giá, lịch trống |
| Đặt lịch và họp | Khung giờ, yêu cầu đặt/đổi/hủy lịch, phản hồi buổi họp | Xác nhận booking, trạng thái, liên kết phòng tư vấn |
| Khóa học | Lựa chọn khóa học, giỏ hàng, câu hỏi bài học, tiến độ | Nội dung bài học, ghi danh, tiến độ, chứng chỉ nếu đủ điều kiện |
| Gói và thanh toán | Chọn gói, thanh toán/chuyển khoản | Trạng thái giao dịch, quyền lợi gói, hóa đơn |
| Theo dõi và phản hồi | Yêu cầu dashboard, đánh giá mentor/khóa học, báo cáo sự cố | Thống kê cá nhân, thông báo, lịch sử hoạt động |

**Ranh giới hệ thống:** React frontend, Express backend, FastAPI `cv_jd_matching` và cơ sở dữ liệu MongoDB đều thuộc ProInterview, nên không tách thành thực thể ngoài ở sơ đồ mức 0. Các dịch vụ ngoài được nêu theo khả năng tích hợp của code; việc hoạt động thực tế phụ thuộc cấu hình môi trường. VNPay có nhánh thanh toán thật khi cấu hình khóa; MoMo/ZaloPay ở luồng khởi tạo hiện trả về mock.

## 2. Phóng to luồng Ứng viên

Trang 02 trong file `.drawio` trình bày tám nhóm trên thành các chức năng riêng và nối chúng với dịch vụ liên quan. Đây là **sơ đồ phóng to**, không thay thế context diagram mức 0.

```mermaid
flowchart LR
    UV["Ứng viên"]
    A["1. Tài khoản / hồ sơ"]
    CV["2. Phân tích CV-JD"]
    I["3. Phỏng vấn AI"]
    MS["4. Tìm mentor / đặt lịch"]
    MM["5. Họp và đánh giá mentor"]
    C["6. Mua và học khóa học"]
    P["7. Gói / thanh toán"]
    D["8. Dashboard / thông báo / báo cáo"]

    UV <-->|"Đăng nhập, sửa hồ sơ ↔ tài khoản"| A
    UV <-->|"CV/JD ↔ điểm và gợi ý"| CV
    UV <-->|"Câu trả lời ↔ câu hỏi và đánh giá"| I
    UV <-->|"Tìm/đặt lịch ↔ mentor và lịch trống"| MS
    UV <-->|"Tham gia/đánh giá ↔ buổi tư vấn"| MM
    UV <-->|"Chọn/học ↔ bài học và tiến độ"| C
    UV <-->|"Thanh toán ↔ hóa đơn và quyền lợi"| P
    UV <-->|"Theo dõi/báo cáo ↔ thông báo"| D

    A <-->|"Xác thực"| GG["Google Sign-In"]
    CV <-->|"Phân tích"| LLM["Nhà cung cấp LLM"]
    I <-->|"Avatar, hình ảnh, giọng nói"| AI["D-ID / Vision / STT-TTS"]
    MM --> MEET["Jitsi / JaaS"]
    C <-->|"Ảnh và video"| MEDIA["Cloudinary"]
    P <-->|"Giao dịch"| PAY["VNPay / SePay"]
    D --> MAIL["SMTP"]

    CV -->|"CV dùng cho phỏng vấn"| I
    MS -->|"Booking đã xác nhận"| MM
```

## 3. Phóng to phần Kiểm duyệt viên (DFD mức 1 — đề xuất)

Sơ đồ này **không phải context diagram**; nó phân rã phần kiểm duyệt để làm rõ bốn tính năng trong yêu cầu.

```mermaid
flowchart LR
    KD["Kiểm duyệt viên"]
    AI["AI sinh câu hỏi / phân tích CV-JD"]
    Q[("D1. Ngân hàng câu hỏi")]
    M[("D2. Bộ quy tắc và mẫu CV-JD")]
    LOG[("D3. Lịch sử kiểm duyệt")]
    RESULT[("D4. Kết quả phỏng vấn và CV-JD")]

    P1["1. Lập Review Queue"]
    P2["2. Duyệt câu hỏi phỏng vấn"]
    P3["3. Duyệt logic CV-JD matching"]
    P4["4. Tạo Quality Dashboard"]

    AI -->|"Câu hỏi mới / phiên bản mới"| Q
    AI -->|"Kết quả so khớp / đề xuất điều chỉnh"| M
    Q -->|"Câu hỏi cần duyệt"| P1
    M -->|"Logic / kết quả cần duyệt"| P1
    P1 -->|"Danh sách ưu tiên và trạng thái"| KD

    KD -->|"Chọn câu hỏi; duyệt, sửa hoặc từ chối"| P2
    P2 -->|"Trạng thái và nội dung được duyệt"| Q
    P2 -->|"Lý do và người duyệt"| LOG

    KD -->|"Chọn logic/mẫu; duyệt hoặc yêu cầu sửa"| P3
    P3 -->|"Phiên bản quy tắc được duyệt"| M
    P3 -->|"Lý do và người duyệt"| LOG

    Q -->|"Tỉ lệ câu hỏi đạt"| P4
    M -->|"Tỉ lệ logic đạt"| P4
    LOG -->|"Thời gian xử lý, số mục tồn"| P4
    RESULT -->|"Chất lượng đầu ra"| P4
    P4 -->|"Biểu đồ chất lượng và cảnh báo"| KD

    classDef planned fill:#f2e8ff,stroke:#7c3aed,stroke-width:2px;
    class KD,P1,P2,P3,P4 planned;
```

## Cách vẽ trên draw.io

1. Mở file `.drawio` ở trên để chỉnh sửa trực tiếp. Nếu muốn tạo sơ đồ từ mã, vào **Arrange → Insert → Advanced → Mermaid** và dán từng khối Mermaid.
2. Nếu vẽ tay, đặt `0. ProInterview` ở giữa; người dùng bên trái, dịch vụ bên ngoài bên phải.
3. Dùng hình chữ nhật cho tác nhân/dịch vụ, hình tròn hoặc hình bo góc cho hệ thống, mũi tên có nhãn cho dữ liệu trao đổi.
4. Giữ đường của Kiểm duyệt viên ở dạng nét đứt cho đến khi vai trò và các quy trình này được triển khai.

## Căn cứ từ code

- `backend/src/models/User.js`: role hiện có là `customer`, `mentor`, `admin`.
- `backend/src/app.js`: các module auth, mentor, booking, payment, course, CV và interview.
- `backend/src/routes/auth.js`, `backend/src/routes/interviews.js`, `backend/src/routes/bookings.js`: tài khoản, phiên phỏng vấn và lịch mentor của ứng viên.
- `backend/src/routes/courses.js`, `backend/src/routes/cart.js`, `backend/src/routes/enrollments.js`, `backend/src/routes/notifications.js`: mua/học khóa học, tiến độ và thông báo.
- `backend/src/routes/cvMatch.js`: Express gọi dịch vụ FastAPI phân tích CV/JD.
- `backend/src/services/paymentsService.js` và `backend/src/routes/payments.js`: VNPay, chuyển khoản/SePay và webhook.
- `backend/src/services/avatarService.js`, `backend/src/services/jaasService.js`, `backend/src/services/emailService.js`: avatar, phòng họp và email.
