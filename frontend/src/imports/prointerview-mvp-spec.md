HẦN 1 – PRODUCT CONTEXT (AI cần hiểu bạn đang build cái gì)

Tên sản phẩm là ProInterview

Đây là:
MVP Web app
Mục tiêu chính của sản phẩm là App hỗ trợ user là ứng viên chuẩn bị cho interview một cách tự tin nhất và là nền tảng để HR kiếm thêm thu nhập bằng việc làm mentor hướng dẫn cho buổi phỏng vấn online

User chính là sinh viên năm 3-4, người đi làm

Vấn đề lớn nhất của user là Không có sự chuẩn bị cụ thể cho buổi phỏng vấn, thiếu các kĩ năng hoặc bộ câu hỏi khi đi phỏng vấn trực tiếp, nguồn trên mạng quá lan man thiếu tính cụ thể cho từng JD, CV, Company

🎯 PHẦN 2 – FEATURE & STRUCTURE

Màn hình này thuộc giai đoạn MVP

Trang chủ
Dashboard
Profile
Booking
Analytics Tracking

Các section bắt buộc phải có là :
1/ AI-Based Mock Interview Simulation
2/ Job Description (JD) - Based Personalization
3/ Mentor 1–1 Mock Interview Booking
4/ Skill Development History & Structured Feedback System (Switching Cost Strategy)

Có search bar cho phần mentor, tìm kiếm theo ngành
Có filter cho mentor theo ngành, giá,....
Có AI chat box kết hợp với virtual interview zoom
Có notification cho phần nhắc hẹn với mentor cho buổi phỏng vấn khi booking mentor
Có sidebar navigation ẩn hiện tạo tính tiện lợi khi sử dụng 
Có top navbar
Có progress tracking

🧭 PHẦN 3 – USER FLOW
Flow 1: Phân Tích CV/JD và Gợi Ý Câu Hỏi Phỏng vấn
Bước 1: Click hoặc hover vào nút CV trên thanh navbar sẽ xổ xuống( drop-down) 2 mục nhỏ
Phân tích với JD
Upload CV (file PDF/Word) - 
Upload JD (file PDF / Doc hoặc text)
Click button “Phân Tích”
UI có 2 div box drag and drop upload CV và JD (từng div sẽ có mẫu riêng của CV và JD để user có thể phân biệt)
Không có JD -> thì click vào chỗ “Không có JD” và dropdown từng ngành nghề nhỏ ( vd: IT, marketing, graphic design)
Upload CV (file PDF/Word)
Click button “Phân Tích”
UI chỉ có 1 div box Drag & Drop upload CV zone rõ ràng
Bước 2: AI phân tích độ matching CV và JD hoặc theo ngành nghề mình chọn ( cùng kiểu giao diện same FE, different BE logic)
Hệ thống AI xử lý trong 30-60 giây (search)
Hiển thị màn hình loading với progress bar (hiện chữ “đang phân tích”)
Bước 3: Nhận kết quả phân tích
User nhận được:
Highlight những phần matching giữa JD và CV: hiện 2 cái kế bên nhau trên màn hình
Để nút xem chi tiết ở góc phải trên cùng -> sau khi ấn hiện lên pop up, display thông tin chi tiết đánh giá:
Đánh giá mức độ phù hợp CV-JD (điểm số % + biểu đồ trực quan)
Hiển thị bảng điểm:
Tiêu chí	                Điểm
Clarity (Rõ ràng)	        7/10
Structure (STAR)	        6/10
Relevance (Liên quan JD)	8/10
Credibility (Thuyết phục)	5/10
Điểm mạnh & điểm yếu của CV so với yêu cầu JD
Gợi ý tối ưu CV cụ thể (thêm/bỏ/sửa keyword, kỹ năng, kinh nghiệm)
Bước 4: Lưu và chuẩn bị
User có thể lưu kết quả phân tích
Chọn tiếp tục với Flow 2 (Phỏng vấn AI) hoặc Flow 3 (Book mentor)

Flow 2: Phỏng vấn Thử với AI (AI Mock Interview)
Bước 1: Thiết lập buổi phỏng vấn
User chọn "Phỏng vấn với AI" trên thanh navbar, dropdown: 
Chọn một trong hai cách:
Option A: Sử dụng JD/CV đã upload từ Flow 1
Option B: Upload mới hoặc nhập thông tin, hiện ra trang nhập thông tin sau khi click, hiển thị 2 div, 1 div là drag-drop/upload cv HOẶC 1 div là form điền thông tin có các thông tin sau:
Tên công ty
Vị trí ứng tuyển
Lĩnh vực/ngành nghề
Level (Intern/Fresher/Junior/Mid/Senior)
Bấm nút “Phỏng Vấn"
Bước 2: Chọn chế độ phỏng vấn
User lựa chọn:
OPTION A: Trả lời bằng giọng nói (voice mode - khuyến nghị)
OPTION B: Trả lời bằng text (typing mode)
Bước 3: OPTION A: Vào phòng phỏng vấn ảo (Virtual Interview Room)

