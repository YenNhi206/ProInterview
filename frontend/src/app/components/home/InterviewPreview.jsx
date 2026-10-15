import React, { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, FileText, Mic, Search, Sparkles, XCircle } from "lucide-react";
import "../../../styles/interview-preview.css";

const feedback = [
  { label: "Kiến thức chuyên môn", score: 8.5, color: "#80eaa7" },
  { label: "Tư duy & phân tích", score: 7.5, color: "#f5cf75" },
  { label: "Cách diễn đạt", score: 8, color: "#b176f5" },
  { label: "Độ tự tin", score: 8, color: "#c7f36b" },
];
const waveHeights = [5, 10, 7, 18, 12, 25, 10, 32, 19, 43, 24, 15, 30, 12, 18, 7, 11, 5];
const INTERVIEW_VIDEO = "https://res.cloudinary.com/dee4bvivu/video/upload/v1774336640/Female_delxmy.mp4";
const INTERVIEW_POSTER = "https://res.cloudinary.com/dee4bvivu/video/upload/so_0/v1774336640/Female_delxmy.jpg";


function ScoreRing({ value, text }) {
  return (
    <div className="ip-score-ring" style={{ "--ip-score": `${value}%` }} role="img" aria-label={`Điểm minh họa: ${text}`}>
      <span>{text}</span>
    </div>
  );
}

// Bend the rendered React surface, including its border and text. A flat
// perspective rotation cannot produce the reference's curved upper edge.
function CurvedSurface({ children }) {
  const id = `ip-curve-${useId().replace(/:/g, "")}`;
  const frame = useRef(null);
  const [size, setSize] = useState({ width: 1120, height: 520 });
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.borderBoxSize?.[0]?.inlineSize || entry.contentRect.width, height: entry.borderBoxSize?.[0]?.blockSize || entry.contentRect.height });
    });
    observer.observe(frame.current);
    return () => observer.disconnect();
  }, []);
  // Neutral R preserves horizontal positions. Opposite G gradients bend
  // the upper edge down and the lower edge up, meeting halfway vertically.
  const makeStops = (reverse = false) => Array.from({ length: 17 }, (_, i) => {
    const position = i / 16;
    const value = .1 + .8 * (2 * position - 1) ** 2;
    const green = Math.round(255 * (reverse ? 1 - value : value));
    return `<stop offset="${position * 100}%" stop-color="rgb(128,${green},128)"/>`;
  }).join("");
  const map = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="520"><defs><linearGradient id="top">${makeStops()}</linearGradient><linearGradient id="bottom">${makeStops(true)}</linearGradient><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="black"/><stop offset="1" stop-color="white"/></linearGradient><mask id="blend"><rect width="100%" height="100%" fill="url(#fade)"/></mask></defs><rect width="100%" height="100%" fill="url(#top)"/><rect width="100%" height="100%" fill="url(#bottom)" mask="url(#blend)"/></svg>`)}`;
  return (
    <>
      <svg className="ip-filter-definitions" aria-hidden="true">
        <defs>
          <filter id={id} filterUnits="userSpaceOnUse" x="-40" y="-40" width={size.width + 80} height={size.height + 80} colorInterpolationFilters="sRGB">
            <feImage href={map} x="-40" y="-40" width={size.width + 80} height={size.height + 80} preserveAspectRatio="none" result="curve" />
            <feDisplacementMap in="SourceGraphic" in2="curve" scale="32" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <div ref={frame} className="ip-browser" style={{ "--ip-curve-filter": `url(#${id})` }}>{children}</div>
    </>
  );
}

