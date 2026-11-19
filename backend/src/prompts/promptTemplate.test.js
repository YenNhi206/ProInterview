/**
 * AI-02: render và kiểm tra template prompt (không cần DB).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  renderTemplate, templateVariables, validateTemplate, renderVersionFewShot, PromptRenderError,
  VERSION_FEW_SHOT_TEMPLATE,
} from "./promptTemplate.js";
import { PROMPT_REGISTRY, versionNameError } from "./index.js";
import { buildEvaluationPrompt } from "./evaluationPrompt.js";

describe("renderTemplate", () => {
  it("thay biến; giá trị chứa {{x}} không bị render tiếp", () => {
    assert.equal(renderTemplate("Xin chào {{name}}, {{name}}!", { name: "An" }), "Xin chào An, An!");
    assert.equal(renderTemplate("CV: {{cv}}", { cv: "Tôi {{hack}}" }), "CV: Tôi {{hack}}");
    assert.equal(renderTemplate("n={{n}}", { n: 0 }), "n=0");
    assert.equal(renderTemplate("rỗng={{x}}.", { x: "" }), "rỗng=.");
  });

  it("thiếu biến → PromptRenderError nói rõ tên biến, không để trống", () => {
    assert.throws(() => renderTemplate("Câu {{n}}: {{question}}", { n: 1 }, "prior_qa_item"),
      (e) => e instanceof PromptRenderError && /prior_qa_item: thiếu biến \{\{question\}\}/.test(e.message));
    assert.throws(() => renderTemplate("{{x}}", { x: undefined }), PromptRenderError);
  });

  it("templateVariables liệt kê biến không trùng", () => {
    assert.deepEqual(templateVariables("{{a}} {{b}} {{a}} { c } {{ d }}"), ["a", "b"]);
  });
});

describe("validateTemplate", () => {
  const spec = { parts: { greet: { vars: ["name"] }, hints: { array: true } } };

  it("template mặc định của mọi key đăng ký đều hợp lệ", () => {
    for (const [key, entry] of Object.entries(PROMPT_REGISTRY)) {
      assert.deepEqual(validateTemplate(entry.spec, entry.default.template), [], key);
    }
  });

  it("báo thiếu phần, thiếu biến, biến lạ, mảng sai", () => {
    assert.deepEqual(validateTemplate(spec, { greet: "Chào {{name}}", hints: ["a"] }), []);
    assert.match(validateTemplate(spec, { hints: ["a"] }).join(), /Thiếu phần "greet"/);
    assert.match(validateTemplate(spec, { greet: "Chào", hints: ["a"] }).join(), /thiếu biến \{\{name\}\}/);
    assert.match(validateTemplate(spec, { greet: "Chào {{name}} {{age}}", hints: ["a"] }).join(), /biến lạ \{\{age\}\}/);
    assert.match(validateTemplate(spec, { greet: "Chào {{name}}", hints: [] }).join(), /mảng chuỗi không rỗng/);
    assert.match(validateTemplate(spec, { greet: "Chào {{name}}", hints: "a" }).join(), /mảng chuỗi không rỗng/);
    assert.match(validateTemplate(spec, null).join(), /object/);
  });
});

describe("few-shot của PromptVersion", () => {
  it("mảng rỗng → chuỗi rỗng; có ví dụ → khối ở vị trí {{versionFewShot}}", () => {
    assert.equal(renderVersionFewShot(VERSION_FEW_SHOT_TEMPLATE, []), "");
    const block = renderVersionFewShot(VERSION_FEW_SHOT_TEMPLATE, [{ input: "Câu A", output: "{\"overall\": 3}" }]);
    assert.match(block, /### Ví dụ 1\nĐầu vào:\nCâu A\nKết quả chuẩn:\n\{"overall": 3\}/);

    const evaluation = PROMPT_REGISTRY.evaluation.default;
    const plain = buildEvaluationPrompt(evaluation, {}).system.static;
    const withShots = buildEvaluationPrompt({ ...evaluation, fewShotExamples: [{ input: "Câu A", output: "3" }] }, {}).system.static;
    assert.equal(withShots, plain.replace("Trả về JSON hợp lệ", `${renderVersionFewShot(evaluation.template, [{ input: "Câu A", output: "3" }])}Trả về JSON hợp lệ`));
  });
});

describe("tên version", () => {
  it("theo quy ước <tiền tố>-vN và tiền tố của key", () => {
    assert.equal(versionNameError("evaluation", "eval-v2"), null);
    assert.equal(versionNameError("question_gen", "followup-v3"), null);
    assert.match(versionNameError("evaluation", "followup-v2"), /bắt đầu bằng "eval-v"/);
    assert.match(versionNameError("evaluation", "v2"), /dạng <tiền tố>-vN/);
    assert.equal(versionNameError("future_key", "rubric-v1"), null);
  });
});
