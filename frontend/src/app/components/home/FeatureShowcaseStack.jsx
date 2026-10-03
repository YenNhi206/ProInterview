import React from "react";

const LABELS = ["Phân tích CV", "Phỏng vấn AI", "Lịch hẹn Mentor", "Khóa học"];

/** Glass feature windows adapted from Uiverse.io by Fcodingx. */
export function FeatureShowcaseStack({ children, heading }) {
  return (
    <div className="feature-showcase-stage">
      {heading}
      <div className="feature-window-grid">
        {React.Children.toArray(children).map((child, index) => (
          <article key={index} className="feature-window" tabIndex={0} aria-label={LABELS[index]}>
            <div className="feature-window__lights" aria-hidden="true">
              <span /><span /><span />
            </div>
            {child}
          </article>
        ))}
      </div>
    </div>
  );
}
