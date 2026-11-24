# Bắt đầu: cách làm việc với code agent (bản 2, 22/11/2026)

> Bản 2 thêm **neo phạm vi**: mọi task phải bám vào một dòng trong đơn đăng ký V2 qua mã REQ. Thay đổi so với bản 1: thêm Prompt 0 và Prompt F; sửa Prompt A, B, E; thêm mục "Luật task phát sinh".

Thư mục `docs/plan/` gồm:

| File | Dùng để | Ai sửa |
| --- | --- | --- |
| `REGISTRATION_V3.md` | Đơn đăng ký V3 dạng Markdown (23/11/2026). **Phạm vi đã cam kết với hội đồng** | Không ai sửa; đơn đổi thì chép lại |
| `REGISTRATION_V2.md` | Đơn V2, bản cũ giữ để đối chiếu | Không sửa, không dùng làm phạm vi |
| `REQUIREMENTS.md` | Mã REQ cho 39 chức năng + 6 NFR, ánh xạ REQ ↔ task, trạng thái phủ | Agent cập nhật cột Task và Phủ; Janet duyệt REQ mới |
| `TASKS.md` | Task, trạng thái, phụ thuộc, điều kiện xong, cột REQ. Nguồn đúng duy nhất về tiến độ | Agent cập nhật trạng thái; Janet duyệt đề xuất thay đổi |
| `DECISIONS.md` | Quyết định đã chốt + nhật ký quyết định mới | Agent ghi quyết định mới sau khi bạn trả lời |
| `DESIGN.md` | Model, state machine, chia tiền, API, bẫy trong code | Janet (khi thiết kế đổi) |
| `START_HERE.md` | File này: quy trình và prompt mẫu | Janet |

**Thứ tự agent đọc:** `REQUIREMENTS.md` (dòng REQ của task) → `TASKS.md` → `DECISIONS.md` → `DESIGN.md` → `CLAUDE.md`. Đọc phạm vi trước để mọi quyết định sau đều được so với đơn.

## Cài đặt một lần

1. Chép thư mục `docs/plan/` vào repo ProInterview, gồm cả `REGISTRATION_V3.md`.
2. Dán mục "Đoạn cho CLAUDE.md" ở cuối file này vào cuối `CLAUDE.md` ở gốc repo.
3. Chạy **Prompt 0** ở một phiên riêng để tạo `REQUIREMENTS.md` và gắn REQ cho mọi task.
4. Commit lên nhánh chính: `docs: add scope anchor (REQUIREMENTS, REQ column)`.
5. Báo cả nhóm: từ giờ chỉ nhận việc qua `TASKS.md`, và task không có REQ thì không làm.
6. Nếu dùng Gemini trong Antigravity: đặt AGENTS.md ở gốc repo. Antigravity tự nạp file này. Prompt A đến F dùng được nguyên văn cho cả hai agent.
## Vòng làm một task

1. Mở **phiên agent mới** cho mỗi task (ngữ cảnh sạch).
2. Dán **Prompt A** (đổi mã task).
3. Agent đọc file, kiểm tra REQ và phụ thuộc, gửi kế hoạch + câu hỏi. **Trả lời một lần cho đủ.**
4. Agent code, test, đối chiếu "Xong khi", cập nhật `TASKS.md` sang `Review`, mở PR.
5. Người review duyệt → merge → đổi sang `Done` (Prompt D hoặc sửa tay).

Một phiên chỉ làm 1 task, hoặc vài task nhỏ liền nhau của cùng một người và cùng REQ (ví dụ N-02 đến N-04).

## Luật task phát sinh

Mọi việc mới phát hiện trong lúc làm đều được phân loại bằng một câu hỏi: **"Việc này phục vụ REQ nào trong `REQUIREMENTS.md`?"**

| Loại | Dấu hiệu | Xử lý |
| --- | --- | --- |
| `bat-buoc` (phát sinh bắt buộc) | Không làm thì task hiện tại không đạt "Xong khi" (bẫy trong code, field thiếu, luồng cũ chặn) | Nếu là **sửa nhỏ**: làm luôn trong phiên, ghi rõ trong PR, người phụ trách tự duyệt. Nếu không: đề xuất task mới cùng REQ, cùng mức với task gốc |
| `chi-tiet` (chi tiết hóa REQ) | Phục vụ một REQ nhưng chưa task nào bao | Đề xuất task mới gắn REQ đó; Janet chọn mức |
| `ngoai-don` (ngoài đơn) | Không chỉ ra được REQ nào | **Không làm.** Ghi vào mục "Hướng phát triển" của `TASKS.md` |
| `no-ky-thuat` (nợ kỹ thuật) | Làm cho gọn hơn, không đổi hành vi người dùng | Đề xuất P2, chỉ làm khi còn thời gian |

