import { useEffect, useRef, useState } from "react";

const MASCOT_VIDEO_SRC = "/mascot-loading.mp4";
// Video nguồn pillarbox 1280x720, mascot chỉ chiếm vùng giữa ~766x720 (viền đen 2 bên,
// không letterbox trên/dưới). Frame cuối ăn khớp frame đầu (đo bằng pixel) nên loop tự
// nhiên đã mượt — không cần xử lý crossfade/artifact riêng như video cũ.
const MASCOT_CROP = { x: 257, y: 0, w: 766, h: 720 };

export function MascotVideo({ className }) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = container.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let rafId;
    const draw = () => {
      if (video.readyState >= 2) {
        ctx.drawImage(
          video,
          MASCOT_CROP.x, MASCOT_CROP.y, MASCOT_CROP.w, MASCOT_CROP.h,
          0, 0, canvas.width, canvas.height,
        );
      }
      rafId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className={className}>
      <video
        ref={videoRef}
        src={MASCOT_VIDEO_SRC}
        autoPlay
        loop
        muted
        playsInline
        disablePictureInPicture
        className="hidden"
      />
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}

/** Xoay vòng 1 mảng tip theo chu kỳ `intervalMs`, trả về tip hiện tại. */
export function useRotatingTip(tips, intervalMs = 6000) {
  const [tipIdx, setTipIdx] = useState(0);
  useEffect(() => {
    setTipIdx(0);
    const interval = setInterval(() => {
      setTipIdx((i) => (i + 1) % tips.length);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [tips, intervalMs]);
  return tips[tipIdx];
}

// "weight" ~ tỉ trọng thời gian tương đối giữa các bước, dùng để tính % progress bar.
// Không cần khớp tuyệt đối với thời gian thực tế của backend, chỉ cần đủ để
// thanh progress di chuyển hợp lý qua các giai đoạn.
const INTERVIEW_STEPS = [
  { key: "extracting_cv",        message: "AI đang đọc và hiểu hồ sơ của bạn...",                         weight: 3 },
  { key: "analyzing_role",       message: "Đang phân tích vai trò & năng lực cần có cho vị trí này...",   weight: 5 },
  { key: "generating_questions", message: "Đang soạn câu hỏi phỏng vấn được cá nhân hóa riêng cho bạn...", weight: 30 },
  { key: "creating_session",     message: "Đang chuẩn bị phòng phỏng vấn...",                              weight: 3 },
  { key: "pregenerating_videos", message: "Đang dựng hình ảnh & giọng nói cho HR ảo, bước này hơi lâu nhưng rất đáng chờ!", weight: 70 },
];

// Map real loadingStep values (từ Interview.jsx) sang vị trí hiển thị.
// "analyzing_role" không bao giờ được set trực tiếp, nó tự "hoàn thành" âm thầm
// khi chuyển từ extracting_cv → generating_questions.
const INTERVIEW_STEP_INDEX = {
  extracting_cv:        0,
  extracting_jd:        0,
  generating_questions: 2,
  creating_session:     3,
  pregenerating_videos: 4,
};

export const TIPS = [
  "Mẹo nhỏ: trả lời theo cấu trúc STAR (Tình huống – Nhiệm vụ – Hành động – Kết quả) sẽ thuyết phục hơn đấy.",
  "Đây là cơ hội để bạn luyện tập trước buổi phỏng vấn thật — trả lời chưa hoàn hảo cũng không sao cả!",
  "Hãy ngồi thẳng, hít thở sâu và mỉm cười — sự tự tin luôn là điểm cộng lớn nhất.",
  "Đừng quên chuẩn bị vài câu chuyện thực tế từ kinh nghiệm của bạn, HR rất thích những ví dụ cụ thể.",
  "Chúc bạn may mắn! Chúng tôi sẽ đồng hành cùng bạn trong suốt buổi phỏng vấn này.",
];

function cumulativeWeight(steps, uptoIdx) {
  return steps.slice(0, uptoIdx).reduce((sum, s) => sum + s.weight, 0);
}

/**
 * Màn hình chờ dùng chung cho các tác vụ AI chạy lâu (sinh câu hỏi phỏng vấn,
 * phân tích CV/JD, ...): mascot động + thông điệp theo bước + progress bar tự
 * "nhích" trong lúc chờ + tip xoay vòng.
 *
 * `currentStep` là key thực tế do nơi gọi set (vd theo tiến trình backend).
 * `steps`/`stepIndex`/`tips` cho phép nơi gọi khác (vd CV Analysis) định nghĩa
 * bộ bước & tip riêng; mặc định dùng bộ của luồng phỏng vấn.
 */
export function AiLoadingState({
  currentStep,
  steps = INTERVIEW_STEPS,
  stepIndex = INTERVIEW_STEP_INDEX,
  tips = TIPS,
}) {
  const currentIdx = stepIndex[currentStep] ?? 0;
  const step = steps[currentIdx];

  const segmentStart = (cumulativeWeight(steps, currentIdx) / cumulativeWeight(steps, steps.length)) * 100;
  const segmentEnd = (cumulativeWeight(steps, currentIdx + 1) / cumulativeWeight(steps, steps.length)) * 100;

  // "Creep": trong lúc đứng ở 1 step (đặc biệt step cuối có thể tốn tới ~3 phút),
  // tự nhích thanh progress lên dần để không tạo cảm giác bị đứng/treo,
  // nhưng luôn dừng lại trước ranh giới của step kế tiếp.
  const [creepPct, setCreepPct] = useState(0);
  useEffect(() => {
    setCreepPct(0);
    const interval = setInterval(() => {
      setCreepPct((prev) => Math.min(prev + 1, 92));
    }, 1200);
    return () => clearInterval(interval);
  }, [currentStep]);

  const tip = useRotatingTip(tips);

  const segmentSpan = Math.max(segmentEnd - segmentStart, 0);
  const progress = segmentStart + (segmentSpan * creepPct) / 100;

  return (
    <div className="flex flex-col items-center">
      <MascotVideo className="mb-4 mx-auto h-36 aspect-[766/720] overflow-hidden rounded-md sm:h-44" />

      <p className="text-center text-sm font-semibold text-violet-800">
        {step.message}
      </p>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-violet-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#630ed4] to-[#93f72b] transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-4 w-full rounded-md bg-violet-50 px-3 py-2.5 text-center text-xs text-violet-700">
        {tip}
      </div>
    </div>
  );
}
