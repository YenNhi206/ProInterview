import { FlowStepBar } from "../shared/FlowStepBar";

const INTERVIEW_STEPS = [
  { n: 1, label: "Nguồn CV" },
  { n: 2, label: "Chọn HR" },
  { n: 3, label: "Phỏng vấn" },
];

/** Thanh 3 bước, setup (#/interview) và phòng chờ (#/interview/room) */
export function InterviewStepBar({ current = 1, className = "", onStepClick }) {
  return (
    <FlowStepBar
      steps={INTERVIEW_STEPS}
      current={current}
      className={className}
      ariaLabel="Tiến trình phỏng vấn"
      onStepClick={onStepClick}
    />
  );
}
