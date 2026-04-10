# Flow 2: Phỏng vấn Thử với AI (AI Mock Interview)

## 🎯 Tổng quan
Flow này cho phép người dùng luyện tập phỏng vấn với AI thông qua voice recognition, nhận phân tích hành vi real-time và feedback chi tiết từng câu trả lời.

---

## 📍 Bước 1: Thiết lập buổi phỏng vấn
**Route:** `/interview`

### 1.1. Entry Point
- User click vào **"Phỏng vấn với AI"** trên sidebar/navbar
- Hoặc từ Dashboard → Card "Bắt đầu phỏng vấn AI"

### 1.2. Chọn nguồn thông tin
User chọn một trong hai options:

#### **Option A: Sử dụng dữ liệu đã có**
- Sử dụng JD/CV đã upload từ Flow 1 (CV Analysis)
- Hiển thị preview: Vị trí, công ty, lĩnh vực
- Icon: ⚡ "Nhanh chóng - Dùng dữ liệu đã phân tích"

#### **Option B: Nhập thông tin mới**
User có thể chọn:
- **B1: Upload CV/JD mới**
  - Drag & drop hoặc browse file
  - Format hỗ trợ: PDF, DOCX
  - Tự động parse thông tin
  
- **B2: Điền form thủ công**
  - Tên công ty (text input)
  - Vị trí ứng tuyển (text input)
  - Lĩnh vực/ngành nghề (dropdown: Frontend, Backend, Full-stack, Data, AI/ML, Mobile, DevOps, QA, Product, Design...)
  - Level (dropdown: Intern, Fresher, Junior, Mid-level, Senior, Lead, Manager)

### 1.3. Preview & Confirm
- Hiển thị tóm tắt thông tin:
  - 🏢 Công ty: **Shopee**
  - 💼 Vị trí: **Senior Frontend Developer**
  - 🎯 Lĩnh vực: **Frontend Development**
  - 📊 Level: **Senior**
- Button: **"Bắt Đầu Phỏng Vấn"** (Primary CTA - Deep Purple)

### 1.4. Loading Screen
- Hiển thị AI đang chuẩn bị:
  - "🧠 AI đang phân tích JD và tạo câu hỏi phù hợp..."
  - "🎯 Tạo bộ câu hỏi cá nhân hóa cho vị trí Senior Frontend..."
  - Progress animation (1-2 giây)

---

## 📍 Bước 2: Phòng phỏng vấn ảo (Interview Room)
**Route:** `/interview/room`

### 2.1. Giao diện phòng phỏng vấn

#### 🎨 Layout
```
┌─────────────────────────────────────────────────┐
│ [Timer: 12:45] [🔴 REC] [AI đang nói] [Câu 2/5] │  ← Top bar (sticky)
├─────────────────────────────────────────────────┤
│                                                 │
│         ┌──────────────────────────┐            │
│         │                          │            │
│         │   🤖 AI Avatar           │            │  ← AI Avatar (center)
│         │   (Pulsing animation)    │            │
│         │                          │            │
│         └──────────────────────────┘            │
│                                                 │
│   ┌─────────────────────────────────────┐      │
│   │  "Hãy kể về dự án lớn nhất bạn      │      │  ← Câu hỏi hiện tại
│   │   đã tham gia và vai trò của bạn?"  │      │
│   └─────────────────────────────────────┘      │
│                                                 │
│   ┌─────────────────────────────────────┐      │
│   │ "Trong dự án X tại công ty Y,       │      │  ← Transcript real-time
│   │  tôi đảm nhận vai trò tech lead..." │      │     (User đang nói)
│   └─────────────────────────────────────┘      │
│                                                 │
│      [🎤 Nhấn để trả lời]  [Câu tiếp theo →]   │  ← Controls
└─────────────────────────────────────────────────┘
```

#### 🎛️ Các thành phần UI

**Top Bar:**
- 🔴 **REC indicator** (đỏ nhấp nháy khi recording)
- ⏱️ **Timer** (đếm tổng thời gian: 00:00)
- 🗣️ **AI Status**: "AI đang nói..." / "Đang lắng nghe..." / "Đang phân tích..."
- 📊 **Question Counter**: "Câu 2/5" (Free) hoặc "Câu 3/∞" (Pro)
- 📈 **Progress bar** (dưới top bar)

