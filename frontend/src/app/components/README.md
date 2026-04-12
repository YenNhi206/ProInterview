# `components/` — cấu trúc

| Thư mục | Vai trò |
|:--|:--|
| `ui/` | Primitives (shadcn-style): button, dialog, input, … |
| `layout/` | `AppLayout`, navbar, sidebar, footer |
| `auth/` | Vỏ đăng nhập / Google block |
| `mentor/` | `MentorPageShell` — layout chung khu mentor |
| `modals/` | Modal tái sử dụng (report, reschedule, …) |
| `figma/` | Tiện ích (vd. `ImageWithFallback`) |
| `interview/` | Avatar AI, video HR, camera hành vi — mọi thứ gắn **phỏng vấn AI / stream** |
| `cv/` | Preview và widget liên quan **CV** |
| `courses/` | Gợi ý khóa học (`CourseRecommendations`, …) |
| `home/` | Khối marketing / landing: `RecommendedJourney`, … |
| `shared/` | Khối dùng chung nhiều màn: `PageHeader`, `SupportContact`, `HistoryPanel` |

File đặt ở **root** `components/` chỉ khi là entry chung (vd. còn lại từ prototype). Ưu tiên thêm file mới vào đúng folder domain.
