# Cấu trúc thư mục `pages/`

Mỗi nhóm màn hình nằm trong một folder; import trong `routes.js` dùng đường dẫn đầy đủ (vd. `./pages/auth/Login`).

| Thư mục | Màn / luồng |
|:--------|:------------|
| `auth/` | Đăng nhập, đăng ký |
| `home/` | Trang chủ, pricing |
| `account/` | Dashboard, profile, cài đặt |
| `booking/` | Đặt lịch, checkout, chi tiết session, đánh giá mentor |
| `mentors/` | Danh sách mentor, hồ sơ mentor (khách) |
| `courses/` | Khóa học, chi tiết, học, khóa của tôi |
| `cv/` | Phân tích CV, lịch sử phân tích |
| `interview/` | Phỏng vấn AI (phòng, feedback, gender, avatar demo) |
| `mentor/` | Khu vực mentor: dashboard, lịch, tài chính, khóa học mentor, meeting room, … |

Utils / components / data vẫn import từ `../../utils`, `../../components`, `../../data` (hai cấp lên `app/`).
