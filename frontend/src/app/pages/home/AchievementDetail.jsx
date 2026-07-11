import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { achievementsApi } from "../../api/achievementsApi.js";
import { CalendarDays, ArrowLeft, Award } from "lucide-react";

const parseLinks = (text, keyPrefix) => {
  if (typeof text !== "string") return text;
  const parts = text.split(/(\[[^\]]+\]\([^)]+\))/g);
  if (parts.length === 1) return text;
  
  return parts.map((part, idx) => {
    const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (match) {
      const linkText = match[1];
      const linkUrl = match[2];
      return (
        <a
          key={`${keyPrefix}-link-${idx}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#8037f4] hover:text-[#630ed4] underline font-bold transition-colors duration-200"
        >
          {linkText}
        </a>
      );
    }
    return part;
  });
};

const renderFormattedText = (line, lineIndex = 0) => {
  if (!line) return "";
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const innerText = part.slice(2, -2);
      return (
        <strong key={idx} className="font-black text-slate-900">
          {parseLinks(innerText, `line-${lineIndex}-bold-${idx}`)}
        </strong>
      );
    }
    return parseLinks(part, `line-${lineIndex}-text-${idx}`);
  });
};

const renderTextWithListsAndHeadings = (text) => {
  if (!text) return null;
  const lines = text.split("\n");
  const renderedElements = [];
  let currentList = [];

  const flushList = (key) => {
    if (currentList.length > 0) {
      renderedElements.push(
        <ul key={key} className="list-disc pl-5 my-3 space-y-1.5 text-sm text-slate-700 sm:text-base">
          {currentList}
        </ul>
      );
      currentList = [];
    }
  };

  lines.forEach((line, index) => {
    const trimmedLine = line.trim();

    if (trimmedLine.startsWith("* ") || trimmedLine.startsWith("- ")) {
      const content = trimmedLine.slice(2);
      currentList.push(
        <li key={`li-${index}`} className="leading-relaxed">
          {renderFormattedText(content, index)}
        </li>
      );
    } else {
      flushList(`list-${index}`);

      if (trimmedLine.startsWith("### ")) {
        renderedElements.push(
          <h4 key={`h3-${index}`} className="text-base font-black text-slate-900 mt-6 mb-2">
            {renderFormattedText(trimmedLine.slice(4), index)}
          </h4>
        );
      } else if (trimmedLine.startsWith("## ")) {
        renderedElements.push(
          <h3 key={`h2-${index}`} className="text-lg font-black text-slate-900 mt-6 mb-3">
            {renderFormattedText(trimmedLine.slice(3), index)}
          </h3>
        );
      } else if (trimmedLine.startsWith("# ")) {
        renderedElements.push(
          <h2 key={`h1-${index}`} className="text-xl font-black text-slate-900 mt-7 mb-4">
            {renderFormattedText(trimmedLine.slice(2), index)}
          </h2>
        );
      } else {
        if (trimmedLine === "") {
          renderedElements.push(<div key={`spacer-${index}`} className="h-2" />);
        } else {
          renderedElements.push(
            <p key={`p-${index}`} className="text-sm leading-relaxed text-slate-700 sm:text-base mb-3">
              {renderFormattedText(line, index)}
            </p>
          );
        }
      }
    }
  });

  flushList("list-final");
  return <div className="space-y-1">{renderedElements}</div>;
};

export function AchievementDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Scroll to top on load
    window.scrollTo(0, 0);

    const fetchDetail = async () => {
      try {
        const res = await achievementsApi.getById(id);
        if (res.data?.success) {
          setItem(res.data.achievement);
        }
      } catch (err) {
        console.error("Failed to load achievement", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-[#8037f4]" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h2 className="text-2xl font-black text-slate-900 mb-4">Không tìm thấy bài viết</h2>
        <p className="text-slate-600 mb-8">Nội dung này có thể đã bị xóa hoặc không tồn tại.</p>
        <button
          onClick={() => navigate("/")}
          className="inline-flex items-center gap-2 rounded-full bg-[#a3e635] px-6 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-[#a3e635]/30 transition-all hover:bg-[#84cc16] active:scale-[0.98]"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Trang chủ
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent pb-24">
      {/* Decorative Blur */}
      <div
        className="pointer-events-none absolute left-1/2 top-0 z-0 h-[min(60vw,600px)] w-[min(60vw,600px)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#8037f4]/10 blur-[100px] sm:h-[800px] sm:w-[800px] sm:blur-[140px]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-3xl px-6 pt-8 sm:pt-12">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="group mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition-colors hover:text-[#8037f4]"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Quay lại
        </button>

        <article>
          {/* Header Info */}
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100/80 px-3 py-1 text-xs font-bold uppercase tracking-wider text-[#8037f4] border border-violet-200">
              <Award className="h-3 w-3" />
              Câu chuyện thành công
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date(item.date).toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })}
            </span>
          </div>

          {/* Title */}
          <h1 className="mb-8 text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            {item.title}
          </h1>

          {/* Featured Image */}
          {item.imageUrl && (
            <div className="mx-auto mb-10 max-w-lg overflow-hidden rounded-3xl border border-slate-200/40 shadow-xl shadow-slate-200/30">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-auto object-contain"
              />
            </div>
          )}

          {/* Content Body */}
          <div className="prose prose-slate max-w-none">
            {(() => {
              if (!item.content) return null;
              const images = item.images || [];

              // Split content by [image:N|Caption] placeholders
              const parts = item.content.split(/(\[image:\d+(?:\|[^\]]*)?\])/g);
              
              if (parts.length === 1) {
                // No image placeholders, check for "---" dividers
                const sections = item.content.split(/\r?\n---\r?\n/);
                if (sections.length === 1) {
                  return renderTextWithListsAndHeadings(item.content);
                }
                
                return (
                  <div className="space-y-4">
                    {sections.map((section, idx) => {
                      const trimmed = section.trim();
                      if (!trimmed) {
                        return idx > 0 ? <hr key={idx} className="my-4 border-slate-200/60" /> : null;
                      }
                      return (
                        <React.Fragment key={idx}>
                          {idx > 0 && <hr className="my-4 border-slate-200/60" />}
                          {renderTextWithListsAndHeadings(trimmed)}
                        </React.Fragment>
                      );
                    })}
                  </div>
                );
              }

              return (
                <div className="space-y-4">
                  {parts.map((part, index) => {
                    if (part.startsWith("[image:") && part.endsWith("]")) {
                      const inner = part.slice(7, -1);
                      const [imgIndexStr, ...captionParts] = inner.split("|");
                      const imageIndex = parseInt(imgIndexStr, 10);
                      const caption = captionParts.join("|");
                      const imageUrl = images[imageIndex];
                      
                      if (!imageUrl) return null;

                      return (
                        <div key={index} className="mt-5 mb-2 flex flex-col items-center justify-center">
                          <div className="overflow-hidden rounded-2xl border border-slate-200/40 bg-slate-50 shadow-lg shadow-slate-200/30 transition-transform duration-500 hover:-translate-y-0.5 hover:shadow-violet-200/50 max-w-xl w-full">
                            <img
                              src={imageUrl}
                              alt={caption || `Hình ảnh đính kèm ${imageIndex + 1}`}
                              className="w-full h-auto object-contain"
                            />
                          </div>
                          {caption && (
                            <p className="mt-3 text-center text-sm font-semibold text-slate-500 italic max-w-lg">
                              {caption}
                            </p>
                          )}
                        </div>
                      );
                    }

                    // For text segment, check for "---" dividers
                    const sections = part.split(/\r?\n---\r?\n/);
                    return (
                      <React.Fragment key={index}>
                        {sections.map((section, idx) => {
                          const trimmed = section.trim();
                          if (!trimmed) {
                            return idx > 0 ? <hr key={idx} className="my-4 border-slate-200/60" /> : null;
                          }
                          return (
                            <React.Fragment key={idx}>
                              {idx > 0 && <hr className="my-4 border-slate-200/60" />}
                              {renderTextWithListsAndHeadings(trimmed)}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Gallery Images (Only show images not rendered inline) */}
          {(() => {
            const usedIndices = new Set();
            if (item.content) {
              const matches = item.content.matchAll(/\[image:(\d+)(?:\|[^\]]*)?\]/g);
              for (const match of matches) {
                usedIndices.add(parseInt(match[1], 10));
              }
            }
            const galleryImages = (item.images || []).filter((_, idx) => !usedIndices.has(idx));

            if (galleryImages.length === 0) return null;

            return (
              <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
                {galleryImages.map((img, idx) => (
                  <div key={idx} className="overflow-hidden rounded-2xl border border-slate-200/40 bg-slate-50 shadow-lg shadow-slate-200/30 transition-transform duration-500 hover:-translate-y-1 hover:shadow-violet-200/50 group">
                    <img src={img} alt={`Hình ảnh ${idx + 1}`} className="w-full h-auto object-contain transition-transform duration-700 group-hover:scale-105" />
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Author/Sign-off Card */}
          <div className="mt-12 flex items-center gap-3 border-t border-slate-100 pt-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white p-2 shadow-sm border border-slate-100 shrink-0">
              <img
                src="/logo-mark.png?v=9"
                alt="ProInterview"
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800 leading-tight">ProInterview Team</p>
              <p className="text-[10px] text-slate-400 leading-tight">contact@prointerview.vn</p>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
