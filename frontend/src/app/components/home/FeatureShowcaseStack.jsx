import React from "react";

const LABELS = ["Phân tích CV", "Phỏng vấn AI", "Lịch hẹn Mentor", "Khóa học"];

/** Glass feature windows adapted from Uiverse.io by Fcodingx. */
export function FeatureShowcaseStack({ children, heading }) {
  return (
    <div className="feature-showcase-stage">
      {heading}
      <div className="feature-window-grid feature-window-grid--horizontal">
        {React.Children.toArray(children).map((child, index) => (
          <div key={index} className="feature-window-slot">
          <article className="feature-window liquid-glass-strong" tabIndex={0} aria-label={LABELS[index]}>
            {child}
          </article>
          </div>
        ))}
      </div>
    </div>
  );
}
