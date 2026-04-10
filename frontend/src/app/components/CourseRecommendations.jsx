import { useNavigate } from "react-router";
import { ArrowRight, GraduationCap, Star, Users, BadgeCheck, PlayCircle } from "lucide-react";

import { RecommendedJourney } from "./RecommendedJourney";
import { COURSES_DATA } from "../data/coursesData";

export function CourseRecommendations({
  courses: propCourses,
  tags,
  title = "Khóa học gợi ý cho bạn",
  subtitle,
  variant = "inline",
  currentStep,
  maxCourses = 3,
  weakAreas,
}) {
  const navigate = useNavigate();

  // Determine courses to display
  let courses = [];
  
  if (propCourses) {
    courses = propCourses;
  } else if (tags && tags.length > 0) {
    // Filter courses by tags
    courses = COURSES_DATA.filter(course => 
      course.tags?.some(tag => tags.includes(tag))
    );
  } else {
    // Default: show first 3 courses
    courses = COURSES_DATA;
  }

  // Limit courses
  courses = courses.slice(0, maxCourses);

  if (courses.length === 0) return null;

  // Course card renderer
  const renderCourseCard = (course, compact = false) => (
    <div
      key={course.id}
      onClick={() => navigate(`/courses/${course.id}`)}
      className="rounded-2xl overflow-hidden cursor-pointer group transition-all hover:-translate-y-1"
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget).style.border = "1px solid rgba(110, 53, 232,0.4)";
        (e.currentTarget).style.boxShadow = "0 20px 60px rgba(110, 53, 232,0.15)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget).style.border = "1px solid rgba(255,255,255,0.08)";
        (e.currentTarget).style.boxShadow = "none";
      }}
    >
      {/* Thumbnail */}
      <div className={`relative ${compact ? 'h-32' : 'h-40'} overflow-hidden`}>
        <img
          src={course.thumbnail}
          alt={course.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: "rgba(110, 53, 232,0.85)" }}
          >
            <PlayCircle className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="absolute top-3 left-3">
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ background: "rgba(110, 53, 232,0.85)", color: "#fff" }}
          >
            {course.category}
          </span>
        </div>
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
        <div className="flex items-center gap-2 mb-3">
          <img
            src={course.mentorAvatar}
            alt={course.mentorName}
            className="w-6 h-6 rounded-full object-cover"
          />
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>
            {course.mentorName}
          </span>
          <SealCheck className="w-3.5 h-3.5 text-[#B4F000]" />
        </div>

        {/* Stats + Price */}
        <div
          className="flex items-center justify-between pt-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5" style={{ color: "#FFD600" }} />
              <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#fff" }}>
                {course.rating}
              </span>
            </div>
            <div className="flex items-center gap-1" style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.75rem" }}>
              <Users className="w-3.5 h-3.5" />
              <span>{course.studentsCount}</span>
            </div>
          </div>
          <span style={{ fontWeight: 700, color: "#B4F000" }}>
            {course.price === 0
              ? "Miễn phí"
              : new Intl.NumberFormat("vi-VN", {
                  style: "currency",
                  currency: "VND",
                }).format(course.price)}
          </span>
        </div>
      </div>
    </div>
  );

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

  // inline variant
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-[#6E35E8]" />
            {title}
          </h3>
          {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <button
          onClick={() => navigate("/courses")}
          className="text-sm font-semibold flex items-center gap-1 transition-colors"
          style={{ color: "#6E35E8" }}
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