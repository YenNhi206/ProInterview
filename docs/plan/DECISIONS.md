# ProInterview: Quyết định đã chốt

> Agent đọc file này trước mỗi task. Không hỏi lại những gì đã ghi ở đây.
> Quyết định mới phát sinh khi làm task: ghi vào mục "Nhật ký quyết định mới" ở cuối file, kèm mã task.
> Khi tài liệu và code mâu thuẫn: tin code, rồi ghi đề xuất sửa vào `TASKS.md` mục "Đề xuất thay đổi kế hoạch".

## 14 quyết định đã chốt (18/11/2026)

| # | Câu hỏi | Đã chốt | Lý do |
| --- | --- | --- | --- |
| 1 | Trả tiền lộ trình trọn gói hay từng buổi? | Trọn gói, một `paymentRef` cho cả lộ trình | Đơn ghi "pay for the mentor's learning path"; một QR giống giỏ hàng |
| 2 | Buổi học lại có tính phí? | Miễn phí 1 lần mỗi buổi, tính sẵn trong giá; lần 2 trở đi mentor đề xuất buổi bổ sung có phí | Giữ lời hứa "retaught before moving on" mà không để mentor dạy không giới hạn |
| 3 | Thu nhập mentor ghi khi nào? | Mỗi buổi `done` vào `clearingBalance` | Dùng lại `earningsClearanceJob`; hoàn tiền phần chưa học dễ tính |
| 4 | Phí nền tảng cho lộ trình? | Dùng `Mentor.pricing.platformFeeRate` như booking | Không thêm cấu hình mới |
| 5 | Lộ trình có bắt buộc gắn job post? | Không bắt buộc; có job thì lấy `requiredCompetencies` làm khung | Giảm phụ thuộc vào Job Post, làm Learning Path trước được |
| 6 | Tên role trong code? | `enterprise` → `company_moderator`; giữ `customer`, `moderator` trong DB, đổi nhãn UI thành Candidate, Platform Moderator | Role enterprise chỉ có tài khoản seed (`enterprise@dev.local`), đổi kèm script migrate N-03; hai role kia có dữ liệu thật nên giữ |
| 7 | Mỗi công ty mấy Company Mod? | 1 người cho MVP, model cho phép nhiều | Khớp phạm vi đã chốt 09/11 |
| 8 | Job post có cần duyệt trước khi đăng? | Không; Platform Mod hậu kiểm (ẩn khi bị báo cáo) | Đơn chỉ ghi "hide reported job posts" |
| 9 | Rubric công ty áp dụng lúc nào? | **Đã thay 23/11/2026 (dòng JB-07 ở bảng dưới).** Bản cũ: chỉ khi luyện theo job của công ty đó; luyện tự do vẫn chấm SHRM/DDI | Tránh trộn tiêu chí giữa các công ty |
| 10 | Có đặt deadline theo tuần? | Không; làm theo thứ tự task và cổng giai đoạn, cổng gắn mốc Review | Nhóm chọn lập kế hoạch theo task |
| 11 | Câu hỏi của công ty lấy từ đâu? | **Đã sửa 23/11/2026 (dòng CO-16 ở bảng dưới): thêm tải câu lên theo job, câu doanh nghiệp duyệt xong phải qua Platform Moderator.** Bản cũ: endpoint sinh bộ 8–12 câu nháp theo `roleCategory` (SHRM/DDI), `orgId = companyId`, `source: org_template`, `status: draft`; Company Mod duyệt, sửa hoặc tự thêm câu | Hiện câu hỏi chỉ sinh giữa buổi cho từng ứng viên (`llm_followup`, `orgId: null`) |
| 12 | Luyện theo job dùng câu nào, quota thế nào, user free có được luyện? | **Đã thay 23/11/2026 (dòng JB-06 ở bảng dưới): không còn "Luyện theo job" riêng.** Bản cũ: mọi gói đều luyện được. Free: 3 câu baseline + 2 câu công ty đã duyệt = 5 câu. Pro: thêm 2 câu follow-up LLM = 7 câu. Trừ 1 lượt phỏng vấn như buổi thường | User free vẫn có câu công ty nên chấm rubric có ý nghĩa; câu công ty cố định nên cache video được, chi phí thấp |
| 13 | Giới hạn buổi đánh giá 0đ? | Mỗi ứng viên tối đa 1 buổi 0đ chưa xong cùng lúc và 2 buổi trong 30 ngày; ứng viên vắng thì tính là đã dùng; mentor vắng thì không tính và được đặt lại | Chặn lạm dụng mà vẫn cho thử 2 mentor |
| 14 | Rút đơn thì công ty còn xem snapshot? Email được mời đã có tài khoản khác? | Rút đơn: công ty chỉ còn thấy tên và "Đã rút", snapshot bị ẩn. Email đã có tài khoản role khác: từ chối lời mời, admin mời bằng email công ty khác | Đúng NFR "chỉ chia sẻ khi đồng ý"; `User.role` chỉ có một giá trị nên không trộn quyền ứng viên với quyền xem ứng viên |

## Nguyên tắc thiết kế (áp dụng cho mọi task)

