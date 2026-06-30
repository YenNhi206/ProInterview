import {
  CUSTOMER_SHELL_GUTTER,
  CUSTOMER_SHELL_MAX,
  CV_JD_PAGE_WRAP,
} from "../layout/customerShellLayout";
import { MentorPageShell } from "../mentor/MentorPageShell";
import { CvJdAnalysisTabs } from "./CvJdAnalysisTabs";
import { CustomerPageHeader } from "../layout/CustomerPageHeader";

export const CV_JD_CARD_CLASS =
  "w-full overflow-hidden rounded-[1.75rem] border border-violet-200/80 bg-white shadow-[0_16px_40px_rgba(99,14,212,0.1)]";

/** Field upload + dropdown ngành, cần overflow visible để list không bị cắt */
export const CV_JD_CARD_FIELD_CLASS =
  "w-full overflow-visible rounded-[1.75rem] border border-violet-200/80 bg-white shadow-[0_16px_40px_rgba(99,14,212,0.1)]";

const JD_SUBTITLE =
  "Tải CV và Job Description, phân tích khớp từ khóa, chấm điểm và gợi ý chỉnh sửa theo đúng vị trí tuyển dụng.";

const FIELD_SUBTITLE =
  "Tải CV, chọn nhóm ngành nghề. AI đánh giá cấu trúc, nội dung và gợi ý cải thiện theo chuẩn ngành.";

const FIELD_SUBTITLE_CLASS =
  "mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-600 sm:text-base";

/** Header cố định theo tính năng, tab Phân tích / Lịch sử dùng chung, không đổi tiêu đề khi chuyển tab */
export function cvAnalysisPageHeader(mode) {
  if (mode === "field") {
    return {
      title: (
        <>
          Phân tích CV <span className="text-[#630ed4]">theo ngành</span>
        </>
      ),
      subtitle: FIELD_SUBTITLE,
      subtitleClassName: FIELD_SUBTITLE_CLASS,
    };
  }
  return {
    title: (
      <>
        Tối ưu CV theo vị trí <span className="text-[#630ed4]">ứng tuyển</span>
      </>
    ),
    subtitle: JD_SUBTITLE,
    subtitleClassName: "mt-3 max-w-3xl text-sm font-medium leading-relaxed text-slate-600 sm:text-base",
  };
}

/**
 * Khung chung: header + card trắng + tab Phân tích mới / Lịch sử (CV+JD).
 * Dùng cho /cv-analysis/jd, /cv-analysis/field và trang lịch sử tương ứng.
 */
export function CvJdAnalysisPage({
  activeTab,
  tabTrailing = null,
  tabAnalysisPath,
  tabHistoryPath,
  children,
  badge = null,
  title = (
    <>
      Tối ưu CV theo vị trí <span className="text-[#630ed4]">ứng tuyển</span>
    </>
  ),
  subtitle = JD_SUBTITLE,
  subtitleClassName = "mt-3 max-w-3xl text-sm font-medium leading-relaxed text-slate-600 sm:text-base",
  showTabs = true,
  showHeader = true,
  cardVariant = "default",
}) {
  const cardClass = cardVariant === "field" ? CV_JD_CARD_FIELD_CLASS : CV_JD_CARD_CLASS;

  return (
    <MentorPageShell bottomPad="pb-12">
      <div className={`relative z-[1] flex flex-col pb-10 pt-8 sm:pt-10 ${CUSTOMER_SHELL_GUTTER}`}>
        <div className={CUSTOMER_SHELL_MAX}>
          <div className={CV_JD_PAGE_WRAP}>
            {showHeader ? (
              <CustomerPageHeader
                badge={badge}
                title={title}
                subtitle={subtitle}
                subtitleClassName={subtitleClassName}
                className="w-full"
              />
            ) : null}

            <div className={cardClass}>
              {showTabs ? (
                <CvJdAnalysisTabs
                  activeTab={activeTab}
                  trailing={tabTrailing}
                  analysisPath={tabAnalysisPath}
                  historyPath={tabHistoryPath}
                />
              ) : tabTrailing ? (
                <div className="flex justify-end border-b border-violet-100 px-4 py-3 sm:px-6">
                  {tabTrailing}
                </div>
              ) : null}
              {children}
            </div>
          </div>
        </div>
      </div>
    </MentorPageShell>
  );
}
