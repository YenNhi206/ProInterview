# QA-06: Kịch bản kiểm thử thủ công trên staging

> Chuẩn bị trước cho task **QA-06** (Nhi, P0) trong `docs/plan/TASKS.md`. QA-06 chưa sẵn sàng (cần QA-05 seed đủ dữ liệu, QA-05 cần JB-09). File này soạn sẵn để khi staging có dữ liệu thì chạy ngay.
> REQ của QA-06: C-07 (+A-02, CM-01, CM-02, PM-02, C-05, C-03, CM-04, PM-03, PM-04).
> Nguồn: mục "Kịch bản demo xuyên suốt" trong `TASKS.md` và cột "Đạt khi" trong `docs/plan/REQUIREMENTS.md` (các ô còn ghi "(nháp)" hoặc "CẦN CHỐT" thì kiểm phần chắc chắn).
> Soạn ngày 23/11/2026 theo `main` cùng ngày. Tính năng nào ghi "Chờ <mã>" thì chưa có trên `main`; tới lúc chạy kiểm lại cột Trạng thái trong `TASKS.md`.

## 1. Chuẩn bị

| Việc | Cách làm |
|:-----|:---------|
| Môi trường | **Staging**, không chạy trên production (cổng GĐ 6) |
| Dữ liệu | `npm run seed:demo-staging` trong `backend/` (QA-05); chạy lên DB staging thì đặt `TARGET_MONGO_URI=<chuỗi kết nối staging>` trước lệnh. Chạy lại được, không tạo bản trùng. Script có `_devOnlyGuard.js` chặn production |
| Mật khẩu tài khoản seed | `Password123!` |
| Ứng viên | `candidate.demo@prointerview.vn` |
| Company Moderator | `hr.fpt@prointerview.vn` (công ty A), `hr.vng@prointerview.vn` (công ty B), `hr.lumen@prointerview.vn` (công ty C, hư cấu; cả 3 đã đồng ý điều khoản CO-02) |
| Dữ liệu seed có sẵn | Job FPT Frontend và job VNG có câu doanh nghiệp đã duyệt (B3.8); ứng viên đã xem 2 job đó (thẻ chọn job JB-21) và có 1 buổi phỏng vấn câu doanh nghiệp FPT đã chấm rubric (B3.9, chỉ số B6.3); 5 lượt chấm lại có điểm moderator (B7.3); job FPT Backend Golang không có câu doanh nghiệp |
| Platform Moderator | `moderator@dev.local` |
| Mentor | `mentor.tu@prointerview.vn`, `mentor.minh@prointerview.vn`, `mentor.hang@prointerview.vn` |
| Admin | Tài khoản admin của staging (seed staging không tạo admin; hỏi Janet nếu chưa có) |
| Email mời | Hộp thư nhận được thật (bước mời Company Moderator gửi email có link) |
| Thanh toán | Chuyển khoản số tiền nhỏ, hoặc admin xác nhận tay ở trang đối soát nếu SePay staging chưa nối |
| Trình duyệt | Mỗi vai trò một cửa sổ ẩn danh riêng để không lẫn phiên đăng nhập |

## 2. Cách ghi lỗi

- Mỗi lỗi một GitHub issue, tiêu đề bắt đầu bằng **mã task** gây lỗi, ví dụ `CO-13: nút tải câu không mở hộp thoại`.
- Nội dung issue: bước trong file này (ví dụ `B2.3`), tài khoản, kết quả mong đợi, kết quả thực tế, ảnh chụp hoặc video, URL.
- Mức: **Chặn** (không đi tiếp được luồng), **Nặng** (sai dữ liệu, tiền, quyền), **Nhẹ** (giao diện, chữ).
- QA-06 xong khi không còn lỗi mức **Chặn**.
- Ghi kết quả vào cột "Kết quả" bên dưới: `Đạt`, `Lỗi #<số issue>`, hoặc `Bỏ qua (<lý do>)`.

## 3. Kịch bản demo 7 bước

### B1. Admin tạo công ty và mời Company Moderator (A-02)

