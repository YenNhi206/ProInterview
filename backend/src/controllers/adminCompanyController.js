import * as companyService from "../services/companyService.js";
import { CompanyInvite } from "../models/CompanyInvite.js";
import { User } from "../models/User.js";

export const AdminCompanyController = {
  async list(req, res) {
    const { page, limit, search, status } = req.query;
    const result = await companyService.listCompanies({ page, limit, search, status });
    return res.json({ success: true, ...result });
  },

  async create(req, res) {
    const company = await companyService.createCompany(req.body);
    return res.status(201).json({
      success: true,
      message: "Tạo công ty thành công.",
      company,
    });
  },

  async getById(req, res) {
    const company = await companyService.getCompanyById(req.params.id);
    const [invites, moderators] = await Promise.all([
      CompanyInvite.find({ companyId: req.params.id }).sort({ createdAt: -1 }).limit(10).lean(),
      User.find({ companyId: req.params.id, role: "company_moderator" }).select("name email createdAt isActive").lean(),
    ]);
    return res.json({ success: true, company, invites, moderators });
  },

  async update(req, res) {
    const company = await companyService.updateCompany(req.params.id, req.body);
    return res.json({
      success: true,
      message: "Cập nhật thông tin công ty thành công.",
      company,
    });
  },

  async toggleStatus(req, res) {
    const { status } = req.body;
    const company = await companyService.setCompanyStatus(req.params.id, status);
    return res.json({
      success: true,
      message: status === "suspended" ? "Đã tạm khóa công ty." : "Đã mở khóa công ty.",
      company,
    });
  },

  async inviteModerator(req, res) {
    const { email } = req.body;
    const result = await companyService.inviteCompanyModerator(req.params.id, email, req.userId);
    const baseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
    const inviteUrl = `${baseUrl}/company-invite/${result.rawToken}`;

    return res.status(201).json({
      success: true,
      message: `Đã tạo lời mời cho ${email}.`,
      invite: result.invite,
      inviteUrl,
      expiresAt: result.expiresAt,
    });
  },

  async listInvites(req, res) {
    const invites = await CompanyInvite.find({ companyId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, invites });
  },
};
