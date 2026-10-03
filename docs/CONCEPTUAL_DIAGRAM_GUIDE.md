# Conceptual Diagram của ProInterview

## Mở sơ đồ

Mở [`PROINTERVIEW_CONCEPTUAL.drawio`](PROINTERVIEW_CONCEPTUAL.drawio) trong draw.io bằng **File → Open From → Device**. File có **một trang** và có thể chỉnh sửa từng hộp, từng đường nối. [Ảnh xem trước](PROINTERVIEW_CONCEPTUAL_unified.png).

Sơ đồ vẽ theo mẫu bạn gửi: hộp chỉ ghi **tên thực thể**, đường nối vuông góc, ký hiệu bội số **Crow's Foot**, đen trắng. Nội dung lấy từ các Mongoose model hiện tại trong `backend/src/models`, không sao chép tên thực thể của ảnh mẫu.

## 17 thực thể trên cùng một sơ đồ

| Nhóm | Model xuất hiện trong sơ đồ |
|---|---|
| Tài khoản và tương tác | `User`, `Mentor`, `Notification`, `Report`, `Review` |
| Đặt lịch và tài chính | `Booking`, `Payment`, `Subscription`, `PayoutRequest` |
| Khóa học | `Course`, `Enrollment`, `CourseQA`, `MentorPeerReview`, `Cart`, `CartOrder` |
| AI | `CVAnalysis`, `InterviewSession` |

Tên trong hộp dùng dạng viết hoa có dấu gạch dưới để dễ đọc, chẳng hạn `CV_ANALYSIS` tương ứng model `CVAnalysis` và `CART_ORDER` tương ứng `CartOrder`.

## Cách đọc ký hiệu và quan hệ

`||` nghĩa là **đúng một**; `O|` nghĩa là **không hoặc một**; `O<` nghĩa là **không hoặc nhiều**. Ký hiệu đặt sát một hộp cho biết một bản ghi ở hộp đối diện có thể liên kết với bao nhiêu bản ghi ở hộp đó.

| Quan hệ trong sơ đồ | Vì sao vẽ như vậy trong code |
|---|---|
| `USER` — `MENTOR`: `0..1` — `0..1` | `Mentor.userId` là tùy chọn và duy nhất. Mentor dữ liệu mẫu có thể chưa gắn tài khoản. |
| `USER` — `SUBSCRIPTION`: `1` — `0..1` | `Subscription.userId` bắt buộc và duy nhất. |
| `USER` — `CART`: `1` — `0..1` | `Cart.userId` bắt buộc và duy nhất. |
| `USER` — `BOOKING`, `CV_ANALYSIS`, `INTERVIEW_SESSION`, `PAYMENT`, `ENROLLMENT`, `REVIEW`, `COURSE_QA`, `CART_ORDER`, `NOTIFICATION`, `REPORT`: `1` — `0..n` | Các model này có `userId` hoặc `reportedBy` tham chiếu `User` bắt buộc. |
| `MENTOR` — `BOOKING`, `COURSE`, `PAYOUT_REQUEST`, `MENTOR_PEER_REVIEW`: `1` — `0..n` | Có `mentorId` hoặc `reviewerId` tham chiếu `Mentor` bắt buộc. |
| `COURSE` — `ENROLLMENT`, `COURSE_QA`, `MENTOR_PEER_REVIEW`: `1` — `0..n` | Các model này có `courseId` tham chiếu `Course` bắt buộc. |
| `CART_ORDER` — `ENROLLMENT`: `0..1` — `0..n` | `Enrollment.cartOrderId` có thể vắng mặt; một đơn hàng chứa nhiều lượt ghi danh trong `items`. |
| `CART` — `COURSE`: `0..n` — `0..n` | `Cart.courseIds` là mảng các tham chiếu khóa học. |

**Nét đứt** đánh dấu quan hệ cần đọc theo trường phân loại hoặc mảng tham chiếu:

- `PAYMENT` liên kết với **một trong** `BOOKING`, `SUBSCRIPTION`, `ENROLLMENT` qua `type`, `referenceModel`, `referenceId`. Ba đường trong hình là ba khả năng, không phải một giao dịch thanh toán cả ba loại cùng lúc.
- `REVIEW` nhắm tới **Mentor hoặc Course** qua `targetType`, `targetId`. Hai đường trong hình cũng là hai khả năng loại trừ nhau.
- `CART` chứa nhiều `COURSE` qua mảng `courseIds`.

## Những gì không vẽ thành hộp riêng

- `MODULE` và `LESSON` là dữ liệu lồng trong `Course.modules`; loại bài học `quiz` nằm trong `Course.modules.lessons`.
- Tiến độ và đường dẫn chứng chỉ là trường của `Enrollment`, không có model `PROGRESS` hoặc `CERTIFICATE` riêng.
- CV và JD là tệp/nội dung trong `CVAnalysis`, không có collection `CV` hay `JD` riêng.
- `User.role` hiện có `customer`, `mentor`, `admin`; chưa có role hoặc model **kiểm duyệt viên** riêng. Việc duyệt mentor/khóa học hiện được ghi trong `Mentor.adminReview` và `Course.adminReview`. Vì vậy sơ đồ không tạo hộp `REVIEWER` không có trong code.
- `Report.targetType` có thể nhắm `mentor`, `booking`, `review`, `course`; để một trang vẫn đọc được, sơ đồ chỉ nối người tạo báo cáo với `REPORT` và ghi rõ trường đa hình tại đây.
- Nhật ký kỹ thuật như `Activity`, `SecurityLog`, `UserEvent`, `CostEvent`, `SepayWebhookEvent` được lược khỏi mức khái niệm nghiệp vụ.

Nếu cần tái tạo file sau khi chỉnh script, chạy `python docs/generate_conceptual_drawio.py` từ thư mục gốc dự án.
