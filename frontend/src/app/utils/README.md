# Tiện ích client (`src/app/utils/`)

Các file **`.js`** ở đây chạy trên **trình duyệt** (hoặc build-time), **không** phải server Node. Không “chuyển file sang backend” — chỉ **logic nhạy cảm / DB** mới cần viết lại phía BE.

## Bản đồ file

| File | Nhiệm vụ |
|:--|:--|
| **`api.js`** | `API_BASE_URL`, `apiUrl()`, `apiGet()` — base URL backend (Vite proxy dev / `VITE_API_URL` prod). |
| **`auth.js`** | Đăng ký, đăng nhập, Google, JWT trong `localStorage`, `PATCH /me`, `getPostLoginPath` (customer / mentor / admin). |
| **`mentorApi.js`** | `fetchMentors`, `fetchMentor` → gọi `/api/mentors` (đã có BE). |
| **`bookings.js`** | Booking mock + `localStorage`, map với `UPCOMING_SESSIONS` / mentor — **tạm** cho đến khi có `/api/bookings`. |
| **`meetings.js`** | Trạng thái phòng họp mentor (mock) — tương lai nối API. |
| **`history.js`** | Lịch sử CV & phỏng vấn AI: seed từ `mockData`, persist `localStorage`. |
| **`aiDialogue.js`** | Luật hội thoại demo (chào hỏi, filter từ ngữ) cho phỏng vấn AI — chỉ client. |

## Liên quan backend

- Gọi HTTP thật: dùng **`apiUrl`** + `fetch` + `Authorization` (pattern trong `auth.js`).
- Dữ liệu nguồn sự thật: **Mongo + API** — xem `backend/` và `API_INDEX.md` ở root repo.
