import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  Search as MagnifyingGlass,
  Star,
  Filter as Funnel,
  Clock,
  CheckCircle,
  ChevronDown as CaretDown,
  X,
  Loader2 as CircleNotch,
  Users,
  Zap as Lightning,
  BadgeCheck as SealCheck,
} from "lucide-react";
import { fetchMentors } from "../utils/mentorApi";
import { FIELDS } from "../data/mockData";

const EXPERIENCE_OPTIONS = ["Tất cả", "1-3 năm", "4-6 năm", "7+ năm"];
const PRICE_OPTIONS = [
  { label: "Tất cả", min: 0, max: Infinity },
  { label: "Dưới 280k", min: 0, max: 280000 },
  { label: "280k - 320k", min: 280000, max: 320000 },
  { label: "Trên 320k", min: 320000, max: Infinity },
];
const RATING_OPTIONS = ["Tất cả", "4.5+", "4.0+", "3.5+"];

export function Mentors() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedField, setSelectedField] = useState("Tất cả");
  const [selectedExp, setSelectedExp] = useState("Tất cả");
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [selectedRating, setSelectedRating] = useState("Tất cả");
  const [availableOnly, setAvailableOnly] = useState(false);

  const [mentors, setMentors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Dropdown states
  const [openDropdown, setOpenDropdown] = useState(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    fetchMentors()
      .then((data) => { 
        console.log("Mentors loaded:", data); 
        setMentors(data); 
        setLoading(false); 
      })
      .catch((e) => { 
        console.error("Error loading mentors:", e);
        setError(String(e)); 
        setLoading(false); 
      });
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredMentors = useMemo(() => {
    console.log("Filtering mentors. Total mentors:", mentors.length);
    console.log("Filters:", { search, selectedField, selectedExp, selectedPrice, selectedRating, availableOnly });
    const filtered = mentors.filter((m) => {
      const matchSearch = search === "" || m.name.toLowerCase().includes(search.toLowerCase()) || m.title.toLowerCase().includes(search.toLowerCase()) || m.field.toLowerCase().includes(search.toLowerCase()) || m.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
      const matchField = selectedField === "Tất cả" || m.field === selectedField;
      const matchExp =
        selectedExp === "Tất cả" ||
        (selectedExp === "1-3 năm" && m.experience <= 3) ||
        (selectedExp === "4-6 năm" && m.experience >= 4 && m.experience <= 6) ||
        (selectedExp === "7+ năm" && m.experience >= 7);
      const priceRange = PRICE_OPTIONS[selectedPrice];
      const matchPrice = m.price >= priceRange.min && m.price <= priceRange.max;
      const matchRating =
        selectedRating === "Tất cả" ||
        (selectedRating === "4.5+" && m.rating >= 4.5) ||
        (selectedRating === "4.0+" && m.rating >= 4.0) ||
        (selectedRating === "3.5+" && m.rating >= 3.5);
      const matchAvail = !availableOnly || m.available;
      return matchSearch && matchField && matchExp && matchPrice && matchRating && matchAvail;
    });
    console.log("Filtered mentors count:", filtered.length);
    return filtered;
  }, [search, selectedField, selectedExp, selectedPrice, selectedRating, availableOnly, mentors]);

  // Dropdown Component
  const Dropdown = ({ 
    id, 
    label, 
    value, 
    icon 
  }) => {
    const isOpen = openDropdown === id;
    return (
      <div className="relative">
        <button
          onClick={() => setOpenDropdown(isOpen ? null : id)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all"
          style={{
            background: value !== "Tất cả" ? "rgba(110, 53, 232,0.08)" : "#fff",
            borderColor: value !== "Tất cả" ? "#6E35E8" : "#E5E7EB",
            color: value !== "Tất cả" ? "#6E35E8" : "#6B7280"
          }}
        >
          {icon}
          <span className="max-w-[120px] truncate">{label}: <strong>{value}</strong></span>
          <CaretDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div 
            className="absolute top-full left-0 mt-2 bg-white rounded-xl border border-gray-200 shadow-xl z-50 min-w-[200px] py-2 max-h-[300px] overflow-y-auto"
            style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.12)" }}
          >
            {id === "field" && (
              <>
                {["Tất cả", ...FIELDS].map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setSelectedField(f);
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-all ${
                      selectedField === f 
                        ? "bg-[#6E35E8]/10 text-[#6E35E8] font-semibold" 
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </>
            )}

            {id === "exp" && (
              <>
                {EXPERIENCE_OPTIONS.map((e) => (
                  <button
                    key={e}
                    onClick={() => {
                      setSelectedExp(e);
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-all ${
                      selectedExp === e 
                        ? "bg-[#6E35E8]/10 text-[#6E35E8] font-semibold" 
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </>
            )}

            {id === "price" && (
              <>
                {PRICE_OPTIONS.map((p, i) => (
                  <button
                    key={p.label}
                    onClick={() => {
                      setSelectedPrice(i);
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-all ${
                      selectedPrice === i 
                        ? "bg-[#6E35E8]/10 text-[#6E35E8] font-semibold" 
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </>
            )}

            {id === "rating" && (
              <>
                {RATING_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      setSelectedRating(r);
                      setOpenDropdown(null);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm transition-all ${
                      selectedRating === r 
                        ? "bg-[#6E35E8]/10 text-[#6E35E8] font-semibold" 
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {r === "Tất cả" ? r : (
                      <span className="flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> {r}
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: "#F4F5F7" }}>
      {/* ── Hero Banner ─────────────────────────────────── */}
      <div
        className="relative overflow-hidden border-b border-white/5 bg-background"
        style={{ background: "linear-gradient(145deg, #0E0922 0%, #1a0d35 100%)" }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-20 -left-20 w-80 h-80 bg-white rounded-full blur-3xl" />
          <div className="absolute -bottom-10 right-10 w-96 h-96 bg-[#B4F000] rounded-full blur-3xl" />
        </div>
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.05]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)",
          backgroundSize: "40px 40px"
        }} />
        <div className="relative max-w-7xl mx-auto px-6 py-16">
            <div className="flex items-center gap-3 mb-4">
              <Users className="text-primary-fixed size-5" />
              <span className="text-secondary font-bold uppercase tracking-[0.2em] text-xs">Mentor 1-1</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tighter leading-none text-white mb-4 whitespace-nowrap">
              Tìm Mentor <span className="text-primary-fixed">phù hợp.</span>
            </h1>
            <p className="text-lg text-zinc-400 leading-relaxed mb-8 max-w-2xl">
              Đặt lịch phỏng vấn 1-1 với các HR/Manager từ Shopee, Grab, VNG và 200+ công ty hàng đầu
            </p>
          {/* Stats */}
          <div className="flex flex-wrap gap-6">
            {[
              { icon: Users, value: "500+", label: "Mentor chuyên nghiệp" },
              { icon: Lightning, value: "24/7", label: "Đặt lịch bất kỳ lúc nào" },
              { icon: SealCheck, value: "4.8★", label: "Điểm hài lòng trung bình" },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.12)" }}>
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{s.value}</p>
                  <p className="text-white/55 text-xs">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">

      {/* Search */}
      <div className="mb-5">
        <div className="relative">
          <MagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 text-sm focus:outline-none focus:border-[#6E35E8]/50 bg-white shadow-sm focus:shadow-md transition-all"
            placeholder="Tìm theo tên, ngành, kỹ năng..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar with Dropdowns */}
      <div ref={dropdownRef} className="mb-6">
        <div className="card-premium p-4">
          <div className="flex items-center gap-3 mb-3">
            <Funnel className="w-4 h-4 text-[#6E35E8]" />
            <h2 className="text-gray-800 font-semibold text-sm">Bộ lọc</h2>
            {(selectedField !== "Tất cả" || selectedExp !== "Tất cả" || selectedPrice !== 0 || selectedRating !== "Tất cả" || availableOnly) && (
              <button
                onClick={() => {
                  setSelectedField("Tất cả");
                  setSelectedExp("Tất cả");
                  setSelectedPrice(0);
                  setSelectedRating("Tất cả");
                  setAvailableOnly(false);
                }}
                className="ml-auto text-xs font-medium px-3 py-1.5 rounded-lg text-gray-500 hover:text-[#6E35E8] hover:bg-[#6E35E8]/5 transition-all"
              >
                Xóa bộ lọc
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Available Only Toggle */}
            <button
              onClick={() => setAvailableOnly(!availableOnly)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                availableOnly 
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700" 
                  : "bg-white border-gray-200 text-gray-600 hover:border-emerald-200"
              }`}
            >
              <CheckCircle className={`w-4 h-4 ${availableOnly ? "text-emerald-500 fill-emerald-500" : "text-gray-400"}`} />
              Có lịch trống
            </button>

            {/* Field Dropdown */}
            <Dropdown 
              id="field" 
              label="Lĩnh vực" 
              value={selectedField} 
            />

            {/* Experience Dropdown */}
            <Dropdown 
              id="exp" 
              label="Kinh nghiệm" 
              value={selectedExp} 
            />

            {/* Price Dropdown */}
            <Dropdown 
              id="price" 
              label="Giá" 
              value={PRICE_OPTIONS[selectedPrice].label} 
            />

            {/* Rating Dropdown */}
            <Dropdown 
              id="rating" 
              label="Đánh giá" 
              value={selectedRating}
              icon={selectedRating !== "Tất cả" ? <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" /> : null}
            />
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-5">
        <p className="text-gray-500 text-sm">
          {loading ? "Đang tải..." : <>Tìm thấy <span className="text-gray-900 font-semibold">{filteredMentors.length}</span> mentor phù hợp</>}
        </p>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card-premium overflow-hidden animate-pulse">
              <div className="p-5 pb-3">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex-shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3.5 bg-gray-100 rounded-full w-3/4" />
                    <div className="h-3 bg-gray-100 rounded-full w-1/2" />
                    <div className="h-3 bg-gray-100 rounded-full w-2/5" />
                  </div>
                </div>
                <div className="flex gap-1.5 mb-3">
                  <div className="h-5 w-16 bg-gray-100 rounded-full" />
                  <div className="h-5 w-20 bg-gray-100 rounded-full" />
                </div>
              </div>
              <div className="border-t border-gray-50 px-5 py-3 flex justify-between items-center">
                <div className="h-4 w-20 bg-gray-100 rounded-full" />
                <div className="h-8 w-16 bg-gray-100 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="text-center py-20">
          <Loader2 className="w-8 h-8 text-[#6E35E8] animate-spin mx-auto mb-3" />
          <p className="text-gray-500 font-medium">Không thể tải danh sách mentor</p>
          <button
            onClick={() => { setLoading(true); fetchMentors().then((d) => { setMentors(d); setLoading(false); setError(null); }); }}
            className="mt-3 text-sm font-semibold px-4 py-2 rounded-xl text-white"
            style={{ background: "#6E35E8" }}
          >
            Thử lại
          </button>
        </div>
      )}

      {/* Mentor Grid */}
      {!loading && !error && (filteredMentors.length === 0 ? (
        <div className="text-center py-20">
          <MagnifyingGlass className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Không tìm thấy mentor phù hợp</p>
          <p className="text-gray-400 text-sm mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredMentors.map((mentor) => (
            <div
              key={mentor.id}
              className="bg-white rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:-translate-y-1"
              style={{ border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}
              onClick={() => navigate(`/mentors/${mentor.id}`)}
              onMouseEnter={e => { (e.currentTarget).style.boxShadow = "0 12px 32px rgba(110, 53, 232,0.15)"; }}
              onMouseLeave={e => { (e.currentTarget).style.boxShadow = "0 2px 12px rgba(0,0,0,0.05)"; }}
            >
              {/* Top accent bar */}
              <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #6E35E8, #9B6DFF)" }} />

              <div className="p-5">
                {/* Avatar + info */}
                <div className="flex items-start gap-3 mb-4">
                  <div className="relative flex-shrink-0">
                    <img
                      src={mentor.avatar}
                      alt={mentor.name}
                      className="w-14 h-14 rounded-2xl object-cover"
                      style={{ border: "2px solid rgba(110, 53, 232,0.1)" }}
                    />
                    {mentor.available && (
                      <div
                        className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white"
                        style={{ background: "#22c55e" }}
                        title="Có lịch trống"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate" style={{ color: "#1F1F1F", letterSpacing: "-0.01em" }}>
                      {mentor.name}
                    </h3>
                    <p className="text-xs truncate mt-0.5" style={{ color: "#6B7280" }}>{mentor.title}</p>
                    <p className="text-xs font-semibold mt-0.5" style={{ color: "#6E35E8" }}>{mentor.company}</p>
                  </div>
                </div>

                {/* Rating row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <Star className="w-3.5 h-3.5" style={{ color: "#FFD600", fill: "#FFD600" }} />
                    <span className="font-bold text-sm" style={{ color: "#1F1F1F" }}>{mentor.rating}</span>
                    <span className="text-xs" style={{ color: "#9CA3AF" }}>({mentor.reviews} đánh giá)</span>
                  </div>
                  <div className="flex items-center gap-1 text-xs" style={{ color: "#9CA3AF" }}>
                    <Clock className="w-3 h-3" />
                    {mentor.responseTime}
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {mentor.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                      style={{ background: "rgba(110, 53, 232,0.08)", color: "#6E35E8" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Footer */}
                <div
                  className="flex items-center justify-between pt-3"
                  style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}
                >
                  <div>
                    <span className="font-bold text-sm" style={{ color: "#1F1F1F" }}>
                      {mentor.price.toLocaleString("vi")}đ
                    </span>
                    <span className="text-xs" style={{ color: "#9CA3AF" }}> / giờ</span>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(`/booking/${mentor.id}`); }}
                    className="text-white text-xs font-bold px-4 py-2 rounded-xl transition-all"
                    style={{
                      background: "linear-gradient(135deg, #6E35E8, #8B4DFF)",
                      boxShadow: "0 4px 12px rgba(110, 53, 232,0.3)",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
                    onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                  >
                    Đặt lịch
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
      </div>
    </div>
  );
}