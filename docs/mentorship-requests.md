# Kết nối Mentor qua nhu cầu của mentee

Luồng đặt lịch trực tiếp tại `/mentors` vẫn hoạt động. Luồng mới:

1. Customer đăng nhu cầu tại `/mentor-requests/new`, kèm CV và JD (PDF/DOC/DOCX/TXT, tối đa 5MB/file). Mỗi tài liệu có thể tải mới hoặc chọn từ lịch sử phân tích, lịch hẹn và yêu cầu Mentor trước đây.
2. Mentor đã được duyệt xem `/mentor/requests` và gửi một đề nghị cho mỗi yêu cầu.
3. Customer xem `/mentor-requests`, xác nhận chọn một đề nghị. Thao tác này đóng nhận đề nghị mới, chia sẻ tài liệu với đúng Mentor được chọn, chưa tạo lịch hoặc thanh toán.
4. Customer tiếp tục sang `/booking/:mentorId?mentorshipRequestId=...`, chọn một buổi 60 phút và checkout hiện có. Nội dung, loại buổi và tài liệu lấy từ snapshot của yêu cầu trên server.
5. Hai bên xem lại nhu cầu/tài liệu qua link ở trang chi tiết lịch hẹn.

## Phạm vi bản đầu

- Phí đề nghị là **phí tham khảo** từ session type hoặc giá hồ sơ Mentor tại thời điểm gửi. Không có thương lượng giá riêng: phí cuối cùng và ưu đãi được tính lại bởi booking service tại checkout.
- Thời gian đề nghị là mô tả mong muốn. Booking chỉ tạo khi customer chọn khung giờ thực tế, qua kiểm tra lịch trống hiện có.
- Request và offer được lưu MongoDB, không dùng dữ liệu mẫu hoặc localStorage.
- CV/JD lưu dưới dạng Buffer trong collection `mentorship_requests`, không tạo URL upload công khai. Truy vấn mặc định không lấy nội dung file. Chỉ owner và Mentor được chọn tải bằng endpoint có JWT, `Cache-Control: private, no-store`, attachment disposition.
- Board chỉ hiển thị nhu cầu. Customer khác không xem được; Mentor không thấy đề nghị của Mentor khác. Nội dung mô tả do mentee chủ động chia sẻ với Mentor đã được duyệt.
- Chọn/rút/đóng đề nghị dùng cập nhật MongoDB có điều kiện để chặn race. Unique partial index trên `bookings.mentorshipRequestId` chặn nhiều buổi còn hiệu lực cho cùng yêu cầu.
- Một người có tối đa 10 yêu cầu đang mở; một yêu cầu tối đa 50 đề nghị. Danh sách lấy tối đa 100 bản mới nhất. Một Mentor có một đề nghị/yêu cầu; đề nghị đã rút không gửi lại được trong bản đầu.
- Sau khi chọn Mentor, chưa có thao tác đổi lựa chọn. Lịch hẹn đã tạo dùng quy trình đổi/hủy và hoàn tiền hiện có.
- Không tự gửi email hoặc thông báo tới toàn bộ Mentor khi đăng nhu cầu. Mentor chủ động mở bảng nhu cầu; mentee theo dõi đề nghị trong Yêu cầu của tôi.

## API

Tất cả endpoint dưới `/api/mentorship-requests` yêu cầu JWT; role customer hoặc Mentor đang active và verified.

- `GET /?scope=open|mine`: customer chỉ thấy yêu cầu của mình; Mentor thấy board mở hoặc các yêu cầu mình đã đề nghị.
- `GET /documents`: danh sách CV/JD thuộc tài khoản customer, chỉ trả metadata và ID nguồn, không trả URL hoặc nội dung file.
- `POST /`: multipart gồm title, position, description, sessionType, availability, budget; mỗi loại tài liệu gửi file `cv`/`jd` hoặc mã tham chiếu `cvSource`/`jdSource` (`request:id`, `analysis:id`, `booking:id`), không gửi cả hai nguồn cho cùng một loại. Server kiểm tra sở hữu, đọc file giới hạn 5MB và lưu bản sao riêng tư. File local phải nằm trực tiếp trong thư mục uploads; file Cloudinary chỉ đọc từ tài khoản và thư mục CV/JD được cấu hình. Không truy cập URL tùy ý hoặc theo redirect; tệp mất trả lỗi 410 để người dùng tải lại.
- `GET /:id`: chi tiết đã lọc theo quyền.
- `POST /:id/offers`: message, availability; phí lấy từ server.
- `POST /:id/offers/:offerId/select`: chỉ owner, chỉ yêu cầu mở và offer pending.
- `POST /:id/offers/:offerId/withdraw`: chỉ Mentor sở hữu offer, chỉ khi yêu cầu còn mở.
- `POST /:id/close`: chỉ owner, chỉ yêu cầu mở.
- `GET /:id/files/cv|jd`: tải file riêng tư.

## Chạy và kiểm tra

Chạy backend/frontend theo hướng dẫn dự án; tính năng cần MongoDB và hai tài khoản với role customer/mentor. Mentor cần isActive và isVerified. Khởi động lại backend để mount router mới và tạo index theo cấu hình Mongoose của dự án. Production cần triển khai index `bookings.mentorshipRequestId` theo quy trình quản lý index hiện có trước khi mở tính năng.

- `npm --prefix backend run test:mentorship`
- `npm --prefix frontend test`
- `npm --prefix frontend run build`

Test mới sử dụng MongoDB tạm, kiểm tra upload/size limit, quyền xem/tải, xác minh Mentor, chống gửi trùng, chọn đồng thời, rút/đóng, và tạo booking có liên kết yêu cầu. Không sử dụng database thật.