export default function InterviewPreview() {
  const [tab, setTab] = useState("Phản hồi");
  const [recording, setRecording] = useState(true);
  const interviewerVideo = useRef(null);
  useEffect(() => {
    const video = interviewerVideo.current;
    if (!video) return;
    if (recording) video.play().catch(() => {});
    else video.pause();
  }, [recording]);
  return (
    <div className="interview-preview" aria-label="Bản xem trước minh họa ProInterview">
      <CurvedSurface>
        <div className="ip-browser-bar">
          <div className="ip-traffic" aria-hidden="true"><i /><i /><i /></div>
          <span className="ip-browser-brand">ProInterview</span>
          <div className="ip-browser-tools" aria-hidden="true"><Search size={11} /><span>○</span></div>
        </div>
        <div className="ip-workspace">
          <div className="ip-content">
            <article className="ip-cv">
              <h3>Phân tích CV / JD</h3>
              <div className="ip-cv-panel">
                <div className="ip-role"><span><FileText size={19} /></span><div><strong>Frontend Developer</strong><p>VNG Corporation</p></div></div>
                <div className="ip-skills">{["React", "TypeScript", "Next.js", "REST API"].map(skill => <span key={skill}>{skill}</span>)}</div>
                <div className="ip-match"><ScoreRing value={78} text="78%" /><div><h4>Mức độ phù hợp</h4><p>CV của bạn phù hợp khá tốt với yêu cầu. Hãy tăng thêm kinh nghiệm về Next.js và kỹ năng thiết kế hệ thống.</p></div></div>
                <h4>Điểm mạnh</h4>
                <ul className="ip-strengths"><li><CheckCircle2 />Có kinh nghiệm với React</li><li><CheckCircle2 />Kỹ năng TypeScript tốt</li></ul>
                <h4>Gợi ý cải thiện</h4>
                <ul className="ip-improvements"><li><XCircle />Bổ sung kinh nghiệm Next.js</li><li><XCircle />Làm rõ các dự án cá nhân có testing</li></ul>
              </div>
            </article>
            <article className="ip-interview">
              <h3><Sparkles size={15} />Phỏng vấn AI</h3>
              <div className="ip-session-meta"><span>Vòng kỹ thuật · Frontend</span><span><i />00:42</span></div>
              <div className="ip-interviewer-video">
                <video ref={interviewerVideo} src={INTERVIEW_VIDEO} poster={INTERVIEW_POSTER} autoPlay muted loop playsInline preload="metadata" aria-label="Video minh họa người phỏng vấn AI" />
                <span className="ip-interviewer-label"><i />Người phỏng vấn AI</span>
              </div>
              <div className="ip-question ip-video-question">Giải thích cách React cập nhật giao diện.</div>
              <div className={`ip-audio ip-video-audio ${recording ? "ip-audio-active" : ""}`}>
                <div className="ip-wave" aria-hidden="true">{waveHeights.map((height, i) => <i key={i} style={{ height, animationDelay: `${i * .08}s` }} />)}</div>
                <button className="ip-mic" data-button-surface="none" type="button" onClick={() => setRecording(value => !value)} aria-label={recording ? "Tạm dừng ghi âm minh họa" : "Tiếp tục ghi âm minh họa"} aria-pressed={recording}><Mic size={23} /></button>
                <div className="ip-wave" aria-hidden="true">{[...waveHeights].reverse().map((height, i) => <i key={i} style={{ height, animationDelay: `${i * .08}s` }} />)}</div>
              </div>
              <p className="ip-recording-label">{recording ? "Đang ghi âm…" : "Đã dừng phiên minh họa"}</p>
              <button className="ip-end" data-button-surface="none" type="button" onClick={() => setRecording(value => !value)}><span />{recording ? "Kết thúc" : "Luyện lại"}</button>
            </article>
            <article className="ip-feedback">
              <div className="ip-tabs" role="tablist" aria-label="Kết quả minh họa">{["Phản hồi", "Transcript", "Gợi ý học thêm"].map((label, index) => <button key={label} data-button-surface="none" type="button" role="tab" id={`ip-tab-${index}`} aria-selected={tab === label} aria-controls="ip-feedback-content" onClick={() => setTab(label)}>{label}</button>)}</div>
              <div id="ip-feedback-content" role="tabpanel" aria-labelledby={`ip-tab-${["Phản hồi", "Transcript", "Gợi ý học thêm"].indexOf(tab)}`}>
                {tab === "Phản hồi" ? <>
                  <div className="ip-overview"><ScoreRing value={80} text="8.0" /><div><h4>Tổng quan</h4><p>Câu trả lời rõ ràng, đúng trọng tâm và thể hiện tư duy tốt.</p></div></div>
                  <div className="ip-metrics">{feedback.map(({ label, score, color }) => <div key={label}><div className="ip-metric-label"><span>{label}</span><span>{score.toFixed(1)}</span></div><div className="ip-metric-track"><span style={{ width: `${score * 10}%`, background: color }} /></div></div>)}</div>
                  <div className="ip-detail"><h4>Nhận xét chi tiết</h4><p>Bạn đã giải thích đúng cơ chế reconciliation và vai trò của Virtual DOM. Phần ví dụ minh họa rõ ràng. Có thể bổ sung thêm về batching và tránh re-render không mong muốn.</p></div>
                </> : tab === "Transcript" ? <div className="ip-detail"><h4>Câu trả lời minh họa</h4><p>React sử dụng Virtual DOM để so sánh giao diện trước và sau khi state thay đổi. Quá trình reconciliation xác định những phần cần cập nhật trên DOM thực.</p></div> : <div className="ip-detail"><h4>Gợi ý học thêm</h4><ul><li>React reconciliation và Virtual DOM</li><li>Batching các cập nhật state</li><li>Tối ưu render với memo và useMemo</li></ul></div>}
              </div>
            </article>
          </div>
        </div>
      </CurvedSurface>
    </div>
  );
}