Giao diện giống môi trường phỏng vấn thật:
Visual feedback showing that user is talking ( Pulsing or Glowing Ring )
AI bắt đầu giới thiệu và hỏi câu hỏi ( 5 câu cho free plan)
User trả lời từng câu một, sau khi trả lời từng câu, AI sẽ nói “ tốt tốt, ok em”
OPTION B: Vào box chat phỏng vấn ảo thông qua text
Giống giao diện chat box thông thường nhưng chat được training  trả lời cho những câu hỏi liên quan tới interview, những từ khóa không liên quan sẽ đc phản hồi là “ ko liên quan”
Bước 4: Hoàn thành phỏng vấn
Sau mỗi câu trả lời, AI có thể hỏi thêm câu follow-up
Bước 5: Nhận feedback chi tiết
Hệ thống AI đánh giá và hiển thị:
A. Điểm tổng quan (dựa trên mô hình STAR)
Clarity (Độ rõ ràng): X/5 sao
Structure (Cấu trúc STAR): X/5 sao
Relevance (Liên quan JD): X/5 sao
Credibility (Độ thuyết phục): X/5 sao
Tổng điểm: X/5 sao
B. Phân tích từng câu trả lời
Điểm mạnh của câu trả lời
Điểm cần cải thiện
Gợi ý câu trả lời tốt hơn (mẫu)
C. Đề xuất hành động tiếp theo
Kỹ năng cần luyện thêm
Câu hỏi nên ôn lại
Link tài liệu tham khảo
Bước 6: Lưu vào lịch sử
Kết quả tự động lưu vào Dashboard
User có thể xem lại và so sánh với các lần trước
Theo dõi đường cong tiến bộ

Flow 3: Đặt Lịch Phỏng Vấn 1-1 với HR Thật (Mentor Mock Interview)
Bước 1: Tìm mentor phù hợp
User chọn "Đặt lịch với Mentor" trên navbar -> chuyển qua trang danh sách mentor chung chung 
Search bar hiện bên trên đầu trang hiển thị
Trên trang hiển thị sidebar navigation để filter bên tay trái, các thẻ mentor bên tay phải
Lọc mentor theo:
Lĩnh vực chuyên môn (IT, Marketing, Finance, HR, etc.)
Kinh nghiệm (số năm, công ty đã làm)
Đánh giá (rating từ user khác)
Thời gian khả dụng (xem lịch trống)

Bước 2: Chọn mentor và xem profile
Người dùng ấn vào từng thẻ mentor để xem thông tin chi tiết:
Kinh nghiệm làm việc
Chuyên môn
Video giới thiệu (nếu có)
Reviews từ user trước
Xem lịch trống của mentor
Bước 3: Đặt lịch
Chọn ngày giờ phù hợp
Nhập thông tin:
Vị trí đang ứng tuyển
Upload JD (optional nhưng khuyến khích)
Upload CV
Ghi chú thêm (nếu có yêu cầu đặc biệt)
Xác nhận đặt lịch
Bước 4: Nhận xác nhận
Thông báo qua email/in-app
Nhắc nhở trước buổi phỏng vấn 1 ngày và 1 giờ
Link tham gia (Zoom/Google Meet/Platform riêng)
Bước 5: Tham gia buổi phỏng vấn 1-1
User tham gia đúng giờ
HR/Mentor tiến hành phỏng vấn thật (30-60 phút)
Môi trường chuyên nghiệp như phỏng vấn thực tế
Bước 6: Nhận feedback từ HR
Sau buổi phỏng vấn (trong vòng 24h), HR gửi feedback bao gồm:
Đánh giá tổng quan: Điểm mạnh & điểm yếu
Chi tiết từng phần:
Giới thiệu bản thân
Câu trả lời behavioral
Câu trả lời technical
Ngôn ngữ cơ thể & giao tiếp
Điểm số STAR model (tương tự Flow 2)
Lời khuyên cụ thể để cải thiện
Đề xuất bước tiếp theo
Bước 7: Đánh giá HR/Mentor
User đánh giá mentor (1-5 sao)
Viết review (optional)
Feedback giúp cải thiện chất lượng hệ thống mentor
Bước 8: Lưu vào lịch sử
Feedback từ HR được lưu vào Dashboard
User có thể xem lại và so sánh giữa các lần phỏng vấn
Theo dõi roadmap cá nhân hóa

Flow 4 - Dashboard: Theo Dõi Tiến Bộ Cá Nhân
User có thể truy cập Dashboard bất kỳ lúc nào để xem:
1. Thống kê tổng quan
Số lần phỏng vấn đã thực hành (AI + Mentor)
Điểm trung bình STAR qua các lần
Biểu đồ tiến bộ theo thời gian
Tỷ lệ cải thiện (%)
2. Lịch sử chi tiết
Phỏng vấn với AI: Xem lại feedback, câu hỏi, điểm số
Phỏng vấn với Mentor: Xem feedback từ HR, notes
Phân tích CV/JD: Xem lại các phiên phân tích trước
3. Kỹ năng cần phát triển
Roadmap cá nhân hóa:
Kỹ năng đã thành thạo
Kỹ năng đang phát triển 
Kỹ năng cần luyện thêm 
