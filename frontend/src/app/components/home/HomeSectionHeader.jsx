import React from "react";
import {
  HOME_SECTION_TITLE_SIZE,
  homeSectionClasses as ty,
} from "../../constants/homeTypography";

const LINE_TONE = {
  dark: ty.sectionTitleLineDark,
  accent: ty.sectionTitleLineAccent,
  lime: ty.sectionTitleLineLime,
};

/**
 * Badge + tiêu đề + mô tả — dùng chung mọi section Home.
 * @param {{ text: string, tone?: 'dark'|'accent'|'lime' }[]} lines
 */
export function HomeSectionHeader({
  badge,
  icon: Icon,
  lines = [],
  body,
  align = "start",
  className = "",
  titleClassName = "",
  children,
}) {
  const wrapClass =
    align === "center" ? ty.sectionCopyCenter : ty.sectionCopy;

  return (
    <div className={`${wrapClass} ${className}`.trim()}>
      {badge ? (
        <span className={ty.badge}>
          {Icon ? <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
          {badge}
        </span>
      ) : null}
      {lines.length > 0 ? (
        <h2
          className={`${ty.sectionTitle} ${titleClassName}`.trim()}
          style={{ fontSize: HOME_SECTION_TITLE_SIZE }}
        >
          {lines.map((line) => (
            <span
              key={line.text}
              className={LINE_TONE[line.tone] ?? ty.sectionTitleLineDark}
            >
              {line.text}
            </span>
          ))}
        </h2>
      ) : null}
      {body ? <p className={ty.sectionBody}>{body}</p> : null}
      {children}
    </div>
  );
}
