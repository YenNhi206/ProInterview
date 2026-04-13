# Cấu trúc `src/app/`

| Thư mục | Mô tả | Chi tiết |
|:--|:--|:--|
| **`pages/`** | Màn hình theo nhóm (auth, booking, mentor, …) | [`pages/README.md`](./pages/README.md) |
| **`components/`** | UI tái sử dụng (layout, ui, interview, …) | [`components/README.md`](./components/README.md) |
| **`data/`** | Mock / seed / khóa học tĩnh | [`data/README.md`](./data/README.md) |
| **`utils/`** | API client, auth, mock booking, history | [`utils/README.md`](./utils/README.md) |
| **`hooks/`** | Hook React (vd. D-ID) | — |
| **`routes.js`** | Định tuyến HashRouter | — |
| **`App.jsx`** | Root + providers | — |

File **`.jsx`**: thường là component có giao diện. File **`.js`**: logic không JSX hoặc module thuần — **đều thuộc FE**, không phải lỗi cấu trúc.
