# AGENTS.md: luật cho agent trong Antigravity (Gemini)

> File này Antigravity tự nạp vào mọi phiên. Nội dung tương đương phần "Kế hoạch capstone" trong `CLAUDE.md`, để Gemini và Claude làm theo cùng một chuẩn.
> Khi sửa luật kế hoạch: sửa cả file này và mục "Kế hoạch capstone (docs/plan/)" trong `CLAUDE.md`.

## 1. Đọc trước khi làm bất cứ việc gì

1. `CLAUDE.md` ở gốc repo: quy ước code, kiến trúc, domain. **Bắt buộc đọc dù tên file có chữ Claude**; đây là tài liệu kỹ thuật chung của repo, không phải hướng dẫn riêng cho Claude.
2. `docs/plan/START_HERE.md`: quy trình làm task và các prompt mẫu (Prompt 0, A đến F).
3. Khi làm một task, đọc theo thứ tự: `docs/plan/REQUIREMENTS.md` (dòng REQ của task) → `docs/plan/TASKS.md` → `docs/plan/DECISIONS.md` → `docs/plan/DESIGN.md` (nhất là mục 7 "Bẫy trong code").

Phạm vi chính thức của đồ án là `docs/plan/REGISTRATION_V3.md` (thay V2 từ 23/11/2026). Bỏ qua `docs/plan/REGISTRATION_V2.md`, `docs/report/REGISTRATION.md` và `docs/capstone/TASKS.md` (bản cũ).

## 2. Luật kế hoạch capstone

- `docs/plan/TASKS.md` là nguồn đúng duy nhất về task, trạng thái và phân công.
- Khi người dùng giao "làm task <MÃ>" (ví dụ LP-02, CO-07): **làm đúng các bước của Prompt A** trong `docs/plan/START_HERE.md`, kể cả khi người dùng không dán Prompt A.
- Mỗi task gắn ít nhất một mã REQ hoặc nhãn `NEN (*)`. Task không có REQ: dừng và báo.
- Kiểm tra cột "Cần xong trước": task phụ thuộc chưa `Done` thì dừng và báo.
- **Gửi kế hoạch và câu hỏi trước, chưa code.** Chỉ code sau khi người dùng trả lời.
- Chỉ làm đủ cột "Xong khi". Không mở rộng sang REQ khác trong cùng PR.
- Việc phát sinh: phân loại `bat-buoc` / `chi-tiet` / `ngoai-don` / `no-ky-thuat` theo mục "Luật task phát sinh" trong `START_HERE.md`.
  - Chỉ làm luôn nếu là `bat-buoc` VÀ là "sửa nhỏ": không thêm model, route hay collection mới; không đổi request/response của API đã có; sửa không quá 3 file (không tính file test).
  - Còn lại: ghi vào mục "Đề xuất thay đổi kế hoạch" của `TASKS.md`. **Không tự thêm hay sửa task trong bảng chính.**
- Tài liệu và code mâu thuẫn: tin code, ghi đề xuất, không tự đổi phạm vi task.
- Không hỏi lại hay làm ngược các quyết định trong `DECISIONS.md`. Quyết định mới: ghi vào mục "Nhật ký quyết định mới".
- Không bịa số đo NFR hay kết quả test. Chưa đo thì ghi "Chưa đo".

## 3. Quy ước code tối thiểu (chi tiết trong CLAUDE.md)

- Response API dạng `{ success, <key> }`; thông báo lỗi và chữ trên giao diện viết bằng tiếng Việt.
- Làm hoặc sửa giao diện: theo `docs/UI_STYLE_GUIDE.md` (màu, cỡ chữ, bo góc, nút, form, sáng/tối) và chạy danh sách kiểm ở mục 18 của file đó.
- Route gắn `authJwt` và `requireRole`. Mở rộng router có sẵn, không tạo prefix song song cho cùng domain.
- FE gọi API bằng `apiUrl()` + `authFetch()`.
- Tên role trong code: `customer`, `mentor`, `admin`, `moderator`, `company_moderator`. Trong báo cáo và giao diện: Candidate, Mentor, Admin, Platform Moderator, Company Moderator.
- Thu phí mới dùng lại luồng chuyển khoản (SePay + xác nhận tay), không thêm cổng thanh toán.
- Task BE có test integration trong `src/integration/`; `npm test` phải xanh trước khi báo xong.
- Văn bản tài liệu không dùng dấu gạch ngang dài.

## 4. Phối hợp khi hai agent cùng làm trên repo

Nhóm dùng cả Claude Code và Gemini (Antigravity). Để không giẫm chân nhau:

- **Một task chỉ một agent làm.** Trước khi bắt đầu, kiểm tra cột Trạng thái trong `TASKS.md`: task đang `Doing` hoặc `Review` thì dừng và báo.
- Mỗi task một nhánh `feat/<mã>-<tên-ngắn>`. Không làm trực tiếp trên nhánh chính.
- Trước khi sửa `TASKS.md`, `REQUIREMENTS.md`, `DECISIONS.md`: pull nhánh chính mới nhất. Chỉ sửa **dòng của task mình** và **thêm dòng mới** vào cuối các bảng đề xuất, nhật ký. Không sắp xếp lại, không định dạng lại bảng.
- Mô tả PR có 2 dòng: `REQ: <mã, mã>` và `Agent: Gemini`.
- Không chạy script migrate, drop index hay seed trên production. Script chạm dữ liệu chỉ chạy trên staging hoặc local, và phải được người dùng đồng ý trong chat.

## 5. Cuối mỗi phiên, báo ngắn

- Ý nào trong cột "Xong khi" và Definition of Done đã đạt, ý nào chưa.
- REQ đã chạm tới.
- Việc phát sinh đã làm luôn (kèm lý do là `bat-buoc` và sửa nhỏ) và đề xuất đã ghi.
- File tài liệu đã cập nhật.
