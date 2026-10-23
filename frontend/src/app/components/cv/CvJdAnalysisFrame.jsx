import {
  CUSTOMER_SHELL_GUTTER,
  CUSTOMER_SHELL_MAX,
  CV_JD_PAGE_WRAP,
} from "../layout/customerShellLayout";
import { MentorPageShell } from "../mentor/MentorPageShell";
import { CvJdAnalysisTabs } from "./CvJdAnalysisTabs";
import { CustomerPageHeader } from "../layout/CustomerPageHeader";

export const CV_JD_CARD_CLASS =
  "w-full overflow-hidden rounded-[1.75rem] border border-white/15 bg-[#211a36] text-[#f5f2ff] shadow-[0_20px_60px_rgba(5,3,18,0.3)]";

/** Field upload + dropdown ngành, cần overflow visible để list không bị cắt */
export const CV_JD_CARD_FIELD_CLASS =
  "w-full overflow-visible rounded-[1.75rem] border border-white/15 bg-[#211a36] text-[#f5f2ff] shadow-[0_20px_60px_rgba(5,3,18,0.3)]";

const JD_SUBTITLE =
  "Tải CV và Job Description, phân tích khớp từ khóa, chấm điểm và gợi ý chỉnh sửa theo đúng vị trí tuyển dụng.";

const FIELD_SUBTITLE =
  "Tải CV, chọn nhóm ngành nghề. AI đánh giá cấu trúc, nội dung và gợi ý cải thiện theo chuẩn ngành.";

const FIELD_SUBTITLE_CLASS =
  "mt-2 max-w-2xl text-sm font-medium leading-relaxed text-[#c7bfdc] sm:text-base";

/** Header cố định theo tính năng, tab Phân tích / Lịch sử dùng chung, không đổi tiêu đề khi chuyển tab */
export function cvAnalysisPageHeader(mode) {
  if (mode === "field") {
    return {
      title: (
        <>
          Phân tích CV <span className="text-[#b99aff]">theo ngành</span>
        </>
      ),
      subtitle: FIELD_SUBTITLE,
      subtitleClassName: FIELD_SUBTITLE_CLASS,
    };
  }
  return {
    title: (
      <>
        Tối ưu CV theo vị trí <span className="text-[#b99aff]">ứng tuyển</span>
      </>
    ),
    subtitle: JD_SUBTITLE,
    subtitleClassName: "mt-3 max-w-3xl text-sm font-medium leading-relaxed text-[#c7bfdc] sm:text-base",
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
      Tối ưu CV theo vị trí <span className="text-[#b99aff]">ứng tuyển</span>
    </>
  ),
  subtitle = JD_SUBTITLE,
  subtitleClassName = "mt-3 max-w-3xl text-sm font-medium leading-relaxed text-[#c7bfdc] sm:text-base",
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
                titleClassName="font-headline text-[clamp(1.75rem,3.5vw,2.5rem)] font-black leading-[1.12] tracking-tight text-[#f5f2ff]"
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
                <div className="flex justify-end border-b border-white/10 px-4 py-3 sm:px-6">
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
