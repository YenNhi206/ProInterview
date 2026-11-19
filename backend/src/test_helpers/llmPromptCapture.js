/**
 * Bắt nguyên văn prompt mà interviewQuestionService gửi cho LLM, không gọi mạng.
 *
 * Giả lập `fetch` theo đường Anthropic (giữ riêng block system tĩnh/động) và cố định
 * `Math.random` để gợi ý ngẫu nhiên ("Góc độ ưu tiên phiên này") lặp lại được.
 * Dùng cho snapshot AI-02: prompt render qua PromptVersion phải trùng từng ký tự với
 * prompt trước refactor (`services/__fixtures__/promptGolden.json`).
 *
 * Cần MongoDB (memory server) vì logGeneration ghi CostEvent.
 */

const VALID_QUESTION = (i) => ({
  id: `q${i + 1}`,
  layer: "behavior",
  seniority: "junior",
  competency_id: "problem_solving",
  competency_name: "Giải quyết vấn đề",
  ddi_key_action_targeted: "Generate Alternatives",
  question: `Trong dự án ProShop, bạn đã xử lý sự cố hiệu năng thứ ${i + 1} như thế nào và vì sao chọn cách đó?`,
  star_guidance: { situation: ["s"], task: ["t"], action: ["a"], result: ["r"] },
  expected_keywords: ["k1", "k2", "k3"],
  deep_dive: ["d"],
  shrm_rubric_excellent: "x",
});

export const qgenResponse = (n) =>
  JSON.stringify({ inferred_role: "Backend Engineer", inferred_seniority: "junior", competency_coverage: ["problem_solving"], questions: Array.from({ length: n }, (_, i) => VALID_QUESTION(i)) });

export const evalResponse = (indexes, { omitIndex = null } = {}) =>
  JSON.stringify({
    overall_comment: "Nhận xét tổng quan.",
    questions: indexes.map((i) => ({
      question_index: i,
      scores: { clarity: 3, structure: 3, relevance: 3, credibility: i === omitIndex ? undefined : 3 },
      overall: 3,
      shrm_level: "proficient",
      strengths: ["a"],
      improvements: ["b"],
      suggestion: "c",
    })),
  });

/** Kịch bản mẫu — dùng chung cho chụp golden và test. */
export const QGEN_SCENARIOS = [
  {
    name: "full_5_with_accumulated_fewshot",
    input: {
      cvText: "Nguyễn Văn A — Backend Node.js 2 năm, dự án ProShop (Express, MongoDB, Redis), tối ưu truy vấn giảm 40% thời gian.",
      jdText: "Tuyển Backend Engineer: Node.js, MongoDB, thiết kế API, làm việc nhóm agile.",
      position: "Backend Engineer", field: "IT", level: "junior",
      fewShotExamples: ["[Giải quyết vấn đề] Bạn đã tìm nguyên nhân gốc của lỗi timeout thế nào?"],
      questionCount: 5,
    },
    responses: [qgenResponse(5)],
  },
  {
    name: "followup_2_real_answers_empty_jd",
    input: {
      cvText: "Trần B — Frontend React 1 năm, dự án dashboard bán hàng.",
      jdText: "",
      position: "Frontend Developer", field: "", level: "",
      questionCount: 2,
      priorQA: [
        { question: "Giới thiệu bản thân?", transcript: "Em làm React một năm, dự án dashboard bán hàng cho 3 chi nhánh." },
        { question: "Kể về một thử thách?", transcript: "" },
        { question: "Vì sao chọn lĩnh vực này?", transcript: "Em thích làm giao diện." },
      ],
    },
    responses: [qgenResponse(2)],
  },
  {
    name: "followup_2_no_answers_with_repairs",
    input: {
      cvText: "Lê C — Data Analyst, SQL, Power BI.",
      jdText: "Data Analyst: SQL, dashboard.",
      position: "Data Analyst", field: "data", level: "intern",
      questionCount: 2,
      priorQA: [
        { question: "Giới thiệu bản thân?", transcript: "" },
        { question: "Kể về một thử thách?", transcript: "ok" },
      ],
    },
    // Lần 1 không phải JSON → json_repair; repair trả bộ sai số câu → retry; retry không phải JSON → json_repair_retry.
    responses: ["không phải json", qgenResponse(1), "vẫn không phải json", qgenResponse(2)],
  },
];

export const EVAL_SCENARIOS = [
  {
    name: "three_questions_one_empty",
    input: {
      questions: [
        { layer: "behavior", competencyName: "Làm việc nhóm", question: "Kể về lần bạn hỗ trợ đồng đội?", ddiKeyActionTargeted: "Support Others", shrmRubricExcellent: "Chủ động hỗ trợ, kết quả rõ." },
        { layer: "theory", competencyName: "", question: "Index trong MongoDB hoạt động thế nào?", ddiKeyActionTargeted: "", shrmRubricExcellent: "" },
        { question: "Bạn muốn phát triển gì trong 1 năm tới?" },
      ],
      answers: [
        { questionIndex: 0, transcript: "  Em đã giúp bạn cùng nhóm sửa lỗi deploy trong 2 giờ.  " },
        { questionIndex: 1, transcript: "Index B-tree giúp tìm kiếm nhanh hơn." },
        { questionIndex: 2, transcript: "   " },
      ],
    },
    responses: [evalResponse([0, 1, 2])],
  },
  {
    name: "repair_then_incomplete_retry",
    input: {
      questions: [
        { layer: "project", competencyName: "Giao tiếp", question: "Bạn trình bày dự án cho khách hàng ra sao?" },
        { layer: "behavior", competencyName: "Trách nhiệm", question: "Kể lần bạn nhận lỗi?" },
      ],
      answers: [
        { questionIndex: 0, transcript: "Em làm slide và demo." },
        { questionIndex: 1, transcript: "Em nhận lỗi deploy sai." },
      ],
    },
    // Lần 1 không phải JSON → eval_repair; câu 1 thiếu credibility → retry riêng câu 1.
    responses: ["{ hỏng", evalResponse([0, 1], { omitIndex: 1 }), evalResponse([1])],
  },
];

/**
 * Chạy `fn` với fetch giả, trả danh sách request LLM đã gửi (system + user + tham số).
 * @param {string[]} responses  Nội dung text trả về cho từng lượt gọi LLM, theo thứ tự.
 */
export async function captureLLMCalls(fn, responses) {
  const calls = [];
  const queue = [...responses];
  const realFetch = globalThis.fetch;
  const realRandom = Math.random;
  const env = { LLM_PROVIDER: process.env.LLM_PROVIDER, ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY };
  let seed = 0;
  Math.random = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  process.env.LLM_PROVIDER = "anthropic";
  process.env.ANTHROPIC_API_KEY = "test-key";
  globalThis.fetch = async (url, init) => {
    if (!String(url).includes("api.anthropic.com")) return realFetch(url, init);
    const body = JSON.parse(init.body);
    calls.push({ system: body.system, user: body.messages?.[0]?.content, max_tokens: body.max_tokens, temperature: body.temperature, model: body.model });
    const text = queue.length ? queue.shift() : "{}";
    return new Response(JSON.stringify({ content: [{ type: "text", text }], usage: { input_tokens: 1, output_tokens: 1 } }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  };
  let result;
  let error = null;
  try {
    result = await fn();
  } catch (e) {
    error = e;
  } finally {
    globalThis.fetch = realFetch;
    Math.random = realRandom;
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
  return { calls, result, error };
}
