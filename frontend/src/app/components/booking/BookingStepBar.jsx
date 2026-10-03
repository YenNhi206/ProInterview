import { FlowStepBar } from "../shared/FlowStepBar";

const BOOKING_STEPS = [
  { n: 1, label: "Chọn lịch" },
  { n: 2, label: "Thông tin & xác nhận" },
];

export function BookingStepBar({ current = 1, className = "", onStepClick }) {
  return (
    <FlowStepBar
      steps={BOOKING_STEPS}
      current={current}
      className={className}
      ariaLabel="Tiến trình đặt lịch mentor"
      onStepClick={onStepClick}
    />
  );
}