**Sửa nhỏ** nghĩa là đủ cả 3 điều: không thêm model, route hay collection mới; không đổi request/response của API đã có; sửa không quá 3 file (không tính file test).

Agent **không tự thêm task vào bảng chính**. Ai duyệt:
- `bat-buoc` là sửa nhỏ: người phụ trách task tự duyệt, chỉ cần ghi trong PR.
- `bat-buoc` không phải sửa nhỏ, `chi-tiet`, `ngoai-don`: ghi vào "Đề xuất thay đổi kế hoạch", Janet duyệt bằng Prompt E rồi mới lên bảng.
- `no-ky-thuat`: người phụ trách ghi đề xuất, Janet duyệt gom một lần mỗi mốc Review.

Mỗi task gắn **ít nhất một** mã REQ. Task hạ tầng thuần (Node, test, dọn file) gắn `NEN` kèm REQ mà nó mở đường, ví dụ `NEN (C-07)`.

## Prompt 0: cài neo phạm vi (chạy một lần)

Chạy ở **phiên mới**, trước mọi task khác của bản 2.

```
Cài neo phạm vi cho kế hoạch capstone. Chỉ sửa tài liệu trong docs/plan/, không sửa code.

Bước 1. Đọc docs/plan/REGISTRATION_V2.md, docs/plan/TASKS.md, docs/plan/DECISIONS.md.

Bước 2. Tạo docs/plan/REQUIREMENTS.md:
- Đặt mã REQ cho từng dòng chức năng trong REGISTRATION_V3.md, ĐÚNG thứ tự trong đơn:
  C-01..C-10 (Candidate), M-01..M-06 (Mentor), A-01..A-05 (Admin),
  PM-01..PM-06 (Platform Moderator), CM-01..CM-04 (Company Moderator),
  AIS-01..AIS-08 (AI System), NFR-01..NFR-06. Tổng 39 chức năng + 6 NFR.
- Một bảng duy nhất, cột: Mã REQ | Dòng trong đơn (tên ngắn tiếng Anh như trong đơn) |
  Diễn giải tiếng Việt (1 câu, theo DECISIONS.md nếu có quyết định liên quan) |
  Đạt khi | Phủ | Task | Ghi chú.
- Cột "Đạt khi": 1 câu kiểm tra được trên staging (ai làm gì, thấy gì). Đây là bản nháp:
  ghi "(nháp)" ở cuối mỗi ô. Câu trong đơn mơ hồ (ví dụ "verified competency results",
  "Learning from Reviews", "validate against SHRM/DDI") thì ghi "CẦN CHỐT" thay vì tự đoán.
- Sau bảng, thêm mục "Phần 3.2 của đơn": liệt kê từng ý trong Products và Theory and practice,
  mỗi ý ghi REQ nào đã bao nó. Ý nào không REQ nào bao thì đưa vào danh sách (b) ở Bước 3.
- Cột "Phủ" chỉ dùng 4 giá trị:
  "Có sẵn" (đã có trong code trước capstone; kiểm tra bằng cách tìm route/model/màn hình
  tương ứng và ghi đường dẫn file vào Ghi chú),
  "Có task" (có ít nhất 1 task trong TASKS.md),
  "Có sẵn + task" (có sẵn một phần, task bổ sung phần còn thiếu),
  "Thiếu" (không có sẵn và chưa task nào bao).
- Không đoán "Có sẵn". Không tìm thấy file chứng minh thì ghi "Thiếu" hoặc "Có task".
- Thêm đầu file: mục đích, quy ước 4 giá trị Phủ, và bảng 4 loại task phát sinh
  (chép từ START_HERE.md mục "Luật task phát sinh").

Bước 3. Gửi tôi trước khi sửa TASKS.md:
(a) bảng REQUIREMENTS.md vừa lập;
(b) danh sách REQ "Thiếu";
(c) danh sách task không gắn được REQ nào, kèm đề xuất: gắn NEN (REQ) hay chuyển "Hướng phát triển";
(d) task nào gắn nhiều REQ.
Dừng và chờ tôi duyệt.

Bước 4. Sau khi tôi duyệt:
- Thêm cột "REQ" vào MỌI bảng task trong TASKS.md, đặt ngay sau cột "Mã". Không đổi nội dung cột khác.
- Bảng "Đề xuất thay đổi kế hoạch" đổi thành các cột:
  Ngày | Task gốc | REQ | Loại | Vấn đề tìm thấy | Đề xuất | Trạng thái.
  Loại là một trong: bat-buoc, chi-tiet, ngoai-don, no-ky-thuat.
- Thêm mục "## Hướng phát triển" trước "## Ghi chú Blocked", cột: Ngày | Nguồn (task) | Ý tưởng | Lý do không làm trong capstone.
- Với mỗi REQ "Thiếu" tôi đã đồng ý bổ sung: ghi vào "Đề xuất thay đổi kế hoạch" loại chi-tiet, chưa tạo task.
- Sửa dòng đầu TASKS.md: thêm "Mọi task gắn mã REQ trong REQUIREMENTS.md".
- Ghi vào DECISIONS.md mục "Nhật ký quyết định mới":
  | <hôm nay> | DOC-01 | Mọi task gắn mã REQ; task phát sinh chỉ vào bảng chính qua "Đề xuất thay đổi kế hoạch" do Janet duyệt; việc ngoài đơn V2 chuyển "Hướng phát triển" | Janet |

Bước 5. Kiểm tra lại: đếm số REQ (phải là 45), số task có ít nhất một REQ (phải bằng tổng số task), số REQ "Thiếu", số ô "Đạt khi" ghi "CẦN CHỐT". Báo 4 con số này.
```

