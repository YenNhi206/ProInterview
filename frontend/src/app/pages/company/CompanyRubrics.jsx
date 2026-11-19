import React, { useState, useEffect, useCallback } from "react";
import {
  Sliders,
  Plus,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  AlertCircle,
  RefreshCw,
  Building2,
  Trash2,
  Loader2,
  ChevronRight,
  Eye,
  Info,
} from "lucide-react";
import { companyApi } from "../../api/companyApi.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";

const ROLE_CATEGORIES = [
  { id: "software_engineer", label: "Software Engineer" },
  { id: "frontend", label: "Frontend Developer" },
  { id: "backend", label: "Backend Developer" },
  { id: "fullstack", label: "Fullstack Developer" },
  { id: "devops", label: "DevOps / SRE" },
  { id: "mobile", label: "Mobile Developer" },
  { id: "data_engineer", label: "Data Engineer" },
];

const SHRM_KEYS = [
  { id: "technical_mastery", label: "Technical Mastery (Chuyên môn kỹ thuật)" },
  { id: "problem_solving", label: "Problem Solving (Giải quyết vấn đề)" },
  { id: "communication", label: "Communication (Giao tiếp & Truyền đạt)" },
  { id: "teamwork", label: "Teamwork & Collaboration (Làm việc nhóm)" },
  { id: "leadership", label: "Leadership (Khả năng lãnh đạo)" },
  { id: "adaptability", label: "Adaptability (Thích ứng & Học hỏi)" },
];

