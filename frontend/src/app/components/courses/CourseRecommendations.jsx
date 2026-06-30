import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowRight, GraduationCap, Star, Users, BadgeCheck, PlayCircle, AlertTriangle, TrendingUp, Zap, ShoppingBag } from "lucide-react";

import { fetchCourses, mapApiCourseToCard } from "../../api/courseApi.js";
import { formatVnd } from "../../utils/shared/formatVnd.js";

export function CourseRecommendations({
  courses: propCourses,
  tags,
  title = "Khóa học gợi ý cho bạn",
  subtitle,
  variant = "inline",
  currentStep,
  maxCourses = 3,
  weakAreas,
  weakScores,
  overallScore,
  totalFillers = 0,
  avgWpm = 0,
  avgWordCount = 0,
  behavioralSummary = null,
  position = "Phỏng vấn AI",
}) {
  const navigate = useNavigate();
  const [apiCourses, setApiCourses] = useState([]);
  const [loading, setLoading] = useState(!propCourses);

  useEffect(() => {
    if (propCourses) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const res = await fetchCourses();
      if (cancelled) return;
      if (res.success && Array.isArray(res.courses)) {
        setApiCourses(res.courses.map(mapApiCourseToCard));
      } else {
        setApiCourses([]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [propCourses]);

  const courses = useMemo(() => {
    if (propCourses) return propCourses.slice(0, maxCourses);

    let pool = apiCourses;
    if (tags?.length) {
      const tagged = apiCourses.filter((course) =>
        course.tags?.some((tag) => tags.includes(tag)),
      );
      if (tagged.length > 0) pool = tagged;
    }
    return pool.slice(0, maxCourses);
  }, [propCourses, apiCourses, tags, maxCourses]);

  if (loading) return null;
  if (courses.length === 0) return null;

  const weakScoreColor = (avg) =>
    avg >= 4 ? "#B4F000" : avg >= 3 ? "#facc15" : "#f87171";

  // Course card renderer
  const renderCourseCard = (course, compact = false, linkedWeak = null) => {
    return (
      <div
        key={course.id}
        onClick={() => navigate(`/courses/${course.id}`)}
        className="rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget).style.border = "1px solid rgba(128, 55, 244, 0.4)";
          (e.currentTarget).style.boxShadow = "0 20px 60px rgba(128, 55, 244, 0.15)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget).style.border = "1px solid rgba(255,255,255,0.08)";
          (e.currentTarget).style.boxShadow = "none";
        }}
      >
        {/* Thumbnail */}
        <div className={`relative ${compact ? "h-32" : "h-40"} overflow-hidden`}>
          <img
            src={course.thumbnail}
            alt={course.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ background: "rgba(128, 55, 244,0.85)" }}
            >
              <PlayCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          
          {/* Top badging */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 max-w-[80%] items-start">
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full animate-fade-in"
              style={{ background: "rgba(128, 55, 244, 0.85)", color: "#fff" }}
            >
              {course.category}
            </span>
            {linkedWeak && (() => {
              let message = `Cải thiện: ${linkedWeak.label.split(" ")[0]}`;
              if (linkedWeak.key === "clarity") {
                if (totalFillers > 0) {
                  message = `Sửa lỗi dùng ${totalFillers} từ đệm`;
                } else if (avgWpm > 160) {
                  message = `Giảm tốc độ nói (~${avgWpm} từ/phút)`;
                } else {
                  message = "Tối ưu hóa độ lưu loát";
                }
              } else if (linkedWeak.key === "structure") {
                message = "Sửa cấu trúc câu trả lời STAR";
              } else if (linkedWeak.key === "relevance") {
                message = "Khắc phục lỗi trả lời lạc đề";
              } else if (linkedWeak.key === "credibility") {
                message = "Bổ sung số liệu thực tế thuyết phục";
              }
              return (
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 whitespace-nowrap"
                  style={{
                    background: `color-mix(in srgb, ${weakScoreColor(linkedWeak.avg)} 20%, #000)`,
                    color: weakScoreColor(linkedWeak.avg),
                    border: `1px solid ${weakScoreColor(linkedWeak.avg)}50`,
                  }}
                >
                  <Zap className="w-2.5 h-2.5 shrink-0" />
                  {message}
                </span>
              );
            })()}
          </div>
          
          {/* Duration badge */}

          <div className="absolute bottom-3 right-3">
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(0,0,0,0.7)", color: "rgba(255,255,255,0.8)" }}
            >
              {Math.floor(course.duration / 60)}h
              {course.duration % 60 > 0 ? ` ${course.duration % 60}m` : ""}
            </span>
          </div>
        </div>

        <div className={compact ? "p-4" : "p-5"}>
          <h3
            className="text-white mb-2 group-hover:text-[#B4F000] transition-colors leading-snug line-clamp-2"
            style={{ fontSize: compact ? "0.875rem" : "0.9375rem", fontWeight: 600 }}
          >
            {course.title}
          </h3>

          {/* Mentor */}
          <div className="flex items-center gap-2 mb-1.5">
            <img
              src={course.mentorAvatar}
              alt={course.mentorName}
              className="w-6 h-6 rounded-full object-cover"
            />
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>
              {course.mentorName}
            </span>
            <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-[#B4F000]" aria-hidden />
          </div>

          {/* Mentor support value highlight */}
          <div className="mb-3 flex items-center gap-1.5 text-[10px] text-white/50">
            <span className="w-1.5 h-1.5 rounded-full bg-[#B4F000] shrink-0" />
            <span>Hỗ trợ hỏi đáp 1-1 trực tiếp với Mentor</span>
          </div>

          {/* Target Score Promise */}
          {linkedWeak && (
            <div className="mt-2 mb-3.5 flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/5 px-2.5 py-1.5 text-[10px] text-white/80 whitespace-nowrap overflow-hidden">
              <span className="text-orange-400 font-bold shrink-0 font-mono text-[9px] uppercase border border-orange-400/30 rounded px-1">Mục tiêu</span>
              <span className="truncate">{linkedWeak.label.split(" ")[0]} {linkedWeak.avg.toFixed(1)}/5 → <strong className="text-[#B4F000]">4.5+/5</strong></span>
            </div>
          )}

          {/* Stats + Price */}
          <div
            className="flex items-center justify-between pt-3"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
          >
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <Star className="w-3.5 h-3.5" style={{ color: "#FFD600" }} />
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#fff" }}>
                  {course.rating ?? "—"}
                </span>
              </div>
              <div className="flex items-center gap-1" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem" }}>
                <Users className="w-3.5 h-3.5" />
                <span>{course.studentsCount} học viên</span>
              </div>
            </div>
            <span style={{ fontWeight: 800, color: "#B4F000", fontSize: "1.05rem" }}>
              {course.price === 0 ? "Miễn phí" : formatVnd(course.price)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="mt-3.5 flex gap-2 w-full">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/courses/${course.id}`);
              }}
              className="flex-1 py-2.5 rounded-xl text-[11px] font-bold transition-all text-center flex items-center justify-center gap-1 text-white/80 border border-white/10 bg-white/5 hover:bg-white/10"
            >
              Xem chi tiết
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/checkout?type=course&courseId=${course.id}&price=${course.price}`);
              }}
              className="flex-1 py-2.5 rounded-xl text-[11px] font-extrabold transition-all text-center flex items-center justify-center gap-1.5 hover:brightness-110"
              style={{
                background: "#B4F000",
                color: "#1a0a3e",
              }}
            >
              <ShoppingBag className="w-3.5 h-3.5" /> Mua ngay
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (variant === "full-section") {
    return (
      <div
        className="rounded-3xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a0a3e 0%, #2d1060 100%)" }}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <GraduationCap className="w-4 h-4 text-[#B4F000]" />
                <span className="text-[#B4F000] font-bold text-xs uppercase tracking-wide">Được gợi ý</span>
              </div>
              <h3 className="text-white font-bold text-lg">{title}</h3>
              {subtitle && <p className="text-white/55 text-sm mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={() => navigate("/courses")}
              className="text-white/60 hover:text-white transition-colors text-sm font-medium flex items-center gap-1 shrink-0"
            >
              Xem tất cả <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Course cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => renderCourseCard(course, true))}
          </div>

          {/* Journey note */}
          <div
            className="mt-5 flex items-center gap-3 p-3.5 rounded-2xl"
            style={{ background: "rgba(180,240,0,0.08)", border: "1px solid rgba(180,240,0,0.2)" }}
          >
            <GraduationCap className="w-5 h-5 text-[#B4F000] shrink-0" />
            <p className="text-white/70 text-xs">
              <span className="text-white font-semibold">Luồng khuyên dùng:</span>{" "}
              Học khóa học phù hợp → Đặt lịch mentor 1-1 để củng cố kiến thức & nhận phản hồi trực tiếp
            </p>
            <button
              onClick={() => navigate("/mentors")}
              className="px-4 py-2 rounded-xl font-bold text-xs shrink-0 transition-all hover:brightness-110"
              style={{ background: "#B4F000", color: "#1F1F1F" }}
            >
              Đặt lịch Mentor
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "banner") {
    const topWeak = weakScores?.slice(0, 3) ?? [];
    const worstWeak = topWeak[0];
    const scoreColor = (avg) =>
      avg >= 4 ? "#B4F000" : avg >= 3 ? "#facc15" : "#f87171";
    const scoreBg = (avg) =>
      avg >= 4
        ? "rgba(180,240,0,0.15)"
        : avg >= 3
          ? "rgba(250,204,21,0.15)"
          : "rgba(248,113,113,0.15)";
    const scoreLabel = (avg) =>
      avg >= 4 ? "Tốt" : avg >= 3 ? "Cần cải thiện" : "Yếu — ưu tiên";

    return (
      <div
        className="rounded-3xl overflow-hidden"
        style={{ background: "linear-gradient(135deg, #1a0a3e 0%, #2d1060 100%)" }}
      >
        <div className="p-6">

          {/* ── Diagnosis header ── */}
          {topWeak.length > 0 && (
            <div
              className="mb-5 rounded-2xl p-4"
              style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.2)" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#f87171" }} />
                <span className="text-sm font-bold" style={{ color: "#f87171" }}>
                  AI phát hiện {topWeak.length} điểm yếu cần cải thiện ngay
                </span>
                {overallScore != null && (
                  <span
                    className="ml-auto text-xs font-bold px-2.5 py-1 rounded-full"
                    style={{ background: scoreBg(overallScore), color: scoreColor(overallScore) }}
                  >
                    Tổng điểm: {overallScore.toFixed(1)}/5
                  </span>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {topWeak.map((ws, idx) => (
                  <div
                    key={ws.key ?? idx}
                    className="rounded-xl p-3"
                    style={{ background: scoreBg(ws.avg), border: `1px solid ${scoreColor(ws.avg)}30` }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-white/80 text-xs font-semibold truncate pr-2">{ws.label}</span>
                      <span className="text-xs font-bold shrink-0" style={{ color: scoreColor(ws.avg) }}>
                        {ws.avg.toFixed(1)}/5
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(ws.avg / 5) * 100}%`, background: scoreColor(ws.avg) }}
                      />
                    </div>
                    <div className="mt-1.5 flex items-center gap-1">
                      {idx === 0 && <Zap className="w-3 h-3 shrink-0" style={{ color: scoreColor(ws.avg) }} />}
                      <span className="text-[10px] font-semibold" style={{ color: scoreColor(ws.avg) }}>
                        {scoreLabel(ws.avg)}{idx === 0 ? " · Ưu tiên #1" : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {worstWeak && (
                <p className="mt-3 text-white/60 text-xs leading-relaxed">
                  <span className="text-white font-semibold">Tại sao quan trọng?</span>{" "}
                  {worstWeak.key === "structure" && "87% ứng viên bị loại vì câu trả lời thiếu cấu trúc STAR — HR không thể đánh giá năng lực khi không thấy Action & Result rõ ràng."}
                  {worstWeak.key === "credibility" && "Câu trả lời không có số liệu cụ thể khiến HR nghi ngờ bạn chưa thực sự làm. Ứng viên có số liệu được offer lương cao hơn 23%."}
                  {worstWeak.key === "relevance" && "Trả lời lạc đề là lý do #1 bị loại vòng HR screening. Mỗi câu trả lời cần map trực tiếp vào yêu cầu JD."}
                  {worstWeak.key === "clarity" && "Từ đệm và câu lủng củng khiến bạn nghe thiếu tự tin. HR ra quyết định trong 7 phút đầu — ấn tượng đầu rất quan trọng."}
                  {!["structure","credibility","relevance","clarity"].includes(worstWeak.key) && "Cải thiện kỹ năng này sẽ giúp bạn tăng tỉ lệ pass vòng HR và tạo ấn tượng tốt hơn với nhà tuyển dụng."}
                </p>
              )}
            </div>
          )}

          

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingUp className="w-4 h-4 text-[#B4F000]" />
                <span className="text-[#B4F000] font-bold text-xs uppercase tracking-wide">
                  Được gợi ý dựa trên kết quả của bạn
                </span>
              </div>
              <h3 className="text-white font-bold text-lg">{title}</h3>
              {subtitle && <p className="text-white/55 text-sm mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={() => navigate("/courses")}
              className="text-white/60 hover:text-white transition-colors text-sm font-medium flex items-center gap-1 shrink-0"
            >
              Xem tất cả <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Course cards with weakness mapping */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course, idx) => {
              const linkedWeak = topWeak.length > 0 ? topWeak[idx % topWeak.length] : null;
              return renderCourseCard(course, true, linkedWeak);
            })}
          </div>

          {/* Journey note — urgent */}
          <div
            className="mt-5 flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-2xl"
            style={{ background: "rgba(180,240,0,0.08)", border: "1px solid rgba(180,240,0,0.2)" }}
          >
            <div className="flex-1">
              <p className="text-white font-semibold text-sm mb-0.5">
                Lộ trình cải thiện hiệu quả nhất
              </p>
              <p className="text-white/65 text-xs leading-relaxed">
                Học khóa học → Luyện tập lại với AI phỏng vấn → Đặt lịch mentor 1-1 để nhận phản hồi trực tiếp.
                Người dùng theo lộ trình này cải thiện điểm trung bình <span className="text-[#B4F000] font-bold">+1.4 điểm</span> sau 1 tuần.
              </p>
            </div>
            <button
              onClick={() => navigate("/mentors")}
              className="px-4 py-2 rounded-xl font-bold text-xs shrink-0 transition-all hover:brightness-110 whitespace-nowrap"
              style={{ background: "#B4F000", color: "#1F1F1F" }}
            >
              Đặt lịch Mentor ngay
            </button>
          </div>

          
        </div>
      </div>
    );
  }

  // inline variant
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#8037f4]" />
            {title}
          </h3>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <button
          onClick={() => navigate("/courses")}
          className="text-sm font-semibold flex items-center gap-1 transition-colors"
          style={{ color: "#8037f4" }}
        >
          Xem tất cả <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => renderCourseCard(course))}
      </div>
    </div>
  );
}