| # | Vai trò | Thao tác | Mong đợi | Kết quả |
|:--|:--------|:---------|:---------|:--------|
| B1.1 | Admin | `/admin/companies` → tạo công ty mới | Công ty hiện trong danh sách, trạng thái hoạt động | |
| B1.2 | Admin | Mở công ty → mời Company Moderator bằng một email chưa có tài khoản | Báo đã gửi lời mời; email đến hộp thư | |
| B1.3 | Admin | Mời một email đã có tài khoản ứng viên | Bị từ chối, báo "vai trò khác" | |
| B1.4 | Người được mời | Mở link trong email | Trang `/company-invite/:token` hiện **tên công ty, email** và điều khoản dùng rubric ẩn danh (CO-02) | |
| B1.5 | Người được mời | Điền họ tên, mật khẩu nhưng **không** tick đồng ý điều khoản | Nút "Hoàn tất" bị khóa; không nhận được lời mời | |
| B1.6 | Người được mời | Tick đồng ý → Hoàn tất | Vào thẳng `/company` | |
| B1.7 | Người được mời | Mở lại link cũ | Báo lời mời đã được sử dụng | |
| B1.8 | Admin | Tạm khóa công ty → Company Moderator tải lại `/company` | Bị chặn vào; mở khóa lại thì vào được | |

### B2. Company Moderator duyệt câu, soạn rubric, đăng job; Platform Moderator duyệt (CM-01, CM-02, PM-01, PM-02, CM-03)

| # | Vai trò | Thao tác | Mong đợi | Kết quả |
|:--|:--------|:---------|:---------|:--------|
| B2.1 | Company Mod A | `/company/questions` → "Sinh bộ câu bằng AI" cho một vị trí | 8–12 câu trạng thái **Bản nháp** | |
| B2.2 | Company Mod A | Sửa một câu (có ghi lý do) → xem lịch sử | Lịch sử có lần sửa kèm nội dung trước | |
| B2.3 | Company Mod A | "Tải câu theo job": chọn job, dán 5 dòng (có 1 dòng trùng câu đã có) | Tải lên 4 câu, báo bỏ qua 1 câu trùng; câu ở trạng thái **Chờ Platform Mod** | |
| B2.4 | Company Mod A | Dán một dòng rỗng giữa danh sách / chọn năng lực sai | Dòng rỗng tự bỏ; lỗi theo dòng hiện trong hộp thoại, không lưu câu nào | |
| B2.5 | Company Mod A | Chọn nhiều câu nháp → "Duyệt đã chọn" | Các câu chuyển **Chờ Platform Mod** | |
| B2.6 | Company Mod A | Lọc theo job, theo trạng thái | Danh sách đúng bộ lọc | |
| B2.7 | Company Mod B | Mở `/company/questions` | **Không** thấy câu của công ty A | |
| B2.8 | Platform Mod | `/moderator/company-questions` tab "Chờ duyệt" | Thấy câu của công ty A kèm tên công ty và job; `/moderator/questions` **không** lẫn câu doanh nghiệp | |
| B2.9 | Platform Mod | Duyệt 1 câu; từ chối 1 câu (bắt buộc lý do) | Câu duyệt sang tab "Đã duyệt"; câu từ chối sang "Bị từ chối" | |
| B2.10 | Company Mod A | Xem lại hai câu đó | Câu được duyệt hiện **Đang dùng**; câu bị từ chối hiện lý do của Platform Mod | |
| B2.11 | Company Mod A | `/company/rubrics` → soạn rubric: tổng trọng số khác 100% → gửi duyệt | Bị chặn, báo tổng trọng số | |
| B2.12 | Company Mod A | Sửa đủ 100%, đủ mô tả 6 mức, gắn câu đã duyệt → gửi duyệt | Rubric **Chờ duyệt** | |
| B2.13 | Platform Mod | `/moderator/rubrics` → từ chối kèm ghi chú | Company Mod thấy lý do, sửa và gửi lại được | |
| B2.14 | Platform Mod | Duyệt bản gửi lại | Rubric **Đã duyệt**; bản cũ cùng vị trí (nếu có) thành lưu trữ | |
| B2.15 | Company Mod A | Đăng job có năng lực yêu cầu và rubric đã duyệt (JB-15 FE: **Chờ JB-15**, tạm dùng API) | Job hiện ở `/jobs` | |

### B3. Ứng viên xem job, thấy khoảng thiếu, luyện phỏng vấn (C-02, C-04, C-05, C-03)