export function CompanyRubrics() {
  const [rubrics, setRubrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewRubric, setViewRubric] = useState(null);

  // Form state
  const [title, setTitle] = useState("");
  const [roleCategory, setRoleCategory] = useState("software_engineer");
  const [description, setDescription] = useState("");
  const [criteria, setCriteria] = useState([
    {
      name: "Kiến thức kiến trúc và hệ thống",
      weight: 40,
      shrmKey: "technical_mastery",
      scaleDescriptions: {
        0: "Chưa có khái niệm cơ bản",
        1: "Hiểu biết bề mặt, thiếu thực tế",
        2: "Nắm được kiến trúc thông dụng",
        3: "Thiết kế được module độc lập chuẩn chỉ",
        4: "Tối ưu hóa tốt, xử lý được tải lớn",
        5: "Chuyên gia, am hiểu sâu sắc hệ thống phân tán",
      },
    },
    {
      name: "Kỹ năng phân tích và giải quyết vấn đề",
      weight: 30,
      shrmKey: "problem_solving",
      scaleDescriptions: {
        0: "Bối rối, không tìm được nguyên nhân",
        1: "Cần nhiều gợi ý",
        2: "Xử lý được lỗi thông thường",
        3: "Tự phân tích root-cause bài bản",
        4: "Giải pháp sáng tạo, tối ưu chi phí",
        5: "Dự đoán và phòng ngừa rủi ro tương lai",
      },
    },
    {
      name: "Khả năng phối hợp và giao tiếp kỹ thuật",
      weight: 30,
      shrmKey: "communication",
      scaleDescriptions: {
        0: "Khó truyền đạt ý tưởng",
        1: "Giao tiếp rời rạc",
        2: "Trình bày đủ hiểu",
        3: "Rõ ràng, mạch lạc, lắng nghe tốt",
        4: "Thuyết phục được stakeholder",
        5: "Dẫn dắt và tạo ảnh hưởng kỹ thuật",
      },
    },
  ]);
  const [saving, setSaving] = useState(false);

  const fetchRubrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await companyApi.listRubrics({ roleCategory: selectedRole });
      if (res.success) {
        setRubrics(res.rubrics || []);
      }
    } catch (err) {
      toastApiError(err, "Không thể tải danh sách rubric.");
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => {
    fetchRubrics();
  }, [fetchRubrics]);

  const totalWeight = criteria.reduce((sum, c) => sum + (Number(c.weight) || 0), 0);

  const handleAddCriterion = () => {
    setCriteria([
      ...criteria,
      {
        name: "",
        weight: 10,
        shrmKey: "technical_mastery",
        scaleDescriptions: { 0: "", 1: "", 2: "", 3: "", 4: "", 5: "" },
      },
    ]);
  };

  const handleRemoveCriterion = (index) => {
    setCriteria(criteria.filter((_, idx) => idx !== index));
  };

  const handleCriterionChange = (index, field, value) => {
    setCriteria((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleCreateRubric = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (totalWeight !== 100) {
      toastApiError(`Tổng trọng số các tiêu chí phải chính xác bằng 100% (hiện tại: ${totalWeight}%).`);
      return;
    }

    setSaving(true);
    try {
      const res = await companyApi.createRubric({
        title,
        roleCategory,
        description,
        criteria,
      });

      if (res.success) {
        toastApiSuccess("Tạo rubric nháp thành công!");
        setShowCreateModal(false);
        fetchRubrics();
      }
    } catch (err) {
      toastApiError(err, "Không thể tạo rubric.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitRubric = async (id) => {
    if (!window.confirm("Bạn có chắc muốn gửi rubric này lên Platform Moderator để thẩm định?")) return;

    try {
      const res = await companyApi.submitRubric(id);
      if (res.success) {
        toastApiSuccess("Đã gửi rubric thành công! Vui lòng chờ Platform Moderator duyệt.");
        fetchRubrics();
      }
    } catch (err) {
      toastApiError(err, "Không thể gửi duyệt rubric.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Sliders className="size-6 text-violet-400" />
            Rubric đánh giá năng lực ứng viên
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Thiết lập tiêu chuẩn chấm điểm phỏng vấn độc quyền cho từng vị trí. Sau khi gửi, Platform Moderator sẽ thẩm định chất lượng.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 transition hover:bg-violet-500"
        >
          <Plus className="size-4" />
          Tạo Rubric mới
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-3.5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-300 focus:border-violet-500 focus:outline-none"
          >
            <option value="">Tất cả vị trí</option>
            {ROLE_CATEGORIES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={fetchRubrics}
          title="Làm mới"
          className="rounded-xl border border-slate-800 bg-slate-950 p-2 text-slate-400 hover:text-white transition"
        >
          <RefreshCw className="size-4" />
        </button>
      </div>

      {/* Rubrics List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          <div className="col-span-full py-12 text-center text-slate-400">
            <Loader2 className="mx-auto size-6 animate-spin text-violet-500" />
            <span className="mt-2 block text-xs">Đang tải danh sách rubric...</span>
          </div>
        ) : rubrics.length === 0 ? (
          <div className="col-span-full rounded-2xl border border-slate-800 bg-slate-900/40 py-12 text-center text-slate-400">
            <Sliders className="mx-auto size-8 text-slate-600" />
            <p className="mt-2 font-medium text-slate-300">Chưa có rubric nào</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Bấm nút "Tạo Rubric mới" để xây dựng bộ tiêu chí đánh giá chuẩn hóa.
            </p>
          </div>
        ) : (
          rubrics.map((r) => {
            const isApproved = r.status === "approved";
            const isPending = r.status === "pending_review";
            const isRejected = r.status === "rejected";
            const isDraft = r.status === "draft";
            const isArchived = r.status === "archived";

            return (
              <div
                key={r._id}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-xl transition hover:border-slate-700"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-md bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                      v{r.version} • {r.roleCategory}
                    </span>

                    {/* Status Badge */}
                    {isApproved && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
                        <CheckCircle2 className="size-3" /> Đã duyệt
                      </span>
                    )}
                    {isPending && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400">
                        <Clock className="size-3" /> Chờ duyệt
                      </span>
                    )}
                    {isRejected && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-400">
                        <XCircle className="size-3" /> Bị từ chối
                      </span>
                    )}
                    {isDraft && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-700/50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-400">
                        Bản nháp
                      </span>
                    )}
                    {isArchived && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-500">
                        Lưu trữ
                      </span>
                    )}
                  </div>

                  <h3 className="mt-3 font-bold text-white text-base leading-snug">
                    {r.title}
                  </h3>

                  {r.description && (
                    <p className="mt-1 text-xs text-slate-400 line-clamp-2">
                      {r.description}
                    </p>
                  )}

                  {/* Rejection comment */}
                  {isRejected && r.moderationReview?.comment && (
                    <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-300">
                      <strong>Lý do từ chối:</strong> {r.moderationReview.comment}
                    </div>
                  )}

                  <div className="mt-4 border-t border-slate-800/80 pt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      Tiêu chí đánh giá ({r.criteria?.length || 0})
                    </p>
                    <div className="space-y-1.5">
                      {r.criteria?.slice(0, 3).map((c, idx) => (
                        <div key={idx} className="flex items-center justify-between text-xs text-slate-300">
                          <span className="truncate pr-2">• {c.name}</span>
                          <span className="shrink-0 font-medium text-slate-400">{c.weight}%</span>
                        </div>
                      ))}
                      {r.criteria?.length > 3 && (
                        <p className="text-[10px] text-slate-500 italic">
                          +{r.criteria.length - 3} tiêu chí khác...
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between border-t border-slate-800/80 pt-3.5">
                  <button
                    onClick={() => setViewRubric(r)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300"
                  >
                    <Eye className="size-3.5" /> Xem chi tiết
                  </button>

                  {/* Action */}
                  {(isDraft || isRejected) && (
                    <button
                      onClick={() => handleSubmitRubric(r._id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-500 transition"
                    >
                      <Send className="size-3" />
                      Gửi duyệt
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Tạo Rubric mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <h3 className="font-bold text-white text-lg flex items-center gap-2">
              <Sliders className="size-5 text-violet-400" />
              Soạn Rubric đánh giá năng lực mới
            </h3>
            <p className="mt-1 text-xs text-slate-400">
              Tổng trọng số của các tiêu chí phải đạt chính xác 100% trước khi gửi duyệt.
            </p>

            <form onSubmit={handleCreateRubric} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Tên tiêu đề Rubric *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Khung đánh giá Senior Frontend Engineer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Vị trí ứng tuyển *
                  </label>
                  <select
                    value={roleCategory}
                    onChange={(e) => setRoleCategory(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                  >
                    {ROLE_CATEGORIES.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Mô tả ngắn
                  </label>
                  <input
                    type="text"
                    placeholder="Mục đích hoặc phạm vi áp dụng..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-white focus:border-violet-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Criteria Builder */}
              <div className="border-t border-slate-800 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Danh sách tiêu chí
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-bold ${
                        totalWeight === 100
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      Tổng: {totalWeight}% / 100%
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCriterion}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300"
                  >
                    <Plus className="size-3.5" /> Thêm tiêu chí
                  </button>
                </div>

                <div className="space-y-3">
                  {criteria.map((c, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5 space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <input
                          type="text"
                          required
                          placeholder="Tên tiêu chí (vd: Kiến thức thiết kế API)"
                          value={c.name}
                          onChange={(e) => handleCriterionChange(idx, "name", e.target.value)}
                          className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none"
                        />
                        <div className="flex items-center gap-1.5 w-24">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            required
                            value={c.weight}
                            onChange={(e) =>
                              handleCriterionChange(idx, "weight", Number(e.target.value))
                            }
                            className="w-16 rounded-lg border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-white text-right focus:border-violet-500 focus:outline-none"
                          />
                          <span className="text-xs text-slate-400">%</span>
                        </div>
                        {criteria.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCriterion(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400">SHRM Framework:</span>
                        <select
                          value={c.shrmKey}
                          onChange={(e) => handleCriterionChange(idx, "shrmKey", e.target.value)}
                          className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-300 focus:border-violet-500 focus:outline-none"
                        >
                          {SHRM_KEYS.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2.5 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving || totalWeight !== 100}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                  Lưu bản nháp
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Xem chi tiết Rubric */}
      {viewRubric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
                  Phiên bản {viewRubric.version} • {viewRubric.roleCategory}
                </span>
                <h3 className="mt-1 text-lg font-bold text-white">{viewRubric.title}</h3>
              </div>
              <button
                onClick={() => setViewRubric(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {viewRubric.description && (
                <p className="text-xs text-slate-300 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  {viewRubric.description}
                </p>
              )}

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Danh sách tiêu chí & Thang điểm 0–5
                </h4>
                <div className="space-y-3">
                  {viewRubric.criteria?.map((c, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-slate-800 bg-slate-950/70 p-4"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white text-sm">
                          {idx + 1}. {c.name}
                        </span>
                        <span className="rounded bg-violet-500/20 px-2 py-0.5 text-xs font-bold text-violet-300">
                          Trọng số: {c.weight}%
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Khung SHRM: {c.shrmKey}
                      </p>

                      {c.scaleDescriptions && (
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-slate-800/80 pt-2.5">
                          {Object.entries(c.scaleDescriptions).map(([level, desc]) => (
                            <div key={level} className="rounded bg-slate-900 p-2 text-[11px] border border-slate-800">
                              <span className="font-bold text-violet-400 block mb-0.5">
                                Mức {level}:
                              </span>
                              <span className="text-slate-300 line-clamp-3">{desc || "Chưa có mô tả"}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-800 pt-4">
              <button
                onClick={() => setViewRubric(null)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
