# Quy tắc giao diện ProInterview (UI Style Guide)

> Áp dụng cho **mọi màn hình mới hoặc sửa lại** ở `frontend/`, do người hay agent (Claude Code, Gemini trong Antigravity) làm.
> Giá trị trong file lấy từ code đang chạy (đếm trong `frontend/src` ngày 24/11/2026), không đặt mới. Màu, cỡ chữ, bo góc không có trong file này thì **không dùng**; cần thêm thì sửa file này trước, báo nhóm.

Mục lục: [1. Nguyên tắc](#1-nguyên-tắc) · [2. Màu](#2-màu) · [3. Chữ](#3-chữ) · [4. Bo góc](#4-bo-góc) · [5. Khoảng cách, bố cục](#5-khoảng-cách-bố-cục) · [6. Viền, bóng](#6-viền-bóng) · [7. Nút](#7-nút) · [8. Ô nhập, form](#8-ô-nhập-form) · [9. Nhãn trạng thái](#9-nhãn-trạng-thái) · [10. Thẻ, khung](#10-thẻ-khung) · [11. Hộp thoại](#11-hộp-thoại) · [12. Icon](#12-icon) · [13. Trạng thái tải, rỗng, lỗi](#13-trạng-thái-tải-rỗng-lỗi) · [14. Sáng, tối](#14-chế-độ-sáng-tối) · [15. Chữ trên giao diện](#15-chữ-trên-giao-diện) · [16. Truy cập](#16-truy-cập) · [17. Nên, không nên](#17-nên-và-không-nên) · [18. Kiểm trước khi xong](#18-kiểm-trước-khi-xong) · [19. Nợ kỹ thuật đã biết](#19-nợ-kỹ-thuật-đã-biết)

---

## 1. Nguyên tắc

1. **Hai màu thương hiệu, mỗi màu một việc.** Lime `#93f72b` = hành động chính và điểm nhấn. Tím `#8037f4` = thương hiệu, AI, liên kết, trạng thái đang chọn. Không thêm màu thứ ba làm điểm nhấn.
2. **Mỗi khu vực chỉ một nút lime.** Nút còn lại là nút phụ (viền) hoặc chữ.
3. **Dùng đúng mã màu trong bảng.** Không tự chế sắc lime / tím mới (`#a3e635`, `#7c3aed`… xem [mục 2.5](#25-màu-cấm-dùng-và-màu-thay)).
4. **Bo góc theo bảng px ở mục 4**, không dùng `rounded-xl`, `rounded-2xl`, `rounded-3xl` (giá trị của chúng khác nhau giữa khu ứng viên và khu workspace, xem [mục 19](#19-nợ-kỹ-thuật-đã-biết)).
5. **Tái dùng thứ đã có** trước khi viết mới: `MentorPageShell`, `CUSTOMER_SHELL_GUTTER` / `CUSTOMER_SHELL_MAX` (`components/layout/customerShellLayout.js`), lớp `mr-*` (`styles/mentorship-requests.css`), `components/ui/*` (shadcn).
6. **Màn nào cũng phải chạy đúng ở cả chế độ sáng và tối, và ở bề ngang 390px.**

---

## 2. Màu

### 2.1. Lime (hành động chính)

| Token | Mã | Dùng cho |
|:--|:--|:--|
| `lime` | `#93f72b` | Nền nút chính, tab/mục đang chọn trong menu, thanh tiến độ, chấm "đang hoạt động", chữ nhấn **trên nền tối** |
| `lime-hover` | `#a8ff4e` | Nền nút chính khi rê chuột |
| `lime-border-dark` | `#b8ff78` | Viền 1px của nút lime trên nền tối |
| `lime-border-light` | `#7fd925` | Viền lime trên nền sáng |
| `on-lime` | `#131f00` | **Chữ và icon đặt trên nền lime** (luôn tối, không bao giờ trắng) |
| `lime-tint` | `#93f72b` 10% (`bg-[#93f72b]/10`) + viền `#93f72b` 30% | Nền nhãn "đạt / thành công nhẹ", khung gắn kết (vd. "Gắn với job") |

Quy tắc: chữ lime **chỉ** đặt trên nền tối. Trên nền sáng, chữ nhấn dùng tím đậm `#6d28d9` (khu workspace đã tự đổi `text-[#93f72b]` sang màu này ở chế độ sáng).

### 2.2. Tím (thương hiệu, AI, liên kết)

| Token | Mã | Dùng cho |
|:--|:--|:--|
| `purple` | `#8037f4` | Màu thương hiệu: khối CTA lớn (vd. thẻ "Luyện tập phỏng vấn với AI"), avatar chữ cái, tiêu đề nhấn trên nền sáng, icon tiêu đề khối |
| `purple-strong` | `#6d28d9` | Chữ / liên kết / viền focus trên nền sáng; chữ nhấn thay lime ở chế độ sáng |
| `purple-soft` | `#c4b5fd` (violet-300) | Chữ tím, liên kết, icon **trên nền tối** |
| `purple-tint-light` | `#efe9fc` | Nền nhạt cho nhãn, ô chọn, hover trên nền sáng |
| `purple-tint-dark` | `violet-400/10` + viền `violet-400/30` | Nền nhãn tím trên nền tối |

### 2.3. Nền, chữ, viền

| Vai trò | Chế độ tối | Chế độ sáng |
|:--|:--|:--|
| Nền trang | `#120b2e` | `#efebfa` |
| Khung lớn (panel) | `#18113c` 80% (`bg-[#18113c]/80`) + `backdrop-blur-xl` | `#fcfbfe` (hoặc `bg-white`) |
| Ô nổi bên trong khung | `bg-white/[0.03]` – `bg-white/5` | `#f6f3fc` |
| Viền | `border-white/10` (đậm hơn: `white/15`) | `#ddd3f5` |
| Chữ chính, tiêu đề | `text-white` | `#23252f` (`text-slate-900` được đổi tự động trong workspace) |
| Chữ thường | `text-slate-300` (`#cbd5e1`) | `#23252f` |
| Chữ phụ, mô tả | `text-slate-400` (`#94a3b8`) | `#5b5772` |
| Chữ mờ nhất (nhãn nhóm, chú thích) | `text-slate-500` | `#5b5772` 80% |
| Lớp phủ hộp thoại | `bg-black/60` | `bg-black/60` |

### 2.4. Màu ngữ nghĩa

| Ý nghĩa | Trên nền tối (chữ / nền / viền) | Trên nền sáng (chữ / nền / viền) | Dùng khi |
|:--|:--|:--|:--|
| Thành công | `emerald-300` / `emerald-400/10` / `emerald-400/30` | `emerald-700` / `emerald-50` / `emerald-200` | Đạt, đã duyệt, đã thanh toán |
| Cảnh báo | `amber-300` / `amber-400/10` / `amber-400/30` | `amber-800` / `amber-50` / `amber-200` | Còn thiếu, sắp hết hạn, chờ xử lý cần chú ý |
| Lỗi, nguy hiểm | `red-300` / `red-500/10` / `red-400/30` | `red-700` / `red-50` / `red-200` | Lỗi, từ chối, xóa, hủy |
| Thông tin | `violet-200` / `violet-400/10` / `violet-400/30` | `#6d28d9` / `#efe9fc` / `#ddd3f5` | Đang xử lý, đã gửi, mặc định |
| Trung tính | `slate-300` / `white/5` / `white/15` | `#5b5772` / `#f6f3fc` / `#ddd3f5` | Đã rút, đã đóng, chưa có dữ liệu |

Không dùng đỏ cho trạng thái "Chưa phù hợp" của ứng viên (dùng cảnh báo / amber), đỏ chỉ cho lỗi hệ thống và thao tác phá hủy.

### 2.5. Màu cấm dùng và màu thay

Các mã dưới đây đang rải rác trong code cũ. **Code mới không dùng**; sửa màn hình cũ thì đổi sang cột "Thay bằng".

| Không dùng | Thay bằng |
|:--|:--|
| `#c7f36b`, `#bff365`, `#bfff3f`, `#b5e636`, `#a3e635`, `#b4f000`, `#84cc16`, `bg-lime-*` | `#93f72b` (hover `#a8ff4e`) |
| `#8b5cf6`, `#7c3aed`, `#630ed4`, `#6e35e8`, `#6d2fd6`, `#a855f7`, `#a66ff8`, `#4f46e5`, `bg-indigo-*` | `#8037f4`; chữ trên nền tối `#c4b5fd`; trên nền sáng `#6d28d9` |
| `#ffd600`, `#38bdf8` (vàng, xanh dương làm điểm nhấn) | Không dùng làm điểm nhấn; cần cảnh báo thì amber ở mục 2.4 |
| Gradient nhiều màu cho chữ, nút | Màu đặc. Gradient chỉ được dùng cho nền khối hero trang chủ |

---

## 3. Chữ

### 3.1. Font

- Một font cho toàn bộ giao diện: **Lexend** (fallback `Plus Jakarta Sans`, `system-ui`), đã nạp trong `styles/fonts.css`, có bộ ký tự tiếng Việt.
- Tiêu đề thêm class `font-headline`. Không nạp font mới, không dùng serif cho giao diện.
- Số trong bảng, điểm, tiền: thêm `tabular-nums` để cột thẳng hàng.

### 3.2. Thang cỡ chữ

| Cấp | Dùng cho | Class Tailwind | Cỡ (px) | Độ đậm | Màu tối / sáng |
|:--|:--|:--|:--|:--|:--|
| Display | Tiêu đề hero trang chủ, trang giới thiệu | `text-4xl md:text-5xl tracking-tight` | 36 → 48 | `font-black` (900) | trắng / `#23252f` |
| H1 | Tiêu đề trang (mỗi trang đúng **một** H1) | `text-2xl sm:text-3xl` | 24 → 30 | `font-black` | trắng / `#23252f` |
| H2 | Tiêu đề khối trong trang | `text-lg sm:text-xl` | 18 → 20 | `font-black` | trắng / `#23252f` |
| H3 | Tiêu đề thẻ, tên mục trong danh sách | `text-base` | 16 | `font-bold` (700) | trắng / `#23252f` |
| H4 / nhãn nhóm | Nhãn nhóm nhỏ trong khung ("KỸ NĂNG", "NĂNG LỰC") | `text-xs uppercase tracking-wider` | 12 | `font-black` | `slate-500` / `#5b5772` |
| Thân bài | Đoạn văn, mô tả | `text-sm leading-relaxed` | 14 | `font-normal` / `font-medium` | `slate-300` / `#23252f` |
| Thân bài lớn | Đoạn mở đầu dưới H1, câu trả lời phỏng vấn | `text-base leading-relaxed` | 16 | `font-medium` | `slate-300` / `#23252f` |
| Phụ | Mô tả phụ, ngày giờ, gợi ý dưới ô nhập | `text-xs` | 12 | `font-semibold` | `slate-400` / `#5b5772` |
| Nhãn nhỏ | Chữ trong badge, chip | `text-[11px]` | 11 | `font-bold` | theo màu badge |
| Số lớn | Số liệu trên thẻ thống kê, điểm | `text-xl`–`text-2xl tabular-nums` | 20–24 | `font-black` | trắng / `#23252f` |

Quy tắc:
- **Không dùng chữ nhỏ hơn 11px.** `text-[10px]`, `text-[9px]`, `text-[8px]` có trong code cũ: không thêm mới.
- Màu chữ tiêu đề luôn là màu chữ chính (trắng / `#23252f`). Muốn nhấn một từ trong tiêu đề thì tô từ đó tím `#8037f4` (nền sáng) hoặc lime (nền tối), không tô cả câu.
- Chữ in hoa chỉ dùng cho nhãn nhóm (H4) và nhãn nhỏ, **không** dùng cho tiêu đề, câu, nút.
- Trên điện thoại, `styles/index.css` tự tăng toàn bộ thang chữ lên 1 bậc; không tự tăng thêm.
- Dòng dài nhất của đoạn văn ≤ khoảng 75 ký tự (`max-w-2xl` cho đoạn mô tả dưới H1).

---

## 4. Bo góc

Dùng **giá trị px viết thẳng** (`rounded-[16px]`), không dùng `rounded-xl` / `rounded-2xl` / `rounded-3xl` (xem [mục 19](#19-nợ-kỹ-thuật-đã-biết)). `rounded-full`, `rounded-lg`, `rounded-md` vẫn dùng được cho trường hợp ghi trong bảng.

| Thành phần | Bo góc | Class |
|:--|:--|:--|
| Nút, chip, badge, tab dạng viên, ô tìm kiếm lớn, avatar, chấm trạng thái | Tròn hẳn | `rounded-full` |
| Ô nhập, select, textarea | 12px | `rounded-[12px]` |
| Ô nhỏ bên trong khung (mục danh sách, ô số liệu, ô chọn radio dạng thẻ) | 12px | `rounded-[12px]` |
| Ảnh nhỏ, logo, thumbnail ≤ 48px | 8px (logo vuông) / tròn (avatar người) | `rounded-[8px]` / `rounded-full` |
| Thẻ, khung thường (card trong lưới, thẻ mục) | 16px | `rounded-[16px]` |
| Khung lớn của trang (panel chứa cả một khối) | 20px | `rounded-[20px]` |
| Hộp thoại, bảng trượt (sheet) | 24px | `rounded-[24px]` |
| Khối hero, banner lớn | 24px | `rounded-[24px]` |
| Thanh tiến độ, thanh điểm | Tròn hẳn | `rounded-full` |

Quy tắc lồng nhau: **góc trong nhỏ hơn góc ngoài** ít nhất một bậc (khung 20 → ô bên trong 12; hộp thoại 24 → ô bên trong 12 hoặc 16). Không đặt khung 16 trong khung 16 cùng cỡ đệm.

---

## 5. Khoảng cách, bố cục

- **Lưới 4px.** Chỉ dùng các bậc Tailwind: 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16 (= 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64px).
- **Lề trang**: `CUSTOMER_SHELL_GUTTER` (`px-4 sm:px-10 md:px-16 lg:px-24`) và chiều rộng tối đa `CUSTOMER_SHELL_MAX` (`max-w-7xl`). Trang đọc (form, chi tiết) có thể hẹp hơn `max-w-3xl` / `max-w-4xl`, căn giữa.

| Khoảng | Giá trị |
|:--|:--|
| Đệm khung lớn (panel) | `p-5 sm:p-6` (20 → 24px) |
| Đệm thẻ thường | `p-4 sm:p-5` (16 → 20px) |
| Đệm ô nhỏ bên trong | `p-3` (12px) |
| Khoảng giữa các khối lớn trong trang | `space-y-5` hoặc `gap-5` (20px) |
| Khoảng giữa các thẻ trong lưới | `gap-3 sm:gap-4` (12 → 16px) |
| Khoảng giữa các mục trong một khung | `space-y-2` – `space-y-3` (8–12px) |
| Tiêu đề khối → nội dung | `mb-3` (12px) |
| H1 → đoạn mô tả | `mt-1` – `mt-2` (4–8px) |
| Icon → chữ trong nút, nhãn | `gap-1.5` – `gap-2` (6–8px) |

- Lưới: 1 cột trên điện thoại; 2 cột từ `sm`; 3 cột từ `md`/`lg`. Bố cục chi tiết: nội dung chính + cột phụ `lg:grid-cols-[minmax(0,1fr)_380px]`.
- Ở 390px: **không có thanh cuộn ngang**, chữ dài dùng `truncate` hoặc `break-words`, nút xếp dọc `flex-col sm:flex-row`.
- Vùng bấm tối thiểu **40×40px** (nút icon `h-10 w-10`).

---

## 6. Viền, bóng

- Viền luôn **1px**. Viền 2px chỉ dùng cho mục **đang chọn** (ô chọn thẻ, tab).
- Chế độ tối: **không dùng bóng** cho thẻ; tách lớp bằng nền + viền `white/10`.
- Chế độ sáng: thẻ dùng `shadow-sm` hoặc chỉ viền `#ddd3f5`; hộp thoại `shadow-2xl`.
- **Cấm**: quầng sáng mờ quanh nút (`shadow-[0_0_30px_…]`, `ring` mờ thường trực, `blur` sau nút), viền gradient, nhiều lớp bóng chồng nhau. Vòng sáng chỉ xuất hiện khi focus bàn phím (`focus-visible`).
- Hiệu ứng nền mờ (`blur-3xl`, đốm màu trang trí) chỉ dùng ở hero trang chủ, không đặt trong trang làm việc.

---

## 7. Nút

### 7.1. Loại nút

| Loại | Khi dùng | Tối | Sáng |
|:--|:--|:--|:--|
| **Chính (Primary)** | Hành động chính duy nhất của khu vực: Lưu, Gửi, Ứng tuyển, Nộp đơn | nền `#93f72b`, chữ `#131f00`, viền `#b8ff78`; hover `#a8ff4e` | giống tối (nền lime, chữ `#131f00`, viền `#7fd925`) |
| **Phụ (Secondary)** | Hành động thứ hai: Hủy, Tải lại, Xem thêm, Tìm mentor | nền `white/5`, viền `white/15`, chữ trắng; hover viền `violet-400/60`, nền `white/10` | nền trắng, viền `#ddd3f5`, chữ `#23252f`; hover nền `#efe9fc` |
| **Thương hiệu (Tonal tím)** | CTA gắn với AI hoặc khối nổi bật nền tím (hiếm, tối đa 1 / trang) | nền `#8037f4`, chữ trắng; hover `#6d28d9` | giống tối |
| **Nguy hiểm** | Xóa, hủy buổi, rút đơn khi không thể hoàn tác | viền `red-400/40`, chữ `red-300`, nền trong suốt; hover nền `red-500/10` | viền `red-200`, chữ `red-700`; hover `red-50` |
| **Chữ (Ghost / link)** | Hành động phụ nhỏ: "Xem đơn ứng tuyển", "Báo cáo tin này" | chữ `#c4b5fd` hoặc `slate-400`, không viền, không nền | chữ `#6d28d9` |

Không có loại nút nào khác. Không dùng nút nền trắng chữ tím, nút gradient, nút viền lime trên nền sáng.

### 7.2. Kích thước

| Cỡ | Chiều cao | Đệm ngang | Chữ | Icon |
|:--|:--|:--|:--|:--|
| Thường (mặc định) | 40px (`h-10` hoặc `py-2.5`) | `px-5` | `text-sm font-bold` | 16 |
| Nhỏ (trong bảng, thẻ) | 32px (`h-8` hoặc `py-1.5`) | `px-3` | `text-xs font-bold` | 14 |
| Lớn (CTA hero) | 48px (`h-12`) | `px-6` | `text-base font-black` | 18 |
| Chỉ icon | 40×40 (`h-10 w-10`) | — | — | 18 + `aria-label` |

Mọi nút: `rounded-full`, `inline-flex items-center justify-center gap-2`.

### 7.3. Trạng thái

- **Vô hiệu**: `disabled:opacity-50 disabled:cursor-not-allowed`, giữ nguyên màu. Có lý do thì thêm `title` giải thích ("Chọn một CV để ứng tuyển").
- **Đang xử lý**: icon `Loader2` quay (`animate-spin`) + đổi chữ ("Đang lưu…", "Đang nộp…"), khóa nút để không bấm đúp.
- **Focus bàn phím**: `focus-visible:outline-2 focus-visible:outline-offset-2` màu lime (tối) / `#6d28d9` (sáng).
- Nút tự viết (không dùng lớp `mr-*` hay shadcn `Button`) phải có **`data-button-surface="none"`** để style nút toàn cục không chèn viền / nền lạ.

### 7.4. Thứ tự

Cụm nút cuối form / hộp thoại: căn phải trên máy tính, **nút phụ bên trái, nút chính bên phải**. Trên điện thoại xếp dọc, nút chính ở trên.

---

## 8. Ô nhập, form

| Phần | Quy tắc |
|:--|:--|
| Nhãn | Đặt **trên** ô, `text-sm font-bold`, màu chữ chính. Bắt buộc có nhãn (hoặc `aria-label` / `sr-only`) |
| Ô nhập, select | Cao 40–44px, `rounded-[12px]`, `px-3 text-sm`. Tối: nền `white/[0.04]`, viền `white/10`, chữ trắng, placeholder `slate-500`. Sáng: nền trắng, viền `#ddd3f5`, chữ `#23252f`, placeholder `#5b5772` 70% |
| Focus | Viền `violet-400/60` (tối) / `#6d28d9` (sáng), không đổ bóng to |
| Gợi ý dưới ô | `text-xs` màu chữ phụ, `mt-1` |
| Lỗi | `text-xs text-red-300` (tối) / `text-red-700` (sáng) ngay dưới ô, kèm `role="alert"`; viền ô đổi đỏ |
| Textarea | Như ô nhập, `rows={4}` trở lên, `resize-y` |
| Checkbox, radio | `accent-[#93f72b]` (tối) / `accent-[#6d28d9]` (sáng). Đồng ý điều khoản: checkbox + đoạn chữ nói rõ chia sẻ gì cho ai |
| Ô chọn dạng thẻ | `rounded-[12px]` viền 1px; đang chọn: viền `#93f72b` + nền `#93f72b`/8% (tối) / viền `#6d28d9` + nền `#efe9fc` (sáng) |
| Bố cục | Một cột trên điện thoại; 2 cột cho cặp ô ngắn từ `sm`. Khoảng giữa các trường `space-y-4` |

Kiểm lỗi ở client trước khi gửi; nút gửi khóa tới khi hợp lệ; lỗi từ server hiện ở trên cụm nút, giữ nguyên dữ liệu đã nhập.

---

## 9. Nhãn trạng thái

Dạng chung: `inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold` + bộ màu ở [mục 2.4](#24-màu-ngữ-nghĩa).

| Nhóm trạng thái | Màu |
|:--|:--|
| Đạt, đã duyệt, đã thanh toán, vào danh sách chọn, đang dùng | Thành công |
| Đã nộp, đã gửi, đang chờ, nhà tuyển dụng đã xem, đang chấm | Thông tin (tím) |
| Còn thiếu, chờ thanh toán, sắp hết hạn, chưa phù hợp | Cảnh báo |
| Bị từ chối (nội dung), lỗi, thất bại | Lỗi |
| Đã rút, đã đóng, nháp, chưa có dữ liệu | Trung tính |
| Nhãn danh mục (vị trí, "Mặc định") | Lime tint (tối) / tím tint (sáng) |

Chữ trong nhãn là tiếng Việt viết thường đầu câu ("Đã nộp"), không viết hoa toàn bộ. Nhãn đặt cạnh tiêu đề hoặc ở góc trên của thẻ, không đặt giữa đoạn văn.

---

## 10. Thẻ, khung

| Loại | Tối | Sáng |
|:--|:--|:--|
| Khung lớn (panel) | `rounded-[20px] border border-white/10 bg-[#18113c]/80 p-5 sm:p-6 backdrop-blur-xl` | `rounded-[20px] border border-[#ddd3f5] bg-white p-5 sm:p-6` |
| Thẻ trong lưới (job, mentor, khóa) | `rounded-[16px] border border-white/10 bg-[#18113c]/80 p-5`; cả thẻ là `Link` khi mở trang chi tiết, hover viền `violet-400/50` | `rounded-[16px] border border-[#ddd3f5] bg-white p-5 shadow-sm`; hover viền `#6d28d9`/40 |
| Ô nhỏ bên trong | `rounded-[12px] border border-white/10 bg-white/[0.03] p-3` | `rounded-[12px] border border-[#ddd3f5] bg-[#f6f3fc] p-3` |
| Thẻ số liệu | Ô nhỏ + nhãn H4 + số lớn (mục 3.2) | như trái |

Bố cục bên trong thẻ: tiêu đề (H3) → dòng phụ (chữ phụ) → nhãn → nội dung → cụm nút ở đáy (`mt-auto` để các thẻ trong lưới thẳng đáy). Một thẻ tối đa **2 nút**.

---

## 11. Hộp thoại

- Lớp phủ `fixed inset-0 z-50 bg-black/60`, bấm ra ngoài hoặc phím `Esc` thì đóng (trừ khi đang gửi).
- Khung: `rounded-[24px] p-5 sm:p-6 w-full max-w-md` (form ngắn) / `max-w-lg` (form có danh sách chọn), `max-h-[90vh] overflow-y-auto`.
- Tối: nền `#18113c`, viền `white/10`. Sáng: nền trắng, viền `#ddd3f5`, `shadow-2xl`.
- Đầu hộp thoại: tiêu đề `text-lg font-black` + nút đóng icon `X` ở góc phải (`aria-label="Đóng"`). Có `role="dialog" aria-modal="true" aria-labelledby`.
- Cuối: cụm nút theo [mục 7.4](#74-thứ-tự).
- Xác nhận thao tác không hoàn tác (xóa, rút đơn): nêu rõ hậu quả trong câu hỏi ("Doanh nghiệp sẽ không còn xem được hồ sơ…").

---

## 12. Icon

- Chỉ dùng **`lucide-react`** cho code mới. `Material Symbols` (trang dashboard cũ) không thêm mới.
- Cỡ: 14 (trong nhãn, nút nhỏ) · 16 (trong nút, dòng chữ) · 18 (tiêu đề khối) · 20–24 (ô icon của thẻ tính năng) · 30–40 (trạng thái rỗng).
- Màu icon theo màu chữ đi kèm; icon tiêu đề khối dùng tím (`#8037f4` sáng / `#c4b5fd` tối) hoặc lime (tối).
- Icon trang trí thêm `aria-hidden`; icon đứng một mình thì nút phải có `aria-label`.
- Icon và chữ trên cùng dòng: bọc trong `inline-flex items-center gap-1.5`, icon `shrink-0`, để icon không rơi xuống dòng riêng.

---

## 13. Trạng thái tải, rỗng, lỗi

Mọi khối lấy dữ liệu từ API phải có đủ 4 trạng thái:

| Trạng thái | Cách hiện |
|:--|:--|
| Đang tải | Lần đầu: khung xương (`animate-pulse`, khối `bg-white/10` / `bg-slate-100`) đúng hình khối thật, `role="status"`. Tải lại trong trang: giữ nội dung cũ, chỉ hiện chữ "Đang tải…" nhỏ |
| Rỗng | Icon 30–40px + tiêu đề ngắn (H3) + 1 câu hướng dẫn + 1 nút dẫn tới việc cần làm ("Xem việc làm"). Không để khung trắng trơn |
| Lỗi | Khung lỗi (màu lỗi mục 2.4) + câu lỗi tiếng Việt từ server + nút "Thử lại", `role="alert"` |
| Có dữ liệu | Nội dung |

Thông báo thành công sau thao tác: toast (`toastApiSuccess`) hoặc dòng chữ thành công tại chỗ, tự ẩn hoặc nằm cạnh nút. **Không** hiện dữ liệu giả, số liệu mẫu khi API lỗi.

---

## 14. Chế độ sáng, tối

- Người dùng chọn sáng / tối / theo hệ thống; khóa lưu `prointerview_workspace_theme`. Mọi màn mới phải đúng ở **cả hai** chế độ.
- Cách viết hiện tại của dự án: viết lớp màu **tối** theo bảng mục 2 (`text-white`, `bg-white/5`, `border-white/10`, nền `#18113c`, chữ `#93f72b`); file `styles/mentor-workspace-light.css` tự đổi các lớp này sang bảng màu sáng khi `data-workspace-theme="light"`, **với trang nằm trong `MentorPageShell`** (khu ứng viên, mentor, công ty). Trang không dùng shell này thì phải tự viết lớp màu sáng. Dùng **đúng** các lớp trong bảng thì chế độ sáng tự đúng; lớp lạ sẽ không được đổi.
- Không dùng chữ lime trên nền trắng; không đặt chữ trắng trên nền sáng; nền lime luôn đi với chữ `#131f00`.
- Trước khi xong: chụp màn hình cả hai chế độ, so từng khối.

---

## 15. Chữ trên giao diện

- **Tiếng Việt**, câu ngắn, viết hoa chữ đầu câu. Không viết hoa toàn bộ (trừ nhãn nhóm nhỏ).
- Nút là **động từ**: "Lưu", "Ứng tuyển", "Rút đơn", "Thử lại". Không dùng "OK", "Submit".
- Tiền: `formatVnd()` → "350.000 VND" (không dùng "đ", "₫"). Miễn phí: "Miễn phí".
- Ngày: `toLocaleDateString("vi-VN")` → "24/11/2026"; giờ 24h "19:30".
- Tên vai trò: luôn qua `roleLabel()` (Candidate, Mentor, Admin, Platform Moderator, Company Moderator); không in thẳng `customer`, `enterprise`.
- Lỗi: nói chuyện gì xảy ra và làm gì tiếp ("Không tải được kho CV. Thử lại sau."), không in mã lỗi kỹ thuật.
- Không dùng emoji trong giao diện làm việc.

---

## 16. Truy cập

- Độ tương phản chữ ≥ 4.5:1 (chữ thường), ≥ 3:1 (chữ ≥ 18px đậm). Các cặp màu trong mục 2 đã đạt; tự chế màu thì phải kiểm.
- Mọi phần tử bấm được dùng `button` hoặc `Link`, không gắn `onClick` lên `div`.
- Có `focus-visible` rõ ràng; thứ tự Tab theo thứ tự đọc.
- Ảnh có `alt` (logo trang trí: `alt=""`).
- Trạng thái không chỉ dựa vào màu: nhãn luôn có chữ, thanh điểm có số đi kèm.

---

## 17. Nên và không nên

| Nên | Không nên |
|:--|:--|
| Một nút lime cho hành động chính | Hai, ba nút lime cạnh nhau |
| `rounded-[16px]` cho thẻ, `rounded-[20px]` cho panel | `rounded-xl` ở trang này, `rounded-3xl` ở trang kia |
| Chữ trên nền lime màu `#131f00` | Chữ trắng trên nền lime |
| `#93f72b` cho mọi điểm nhấn lime | `#a3e635`, `#c7f36b`, `#bff365`… |
| `#8037f4` / `#c4b5fd` / `#6d28d9` cho tím | `#7c3aed`, `#a855f7`, `indigo-*` |
| Viền 1px `white/10` để tách lớp | Quầng sáng, bóng mờ quanh nút |
| Chữ nhỏ nhất 11px | `text-[9px]`, `text-[8px]` |
| Icon `lucide-react` + `aria-hidden` | Trộn Material Symbols, emoji, ảnh icon |
| Đủ 4 trạng thái tải / rỗng / lỗi / có dữ liệu | Khung trắng khi không có dữ liệu, số liệu giả |
| Tái dùng `MentorPageShell`, `mr-*`, `components/ui` | Viết lại nút, thẻ, hộp thoại riêng cho từng trang |

---

## 18. Kiểm trước khi xong

- [ ] Chỉ dùng màu trong mục 2, không có mã trong danh sách cấm.
- [ ] Cỡ chữ theo thang mục 3; mỗi trang một H1; không chữ < 11px.
- [ ] Bo góc theo bảng mục 4 (px viết thẳng); góc trong nhỏ hơn góc ngoài.
- [ ] Mỗi khu vực một nút chính lime; nút tự viết có `data-button-surface="none"`.
- [ ] Có trạng thái tải, rỗng, lỗi.
- [ ] Chụp màn hình **sáng + tối**, ở **1440px và 390px**; không cuộn ngang; không lỗi console.
- [ ] Chữ tiếng Việt, tiền `formatVnd`, ngày `vi-VN`, vai trò `roleLabel`.
- [ ] Nút icon có `aria-label`; form có nhãn; hộp thoại đóng được bằng `Esc`.

---

## 19. Nợ kỹ thuật đã biết

Ghi lại để không ai "sửa nhanh" làm vỡ trang khác. Sửa các mục này là một task riêng, phải báo nhóm.

1. **Hai bộ token chồng nhau.** `styles/theme.css` (shadcn) đặt `--primary: #8b5cf6`, `--secondary: #c7f36b`, `--radius: 16px`; `styles/index.css` lại đặt `--color-primary: #93f72b`, `--radius-lg: 2rem`, `--radius-xl: 3rem`. Vì vậy class `bg-primary`, `text-secondary` của shadcn ra màu khác bảng mục 2 → **không dùng các class màu ngữ nghĩa của shadcn** (`bg-primary`, `text-secondary`, `bg-accent`…) cho màn mới, viết mã màu theo mục 2.
2. **`rounded-xl` = 48px ở khu ứng viên** (do `--radius-xl: 3rem`) nhưng = 16px trong khu workspace (`styles/mentor-workspace.css` đặt lại `--radius-xl: 1rem`, `--radius-2xl: 1rem`, `--radius-3xl: 1.25rem`). Đây là lý do có trang bo tròn như viên thuốc, có trang gần vuông → mục 4 yêu cầu viết px thẳng.
3. **Nút toàn cục**: có style nút chung áp cho mọi `button`; nút tự viết cần `data-button-surface="none"` (mục 7.3).
4. Code cũ còn nhiều mã màu trong danh sách cấm (mục 2.5) và chữ 8–10px. Sửa dần khi đụng tới màn hình đó, không sửa hàng loạt ngoài phạm vi task.
