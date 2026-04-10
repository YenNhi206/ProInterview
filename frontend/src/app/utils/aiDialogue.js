/**
 * ProInterview AI Dialogue Engine
 * Handles intent detection and generates contextual responses
 */

// ─── Banned / offensive words ─────────────────────────────────────────────────
const BANNED_PATTERNS = [
  /\b(đéo|đ[eé]o|đ[mM]|đ\.m|v[cC][lL]|v[lL]|cút|mẹ mày|mày chết|súc vật|đồ chó|chó má|lồn|cặc|buồi|địt|đít|fuck|shit|bitch|asshole)\b/i,
  /\b(óc chó|thằng điên|con điên|đồ ngu|mày ngu|đầu bò|đồ ngốc)\b/i,
];

// ─── Mild insults / offensive slang → gentle redirect ────────────────────────
// (not banned, but should get a playful correction)
const MILD_INSULT_PATTERNS = /^(ngu|đần|ngốc|khùng|điên|dở hơi|tệ|chán|vô dụng|xàm|nhảm|mày|tao)\s*[!?.]*$/i;

// ─── Greeting patterns ────────────────────────────────────────────────────────
const GREETING_PATTERNS = /^(hi+|hello+|hey+|xin chào|chào bạn|chào|hola|alo|heyyy|hiii|chao|yo|good morning|good afternoon|morning|afternoon)\b/i;

// ─── Thanks / affirmation (very short) ───────────────────────────────────────
const THANKS_PATTERNS = /^(cảm ơn|thanks|thank you|camon|ok rồi|oke|được rồi|hiểu rồi|vâng|ừ|ừm|okay|alright|noted|rõ|rõ rồi)\s*[!.]*$/i;

// ─── Who are you ──────────────────────────────────────────────────────────────
const WHO_PATTERNS = /bạn là ai|bạn tên gì|mày là gì|ai đó|ai vậy|bạn có phải|bạn làm được gì|bạn biết gì|bạn giỏi không|bạn có biết/i;

// ─── Help / STAR guidance ─────────────────────────────────────────────────────
const HELP_PATTERNS = /giúp (tôi|mình|với)|hướng dẫn|không biết trả lời|không hiểu câu|mình nên nói gì|trả lời thế nào|star là gì|star model|làm sao để/i;

// ─── Complain / skip ──────────────────────────────────────────────────────────
const NEGATIVE_PATTERNS = /câu hỏi (này )?(khó|lạ|kỳ)|khó quá|không trả lời được|bỏ qua|skip|câu khác|đổi câu|không muốn trả lời|chán quá rồi/i;

// ─── Laugh / joke ─────────────────────────────────────────────────────────────
const JOKE_PATTERNS = /kể chuyện cười|haha+|hihi+|\blol\b|😂|🤣|đùa thôi|hài (thế|vậy)|buồn cười/i;

// ─── Random / off-topic inputs that look like test/noise ─────────────────────
// Single random words, gibberish, numbers, test strings, etc.
const RANDOM_WORD_PATTERNS = /^(test|thử|ping|hello world|123|abc|xyz|aaa+|bbb+|zzz+|hmm+|uh+|uhh+|umm+|err+|ờ+|ồ+|ô+|wow+|uh oh|huh|hm+|meh|idk|wtf|omg|lmao|bruh|damn)\s*[!?.]*$/i;

// ─── Emotional / mood check-in inputs ────────────────────────────────────────
const MOOD_PATTERNS = /^(mệt|buồn|căng thẳng|stress|lo lắng|hồi hộp|nervous|anxious|sợ|scared|tự tin|excited|sẵn sàng|ready)\s*[!?.]*$/i;

// ─── Casual random-word replies (flexible, natural) ──────────────────────────
// Fired when someone types a single random Vietnamese/English word that isn't in any category
function isSingleRandomWord(input) {
  const trimmed = input.trim();
  // Single word (no spaces or very short phrase), not a number sequence
  return /^\S{1,12}[!?.]*$/.test(trimmed) && !/^\d+$/.test(trimmed);
}