| # | Vai trò | Thao tác | Mong đợi | Kết quả |
|:--|:--------|:---------|:---------|:--------|
| B3.1 | Ứng viên | `/cvs` → tải lên CV thứ hai; đặt một CV làm mặc định | Có ≥ 2 CV, đúng 1 CV mặc định | |
| B3.2 | Ứng viên | Tải lên một ảnh hoặc hóa đơn | Bị từ chối, báo không phải CV | |
| B3.3 | Ứng viên | `/cvs` → "Sửa nội dung" một CV → sửa bullet, kỹ năng → Lưu | Số "Bản" tăng; tải lại trang vẫn giữ nội dung | |
| B3.4 | Ứng viên | Áp một gợi ý AI vào bullet (cần đã phân tích CV trước) → Lưu → Tải PDF | PDF mở được, tiếng Việt đúng dấu, có nội dung vừa sửa | |
| B3.5 | Ứng viên | `/cv-analysis/best-fit`: chọn 3 CV, dán JD | Xếp hạng CV kèm khoảng thiếu (PR-05: **Chờ merge PR #254** nếu chưa merge) | |
| B3.6 | Ứng viên (gói free) | `/jobs` → lọc theo vị trí, cấp độ | Danh sách đúng bộ lọc; không thấy job nháp / đã đóng / bị ẩn | |
| B3.7 | Ứng viên | Mở một job | Thấy khoảng thiếu (**Chờ JB-05, JB-12**) | |
| B3.8 | Ứng viên | Phỏng vấn AI, chọn job đó trước khi vào phòng | Sau 3 câu baseline có tối đa 2 câu của doanh nghiệp (**Chờ JB-06, JB-21**) | |
| B3.9 | Ứng viên | Mở trang feedback | Điểm từng câu theo SHRM/DDI; câu doanh nghiệp có tên doanh nghiệp và điểm rubric, câu khác thì không (**Chờ JB-07, JB-14**) | |

### B4. Yêu cầu mentor, buổi 0đ, lộ trình, thanh toán (C-06, M-02, M-03, C-07, A-04)

| # | Vai trò | Thao tác | Mong đợi | Kết quả |
|:--|:--------|:---------|:---------|:--------|
| B4.1 | Ứng viên | Gửi yêu cầu mentor kèm CV (gắn job: **Chờ JB-12**) | Yêu cầu hiện ở `/mentor-requests` | |
| B4.2 | Mentor | Gửi đề nghị; ứng viên chọn mentor | Trạng thái yêu cầu đổi đúng, có thông báo | |
| B4.3 | Mentor | Tạo buổi đánh giá 0đ | Ứng viên thấy buổi trong lịch | |
| B4.4 | Ứng viên | Tạo thêm buổi 0đ thứ hai khi buổi đầu chưa xong | Bị chặn (LP-06: **Chờ merge PR #244** nếu chưa merge) | |
| B4.5 | Mentor | Sau buổi 0đ, ghi đánh giá đầu vào theo bộ tiêu chí | Lưu được (phần lưu điểm buổi 0đ: LP-13 đề xuất b **chưa làm**) | |
| B4.6 | Mentor | Soạn lộ trình 3 buổi (mục tiêu, năng lực, giá trọn gói) → gửi | Trình soạn hiện năng lực còn thiếu từ hồ sơ / job; ứng viên nhận đề xuất | |
| B4.7 | Ứng viên | `/learning-paths/:id` → yêu cầu sửa kèm ghi chú | Mentor nhận yêu cầu, gửi lại bản mới (version tăng) | |
| B4.8 | Ứng viên | Chấp nhận → thanh toán chuyển khoản | Hiện QR mã `PI…`; SePay khớp thì lộ trình **active** tự cập nhật | |
| B4.9 | Admin | Trang đối soát: xác nhận tay một chuyển khoản lộ trình | Lộ trình chuyển **active** | |

### B5. Không đạt, học lại, đạt (M-04, C-07)

| # | Vai trò | Thao tác | Mong đợi | Kết quả |
|:--|:--------|:---------|:---------|:--------|
| B5.1 | Ứng viên | Đặt lịch buổi 1 | Đặt được; buổi 2 chưa mở | |
| B5.2 | Mentor | Buổi 1 → đạt; buổi 2 → **không đạt** kèm feedback và điểm năng lực | Hệ thống tạo buổi học lại 0đ | |
| B5.3 | Ứng viên | Đặt buổi học lại | Không phải trả thêm tiền | |
| B5.4 | Mentor | Buổi học lại → đạt | Ứng viên đặt được buổi 3 | |
| B5.5 | Mentor | Buổi 3 → đạt | Lộ trình **completed**; timeline ứng viên cập nhật | |
| B5.6 | Ứng viên | `/profile` → thẻ năng lực | Có năng lực từ buổi mentor, bấm ra xem nguồn (PR-06: **Chờ PR-06**) | |
| B5.7 | Mentor | Trang thu nhập | Mỗi buổi gốc nhận phần chia trừ phí; buổi 0đ và học lại nhận 0 | |

### B6. Ứng tuyển và Company Moderator xử lý đơn (C-05, CM-04, NFR-06)

| # | Vai trò | Thao tác | Mong đợi | Kết quả |
|:--|:--------|:---------|:---------|:--------|
| B6.1 | Ứng viên | Ứng tuyển **không** tick ô đồng ý | Bị từ chối (**Chờ JB-08, JB-12**) | |
| B6.2 | Ứng viên | Ứng tuyển kèm CV + đồng ý | Đơn hiện ở `/my-applications` (**Chờ JB-13**) | |
| B6.3 | Company Mod A | `/company/applications` → mở đơn | Xem CV, thẻ năng lực, chỉ số với doanh nghiệp, câu trả lời kèm điểm rubric (**Chờ JB-09, JB-16, JB-19**) | |
| B6.4 | Company Mod A | Shortlist | Ứng viên nhận thông báo | |
| B6.5 | Company Mod B | Tìm cách xem đơn / hồ sơ ứng viên của công ty A | Không xem được | |
| B6.6 | Ứng viên | Rút đơn | Công ty A chỉ còn thấy tên và "Đã rút" | |

### B7. Báo sai điểm, chấm lại, cải tiến AI (C-10, PM-03, PM-04)

| # | Vai trò | Thao tác | Mong đợi | Kết quả |
|:--|:--------|:---------|:---------|:--------|
| B7.1 | Ứng viên | Trang feedback → "Báo sai" một câu | Câu hiện "Đang chờ kiểm định" | |
| B7.2 | Platform Mod | `/moderator/queue` → nhận item → chấm lại | Ứng viên thấy điểm moderator thay điểm AI | |
| B7.3 | Platform Mod | `/moderator/ai-improvements` (seed có ≥ 5 lượt chấm lại) | Có đề xuất kèm bằng chứng và bảng trước/sau (**Chờ AI-04, AI-05, AI-06**) | |
| B7.4 | Platform Mod | Duyệt đề xuất → tạo buổi phỏng vấn mới → rollback | Buổi mới chạy prompt mới; rollback trở về bản trước | |

## 4. Kiểm theo vai trò (ngoài luồng demo)

Kiểm sau khi qua 7 bước, mỗi vai trò một lượt, tập trung vào quyền và trường hợp sai.

| # | Vai trò | Kiểm | Mong đợi | Kết quả |
|:--|:--------|:-----|:---------|:--------|
| R1 | Mọi vai trò | Tên vai trò hiển thị | Candidate, Mentor, Admin, Platform Moderator, Company Moderator; không còn chữ "customer" hay "enterprise" (N-13) | |
| R2 | Ứng viên | Gõ thẳng `/company`, `/moderator/queue`, `/admin` | Bị đẩy ra | |
| R3 | Company Mod | Gõ thẳng `/moderator/company-questions`, `/admin` | Bị đẩy ra | |
| R4 | Company Mod | Bấm duyệt lại câu đã "Đang dùng" | Không có nút duyệt; sửa chữ câu đang dùng thì báo phải duyệt lại | |
| R5 | Platform Mod | Từ chối câu doanh nghiệp không ghi lý do | Không cho gửi | |
| R6 | Platform Mod | `/moderator/courses` → duyệt một khóa có nhãn sàng lọc AI (PM-05) | Hiện cờ sàng lọc; duyệt được | |
| R7 | Platform Mod | Ẩn một job bị báo cáo (JB-04, JB-17: **Chờ JB-17** cho màn hình) | Job biến khỏi `/jobs` | |
| R8 | Admin | `/admin/audit-log` lọc theo vai trò | Thấy thao tác của Platform Mod và Company Mod ở bước B2 | |
| R9 | Admin | `/admin/analytics` | Có doanh thu theo nguồn (booking, khóa, gói, lộ trình); không có số liệu giả | |
| R10 | Mentor | Hủy một buổi lộ trình | Không phát sinh hoàn tiền hay credit cho buổi đó | |
| R11 | Mọi vai trò | Màn hình mới trên bề ngang điện thoại | Ghi lại lỗi cho QA-07 (không chặn QA-06) | |

## 5. Tổng kết lượt chạy

| Ngày chạy | Người chạy | Commit / bản deploy staging | Số bước Đạt | Lỗi Chặn | Lỗi Nặng | Lỗi Nhẹ | Ghi chú |
|:----------|:-----------|:----------------------------|:------------|:---------|:---------|:--------|:--------|
| | | | | | | | |
