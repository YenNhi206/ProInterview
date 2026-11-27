# Lịch sử thanh toán, giữ tiền và quản trị tài khoản

Nguồn tham khảo: [BookingMentorPlatform, commit 9a5a8ed](https://github.com/Vynmt198/BookingMentorPlatform/tree/9a5a8ed/ProInterview). Port invoice, earnings clearance, admin audit và account closure vào cấu trúc hiện tại, tương thích gói Pro/Elite và đơn giỏ hàng.

## Sử dụng

- **Menu tài khoản → Lịch sử thanh toán** (`/payment-history`): lọc loại/trạng thái, phân trang, tải PDF từng giao dịch hoặc toàn đơn giỏ hàng.
- **Mentor → Tài chính**: số dư đang giữ 7 ngày tách khỏi số dư khả dụng và tiền chờ rút.
- **Admin → Giải ngân & đối soát** (`/admin/finance/operations`): giải phóng khoản đủ hạn, xem chênh lệch số dư và tiền nhận khi người trả bị khóa. Ghi nhận hoàn sau khi chuyển khoản thật, nhập mã giao dịch và lý do.
- **Admin → Người dùng → Chi tiết**: xem tác động trước khi đóng; tạo yêu cầu giải ngân từ số dư khả dụng về tài khoản ngân hàng đã lưu của mentor. Tiếp tục duyệt/xác nhận đã chi tại **Rút tiền cố vấn**; mã chuyển khoản bắt buộc. Admin có thể xử lý số dư cuối nhỏ hơn ngưỡng tự rút 100.000đ.
- **Admin → Nhật ký admin** (`/admin/audit-log`): lọc kết quả/phương thức, xem người thao tác, nội dung đã che bí mật và mã HTTP.
- **Cài đặt → Đóng tài khoản**: cùng cổng kiểm tra ràng buộc với admin; giữ chứng từ tài chính và vô hiệu phiên đăng nhập.

## Giữ tiền và đối soát

Giữ 72 giờ từ `Booking.completedAt` hoặc `Enrollment.paidAt`; thiếu mốc thì tính từ lúc ghi có. Thu nhập mới vào `finance.clearingBalance`, chỉ sang `availableBalance` khi đủ hạn và không có report pending/reviewing nhắm vào mentor hoặc buổi/khóa tương ứng. Mentor bị tạm ngưng vẫn được giải phóng tiền và được admin giải ngân.

Job chạy khi backend kết nối DB và mỗi giờ; thực tế có thể trễ tối đa khoảng một chu kỳ quét. Admin có thể quét ngay nhưng không bỏ qua điều kiện 3 ngày hoặc khiếu nại.

Snapshot `earningsNetAmount` giữ nguyên số tiền đã ghi có. Đối soát so sánh tổng khoản chưa giải phóng với số dư đang giữ và tổng yêu cầu rút mở với số dư chờ rút. Báo cáo chỉ đọc, không tự sửa số dư. Khắc phục nguyên nhân rồi chạy lại khoản giải phóng lỗi; chênh lệch cần đối chiếu chứng từ trước khi điều chỉnh dữ liệu.

## Dữ liệu cũ và triển khai

- Không thu hồi hoặc chuyển lại số dư khả dụng đã ghi có trước khi triển khai. Chính sách giữ 7 ngày áp dụng cho khoản mới ghi có; dòng cũ không có `earningsClearAt` không được cộng lại.
- Trường mới: Booking/Enrollment `earningsClearAt`, `earningsClearedAt`, `earningsClearFailedAt`, `earningsNetAmount`; Mentor `finance.clearingBalance`, `status`, `closedAt/closedBy`; User `accountClosedAt`; Payment trạng thái `held_inactive_account` và snapshot hóa đơn; PayoutRequest người tạo thay/lý do; SecurityLog loại `admin_action`.
- Các thao tác tiền dùng transaction khi MongoDB hỗ trợ replica set/Atlas. Standalone dùng cập nhật có điều kiện và hoàn tác lỗi đã biết; không bảo đảm nguyên tử nhiều document nếu tiến trình chết giữa chừng. Vận hành tiền thật nên dùng replica set/Atlas và kiểm tra báo cáo đối soát.
- Thêm `pdfkit`; chạy `npm ci` ở backend khi triển khai và khởi động lại backend. Font DejaVu và giấy phép trong `backend/src/assets/fonts`.
- Tùy chọn env: `INVOICE_SELLER_NAME` (mặc định ProInterview), `INVOICE_SELLER_ADDRESS`, `INVOICE_SELLER_EMAIL`. PDF là chứng từ thanh toán trong ứng dụng; chưa tích hợp nhà cung cấp hóa đơn thuế.
- Hóa đơn chốt thông tin lần đầu xuất, lưu snapshot. Đơn giỏ giữ danh sách và giá từ checkout. PDF toàn đơn và từng khóa là các cách xem cùng giao dịch, không tạo thêm doanh thu.

## Đóng tài khoản và tiền còn tồn

Chặn đóng khi còn số dư, khoản chờ rút, thu nhập chưa giải phóng, đơn chờ thanh toán, buổi đã trả tiền chưa kết thúc (kể cả quá giờ), gói còn hạn, giao dịch giữ/hoàn tiền hoặc khiếu nại của mentor. Xem trước không ghi dữ liệu; thao tác đóng kiểm tra lại trên server. Không mở lại tài khoản đã đóng qua route khóa/mở khóa.

Tiền SePay khớp đơn đang chờ nhưng người trả bị khóa được giữ trong ledger, không mở quyền học. Admin ghi nhận hoàn với số tiền khớp chính xác; thao tác lặp không hoàn thêm. Đây là ghi nhận đối soát, không tự chuyển tiền tại ngân hàng. Giao dịch không khớp/hết hạn vẫn dùng nhật ký webhook hiện có.

## Kiểm thử

Backend: `npm run test:finance` dùng MongoDB replica set tạm; `npm run test:cart` kiểm tra tương thích đơn nhiều khóa; `npm run test:node` chạy hồi quy. Frontend: `npm test`, `npm run build`.

PDF sử dụng [nhúng font và dàn chữ của PDFKit](https://pdfkit.org/docs/text.html).