## Prompt A: làm một task

```
Làm task <MÃ TASK> trong docs/plan/TASKS.md.

1. Đọc theo thứ tự:
   - docs/plan/REQUIREMENTS.md: dòng REQ của task này (cột REQ trong TASKS.md) và dòng tương ứng trong docs/plan/REGISTRATION_V2.md.
   - docs/plan/TASKS.md: dòng của task, các task ở cột "Cần xong trước", Definition of Done, mục "Luật task phát sinh" trong START_HERE.md.
   - docs/plan/DECISIONS.md, docs/plan/DESIGN.md (mục liên quan, nhất là mục 7 "Bẫy trong code"), CLAUDE.md.
2. Kiểm tra:
   - Task có cột REQ chưa. Chưa có thì dừng và báo tôi.
   - Các task phụ thuộc đã Done chưa. Chưa thì dừng và báo tôi.
3. Đổi trạng thái task sang Doing. Tạo nhánh feat/<mã>-<tên-ngắn>.
4. Đọc code liên quan, rồi gửi tôi, gom trong một lần, chưa code:
   - Một câu: task này giúp đáp ứng dòng nào của đơn V3 và đóng góp phần nào cho REQ đó.
   - Kế hoạch thay đổi (file nào, làm gì).
   - Việc phát sinh đã thấy khi đọc code, mỗi việc kèm REQ và loại (bat-buoc / chi-tiet / ngoai-don / no-ky-thuat).
   - Mọi câu hỏi còn mở.
5. Sau khi tôi trả lời: code, viết test, chạy npm test.
   Giữ phạm vi:
   - Chỉ làm đủ cột "Xong khi". Không chạm REQ khác trong cùng PR.
   - Gặp việc mới giữa chừng: dừng, phân loại theo "Luật task phát sinh".
     Chỉ làm luôn nếu là bat-buoc VÀ là "sửa nhỏ" (không thêm model/route/
     collection mới, không đổi API đã có, sửa ≤ 3 file không tính test).
     Còn lại ghi vào "Đề xuất thay đổi kế hoạch" và làm tiếp phần chính.
   - Thấy yêu cầu trong đơn V3 chưa có task: ghi đề xuất loại chi-tiet, không tự làm.
6. Đối chiếu từng ý trong cột "Xong khi" và Definition of Done, báo ý nào đạt, ý nào chưa.
7. Cập nhật:
   - TASKS.md: trạng thái Review.
   - REQUIREMENTS.md: với mỗi REQ của task, nếu mọi task của REQ đó đã Review/Done thì ghi chú "chờ kiểm tra Prompt F".
   - DECISIONS.md mục "Nhật ký quyết định mới" nếu có quyết định mới.
   - Tài liệu theo DoD.
   Mở PR có tên bắt đầu bằng mã task; mô tả PR có dòng "REQ: <mã, mã>".
8. Nếu thấy mô tả task sai so với code: không tự đổi phạm vi; ghi vào "Đề xuất thay đổi kế hoạch" (có REQ và loại) và báo tôi.
9. Cuối phiên, báo ngắn: REQ đã chạm tới, việc phát sinh đã làm luôn (kèm lý do là bat-buoc và sửa nhỏ), đề xuất đã ghi.
```