- **Tái dùng, không dựng song song**: Booking cho mọi buổi gặp; đường ray chuyển khoản (SePay + xác nhận tay) cho mọi khoản thu; ModerationItem cho các mục HITL của phỏng vấn. Không thêm cổng thanh toán mới.
- **Mở rộng router có sẵn**, không tạo prefix mới cho cùng domain (ví dụ dùng `/api/mentorship-requests`, không tạo `/api/mentor-requests`).
- **Dùng lại field đã có** trước khi thêm field mới (ví dụ `QuestionBank.status`, `roleCategory`, `promptVersion`).
- **Rubric công ty** dùng status riêng (`pending_review`), không đi qua ModerationItem.
- **Demo** chạy trên staging; production chỉ smoke test.
- **Tên vai trò**: code `customer` / `mentor` / `admin` / `moderator` / `company_moderator`; báo cáo gọi Candidate / Mentor / Admin / Platform Moderator / Company Moderator.

## Nhật ký quyết định mới

> Thêm dòng mới ở cuối. Một dòng một quyết định. Chỉ ghi điều có giá trị lâu dài, không ghi chi tiết tạm thời.

| Ngày | Task | Quyết định | Ai chốt |
| --- | --- | --- | --- |
| 22/11/2026 | DOC-01 | Bản chuẩn của kế hoạch là docs/plan/; docs/capstone/TASKS.md là bản cũ, giữ để tham khảo | Janet |
| 22/11/2026 | DOC-01 | Ngoài mã REQ, có nhãn NEN (*) cho việc dùng chung cả dự án (hạ tầng, quy trình, hồ sơ bắt buộc của môn) | Janet |
| 22/11/2026 | DOC-01 | Mọi task gắn ít nhất một mã REQ; task phát sinh chỉ vào bảng chính qua "Đề xuất thay đổi kế hoạch" do Janet duyệt (trừ `bat-buoc` là sửa nhỏ: người phụ trách tự duyệt, ghi trong PR); việc ngoài đơn V2 chuyển "Hướng phát triển" | Janet |
| 22/11/2026 | AI-14..AI-17, QA-08 | Video avatar chuyển từ D-ID sang ElevenLabs (`POST /v1/flows/video`). Đổi qua `AVATAR_PROVIDER` sau khi AI-14 chứng minh p95 ≤ 130 giây; gỡ D-ID (AI-17) chỉ sau khi QA-08 đo lại đạt. Giữ mirror Cloudinary, cache 180 ngày, fallback giọng trình duyệt cộng ảnh tĩnh. Chấp nhận rủi ro TTS và video cùng một nhà cung cấp | Nhóm |
| 22/11/2026 | DOC-01 | Chia nhóm: phần AI (mọi task AI-*, kể cả màn hình AI-06, AI-07, AI-09, AI-11 và đo avatar QA-08) do Janet làm trọn; Văn làm cặp với Nhi (nhận N-13, JB-11, JB-16, PR-13, QA-07 từ Nhi); Trầm làm riêng (nhận JB-17). Task của Janet và Trầm không giao cho Văn. Review chéo: Văn với Nhi, Trầm với Janet | Janet |
| 23/11/2026 | JB-06 | Thay quyết định 9 và 12: không có chức năng "Luyện theo job" riêng. Câu doanh nghiệp đã duyệt được chèn vào phỏng vấn AI chung: ngẫu nhiên theo `roleCategory`, hoặc theo job ứng viên chọn từ gợi ý "job quan tâm gần đây" trước khi vào phòng. Tối đa 2 câu doanh nghiệp mỗi buổi, cùng một doanh nghiệp, áp dụng mọi gói, trừ 1 lượt như buổi thường | Janet |
| 23/11/2026 | JB-07 | Câu doanh nghiệp chấm SHRM/DDI và thêm rubric của doanh nghiệp đó; câu khác chỉ chấm SHRM/DDI. Chỉ chèn câu nằm trong "câu áp dụng" của rubric đã duyệt và thuộc job đang mở | Janet |
| 23/11/2026 | JB-19 | Hệ thống lưu chỉ số theo từng cặp ứng viên và doanh nghiệp. Doanh nghiệp chỉ xem khi ứng viên ứng tuyển kèm đồng ý (giữ NFR-06, quyết định 14). Trang kết quả buổi ghi rõ câu nào của doanh nghiệp nào | Janet |
| 23/11/2026 | CO-16 | Sửa quyết định 11: doanh nghiệp vừa dùng bộ câu AI sinh nháp, vừa tự tải câu lên theo job. Câu doanh nghiệp đã duyệt phải qua Platform Moderator duyệt mới được dùng (`pending_platform_review`) | Janet |
| 23/11/2026 | AI-18 | Rubric công ty đã duyệt được dùng ẩn danh để thêm ví dụ neo vào prompt chấm SHRM/DDI chung, khi ≥ 3 công ty cùng có tiêu chí cho một năng lực; chỉ áp dụng sau backtest AI-01 không tăng độ lệch và Platform Moderator duyệt. Bảng 6 mức LP-01 giữ nguyên. Công ty đồng ý điều khoản này khi nhận lời mời | Janet |
| 23/11/2026 | DOC-01 | Phạm vi chính thức chuyển sang `REGISTRATION_V3.md` (đơn V3). V3 chỉ sửa nội dung 9 dòng theo các quyết định JB-06, JB-07, JB-19, CO-16, AI-18; 39 chức năng giữ nguyên số lượng và thứ tự nên mã REQ không đổi. `REGISTRATION_V2.md` giữ làm bản cũ | Janet |
| 24/11/2026 | JB-06, JB-07, JB-19, JB-08, JB-09, JB-20 | Nhóm giao lại các task đang chặn tiến độ GĐ 4 cho Văn (trước là Janet và Trầm), bỏ quy ước "task của Janet và Trầm không giao cho Văn" cho các task này. Văn nhận lần lượt, tối đa 2 task `Doing` cùng lúc: JB-06, JB-20 trước | Nhóm |
