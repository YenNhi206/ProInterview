import React from "react";
import { useNavigate } from "react-router";
import { CvAnalysisHubHero } from "../../components/cv/CvAnalysisHubSections";
import { CUSTOMER_SHELL_GUTTER, CUSTOMER_SHELL_MAX } from "../../components/layout/customerShellLayout";
import { requireLoginNavigate } from "../../utils/auth/authGate.js";

const HUB_VIEWPORT_STYLES = `
  @media (min-width: 1024px) {
    .cv-hub-viewport {
      box-sizing: border-box;
      min-height: calc(100svh - 4.75rem);
      height: auto;
      max-height: none;
      overflow: visible;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding-top: clamp(1.5rem, 4vh, 2.5rem);
      padding-bottom: clamp(2rem, 5vh, 3rem);
    }
    .cv-hub-fit {
      width: 100%;
      max-width: none;
      overflow: visible;
    }
  }
`;

export function CVAnalysisHub() {
  const navigate = useNavigate();

  return (
    <div className={`cv-hub-viewport flex min-h-0 w-full flex-col ${CUSTOMER_SHELL_GUTTER}`}>
      <style>{HUB_VIEWPORT_STYLES}</style>
      <div className={`cv-hub-fit w-full min-h-0 ${CUSTOMER_SHELL_MAX}`}>
        <CvAnalysisHubHero
          navShellAligned
          onJd={() => requireLoginNavigate(navigate, "/cv-analysis/jd")}
          onField={() => requireLoginNavigate(navigate, "/cv-analysis/field")}
          onBestFit={() => requireLoginNavigate(navigate, "/cv-analysis/best-fit")}
        />
      </div>
    </div>
  );
}