## Prompt B: kiểm tra đóng một giai đoạn

Chạy ở **phiên mới**, khi mọi task của giai đoạn đã `Done`.

```
Kiểm tra giai đoạn <N> trong docs/plan/TASKS.md. Không sửa code.

1. Với từng task của giai đoạn: đối chiếu code hiện tại với cột "Xong khi" và Definition of Done. Liệt kê task nào chưa đạt và vì sao (kèm file, dòng).
2. Với từng REQ mà giai đoạn này chạm tới (theo cột REQ): đọc dòng đó trong docs/plan/REGISTRATION_V2.md và trả lời "người dùng đã làm được đúng điều đơn viết chưa?". Ghi rõ phần nào của câu trong đơn chưa làm được, kể cả khi mọi task đã Done.
3. Kiểm tra các bẫy liên quan trong docs/plan/DESIGN.md mục 7 đã được xử lý chưa.
4. Viết hướng dẫn từng bước để tôi chạy thử câu "Cổng" của giai đoạn trên staging (tài khoản, thao tác, kết quả mong đợi).
5. Nếu có task chưa đạt: đổi trạng thái về Doing và ghi lý do vào "Ghi chú Blocked".
   Nếu REQ chưa đạt mà không task nào chịu trách nhiệm: ghi "Đề xuất thay đổi kế hoạch" loại chi-tiet.
```

## Prompt C: tìm việc tiếp theo

```
Đọc docs/plan/TASKS.md và docs/plan/REQUIREMENTS.md. Liệt kê các task đang sẵn sàng (Todo và mọi task ở cột "Cần xong trước" đã Done), nhóm theo người phụ trách, ưu tiên P0 trước. Ghi rõ task nào nằm trên đường găng và REQ của từng task. Cuối cùng liệt kê các REQ có Phủ "Thiếu" nếu còn.
```

## Prompt D: sau khi merge PR

```
PR của task <MÃ TASK> đã merge. Đổi trạng thái task này sang Done trong docs/plan/TASKS.md, rồi liệt kê các task vừa được mở khóa nhờ task này. Nếu mọi task của REQ liên quan đã Done, báo để tôi chạy Prompt F cho REQ đó.
```

## Prompt E: khi kế hoạch cần đổi

```
Đọc mục "Đề xuất thay đổi kế hoạch" trong docs/plan/TASKS.md. Với mỗi đề xuất ở trạng thái chờ:

1. Kiểm tra lại với code.
2. Kiểm tra REQ: mở dòng REQ trong docs/plan/REQUIREMENTS.md và câu tương ứng trong docs/plan/REGISTRATION_V2.md. Nếu không chỉ ra được câu nào trong đơn mà đề xuất phục vụ, đổi loại thành ngoai-don.
3. Đề xuất xử lý theo loại:
   - bat-buoc / chi-tiet: sửa mô tả task, hoặc thêm task mới với mã số tiếp theo, cùng REQ, ghi phụ thuộc và cột "Xong khi" đo được. Đề xuất mức (P0/P1/P2) và lý do.
   - ngoai-don: chuyển sang "Hướng phát triển", không tạo task.
   - no-ky-thuat: task P2 hoặc chuyển "Hướng phát triển".
4. Cho biết tác động: task mới có làm chậm cổng giai đoạn hay mốc Review nào không.

Chờ tôi đồng ý rồi mới sửa TASKS.md và REQUIREMENTS.md. Sau khi sửa, đổi trạng thái đề xuất thành "Đã duyệt" hoặc "Từ chối".
```

## Prompt F: kiểm tra độ phủ so với đơn (mỗi mốc Review)

Chạy ở **phiên mới** trước mỗi mốc trong bảng "Mốc kích hoạt", hoặc khi Prompt D báo một REQ đã xong hết task. Không sửa code.

