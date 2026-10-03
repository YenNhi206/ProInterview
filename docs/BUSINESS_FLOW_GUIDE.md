# ProInterview Business Process Diagram

## Các file sử dụng

- `PROINTERVIEW_BUSINESS_FLOW.drawio`: file gốc để mở và chỉnh sửa trong draw.io.
- `PROINTERVIEW_BUSINESS_FLOW.png`: ảnh xem trước hoặc chèn nhanh vào báo cáo.
- `generate_business_flow_drawio.py`: mã tạo lại hai file trên.

Để import, mở draw.io rồi chọn **File → Open From → Device** và chọn file `.drawio`. Mỗi lane, activity, decision và connector đều là phần tử riêng nên có thể sửa trực tiếp.

## Bố cục theo mẫu

Sơ đồ dùng swimlane nằm ngang giống mẫu ProcessOn:

1. **Candidate / Learner**
2. **ProInterview System**
3. **AI Services**
4. **SePay / Payment Service**
5. **Mentor**
6. **Admin (Reviewer\*)**

Quy ước màu được giữ ở mức cơ bản:

- Màu xanh cyan: activity/process.
- Màu vàng: decision.
- Màu xanh lá: Start/End.
- Mũi tên đen liền: luồng chính.
- Mũi tên đen nét đứt: luồng hỗ trợ, xử lý ngoại lệ hoặc dữ liệu đã được duyệt đưa lên marketplace.

`Admin (Reviewer*)` được dùng vì code hiện tại chỉ có các role `customer`, `mentor`, `admin`. Những thao tác duyệt Mentor và khóa học đang thuộc quyền Admin; chưa có role reviewer độc lập.

## Nội dung nghiệp vụ trong sơ đồ

Sau khi đăng nhập, người dùng chọn một trong bốn dịch vụ độc lập:

1. **CV-JD analysis:** tải CV và JD → kiểm tra quota → AI phân tích → lưu và xem kết quả.
2. **AI interview:** chọn chế độ → kiểm tra quota/quyền Pro → AI đặt câu hỏi và đánh giá → xem feedback.
3. **Mentor booking:** chọn Mentor và slot → hệ thống kiểm tra lại slot → tạo Booking `pending` → chuyển khoản → SePay hoặc Admin xác nhận → Booking chuyển sang `paid/confirmed` → thực hiện buổi tư vấn.
4. **Course enrollment:** chọn khóa học `published` → khóa miễn phí tạo Enrollment trực tiếp; khóa trả phí tạo Enrollment/CartOrder chờ thanh toán → xác nhận thanh toán → học, cập nhật tiến độ và yêu cầu chứng chỉ khi đủ điều kiện.

Cùng sơ đồ còn có luồng cung cấp dịch vụ:

- Người dùng nộp đơn Mentor → Admin duyệt hoặc từ chối → khi được duyệt, hệ thống đổi role và kích hoạt Mentor → Mentor cấu hình loại buổi, giá và lịch rảnh.
- Mentor tạo bản nháp/cập nhật khóa học → gửi duyệt → Admin duyệt hoặc trả về chỉnh sửa → khóa học được publish lên marketplace.
- Xác nhận chuyển khoản thủ công và xử lý report là các nhánh ngoại lệ của Admin.

## Đối chiếu với code

| Nhánh trong sơ đồ | Căn cứ chính |
|---|---|
| Đăng ký, đăng nhập và quota gói | `backend/src/routes/auth.js`, `backend/src/models/User.js`, `backend/src/services/plansService.js` |
| Đăng ký và duyệt Mentor | `backend/src/models/Mentor.js`, `backend/src/controllers/adminController.js` |
| Phân tích CV-JD | `backend/src/routes/cv.js`, `backend/src/controllers/cvController.js`, `backend/src/models/CVAnalysis.js` |
| Phỏng vấn AI | `backend/src/routes/interviews.js`, `backend/src/controllers/interviewsController.js`, `backend/src/models/InterviewSession.js` |
| Tạo và thực hiện Booking | `backend/src/routes/bookings.js`, `backend/src/controllers/bookingsController.js`, `backend/src/models/Booking.js` |
| Thanh toán và SePay webhook | `backend/src/routes/payments.js`, `backend/src/services/sepayWebhookService.js`, `backend/src/models/Payment.js` |
| Admin xác nhận chuyển khoản | Các route `confirm-transfer-payment` trong `backend/src/routes/admin.js` |
| Review và report | `backend/src/routes/reviews.js`, `backend/src/routes/reports.js` |
| Mentor tạo và gửi duyệt khóa học | `backend/src/routes/courses.js`, `backend/src/models/Course.js` |
| Admin duyệt hoặc từ chối khóa học | Các route `courses/:id/approve` và `courses/:id/reject` trong `backend/src/routes/admin.js` |
| Giỏ hàng, đơn hàng và ghi danh | `backend/src/routes/cart.js`, `backend/src/services/cartService.js`, `backend/src/models/CartOrder.js`, `backend/src/models/Enrollment.js` |
| Tiến độ, chứng chỉ và hỏi đáp | `backend/src/routes/enrollments.js`, `backend/src/routes/courses.js`, `backend/src/models/CourseQA.js` |

Đây là Business Process Diagram tổng thể theo WHAT-WHO. Các Activity Diagram riêng vẫn phù hợp để mô tả chi tiết từng nhánh như Mentor Booking hoặc Course Enrollment.