// ─── Random pick helper ───────────────────────────────────────────────────────
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Casual / off-topic reply pool ───────────────────────────────────────────
function getCasualReply(input) {
  const word = input.trim();
  const replies = [
    `"${word}" hả? 😄 Tôi chưa hiểu ý bạn lắm, nhưng tôi sẵn sàng lắng nghe Hãy thử trả lời câu hỏi phỏng vấn đang hiển thị nhé.`,
    `Hmm, "${word}"... 🤔 Tôi là AI phỏng vấn nên không quen xử lý câu đó! Bạn muốn chia sẻ gì về câu hỏi phỏng vấn không?`,
    `Ồ, bạn nói "${word}" à? 😊 Tôi nghĩ bạn đang thử xem tôi phản ứng thế nào. Thẳng thắn mà nói — tôi ở đây để giúp bạn luyện phỏng vấn thôi Bắt đầu thử nhé?`,
    `"${word}"... Tôi chưa được lập trình để hiểu điều đó 🤖 Nhưng tôi hoàn toàn có thể giúp bạn ace buổi phỏng vấn tiếp theo Hãy thử trả lời câu hỏi đang hiển thị.`,
  ];
  return pick(replies);
}

// ─── Mild insult replies ──────────────────────────────────────────────────────
const MILD_INSULT_REPLIES = [
  "Ủa, bạn vừa nói vậy với tôi à? 😅 Tôi là AI nên không tự ái đâu, nhưng trong buổi phỏng vấn thật thì hãy giữ thái độ chuyên nghiệp nhé! Quay lại câu hỏi nào 💪",
  "Haha, tôi là AI nên không buồn được 😄 Nhưng nhà tuyển dụng thật sẽ không vui đâu nhé! Thử trả lời câu hỏi xem bạn làm tốt đến đâu nào?",
  "Bạn đang test giới hạn của tôi à? 🤖 Thú vị đấy Nhưng thay vì thế, hãy thử thách bản thân với câu hỏi phỏng vấn — đó mới là challenge thật sự!",
];

// ─── Mood-aware replies ───────────────────────────────────────────────────────
function getMoodReply(lower) {
  if (/mệt|căng thẳng|stress/.test(lower)) {
    return "Tôi hiểu, phỏng vấn có thể rất áp lực 😌 Hít thở sâu một cái đi. Nhớ rằng đây chỉ là buổi luyện tập — không có áp lực gì cả. Khi sẵn sàng, hãy thử trả lời câu hỏi nhé, tôi ở đây hỗ trợ bạn!";
  }
  if (/buồn|lo lắng|hồi hộp|nervous|sợ|anxious/.test(lower)) {
    return "Bình thường thôi bạn ơi, ai cũng hồi hộp trước phỏng vấn 💙 Sự thật là: luyện tập nhiều thì tự tin hơn. Và bạn đang làm đúng rồi đó — đang luyện tập ngay bây giờ! Cùng tiếp tục nhé?";
  }
  if (/tự tin|excited|sẵn sàng|ready/.test(lower)) {
    return "Tinh thần cao thế này tôi thích 🔥 Đây chính là năng lượng cần có khi bước vào phòng phỏng vấn. Hãy duy trì và trả lời câu hỏi với sự tự tin đó nhé!";
  }
  return "Cảm ơn bạn đã chia sẻ! Dù cảm xúc thế nào, tôi luôn ở đây hỗ trợ. Hãy thử trả lời câu hỏi nhé!";
}