```
Kiểm tra độ phủ của kế hoạch so với đơn đăng ký. Không sửa code.

1. Đọc docs/plan/REGISTRATION_V2.md, docs/plan/REQUIREMENTS.md, docs/plan/TASKS.md.
2. Xuất 4 danh sách:
   (a) REQ có Phủ "Thiếu": thiếu so với đơn, hội đồng sẽ hỏi.
   (b) Task không có REQ hoặc REQ không tồn tại: có thể đang lệch hướng.
   (c) REQ có task nhưng chưa task nào Done: rủi ro tiến độ, ghi task trên đường găng.
   (d) REQ mà mọi task đã Done: đối chiếu cột "Đạt khi" trong REQUIREMENTS.md; chỉ đánh "Đạt" khi có bằng chứng (file, test, hoặc bước chạy thử trên staging). Không đủ bằng chứng thì ghi "Chưa xác nhận".
   (e) Task gắn NEN: liệt kê riêng, kèm REQ mà nó mở đường, để Janet xem có task nào gắn NEN cho qua không. Liệt kê riêng cả các task gắn NEN (*).
3. Kiểm tra mục "Hướng phát triển": có mục nào thật ra phục vụ một REQ không. Có thì đề xuất chuyển lại.
4. Với NFR-01..NFR-06: ghi số đo đã có trong docs/report/nfr-results.md. Chưa đo thì ghi "Chưa đo", không ước lượng.
5. Cập nhật cột Phủ và Ghi chú trong REQUIREMENTS.md theo kết quả (chỉ cột này).
6. Viết tóm tắt 10 dòng dùng cho BM02 Self-Review và BM03 Record of Changes:
   số REQ đạt / có task / thiếu, các thay đổi phạm vi đã duyệt từ lần kiểm tra trước, rủi ro lớn nhất.
```

## Quy tắc giữ không sót task và không lệch hướng

- Không giao agent cả một giai đoạn trong một phiên.
- Mỗi task gắn ít nhất một REQ; task không có REQ thì không làm. Việc không chỉ ra được REQ thì vào "Hướng phát triển".
- Mọi câu trả lời có giá trị lâu dài phải nằm trong `DECISIONS.md`, không chỉ trong chat.
- Mỗi giai đoạn đóng bằng Prompt B ở phiên mới, không để agent tự chấm bài vừa làm.
- Trước mỗi mốc Review chạy Prompt F; kết quả dùng luôn cho BM02, BM03.
- Trạng thái chỉ đổi trong `TASKS.md`. Tài liệu trên claude.ai dùng để đọc và bàn, cập nhật sau.
- Đầu mỗi buổi làm việc nhóm: chạy Prompt C để mỗi người biết việc của mình.

## Việc đầu tiên nên giao

0. **Prompt 0** (Janet): tạo `REQUIREMENTS.md`, gắn REQ cho mọi task.
1. **LP-02** (Trầm): sửa index unique Booking + script drop/sync index.
2. **N-06** (Trầm): mở rộng enum Notification.
3. **N-02, N-03, N-04** (Văn, một phiên): đổi role, migrate, `companyId`.
4. **N-05** (Văn): Node 22 + test glob.
5. **AI-01, AI-12** (Janet): bộ 20 câu chuẩn, kind CostEvent mới.
6. **N-10** (Nhi): HITL bước 7 trên trang feedback.

## Đoạn cho CLAUDE.md

Dán vào cuối `CLAUDE.md` ở gốc repo:

```
## Kế hoạch capstone (docs/plan/)

- Phạm vi đã đăng ký: docs/plan/REGISTRATION_V2.md. Mã REQ: docs/plan/REQUIREMENTS.md.
- Tiến độ và task: docs/plan/TASKS.md (nguồn đúng duy nhất). Quyết định: docs/plan/DECISIONS.md. Thiết kế và bẫy: docs/plan/DESIGN.md.
- Thứ tự đọc trước mỗi task: REQUIREMENTS.md → TASKS.md → DECISIONS.md → DESIGN.md.
- Mỗi task gắn ít nhất một mã REQ. Task không có REQ: dừng và báo.
- Việc phát sinh: phân loại bat-buoc / chi-tiet / ngoai-don / no-ky-thuat (START_HERE.md mục "Luật task phát sinh"). Không tự thêm task vào bảng chính; ghi vào "Đề xuất thay đổi kế hoạch".
- Chỉ làm đủ cột "Xong khi". Không mở rộng sang REQ khác trong cùng PR.
- Tài liệu và code mâu thuẫn: tin code, ghi đề xuất, không tự đổi phạm vi.
- Tên role: code customer / mentor / admin / moderator / company_moderator; báo cáo Candidate / Mentor / Admin / Platform Moderator / Company Moderator.
```