**Center Area:**
- 🤖 **AI Avatar**
  - Animated gradient sphere
  - Pulsing effect khi AI đang nói
  - Waveform animation theo giọng nói AI
  - Color: Deep Purple (#6E35E8)

- 💬 **Question Card**
  - Background: White với subtle shadow
  - Font: Large, bold, readable
  - Icon theo loại câu hỏi (💼 Technical, 🧩 Problem-solving, 🎯 Behavioral, 🚀 Career Goal)

- 📝 **Transcript Box**
  - Real-time transcription (STT)
  - Text màu xám nhạt cho interim
  - Text đậm hơn khi finalized
  - Auto-scroll khi text dài
  - Placeholder: "Câu trả lời của bạn sẽ hiển thị ở đây..."

**Bottom Controls:**
- 🎤 **Mic Button**
  - Lớn, circular, ở giữa
  - State:
    - **Idle**: Gray, icon Microphone
    - **Recording**: Red pulsing, icon MicrophoneSlash
    - **Disabled**: Gray opacity 50%
  - Click to start/stop recording

- ▶️ **Next Question Button**
  - Chỉ enabled khi user đã trả lời xong (có transcript)
  - Label: "Câu tiếp theo →"
  - Color: Purple
  - Disabled state: Gray

- 🔇 **Mute AI Voice** (optional toggle)
  - Icon: SpeakerHigh / SpeakerX
  - Tắt TTS nếu user không muốn nghe AI nói

- ⏸️ **Pause Interview** (optional)
  - Dừng tạm thời, lưu progress
  - Resume sau

### 2.2. Quy trình phỏng vấn

#### 🎬 Phase 1: Intro
1. **AI Greeting** (TTS voice):
   ```
   "Xin chào bạn! Tôi là AI Interviewer của ProInterview. 
    Hôm nay chúng ta sẽ tiến hành một buổi phỏng vấn mô phỏng 
    với 5 câu hỏi thực tế.
    
    Đây là cách thức hoạt động:
    - Sau mỗi câu hỏi, bạn nhấn nút micro màu đỏ ở phía dưới 
      để bắt đầu ghi âm câu trả lời.
    - Hệ thống sẽ chuyển giọng nói của bạn thành văn bản 
      theo thời gian thực.
    - Khi trả lời xong, nhấn lại nút micro để dừng ghi âm, 
      rồi nhấn 'Câu tiếp theo'.
    - Sau buổi phỏng vấn, bạn sẽ nhận được đánh giá chi tiết 
      kèm toàn bộ nội dung câu trả lời.
    
    Sẵn sàng chưa? Bắt đầu nhé!"
   ```

2. Button **"Bắt đầu"** xuất hiện
3. Click → Chuyển sang Phase 2

#### 🎤 Phase 2: Questions Loop (Câu 1 → 5)

**Cho mỗi câu hỏi:**

1. **AI đọc câu hỏi** (TTS):
   - Avatar pulsing
   - Hiển thị text câu hỏi đồng thời
   - Status: "AI đang nói..."
   - Duration: 3-5 giây

2. **AI chờ user trả lời**:
   - Status: "Đang lắng nghe..."
   - Mic button sáng lên (enabled)
   - Placeholder: "Nhấn 🎤 để bắt đầu trả lời"

3. **User click Mic → Bắt đầu recording**:
   - Mic button → Red pulsing
   - Status: "🔴 Đang ghi âm..."
   - STT (Speech-to-Text) bật:
     - **Web Speech API** (Chrome) hoặc
     - **Whisper API** (fallback)
   - Real-time transcription hiển thị trong Transcript Box
     - Interim results: màu xám nhạt, italic
     - Final results: màu đen, bold

4. **User click Mic lại → Dừng recording**:
   - Mic button → Gray
   - Status: "Đang xử lý..."
   - Finalize transcript
   - Button "Câu tiếp theo" → Enabled (purple)

5. **AI phản hồi ngắn** (TTS):
   - Ngẫu nhiên một trong các câu:
     - "Tốt, em hiểu rồi."
     - "Cảm ơn bạn. Câu tiếp theo nhé."
     - "Được rồi, chúng ta sang câu hỏi khác."
     - "OK, noted. Tiếp tục nào."
   - Duration: 1-2 giây

6. **User click "Câu tiếp theo"**:
   - Save transcript vào sessionStorage:
     ```js
     sessionStorage.setItem('prointerview_transcripts', JSON.stringify([
       "Transcript câu 1...",
       "Transcript câu 2...",
       // ...
     ]))
     ```
   - Reset transcript box
   - Tăng question counter
   - Loop lại từ bước 1 cho câu hỏi tiếp theo

7. **Follow-up questions** (Optional - Pro plan):
   - Nếu AI phát hiện câu trả lời chưa đủ thông tin
   - AI có thể hỏi thêm:
     - "Bạn có thể nói cụ thể hơn về phần X không?"
     - "Kết quả cuối cùng của dự án là gì?"
   - Giới hạn: Tối đa 1 follow-up/câu chính

#### 🏁 Phase 3: End Interview
1. Sau câu hỏi cuối cùng (câu 5 cho Free, hoặc user click "Kết thúc sớm")
2. **AI closing** (TTS):
   ```
   "Tuyệt vời! Chúng ta đã hoàn thành buổi phỏng vấn. 
    Bạn đã làm rất tốt. 
    Hệ thống đang phân tích câu trả lời của bạn để đưa ra 
    feedback chi tiết. 
    Xin vui lòng chờ trong giây lát..."
   ```

3. **Processing screen**:
   - Animation: AI analyzing
   - Text:
     - "🧠 Phân tích nội dung câu trả lời..."
     - "📊 Đánh giá STAR structure..."
     - "🎯 Tính điểm Clarity, Relevance, Credibility..."
     - "📈 Tạo gợi ý cải thiện..."
   - Duration: 2-3 giây (fake loading cho UX)

4. **Navigate to Feedback page**:
   ```js
   navigate('/interview/feedback')
   ```

### 2.3. Phân tích đồng thời (Background Analysis)

Trong khi user trả lời, AI phân tích:

#### 📹 **Behavioral Analysis** (Chỉ Pro plan có camera):
- ❌ **Free plan**: Không có camera, bỏ qua phần này
- ✅ **Pro plan**:
  - **Eye Contact**: % thời gian nhìn vào camera
  - **Blink Rate**: Số lần nhấp nháy/phút (detect stress)
  - **Facial Expressions**: Tự tin, lo lắng, ngập ngừng
  - **Posture**: Ngồi thẳng, dựa vào ghế, vươn vai
  - **Body Language**: Chạm tay lên mặt, gãi đầu, fidgeting
  - **Tech**: TensorFlow.js hoặc MediaPipe (client-side)

#### 🗣️ **Verbal Analysis** (Tất cả plans):
- **Nội dung**:
  - **Clarity**: Rõ ràng, dễ hiểu (1-5)
  - **Structure (STAR)**: Có Situation-Task-Action-Result không? (1-5)
  - **Relevance**: Liên quan đến JD/câu hỏi (1-5)
  - **Credibility**: Thuyết phục, có ví dụ cụ thể (1-5)
  
- **Speaking Quality**:
  - **Pace**: Tốc độ nói (từ/phút)
    - Chậm: < 120
    - Vừa: 120-160 ✅
    - Nhanh: 160-180 ⚠️
    - Quá nhanh: > 180 ❌
  - **Filler Words**: Đếm "ừm", "à", "uhh", "thì", "kiểu"...
  - **Pauses**: Phát hiện khoảng lặng > 3 giây (suy nghĩ, ngập ngừng)
  - **Tone**: Tự tin, lo lắng, monotone

- **Tech Stack**:
  - STT: Web Speech API (Chrome) hoặc Whisper API
  - NLP: OpenAI GPT-4 hoặc custom model
  - Analysis: Real-time hoặc post-processing

---

## 📍 Bước 3: Nhận Feedback Chi Tiết
**Route:** `/interview/feedback`

### 3.1. Layout Overview
```
┌──────────────────────────────────────────────┐
│  [← Thực hiện buổi phỏng vấn mới]            │
│                                              │
│  ✅ Hoàn thành phỏng vấn                     │
│  # Kết quả phỏng vấn của bạn                 │
│  Frontend Developer @ Shopee · 32 phút · 5 câu│
├──────────────────────────────────────────────┤
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  📊 TỔNG ĐIỂM: 4.0/5 ⭐⭐⭐⭐           │ │  ← Overall Score Banner
│  │  Clarity: 4.0 | Structure: 3.8 ...    │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  🎯 Verbal Performance                 │ │  ← Section A
│  │  ├─ Clarity: 4/5                       │ │
│  │  ├─ Structure (STAR): 3/5              │ │
│  │  └─ ...                                │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  🎭 Behavioral Performance (Pro)       │ │  ← Section B (Pro only)
│  │  ├─ Eye Contact: 3/5                   │ │
│  │  └─ ...                                │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  🗣️ Speaking Quality                  │ │  ← Section C
│  │  ├─ Pace: 3/5                          │ │
│  │  └─ Filler Words: ⚠️                   │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  📝 Phân tích từng câu trả lời (5)     │ │  ← Section D
│  │                                        │ │
│  │  [Accordion] Câu 1: Giới thiệu bản...  │ │
│  │  └─ ⭐ 4.0/5                           │ │
│  │     ├─ ✅ Điểm mạnh                    │ │
│  │     ├─ ⚠️ Cần cải thiện                │ │
│  │     ├─ 💡 Gợi ý câu trả lời tốt hơn   │ │
│  │     └─ 📄 Transcript: "Tôi là..."     │ │
│  │                                        │ │
│  │  [Accordion] Câu 2: Dự án khó khăn...  │ │
│  │  ...                                   │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  ┌────────────────────────────────────────┐ │
│  │  🚀 Đề xuất hành động tiếp theo        │ │  ← Section E
│  │  ├─ 📚 Kỹ năng cần luyện               │ │
│  │  ├─ 🔄 Câu hỏi nên ôn lại              │ │
│  │  └─ 🔗 Tài liệu tham khảo              │ │
│  └────────────────────────────────────────┘ │
│                                              │
│  [⬇️ Tải báo cáo PDF]  [🔄 Phỏng vấn lại]  │  ← Actions
└──────────────────────────────────────────────┘
```

### 3.2. Section A: Điểm Tổng Quan

#### 🎯 **A1. Overall Score Banner**
- **Background**: Gradient Purple (#6E35E8 → #9B6DFF)
- **Layout**:
  ```
  ┌─────────────────────────────────────────────┐
  │                                             │
  │         📊 TỔNG ĐIỂM: 4.0/5                 │
  │         ⭐⭐⭐⭐☆                            │
  │                                             │
  │  Clarity: 4.0  Structure: 3.8  Relevance: 4.5│
  │  Credibility: 3.5                           │
  │                                             │
  │  🎯 Bạn đã làm rất tốt! Một vài điểm nhỏ   │
  │     cần cải thiện về cấu trúc STAR.         │
  └─────────────────────────────────────────────┘
  ```

#### 🗣️ **A2. Verbal Performance**
Card màu trắng, border subtle:

```
📊 Verbal Performance (Nội dung câu trả lời)

┌─ Clarity (Rõ ràng) ──────────────────┐
│  4.0/5 ⭐⭐⭐⭐☆                      │
│  [████████████████░░░░] 80%          │
│  💬 "Câu trả lời rõ ràng, dễ hiểu,   │
│      nhưng có một vài chỗ hơi lan man"│
└──────────────────────────────────────┘

┌─ Structure (STAR) ───────────────────┐
│  3.0/5 ⭐⭐⭐☆☆                      │
│  [████████████░░░░░░░░] 60%          │
│  ⚠️ "Thiếu phần Result rõ ràng.      │
│      Nên kết thúc bằng con số/thành  │
│      tích cụ thể"                     │
└──────────────────────────────────────┘

┌─ Relevance (Liên quan JD) ───────────┐
│  4.5/5 ⭐⭐⭐⭐⭐                     │
│  [██████████████████░░] 90%          │
│  ✅ "Câu trả lời rất match với yêu   │
│      cầu JD về React/TypeScript"      │
└──────────────────────────────────────┘

┌─ Credibility (Thuyết phục) ──────────┐
│  3.5/5 ⭐⭐⭐⭐☆                     │
│  [██████████████░░░░░░] 70%          │
│  💡 "Có ví dụ cụ thể nhưng thiếu số  │
│      liệu. Thêm metrics sẽ tốt hơn"   │
└──────────────────────────────────────┘
```

#### 🎭 **A3. Behavioral Performance** (Pro plan only)
Card màu trắng, badge "PRO":

```
🎭 Behavioral Performance (Hành vi & Ngôn ngữ cơ thể) 🔒 PRO

┌─ Eye Contact ────────────────────────┐
│  3.5/5 ⭐⭐⭐⭐☆                     │
│  [██████████████░░░░░░] 70%          │
│  👁️ "Nhìn xuống 45% thời gian.       │
│      Nên duy trì eye contact 60-70%   │
│      để tạo sự tự tin"                │
└──────────────────────────────────────┘

┌─ Nervous Habits ─────────────────────┐
│  4.0/5 ⭐⭐⭐⭐☆                     │
│  [████████████████░░░░] 80%          │
│  😌 Nhấp nháy: 28 lần/phút           │
│     (Bình thường: 15-20, hơi nervous) │
│  ✋ Chạm tay lên mặt: 7 lần           │
│     (Nên hạn chế gesture này)         │
└──────────────────────────────────────┘

┌─ Posture ────────────────────────────┐
│  4.5/5 ⭐⭐⭐⭐⭐                     │
│  [██████████████████░░] 90%          │
│  ✅ "Tư thế ngồi thẳng, chuyên nghiệp │
│      trong suốt buổi phỏng vấn"       │
└──────────────────────────────────────┘
```

#### 🗣️ **A4. Speaking Quality**
Card màu trắng:

```
🗣️ Speaking Quality (Chất lượng giọng nói)

┌─ Pace (Tốc độ nói) ──────────────────┐
│  3.5/5 ⭐⭐⭐⭐☆                     │
│  [██████████████░░░░░░] 70%          │
│  ⚡ 180 từ/phút (Hơi nhanh)          │
│     Nên giảm xuống 140-160 từ/phút    │
│     để nghe rõ ràng hơn               │
└──────────────────────────────────────┘

┌─ Filler Words (Từ đệm) ──────────────┐
│  3.0/5 ⭐⭐⭐☆☆                      │
│  [████████████░░░░░░░░] 60%          │
│  ⚠️ Phát hiện:                       │
│     • "Ừm": 12 lần                    │
│     • "À": 8 lần                      │
│     • "Thì": 15 lần                   │
│  💡 Luyện tập pause thay vì dùng filler│
└──────────────────────────────────────┘

┌─ Pauses (Khoảng lặng) ───────────────┐
│  4.0/5 ⭐⭐⭐⭐☆                     │
│  ✅ 3 khoảng lặng > 3s (Bình thường) │
│     Pause để suy nghĩ là OK           │
└──────────────────────────────────────┘
```

### 3.3. Section B: Phân tích từng câu trả lời

Accordion list, mỗi câu hỏi là một accordion item:

```
📝 Phân tích từng câu trả lời (5 câu)

┌─────────────────────────────────────────────┐
│  [▼] Câu 1: Giới thiệu về bản thân          │ ⭐ 4.0/5
├─────────────────────────────────────────────┤
│  📊 Chi tiết điểm số:                       │
│    • Clarity: 4/5                           │
│    • Structure: 4/5                         │
│    • Relevance: 4.5/5                       │
│    • Credibility: 3.5/5                     │
│                                             │
│  ✅ Điểm mạnh:                              │
│    • Giới thiệu rõ ràng, có cấu trúc        │
│    • Nêu được điểm mạnh liên quan đến JD    │
│                                             │
│  ⚠️ Điểm cần cải thiện:                     │
│    • Cần cụ thể hơn về thành tích có số liệu│
│    • Phần kết luận chưa đủ impact           │
│                                             │
│  💡 Gợi ý câu trả lời tốt hơn:              │
│    "Thay vì nói 'tôi là người chăm chỉ',   │
│     hãy nói: 'Trong 2 năm tại Công ty X,   │
│     tôi đã hoàn thành 95% sprint đúng      │
│     deadline và được đánh giá performance  │
│     Exceeds Expectations 2 quý liên tiếp.'"│
│                                             │
│  📄 Transcript của bạn:                     │
│  ┌─────────────────────────────────────┐   │
│  │ "Tôi là một Frontend Developer với  │   │
│  │  3 năm kinh nghiệm, chuyên về React │   │
│  │  và TypeScript. Tôi đã từng làm việc│   │
│  │  tại 2 công ty startup và 1 product │   │
│  │  company lớn. Điểm mạnh của tôi là  │   │
│  │  khả năng học nhanh và teamwork tốt.│   │
│  │  Tôi mong muốn được làm việc tại    │   │
│  │  Shopee để phát triển kỹ năng..."   │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  [👂 Nghe lại] [📋 Copy transcript]         │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  [►] Câu 2: Dự án khó khăn nhất             │ ⭐ 3.3/5
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  [►] Câu 3: Tại sao muốn làm tại Shopee     │ ⭐ 4.2/5
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  [►] Câu 4: Điểm yếu của bạn                │ ⭐ 3.8/5
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  [►] Câu 5: Mục tiêu 5 năm tới              │ ⭐ 4.3/5
└─────────────────────────────────────────────┘
```

### 3.4. Section C: Đề xuất hành động tiếp theo

Card màu Lime Green gradient (accent color):

```
🚀 Đề xuất hành động tiếp theo

┌─ 📚 Kỹ năng cần luyện thêm ──────────────────┐
│  1. STAR structure (Câu 2, 4)                │
│     → Đọc: "Cách trả lời phỏng vấn theo STAR"│
│  2. Giảm filler words                        │
│     → Luyện tập: Record & review hàng ngày   │
│  3. Nói chậm lại (từ 180 → 150 wpm)          │
│     → Tip: Thở sâu trước khi nói             │
└──────────────────────────────────────────────┘

┌─ 🔄 Câu hỏi nên ôn lại ─────────────────────┐
│  • Câu 2: Dự án khó khăn (Score: 3.3/5) ⚠️  │
│    → Chuẩn bị STAR structure rõ hơn          │
│  • Câu 4: Điểm yếu (Score: 3.8/5)            │
│    → Tránh câu trả lời "safe" giả tạo        │
└──────────────────────────────────────────────┘

┌─ 🔗 Tài liệu tham khảo ──────────────────────┐
│  📖 "STAR Method: Hướng dẫn chi tiết"        │
│     → blog.prointerview.vn/star-method       │
│  🎥 "Top 10 câu hỏi phỏng vấn Frontend"      │
│     → youtube.com/watch?v=xxx                │
│  📚 "Cách giảm filler words hiệu quả"        │
│     → blog.prointerview.vn/filler-words      │
└──────────────────────────────────────────────┘
```

### 3.5. Action Buttons

Sticky bottom bar hoặc inline buttons:

```
┌──────────────────────────────────────────────┐
│  [⬇️ Tải báo cáo PDF]                        │
│  [📊 So sánh với lần trước]                  │
│  [🔄 Phỏng vấn lại với JD này]               │
│  [🏠 Về Dashboard]                           │
└──────────────────────────────────────────────┘
```

**Button actions:**
- **Tải báo cáo PDF**: Export toàn bộ feedback + transcripts ra file PDF
- **So sánh với lần trước**: Nếu đã làm interview với JD tương tự, hiển thị chart tiến bộ
- **Phỏng vấn lại**: Navigate về `/interview` với pre-fill thông tin
- **Về Dashboard**: Navigate `/dashboard`

---

## 📍 Bước 4: Lưu vào Lịch Sử
**Auto-save khi hoàn thành**

### 4.1. Data Structure
Lưu vào localStorage hoặc database (nếu có backend):

```json
{
  "id": "interview_20260228_1234567",
  "timestamp": "2026-02-28T14:30:00Z",
  "duration": "32 phút",
  "metadata": {
    "company": "Shopee",
    "position": "Senior Frontend Developer",
    "field": "Frontend Development",
    "level": "Senior"
  },
  "questions": [
    {
      "id": 1,
      "question": "Giới thiệu về bản thân và điểm mạnh nổi bật nhất của bạn?",
      "transcript": "Tôi là một Frontend Developer với 3 năm kinh nghiệm...",
      "scores": {
        "clarity": 4.0,
        "structure": 4.0,
        "relevance": 4.5,
        "credibility": 3.5
      },
      "overall": 4.0,
      "strengths": ["Giới thiệu rõ ràng, có cấu trúc", "Nêu được điểm mạnh liên quan đến JD"],
      "improvements": ["Cần cụ thể hơn về thành tích có số liệu", "Phần kết luận chưa impact"],
      "suggestion": "Thay vì nói 'tôi là người chăm chỉ', hãy nói: '...'",
      "audio": "blob://..." // optional
    }
    // ... 4 câu khác
  ],
  "overallScores": {
    "clarity": 4.0,
    "structure": 3.8,
    "relevance": 4.3,
    "credibility": 3.7,
    "overall": 4.0
  },
  "behavioral": { // Pro only
    "eyeContact": 3.5,
    "nervousHabits": 4.0,
    "posture": 4.5
  },
  "speaking": {
    "pace": 3.5,
    "fillerWords": 3.0,
    "pauses": 4.0
  },
  "recommendations": [
    "Luyện STAR structure",
    "Giảm filler words",
    "Nói chậm lại"
  ]
}
```

### 4.2. Hiển thị trong Dashboard

Trong `/dashboard`:

```
📊 Lịch sử phỏng vấn

┌─────────────────────────────────────────────┐
│  Frontend Developer @ Shopee               │
│  28/02/2026 · 32 phút · ⭐ 4.0/5           │
│  [Xem chi tiết]                            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Backend Engineer @ Grab                   │
│  25/02/2026 · 28 phút · ⭐ 3.7/5           │
│  [Xem chi tiết]                            │
└─────────────────────────────────────────────┘
```

Click "Xem chi tiết" → Navigate to `/interview/feedback?id=interview_20260228_1234567`

### 4.3. Progress Chart

Trong Dashboard, hiển thị chart tiến bộ:

```
📈 Tiến bộ của bạn (7 ngày qua)

     ⭐
  5  │           ●
  4  │       ●       ●
  3  │   ●               ●
  2  │
  1  │
     └───────────────────────
       T2  T3  T4  T5  T6  T7  CN

  Clarity: ▲ +0.5
  Structure: ▲ +0.8
  Pace: ▼ -0.2 (cần cải thiện)
```

---

## 📍 Bước 5: Theo dõi đường cong tiến bộ
**Route:** `/dashboard` hoặc `/analytics`

### 5.1. Progress Dashboard

```
📊 Analytics & Insights

┌─ Tổng quan ──────────────────────────────────┐
│  Tổng số buổi: 15                            │
│  Điểm trung bình: 3.8/5 ⭐⭐⭐⭐☆          │
│  Cải thiện: +71% (so với lần đầu)            │
│  Streak: 🔥 5 ngày                           │
└──────────────────────────────────────────────┘

┌─ Breakdown by Skill ─────────────────────────┐
│  Clarity:       ████████████░░ 4.0/5         │
│  Structure:     ██████████░░░░ 3.5/5 ⚠️     │
│  Relevance:     ██████████████░ 4.3/5        │
│  Credibility:   ████████████░░ 3.8/5         │
└──────────────────────────────────────────────┘

┌─ Recommendations ────────────────────────────┐
│  🎯 Focus area: Structure (STAR)             │
│  📚 Suggested reading: [Link]                │
│  🎥 Video tutorial: [Link]                   │
└──────────────────────────────────────────────┘
```

### 5.2. Comparison View

So sánh 2 lần phỏng vấn:

```
📊 So sánh: 25/02 vs 28/02

             25/02   28/02   Thay đổi
Clarity        3.5     4.0    +0.5 ▲
Structure      3.0     3.8    +0.8 ▲▲
Relevance      4.0     4.3    +0.3 ▲
Credibility    3.8     3.7    -0.1 ▼
Overall        3.6     4.0    +0.4 ▲

🎉 Bạn đã cải thiện 11% so với lần trước!
```

---

## 🔒 Free vs Pro Plan

### Free Plan Limitations:
- ❌ Chỉ 2 buổi AI Interview thử nghiệm
- ❌ 5 câu hỏi cố định (không customize)
- ❌ Không có Behavioral analysis (camera)
- ❌ Feedback tổng quan (không chi tiết từng câu)
- ❌ Không lưu lịch sử vĩnh viễn (chỉ 7 ngày)
- ❌ Không export PDF

### Pro Plan Features:
- ✅ Unlimited AI Interviews
- ✅ Customize số câu hỏi (5-20)
- ✅ Behavioral analysis với camera
- ✅ Feedback chi tiết từng câu + gợi ý mẫu
- ✅ Lịch sử vĩnh viễn
- ✅ Export PDF
- ✅ Progress chart & analytics
- ✅ Follow-up questions
- ✅ AI Voice 2.0 (tự nhiên hơn)
- ✅ Priority support

---

## 🎯 Success Metrics

### UX Goals:
- ✅ User hoàn thành buổi phỏng vấn trong < 30 phút
- ✅ Feedback dễ hiểu, actionable
- ✅ STT accuracy > 95% (tiếng Việt)
- ✅ TTS voice tự nhiên, không robot

### Business Goals:
- 📈 Free → Pro conversion: Target 20%
- 📈 User retention: 70% quay lại sau 7 ngày
- 📈 Interview completion rate: > 85%

---

## 🛠️ Tech Stack Recommendations

### Frontend:
- **React** + TypeScript
- **Web Speech API** (STT - Chrome)
  - Fallback: Whisper API (OpenAI)
- **Speech Synthesis API** (TTS)
  - Fallback: ElevenLabs / Google TTS
- **MediaPipe** (Camera analysis - Pro)
- **Recharts** (Progress charts)

### Backend (Optional - nếu có):
- **Node.js** / Python FastAPI
- **OpenAI GPT-4** (NLP analysis)
- **PostgreSQL** / Supabase (lưu lịch sử)
- **AWS S3** (lưu audio recordings)

### Storage:
- **sessionStorage**: Lưu transcript tạm trong buổi interview
- **localStorage**: Lưu lịch sử interviews (nếu không có backend)
- **Database**: Lưu lâu dài (Pro plan)

---

## ✅ Checklist Implementation

### Phase 1: Core Features
- [ ] Interview Setup page (`/interview`)
  - [ ] Option A: Sử dụng JD/CV đã có
  - [ ] Option B: Upload mới / Form thủ công
  - [ ] Preview & Confirm
- [ ] Interview Room (`/interview/room`)
  - [ ] AI Avatar + Animation
  - [ ] TTS: AI greeting
  - [ ] STT: Voice recognition
  - [ ] Real-time transcript
  - [ ] Question loop (5 câu)
  - [ ] Timer & Progress bar
- [ ] Feedback Page (`/interview/feedback`)
  - [ ] Overall score banner
  - [ ] Verbal performance scores
  - [ ] Speaking quality analysis
  - [ ] Per-question breakdown (accordion)
  - [ ] Recommendations

### Phase 2: Advanced Features
- [ ] Behavioral Analysis (Pro)
  - [ ] Camera permission
  - [ ] Eye contact tracking
  - [ ] Facial expression analysis
  - [ ] Posture detection
- [ ] Follow-up questions
- [ ] Export PDF
- [ ] Progress chart
- [ ] Comparison view

### Phase 3: Polish
- [ ] Loading states
- [ ] Error handling (STT fail, mic permission denied...)
- [ ] Mobile responsive
- [ ] Dark mode
- [ ] i18n (Tiếng Việt + English)

---

## 📝 Notes

### Edge Cases:
- **Mic không hoạt động**: Hiển thị error + hướng dẫn enable
- **Browser không hỗ trợ STT**: Fallback to Whisper API hoặc text input
- **Network slow**: Hiển thị loading state, retry
- **User thoát giữa chừng**: Auto-save progress, cho phép resume

### UX Improvements:
- **Keyboard shortcuts**: Space = Start/Stop recording, Enter = Next question
- **Pause/Resume**: User có thể pause buổi interview
- **Practice mode**: Không lưu kết quả, chỉ để luyện tập
- **Question preview**: Hiển thị 5 câu hỏi trước khi bắt đầu

---

**End of Document** 🎉
