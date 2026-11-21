import mongoose from "mongoose";
import { COST_EVENT_KINDS } from "../constants/costEventKinds.js";

/**
 * 1 dòng = 1 lần gọi AI tốn (hoặc tiết kiệm) chi phí — LLM, TTS, avatar video, chấm rubric, sàng lọc khóa.
 * Nguồn ghi: langfuseService.js (logGeneration/logEvent) — dual-write cùng lúc với Langfuse,
 * vì Langfuse dùng để debug trace chi tiết, còn collection này dùng để aggregate cho dashboard
 * nội bộ (Epic 1, Task 1.2/1.3) mà không phụ thuộc vào việc query ngược API của Langfuse.
 */
const CostEventSchema = new mongoose.Schema(
  {
    // llm_call | tts_elevenlabs | avatar_video_did | rubric_scoring | course_prescreen (AI-12)
    kind:      { type: String, required: true, enum: COST_EVENT_KINDS, index: true },
    tags:      { type: [String], default: [], index: true },
    userId:    { type: String, default: null },
    model:     { type: String, default: null },
    costUsd:   { type: Number, default: 0 },
    costVnd:   { type: Number, default: 0 },
    fromCache: { type: Boolean, default: false },
    metadata:  { type: Object, default: {} },
  },
  { timestamps: true },
);

CostEventSchema.index({ createdAt: 1 });
CostEventSchema.index({ kind: 1, createdAt: 1 });

export const CostEvent = mongoose.model("CostEvent", CostEventSchema);