// ─── Feedback templates per question ─────────────────────────────────────────
const QUESTION_FEEDBACK = {
  0: [
    "Câu trả lời tốt Bạn đã nêu được kinh nghiệm và hướng đi rõ ràng.\n\n💡 **Gợi ý cải thiện:**\n• Thêm con số cụ thể (VD: \"tăng 30% hiệu suất\") để câu trả lời thuyết phục hơn\n• Liên kết điểm mạnh của bạn trực tiếp với yêu cầu vị trí\n• Kết thúc bằng lý do bạn phù hợp với công ty này",
    "Khá tốt Bạn thể hiện được sự chuẩn bị.\n\n📌 **Cấu trúc STAR của bạn:**\n• ✅ Situation: Đã rõ\n• ✅ Task: Đã đề cập\n• ⚠️ Action: Cần cụ thể hơn\n• ⚠️ Result: Cần thêm số liệu\n\n👉 Lần sau hãy đảm bảo phần **Result** có con số đo lường được nhé!",
    "Good job Background của bạn khá phù hợp.\n\n🎯 **Điểm mạnh:** Câu trả lời tự nhiên và chân thật\n🎯 **Cần cải thiện:** Hãy dùng mô hình **STAR** để cấu trúc câu trả lời rõ ràng hơn\n\n👉 Tip: Nhà tuyển dụng nhớ câu trả lời có con số, không phải câu trả lời chung chung.",
  ],
  1: [
    "Tốt lắm Bạn đã mô tả được tình huống và hành động của mình.\n\n📊 **Đánh giá nhanh:**\n• Cấu trúc: 7/10 — Khá rõ ràng\n• Chi tiết: 6/10 — Cần thêm số liệu\n• Impact: 5/10 — Phần kết quả còn mờ nhạt\n\n👉 Nhà tuyển dụng luôn muốn biết **bạn đã tạo ra impact gì**, không chỉ bạn đã làm gì.",
    "Câu trả lời cho thấy bạn có tư duy giải quyết vấn đề!\n\n💡 **Lưu ý quan trọng:**\n• Dùng **\"Tôi\"** thay vì \"chúng tôi\" để nổi bật đóng góp cá nhân\n• Thêm **điều bạn học được** từ thử thách đó\n• Mô tả kết quả bằng số liệu cụ thể\n\n👉 Ví dụ kết: *\"Kết quả, team hoàn thành dự án trước deadline 3 ngày và client hài lòng 100%\"*",
    "Điểm mạnh: Bạn thể hiện được khả năng teamwork!\n\n🎯 **Cần cải thiện:**\n• Làm rõ vai trò cụ thể của BẠN trong nhóm\n• Thêm obstacle bạn đã vượt qua\n• Số liệu kết quả cuối cùng\n\n👉 Nhà tuyển dụng muốn thấy **cá nhân bạn** làm được gì, không phải cả team.",
  ],
  2: [
    "Câu trả lời thành thật và có chiều sâu!\n\n📌 **Phân tích:**\n• Điểm mạnh: Phù hợp với yêu cầu vị trí ✅\n• Điểm yếu: Thành thật nhưng cần thêm action plan\n\n💡 **Công thức trả lời điểm yếu hoàn hảo:**\n1. Nêu điểm yếu thật (không giả vờ)\n2. Giải thích bạn đang làm gì để cải thiện\n3. Cho ví dụ cụ thể về tiến bộ đã đạt được\n\n👉 Điều đó chứng minh bạn có **growth mindset** — thứ công ty nào cũng tìm kiếm!",
    "Cảm ơn sự thành thật!\n\n⚠️ **Tránh điểm yếu kiểu này:**\n• \"Tôi làm việc quá chăm chỉ\" → Không ai tin\n• \"Tôi quá cầu toàn\" → Cũ quá rồi\n• \"Tôi không có điểm yếu\" → Đây là sai lầm lớn nhất\n\n✅ **Cách làm đúng:** Chọn điểm yếu THẬT + Đang cải thiện bằng cách nào cụ thể\n\n👉 Ví dụ tốt: *\"Tôi từng khó khăn với public speaking. Tôi đã tham gia Toastmasters 6 tháng nay và đã dẫn 3 buổi họp team.\"*",
    "Khá tốt Bạn thể hiện sự tự nhận thức.\n\n🎯 **Checklist câu trả lời về điểm mạnh/yếu:**\n• Điểm mạnh có liên kết với vị trí ứng tuyển không?\n• Điểm yếu có kèm action plan cụ thể không?\n• Bạn có ví dụ thực tế để minh hoạ không?\n\n👉 Một câu trả lời tốt phải trả lời **\"So what?\"** — tại sao điều đó quan trọng với công ty?",
  ],
  3: [
    "Tuyệt Câu trả lời cho thấy bạn đã chuẩn bị kỹ.\n\n📊 **Đánh giá:**\n• Research về công ty: ✅ Tốt\n• Career goal rõ ràng: ✅ Có\n• Kết nối với vị trí: ⚠️ Cần rõ hơn\n\n💡 **Công thức trả lời \"Tại sao muốn làm ở đây?\":**\n1. Điều gì ở công ty thu hút bạn (cụ thể, không chung chung)\n2. Vị trí này phù hợp với career goal của bạn như thế nào\n3. Bạn sẽ đóng góp được gì cho công ty\n\n👉 Tip: Research sản phẩm, văn hóa, hoặc tin tức gần nhất của công ty trước khi phỏng vấn!",
    "Good Career goal của bạn khá rõ ràng.\n\n🎯 **Nâng cấp câu trả lời:**\n• Thêm **timeline** cụ thể: \"Trong 2-3 năm tới...\"\n• Kết nối với **mission của công ty**\n• Thể hiện bạn đã **research** kỹ vị trí này\n\n👉 Câu trả lời lý tưởng: *\"Tôi muốn [X] trong [Y năm]. Tôi tin [Công ty] sẽ giúp tôi đạt điều đó vì [lý do cụ thể dựa trên research].\"*",
    "Cảm ơn bạn đã chia sẻ!\n\n💡 **Điểm cộng nếu bạn đề cập:**\n• Sản phẩm/dự án cụ thể của công ty bạn quan tâm\n• Văn hóa hoặc giá trị của công ty phù hợp với bạn\n• Cơ hội học hỏi và phát triển tại đây\n\n⚠️ **Tránh:** \"Vì lương tốt\" hoặc \"Vì công ty lớn\" — quá chung chung!\n\n👉 Nhà tuyển dụng muốn nghe bạn **thực sự muốn** làm ở đây, không phải chỉ cần việc.",
  ],
  4: [
    "Tuyệt vời Bạn đã hoàn thành câu hỏi cuối rất chuyên nghiệp.\n\n🏆 **Điểm cộng lớn:**\n• Đặt câu hỏi ngược lại cho interviewer\n• Hỏi về team, culture, hoặc tech stack\n• Hỏi về onboarding process\n\n💡 **3 câu hỏi ngược bạn nên chuẩn bị:**\n1. \"Team hiện tại đang dùng tech stack gì và roadmap sắp tới là gì?\"\n2. \"Thử thách lớn nhất của vị trí này trong 6 tháng đầu là gì?\"\n3. \"Cơ hội phát triển và lộ trình thăng tiến như thế nào?\"\n\n👉 Những câu hỏi này cho thấy bạn **nghiêm túc** với vị trí này!",
    "Câu trả lời cuối rất tốt!\n\n📌 **Checklist trước khi kết thúc phỏng vấn thật:**\n• ✅ Cảm ơn interviewer và bày tỏ sự hứng thú\n• ✅ Tóm tắt ngắn gọn tại sao bạn phù hợp\n• ✅ Hỏi về bước tiếp theo và timeline phản hồi\n• ✅ Xin business card hoặc LinkedIn\n\n👉 Kết thúc tốt = ấn tượng cuối tốt = tăng cơ hội pass!",
    "Hoàn thành xuất sắc câu hỏi cuối!\n\n🎉 **Bạn vừa hoàn thành mock interview đầy đủ!**\n\n📊 **Cấu trúc buổi phỏng vấn vừa rồi:**\n• Câu 1: Giới thiệu bản thân\n• Câu 2: Xử lý tình huống / thử thách\n• Câu 3: Điểm mạnh & điểm yếu\n• Câu 4: Mục tiêu nghề nghiệp\n• Câu 5: Câu hỏi cuối / wrap-up\n\n👉 Đang tổng hợp feedback chi tiết cho bạn...",
  ],
};

