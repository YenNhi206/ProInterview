/**
 * QA-03: script đo NFR chỉ dùng số đo thật (log / DB); kiểm tra cách tính, không có số tự sinh.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  percentile, summarize, parseLogLines, cvSamplesFromLog, avatarSamplesFromLog, filterAvatarRowsByProvider, TARGETS,
} from "./measureNfrPerformance.js";

describe("QA-03: thống kê", () => {
  it("percentile kiểu nearest-rank, luôn là giá trị có trong mẫu", () => {
    const v = [5, 1, 4, 2, 3, 10, 9, 8, 7, 6];
    assert.equal(percentile(v, 50), 5);
    assert.equal(percentile(v, 95), 10);
    assert.equal(percentile([], 50), null);
  });

  it("thiếu mẫu thì không ĐẠT dù nhanh; p95 vượt ngưỡng thì không ĐẠT", () => {
    const fast = Array.from({ length: 10 }, () => 1000);
    const s1 = summarize(fast, TARGETS.cv);
    assert.equal(s1.enoughSamples, false);
    assert.equal(s1.pass, false);
    const slow = [...Array.from({ length: 28 }, () => 20_000), 70_000, 80_000];
    const s2 = summarize(slow, TARGETS.cv);
    assert.equal(s2.n, 30);
    assert.equal(s2.p95S, 70);
    assert.equal(s2.overTarget, 2);
    assert.equal(s2.pass, false);
    assert.deepEqual(summarize([], TARGETS.cv).n, 0);
  });
});

describe("QA-03: đọc log", () => {
  const log = [
    'Nov 24 10:00:00 backend {"ts":"2026-11-24T10:00:00Z","level":"info","event":"cv_analysis_timing","analysisId":"a1","endpoint":"/analyze/suggestions","ok":false,"durationMs":40000}',
    '{"ts":"2026-11-24T10:00:41Z","level":"info","event":"cv_analysis_timing","analysisId":"a1","endpoint":"/analyze/full","ok":true,"durationMs":15000}',
    '{"ts":"2026-11-24T10:05:00Z","level":"warn","event":"cv_analysis_timing","analysisId":"a2","endpoint":"/analyze/full","ok":false,"durationMs":3000}',
    '{"ts":"2026-11-24T10:06:00Z","level":"info","event":"avatar_video_timing","fromCache":false,"ok":true,"durationMs":52000}',
    '{"ts":"2026-11-24T10:06:01Z","level":"info","event":"avatar_video_timing","fromCache":true,"ok":true,"durationMs":120}',
    '{"ts":"2026-11-24T10:07:00Z","level":"warn","event":"avatar_video_timing","fromCache":false,"ok":false,"durationMs":9000}',
    '{"ts":"2026-11-24T10:08:00Z","level":"info","event":"avatar_video_timing","fromCache":false,"ok":tr',
    "dòng log thường không phải JSON",
  ].join("\n");

  it("CV: cộng các lượt gọi Python cùng analysisId; lần phân tích không lượt nào thành công thì đếm lỗi", () => {
    const { samples, failed } = cvSamplesFromLog(parseLogLines(log, "cv_analysis_timing"));
    assert.equal(samples.length, 1);
    assert.equal(samples[0].durationMs, 55_000, "40s lượt lỗi + 15s lượt thành công = thời gian người dùng chờ");
    assert.equal(samples[0].calls, 2);
    assert.equal(failed, 1);
  });

  it("avatar: tách mới / cache, bỏ dòng bị cắt, đếm video mới lỗi riêng", () => {
    const { fresh, cached, failedFresh } = avatarSamplesFromLog(parseLogLines(log, "avatar_video_timing"));
    assert.deepEqual(fresh.map((r) => r.durationMs), [52000]);
    assert.deepEqual(cached.map((r) => r.durationMs), [120]);
    assert.equal(failedFresh, 1);
  });

  it("avatar --provider (QA-08): dòng không có provider là D-ID, lọc đúng provider", () => {
    const rows = [
      { durationMs: 1, ok: true, fromCache: false },
      { durationMs: 2, ok: true, fromCache: false, provider: "did" },
      { durationMs: 3, ok: true, fromCache: false, provider: "elevenlabs", model: "creatify-aurora" },
    ];
    assert.deepEqual(filterAvatarRowsByProvider(rows, "did").map((r) => r.durationMs), [1, 2]);
    assert.deepEqual(filterAvatarRowsByProvider(rows, "elevenlabs").map((r) => r.durationMs), [3]);
    assert.equal(filterAvatarRowsByProvider(rows, undefined).length, 3);
  });

  it("script không còn sinh số (sin / cos / random) hay gõ cứng kết quả k6", () => {
    const src = readFileSync(fileURLToPath(new URL("./measureNfrPerformance.js", import.meta.url)), "utf8");
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(code, /Math\.(sin|cos|random)/);
    assert.doesNotMatch(code, /14850|0\.08%|680ms/);
  });
});
