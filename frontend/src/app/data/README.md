# Dữ liệu trên frontend (`src/app/data/`)

Toàn bộ đây là **dữ liệu phục vụ UI** (mock / seed / tĩnh). **Không** thay cho API backend khi tính năng đã có route thật — lúc đó page sẽ `fetch` và bớt phụ thuộc file này.

## Bản đồ file

| File / thư mục | Vai trò | Khi nào thay bằng BE |
|:--|:--|:--|
| **`mockData.js`** | Barrel re-export | Giữ file này; logic nằm trong `seeds/` |
| **`seeds/*.js`** | Mock tổng hợp: mentor fallback, booking, CV history, dashboard chart, … | Theo từng API trong `ROADMAP.md` / `API_INDEX.md` |
| **`coursesData.js`** | Khóa học + lesson (demo) | `GET /api/courses`, … |
| **`mentorMockData.js`** | KPI mentor, finance, lịch mentor (demo) | `GET /api/mentor/*`, … |

Chi tiết từng export trong `seeds/`: xem [`seeds/README.md`](./seeds/README.md).

## Nguyên tắc

1. **FE giữ mock** để giao diện chạy được khi API chưa xong.
2. **BE giữ nguồn sự thật** (MongoDB, rule, phân quyền) — không copy nguyên file `.js` từ `data/` sang backend; backend định nghĩa schema + route riêng.
3. **`utils/history.js`** đọc seed từ `mockData` rồi lưu `localStorage` — vẫn là **client-only**; sau có API lịch sử CV/interview thì refactor dần sang `fetch`.

## Gợi ý làm sạch dần (theo sprint)

- Một module API xong → thay `import … from "../data/…"` tại đúng page đó bằng gọi API + state loading/error.
- File mock không còn import → xóa hoặc thu gọn export.
