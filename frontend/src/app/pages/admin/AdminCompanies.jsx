import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Mail,
  Check,
  Copy,
  Clock,
  Briefcase,
  Globe,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { companyApi } from "../../api/companyApi.js";
import { toastApiError, toastApiSuccess } from "../../utils/shared/apiToast.js";

export function AdminCompanies() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: "",
    website: "",
    industry: "",
    size: "50-200",
    description: "",
    address: "",
  });
  const [creating, setCreating] = useState(false);

  // Invite states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchCompanies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await companyApi.listCompanies({
        search,
        status: statusFilter,
      });
      if (res.success) {
        setCompanies(res.items || []);
      }
    } catch (err) {
      toastApiError(err, "Không thể tải danh sách công ty.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim()) return;
    setCreating(true);
    try {
      const res = await companyApi.createCompany(createForm);
      if (res.success) {
        toastApiSuccess("Tạo công ty thành công!");
        setShowCreateModal(false);
        setCreateForm({
          name: "",
          website: "",
          industry: "",
          size: "50-200",
          description: "",
          address: "",
        });
        fetchCompanies();
      }
    } catch (err) {
      toastApiError(err, "Không thể tạo công ty.");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (company) => {
    const nextStatus = company.status === "active" ? "suspended" : "active";
    const label = nextStatus === "suspended" ? "tạm khóa" : "mở khóa";
    if (!window.confirm(`Bạn có chắc muốn ${label} công ty "${company.name}"?`)) return;

    try {
      const res = await companyApi.toggleCompanyStatus(company._id, nextStatus);
      if (res.success) {
        toastApiSuccess(`Đã ${label} công ty thành công.`);
        fetchCompanies();
      }
    } catch (err) {
      toastApiError(err, `Không thể ${label} công ty.`);
    }
  };

  const handleOpenInvite = (company) => {
    setSelectedCompany(company);
    setInviteEmail("");
    setInviteResult(null);
    setCopied(false);
    setShowInviteModal(true);
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !selectedCompany) return;
    setInviting(true);
    try {
      const res = await companyApi.inviteModerator(selectedCompany._id, inviteEmail);
      if (res.success) {
        toastApiSuccess(`Đã tạo lời mời cho ${inviteEmail}`);
        setInviteResult(res);
      }
    } catch (err) {
      toastApiError(err, "Không thể gửi lời mời.");
    } finally {
      setInviting(false);
    }
  };

  const handleCopyInviteUrl = () => {
    if (!inviteResult?.inviteUrl) return;
    navigator.clipboard.writeText(inviteResult.inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Quản lý Đối tác Doanh nghiệp
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản trị danh sách công ty, thiết lập tài khoản đại diện Company Moderator và theo dõi hoạt động tuyển dụng.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-white shadow-sm hover:bg-violet-700 transition"
        >
          <Plus size={16} />
          <span>Thêm công ty mới</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-sm backdrop-blur-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Tìm theo tên công ty hoặc lĩnh vực..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-2 pl-10 pr-4 text-xs font-medium text-white placeholder:text-slate-500 focus:border-violet-500/50 focus:bg-white/[0.08] focus:outline-none"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-white/10 bg-[#0d061a] px-3 py-2 text-xs font-semibold text-white focus:border-violet-500/50 focus:outline-none"
        >
          <option value="" className="bg-[#0d061a] text-white">Tất cả trạng thái</option>
          <option value="active" className="bg-[#0d061a] text-white">Đang hoạt động</option>
          <option value="suspended" className="bg-[#0d061a] text-white">Tạm khóa</option>
        </select>

        <button
          type="button"
          onClick={fetchCompanies}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/[0.08] hover:border-white/20 transition"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Table list */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] shadow-sm backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/10 bg-white/[0.04] text-[11px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-5 py-3.5">Công ty</th>
                <th className="px-5 py-3.5">Lĩnh vực & Quy mô</th>
                <th className="px-5 py-3.5">Trạng thái</th>
                <th className="px-5 py-3.5">Ngày tạo</th>
                <th className="px-5 py-3.5 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Đang tải danh sách công ty...
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    Chưa có công ty nào phù hợp với bộ lọc.
                  </td>
                </tr>
              ) : (
                companies.map((company) => (
                  <tr key={company._id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 font-bold border border-violet-200">
                          {company.logo ? (
                            <img src={company.logo} alt="" className="h-full w-full rounded-xl object-cover" />
                          ) : (
                            company.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{company.name}</p>
                          {company.website && (
                            <a
                              href={company.website}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:underline"
                            >
                              <Globe size={11} />
                              {company.website.replace(/^https?:\/\//, "")}
                            </a>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-slate-800">{company.industry || "Chưa cập nhật"}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{company.size ? `${company.size} nhân sự` : "—"}</p>
                    </td>

                    <td className="px-5 py-4">
                      {company.status === "active" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Hoạt động
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          Tạm khóa
                        </span>
                      )}
                    </td>

                    <td className="px-5 py-4 text-slate-400 text-[11px]">
                      {new Date(company.createdAt).toLocaleDateString("vi-VN")}
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenInvite(company)}
                          className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100 transition"
                          title="Mời Company Moderator"
                        >
                          <Mail size={13} />
                          <span>Mời HR</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleStatus(company)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${
                            company.status === "active"
                              ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          }`}
                        >
                          {company.status === "active" ? (
                            <>
                              <ShieldAlert size={13} />
                              <span>Khóa</span>
                            </>
                          ) : (
                            <>
                              <ShieldCheck size={13} />
                              <span>Mở</span>
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal tạo công ty mới */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-black text-slate-900 mb-1">Thêm đối tác doanh nghiệp mới</h2>
            <p className="text-xs text-slate-500 mb-5">
              Nhập thông tin công ty để tích hợp bộ câu hỏi và khung đánh giá riêng.
            </p>

            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tên công ty *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: VNG Corporation"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Lĩnh vực hoạt động</label>
                  <input
                    type="text"
                    placeholder="CNTT, Tài chính, Bán lẻ..."
                    value={createForm.industry}
                    onChange={(e) => setCreateForm({ ...createForm, industry: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium focus:border-violet-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Quy mô nhân sự</label>
                  <select
                    value={createForm.size}
                    onChange={(e) => setCreateForm({ ...createForm, size: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium focus:border-violet-500 focus:outline-none"
                  >
                    <option value="10-50">10 - 50</option>
                    <option value="50-200">50 - 200</option>
                    <option value="200-500">200 - 500</option>
                    <option value="500-1000">500 - 1.000</option>
                    <option value="1000+">Trên 1.000</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Website công ty</label>
                <input
                  type="url"
                  placeholder="https://company.com"
                  value={createForm.website}
                  onChange={(e) => setCreateForm({ ...createForm, website: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Địa chỉ trụ sở</label>
                <input
                  type="text"
                  placeholder="Quận 1, TP. Hồ Chí Minh"
                  value={createForm.address}
                  onChange={(e) => setCreateForm({ ...createForm, address: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium focus:border-violet-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-violet-600 px-5 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {creating ? "Đang tạo..." : "Xác nhận tạo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal mời Company Moderator (CO-02 & CO-10) */}
      {showInviteModal && selectedCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-black text-slate-900 mb-1">Mời đại diện doanh nghiệp (HR)</h2>
            <p className="text-xs text-slate-500 mb-4">
              Gửi lời mời tham gia quản lý bộ câu hỏi và khung năng lực cho{" "}
              <strong className="text-violet-700">{selectedCompany.name}</strong>.
            </p>

            {!inviteResult ? (
              <form onSubmit={handleSendInvite} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email đại diện HR *</label>
                  <input
                    type="email"
                    required
                    placeholder="hr@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-medium focus:border-violet-500 focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    * Email chưa từng đăng ký tài khoản học viên hoặc cố vấn trong hệ thống.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="rounded-xl bg-violet-600 px-5 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {inviting ? "Đang gửi..." : "Tạo liên kết mời"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs mb-1">
                    <Check size={16} className="text-emerald-600" />
                    Đã tạo lời mời thành công!
                  </div>
                  <p className="text-[11px] text-emerald-700">
                    Liên kết có hiệu lực trong vòng 7 ngày. Hãy sao chép liên kết này và gửi cho đại diện doanh nghiệp:
                  </p>

                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-300/80 bg-white p-2">
                    <input
                      type="text"
                      readOnly
                      value={inviteResult.inviteUrl}
                      className="flex-1 bg-transparent text-[11px] font-mono text-slate-700 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCopyInviteUrl}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      <span>{copied ? "Đã chép" : "Sao chép"}</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false);
                      setInviteResult(null);
                    }}
                    className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    Hoàn tất
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
