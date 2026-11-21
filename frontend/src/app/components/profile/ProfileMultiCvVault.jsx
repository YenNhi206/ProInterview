import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  Upload,
  Plus,
  CheckCircle2,
  Trash2,
  ExternalLink,
  Star,
  FileCheck,
  Edit2,
  Check,
  X,
  AlertCircle,
  Loader2,
  Download,
} from "lucide-react";
import { uploadFile } from "../../api/uploadApi.js";
import {
  fetchCandidateCvs,
  addCandidateCv,
  setDefaultCandidateCv,
  deleteCandidateCv,
  updateCandidateCv,
} from "../../api/candidateProfileApi.js";
import { resolveMediaUrl } from "../../utils/shared/mediaUrl.js";

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 KB";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function ProfileMultiCvVault({ initialCvs = [], onCvsChange }) {
  const [cvs, setCvs] = useState(initialCvs);
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Upload Form State
  const [newTitle, setNewTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [makeDefault, setMakeDefault] = useState(false);
  const fileInputRef = useRef(null);

  // Rename Inline State
  const [editingId, setEditingId] = useState(null);
  const [editTitleValue, setEditTitleValue] = useState("");

  // Load CVs on mount if empty
  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        const res = await fetchCandidateCvs();
        if (isMounted && res.success && Array.isArray(res.cvs)) {
          setCvs(res.cvs);
          if (onCvsChange) onCvsChange(res.cvs);
        }
      } catch (e) {
        console.error("Lỗi tải CVs:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const showToast = (msg, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(""), 4000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(""), 3500);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check extension
    const validExts = [".pdf", ".doc", ".docx"];
    const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExts.includes(ext)) {
      showToast("Chỉ chấp nhận file định dạng PDF, DOC hoặc DOCX.", true);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast("Dung lượng file tối đa là 10MB.", true);
      return;
    }

    setSelectedFile(file);
    if (!newTitle.trim()) {
      // Auto name from filename without extension
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      setNewTitle(`CV ${baseName}`);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      showToast("Vui lòng chọn file CV cần tải lên.", true);
      return;
    }

    try {
      setUploading(true);
      setErrorMsg("");

      // 1. Upload to storage
      const uploadRes = await uploadFile(selectedFile, "cv");
      if (!uploadRes.success) {
        showToast(uploadRes.error || "Không thể upload file CV.", true);
        setUploading(false);
        return;
      }

      // 2. Add to User's savedCvs
      const addRes = await addCandidateCv({
        title: newTitle.trim() || selectedFile.name,
        fileName: uploadRes.fileName || selectedFile.name,
        fileUrl: uploadRes.url,
        fileSize: selectedFile.size,
        isDefault: makeDefault || cvs.length === 0,
      });

      if (!addRes.success) {
        showToast(addRes.error || "Không thể lưu thông tin CV.", true);
        setUploading(false);
        return;
      }

      const updated = addRes.cvs || [];
      setCvs(updated);
      if (onCvsChange) onCvsChange(updated);

      showToast("Đã tải lên và lưu CV thành công!");
      setShowUploadModal(false);
      setSelectedFile(null);
      setNewTitle("");
      setMakeDefault(false);
    } catch (err) {
      showToast("Đã xảy ra lỗi trong quá trình tải lên.", true);
    } finally {
      setUploading(false);
    }
  };

  const handleSetDefault = async (cvId) => {
    try {
      const res = await setDefaultCandidateCv(cvId);
      if (res.success && Array.isArray(res.cvs)) {
        setCvs(res.cvs);
        if (onCvsChange) onCvsChange(res.cvs);
        showToast("Đã đặt làm CV mặc định!");
      } else {
        showToast(res.error || "Không thể đổi CV mặc định.", true);
      }
    } catch (e) {
      showToast("Lỗi khi cập nhật CV mặc định.", true);
    }
  };

  const handleDelete = async (cvId, title) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa "${title || "CV này"}" khỏi danh sách lưu trữ?`)) {
      return;
    }
    try {
      const res = await deleteCandidateCv(cvId);
      if (res.success && Array.isArray(res.cvs)) {
        setCvs(res.cvs);
        if (onCvsChange) onCvsChange(res.cvs);
        showToast("Đã xóa CV thành công!");
      } else {
        showToast(res.error || "Không thể xóa CV.", true);
      }
    } catch (e) {
      showToast("Lỗi khi xóa CV.", true);
    }
  };

  const handleStartRename = (cv) => {
    setEditingId(cv.id);
    setEditTitleValue(cv.title);
  };

  const handleSaveRename = async (cvId) => {
    if (!editTitleValue.trim()) {
      showToast("Tiêu đề CV không được để trống.", true);
      return;
    }
    try {
      const res = await updateCandidateCv(cvId, { title: editTitleValue.trim() });
      if (res.success && Array.isArray(res.cvs)) {
        setCvs(res.cvs);
        if (onCvsChange) onCvsChange(res.cvs);
        showToast("Đã cập nhật tên gợi nhớ CV!");
      } else {
        showToast(res.error || "Không thể đổi tên CV.", true);
      }
    } catch (e) {
      showToast("Lỗi khi đổi tên CV.", true);
    } finally {
      setEditingId(null);
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-[#120d2c]/85 backdrop-blur-2xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(5,3,20,0.45)] mb-8">
      {/* Toast Alert */}
      <AnimatePresence>
        {successMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5 text-xs font-semibold text-emerald-300"
          >
            <CheckCircle2 size={16} />
            {successMsg}
          </motion.div>
        )}
        {errorMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/15 px-4 py-2.5 text-xs font-semibold text-rose-300"
          >
            <AlertCircle size={16} />
            {errorMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-2xl bg-violet-600/25 border border-violet-400/30 text-violet-300 flex items-center justify-center shadow-[0_0_16px_rgba(124,58,237,0.25)]">
            <FileText size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-black tracking-tight text-white">
                Kho lưu trữ CV cá nhân (Multi-CV Vault)
              </h3>
              <span className="text-[10px] font-bold text-violet-300 bg-violet-500/20 px-2 py-0.5 rounded-full border border-violet-400/30">
                {cvs.length}/10 CV
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Lưu trữ nhiều phiên bản CV theo từng vị trí ứng tuyển. Chọn CV mặc định để tự động phân tích & ghép nối phỏng vấn.
            </p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          type="button"
          onClick={() => {
            setSelectedFile(null);
            setNewTitle("");
            setMakeDefault(cvs.length === 0);
            setShowUploadModal(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-400/40 bg-gradient-to-b from-violet-500/80 via-violet-600/70 to-indigo-700/80 px-4 py-2.5 text-xs font-bold text-white shadow-[0_4px_16px_rgba(124,58,237,0.35)] hover:brightness-110 transition-all cursor-pointer shrink-0"
        >
          <Plus size={15} strokeWidth={2.5} />
          Tải lên CV mới
        </motion.button>
      </div>

      {/* CV List Container */}
      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
          <Loader2 size={24} className="animate-spin text-violet-400" />
          <span className="text-xs font-medium">Đang tải danh sách CV...</span>
        </div>
      ) : cvs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center">
          <div className="size-12 rounded-2xl bg-white/5 border border-white/10 mx-auto flex items-center justify-center text-slate-400 mb-3">
            <Upload size={20} />
          </div>
          <h4 className="text-sm font-bold text-white mb-1">Chưa có CV nào trong kho</h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
            Tải lên CV đầu tiên của bạn để AI tiến hành phân tích độ phù hợp với JD và cá nhân hóa câu hỏi phỏng vấn.
          </p>
          <button
            type="button"
            onClick={() => {
              setSelectedFile(null);
              setNewTitle("");
              setMakeDefault(true);
              setShowUploadModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white hover:bg-white/15 transition-all cursor-pointer"
          >
            <Upload size={14} />
            Tải lên ngay bây giờ
          </button>
        </div>
      ) : (
        <div className="grid gap-3.5 sm:grid-cols-2">
          {cvs.map((cv) => {
            const isDefault = Boolean(cv.isDefault);
            const isEditing = editingId === cv.id;
            const targetUrl = resolveMediaUrl(cv.fileUrl || cv.rawUrl);

            return (
              <div
                key={cv.id}
                className={`relative rounded-2xl border p-4 transition-all ${
                  isDefault
                    ? "border-emerald-500/40 bg-gradient-to-br from-emerald-950/20 via-[#131131] to-[#0c0920] shadow-[0_4px_20px_rgba(16,185,129,0.1)]"
                    : "border-white/10 bg-[#0e0a26]/70 hover:border-white/20"
                }`}
              >
                {/* Default CV Badge */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`size-9 rounded-xl flex items-center justify-center text-xs font-black ${
                        isDefault
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/30"
                          : "bg-violet-500/20 text-violet-300 border border-violet-400/20"
                      }`}
                    >
                      {cv.fileName?.endsWith(".pdf") ? "PDF" : "DOC"}
                    </div>

                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editTitleValue}
                            onChange={(e) => setEditTitleValue(e.target.value)}
                            className="rounded-lg border border-violet-400/50 bg-slate-900 px-2 py-1 text-xs font-bold text-white focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveRename(cv.id)}
                            className="p-1 rounded bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                          >
                            <Check size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-1 rounded bg-white/10 text-slate-300 hover:bg-white/20"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-white truncate max-w-[170px] sm:max-w-[200px]">
                            {cv.title || "CV cá nhân"}
                          </h4>
                          <button
                            type="button"
                            onClick={() => handleStartRename(cv)}
                            className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
                            title="Đổi tên gợi nhớ"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                      )}

                      <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
                        {cv.fileName}
                      </p>
                    </div>
                  </div>

                  {isDefault ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 shrink-0">
                      <Star size={11} fill="currentColor" /> Mặc định
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(cv.id)}
                      className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-400 hover:border-violet-400/40 hover:text-violet-300 hover:bg-violet-500/10 transition-all shrink-0 cursor-pointer"
                    >
                      Đặt mặc định
                    </button>
                  )}
                </div>

                {/* File Meta Info */}
                <div className="flex items-center justify-between text-[11px] text-slate-400 border-t border-white/5 pt-2.5 mt-2">
                  <span>
                    {formatBytes(cv.fileSize)} • {formatDate(cv.uploadedAt)}
                  </span>

                  <div className="flex items-center gap-1">
                    {targetUrl && (
                      <a
                        href={targetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                        title="Xem / Tải file"
                      >
                        <ExternalLink size={13} />
                        <span className="text-[11px] font-medium">Xem CV</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(cv.id, cv.title)}
                      className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                      title="Xóa CV khỏi kho"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload CV Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6"
            role="presentation"
            onClick={() => !uploading && setShowUploadModal(false)}
          >
            <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-md" aria-hidden />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-b from-[#181339] to-[#0e0a26] shadow-2xl text-white p-6 sm:p-7"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="size-9 rounded-xl bg-violet-600/30 border border-violet-400/40 text-violet-300 flex items-center justify-center">
                    <Upload size={18} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Tải lên CV mới</h3>
                    <p className="text-xs text-slate-400">Hỗ trợ định dạng PDF, DOC, DOCX (Tối đa 10MB)</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => setShowUploadModal(false)}
                  className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleUploadSubmit} className="space-y-4">
                {/* File Dropzone */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                    File CV <span className="text-rose-400">*</span>
                  </label>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
                      selectedFile
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-white/15 bg-white/[0.02] hover:border-violet-400/50 hover:bg-white/[0.04]"
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      onChange={handleFileSelect}
                    />

                    {selectedFile ? (
                      <div className="flex flex-col items-center">
                        <FileCheck size={32} className="text-emerald-400 mb-2" />
                        <p className="text-sm font-bold text-white truncate max-w-xs">{selectedFile.name}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{formatBytes(selectedFile.size)}</p>
                        <span className="mt-2 text-[11px] font-semibold text-violet-400 underline">
                          Bấm để đổi file khác
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center">
                        <Upload size={28} className="text-violet-400 mb-2" />
                        <p className="text-xs font-semibold text-slate-200">
                          Kéo thả file vào đây hoặc <span className="text-violet-400 underline">chọn từ thiết bị</span>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1">PDF, DOC, DOCX • Tối đa 10MB</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Title Input */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-300">
                    Tên gợi nhớ cho CV <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="VD: CV Frontend React, CV Shopee 2026, CV Tiếng Anh..."
                    className="w-full rounded-xl border border-white/15 bg-slate-950/80 px-4 py-3 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/25 transition-all"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    Đặt tên giúp bạn dễ dàng nhận biết khi nộp hồ sơ hoặc chọn phỏng vấn.
                  </p>
                </div>

                {/* Default CV Toggle */}
                <div className="flex items-center gap-2.5 pt-1">
                  <input
                    type="checkbox"
                    id="make-default-check"
                    checked={makeDefault}
                    onChange={(e) => setMakeDefault(e.target.checked)}
                    className="size-4 rounded border-white/20 bg-slate-900 text-violet-600 focus:ring-violet-500 cursor-pointer accent-violet-600"
                  />
                  <label htmlFor="make-default-check" className="text-xs font-semibold text-slate-300 cursor-pointer">
                    Đặt làm CV mặc định ngay sau khi tải lên
                  </label>
                </div>

                {/* Modal Footer Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10 mt-5">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => setShowUploadModal(false)}
                    className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Hủy bỏ
                  </button>

                  <button
                    type="submit"
                    disabled={uploading || !selectedFile}
                    className="inline-flex items-center gap-2 rounded-xl border border-violet-400/40 bg-gradient-to-b from-violet-500 via-violet-600 to-indigo-700 px-5 py-2.5 text-xs font-bold text-white shadow-lg hover:brightness-110 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {uploading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Đang tải lên...
                      </>
                    ) : (
                      <>
                        <Upload size={14} />
                        Lưu vào kho CV
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