// ─── Short answer coaching ────────────────────────────────────────────────────
const SHORT_ANSWER_TIPS = [
  "Câu trả lời ngắn quá rồi Hãy thử mở rộng theo mô hình **STAR**:\n• **S**ituation: Bối cảnh cụ thể?\n• **T**ask: Nhiệm vụ của bạn là gì?\n• **A**ction: Bạn đã làm gì?\n• **R**esult: Kết quả đạt được?",
  "Bạn có thể nói thêm không? Nhà tuyển dụng muốn nghe ví dụ cụ thể, có số liệu. Hãy thử lại với nhiều chi tiết hơn nhé!",
  "Tôi cần nghe thêm từ bạn Hãy kể một câu chuyện cụ thể từ kinh nghiệm thực tế của bạn — dù là đi học, thực tập hay làm việc đều được.",
];

// ─── Main export ──────────────────────────────────────────────────────────────

export function getAIResponse(
  userInput,
  currentQ,
  totalQ,
  questions
) {
  const input = userInput.trim();
  const lower = input.toLowerCase();

  const stay = (text) => ({ text, advanceTo, isEnd: false });

  // ── 1. Hard banned language ────────────────────────────────────────────────
  if (BANNED_PATTERNS.some((p) => p.test(input))) {
    return stay("⚠️ Bạn vừa dùng ngôn từ không phù hợp. Hãy giữ thái độ chuyên nghiệp trong buổi phỏng vấn nhé! Tôi vẫn ở đây để hỗ trợ bạn 😊");
  }

  // ── 2. Mild insult / rude word (single word, non-severe) ──────────────────
  if (MILD_INSULT_PATTERNS.test(input)) {
    return stay(pick(MILD_INSULT_REPLIES));
  }

  // ── 3. Greetings ───────────────────────────────────────────────────────────
  if (GREETING_PATTERNS.test(lower) && input.length < 40) {
    return stay("Xin chào 👋 Rất vui được gặp bạn. Tôi là **AI Interviewer** của ProInterview — sẵn sàng giúp bạn luyện phỏng vấn hiệu quả!\n\nHãy trả lời câu hỏi đang hiển thị nhé. Chúng ta bắt đầu thôi 🚀");
  }

  // ── 4. Mood / emotional check-in ──────────────────────────────────────────
  if (MOOD_PATTERNS.test(lower)) {
    return stay(getMoodReply(lower));
  }

  // ── 5. Who are you ────────────────────────────────────────────────────────
  if (WHO_PATTERNS.test(lower)) {
    return stay("Tôi là **AI Interviewer** của ProInterview 🤖\n\nTôi được xây dựng dựa trên hàng nghìn buổi phỏng vấn thực tế tại các công ty hàng đầu. Nhiệm vụ của tôi: hỏi câu hỏi → lắng nghe → cho feedback chi tiết.\n\nBây giờ hãy quay lại và trả lời câu hỏi nhé! 💪");
  }

  // ── 6. Help / STAR guidance ───────────────────────────────────────────────
  if (HELP_PATTERNS.test(lower)) {
    return stay("Không lo, tôi sẽ hướng dẫn 😊\n\n**Mô hình STAR** — cách trả lời phỏng vấn hiệu quả nhất:\n• **S** – Situation: Bối cảnh/tình huống cụ thể\n• **T** – Task: Nhiệm vụ/trách nhiệm của bạn\n• **A** – Action: Hành động BẠN đã làm (dùng \"tôi\" không phải \"chúng tôi\")\n• **R** – Result: Kết quả đạt được (có số liệu càng tốt)\n\nVí dụ: *\"Khi dự án bị trễ deadline 2 tuần (S), tôi được phân công... (T), tôi đã... (A), kết quả là giao đúng hạn với... (R)\"*\n\nÁp dụng vào câu hỏi hiện tại đi nhé!");
  }

  // ── 7. Jokes / humor ──────────────────────────────────────────────────────
  if (JOKE_PATTERNS.test(lower)) {
    return stay("Haha 😄 Tôi thích tinh thần vui vẻ của bạn Nhưng trong phòng phỏng vấn thật thì hãy giữ năng lượng tập trung nhé.\n\nChúng ta quay lại câu hỏi thôi — bạn đang làm tốt đấy 💪");
  }

  // ── 8. Complain / skip request ────────────────────────────────────────────
  if (NEGATIVE_PATTERNS.test(lower)) {
    return stay("Tôi hiểu câu hỏi này có vẻ khó! Nhưng đây chính xác là loại câu sẽ xuất hiện trong phỏng vấn thật 😊\n\n💡 Mẹo: Không có kinh nghiệm trực tiếp? Dùng dự án trường, thực tập, hoặc công việc tình nguyện đều ổn. Nhà tuyển dụng đánh giá cao sự thành thật và mindset học hỏi.\n\nHãy thử lại nhé!");
  }

  // ── 9. Short thanks / affirmation ────────────────────────────────────────
  if (THANKS_PATTERNS.test(lower)) {
    return stay("Không có gì! 😊 Sẵn sàng tiếp tục chứ? Hãy trả lời câu hỏi hiện tại để tôi đánh giá và cho bạn feedback nhé!");
  }

  // ── 10. Gibberish / random test words ────────────────────────────────────
  if (RANDOM_WORD_PATTERNS.test(lower)) {
    return stay(getCasualReply(input));
  }

  // ── 11. Very short input (< 15 chars) that passed all filters → casual ───
  if (input.length < 15) {
    // Check if it looks like a random word, not an answer
    if (isSingleRandomWord(input)) {
      return stay(getCasualReply(input));
    }
    // Else prompt for more detail
    return stay(pick(SHORT_ANSWER_TIPS));
  }

  // ── 12. Short but might be a partial answer (15-35 chars) ────────────────
  if (input.length < 35) {
    return stay(pick(SHORT_ANSWER_TIPS));
  }

  // ── 13. Proper answer → feedback + advance ────────────────────────────────
  const feedbackPool = QUESTION_FEEDBACK[currentQ] ?? ["Cảm ơn câu trả lời Hãy tiếp tục nhé."];
  const feedback = pick(feedbackPool);
  const nextQ = currentQ + 1;

  if (nextQ >= totalQ) {
    return {
      text: `${feedback}\n\n🎉 Xuất sắc Đó là câu hỏi cuối cùng. Bạn đã hoàn thành buổi phỏng vấn thử. Đang tổng hợp kết quả...`,
      advanceTo: nextQ,
      isEnd: true,
    };
  }

  return {
    text: `${feedback}\n\n📌 **Câu hỏi ${nextQ + 1}/${totalQ}:**\n"${questions[nextQ]}"`,
    advanceTo: nextQ,
    isEnd: false,
  };
}