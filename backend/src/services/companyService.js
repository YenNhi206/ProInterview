import crypto from "node:crypto";
import bcrypt from "bcrypt";
import { Company } from "../models/Company.js";
import { CompanyInvite } from "../models/CompanyInvite.js";
import { User } from "../models/User.js";

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function slugify(text) {
  return String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function listCompanies({ page = 1, limit = 20, search = "", status = "" } = {}) {
  const p = Math.max(1, Number(page) || 1);
  const l = Math.min(100, Math.max(1, Number(limit) || 20));
  const filter = {};

  if (status) {
    filter.status = status;
  }

  if (search && search.trim()) {
    const s = search.trim();
    filter.$or = [
      { name: { $regex: s, $options: "i" } },
      { industry: { $regex: s, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Company.find(filter)
      .sort({ createdAt: -1 })
      .skip((p - 1) * l)
      .limit(l)
      .lean(),
    Company.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page: p,
      limit: l,
      total,
      pages: Math.ceil(total / l),
    },
  };
}

export async function createCompany(data) {
  const name = (data.name || "").trim();
  if (!name) {
    const err = new Error("Tên công ty không được để trống.");
    err.status = 400;
    throw err;
  }

  let slug = data.slug ? slugify(data.slug) : slugify(name);
  if (!slug) {
    slug = `company-${Date.now()}`;
  }

  const existingSlug = await Company.findOne({ slug });
  if (existingSlug) {
    slug = `${slug}-${Date.now().toString().slice(-4)}`;
  }

  const company = await Company.create({
    name,
    slug,
    logo: data.logo || "",
    website: (data.website || "").trim(),
    industry: (data.industry || "").trim(),
    size: (data.size || "").trim(),
    description: (data.description || "").trim(),
    address: (data.address || "").trim(),
    taxCode: (data.taxCode || "").trim(),
    status: data.status === "suspended" ? "suspended" : "active",
  });

  return company;
}

export async function getCompanyById(id) {
  const company = await Company.findById(id).lean();
  if (!company) {
    const err = new Error("Không tìm thấy công ty.");
    err.status = 404;
    throw err;
  }
  return company;
}

export async function updateCompany(id, updates) {
  const company = await Company.findById(id);
  if (!company) {
    const err = new Error("Không tìm thấy công ty.");
    err.status = 404;
    throw err;
  }

  if (updates.name && updates.name.trim()) company.name = updates.name.trim();
  if (updates.logo !== undefined) company.logo = updates.logo;
  if (updates.website !== undefined) company.website = (updates.website || "").trim();
  if (updates.industry !== undefined) company.industry = (updates.industry || "").trim();
  if (updates.size !== undefined) company.size = (updates.size || "").trim();
  if (updates.description !== undefined) company.description = updates.description;
  if (updates.address !== undefined) company.address = updates.address;
  if (updates.taxCode !== undefined) company.taxCode = (updates.taxCode || "").trim();

  await company.save();
  return company;
}

export async function setCompanyStatus(id, newStatus) {
  if (!["active", "suspended"].includes(newStatus)) {
    const err = new Error("Trạng thái công ty không hợp lệ (active | suspended).");
    err.status = 400;
    throw err;
  }

  const company = await Company.findByIdAndUpdate(id, { $set: { status: newStatus } }, { new: true });
  if (!company) {
    const err = new Error("Không tìm thấy công ty.");
    err.status = 404;
    throw err;
  }
  return company;
}

/**
 * CO-02 & Quyết định 14:
 * Mời Company Moderator.
 * Nếu email đã có tài khoản role khác thì từ chối lời mời.
 */
export async function inviteCompanyModerator(companyId, email, invitedByUserId) {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    const err = new Error("Email không hợp lệ.");
    err.status = 400;
    throw err;
  }

  const company = await Company.findById(companyId);
  if (!company) {
    const err = new Error("Không tìm thấy công ty.");
    err.status = 404;
    throw err;
  }

  if (company.status === "suspended") {
    const err = new Error("Không thể mời thành viên cho công ty đang bị tạm khóa.");
    err.status = 400;
    throw err;
  }

  // Quyết định 14: email đã có tài khoản role khác thì từ chối
  const existingUser = await User.findOne({ email: cleanEmail }).select("role companyId").lean();
  if (existingUser) {
    if (existingUser.role !== "company_moderator") {
      const err = new Error("Email này đã được sử dụng cho tài khoản vai trò khác trong hệ thống. Vui lòng sử dụng email công ty khác.");
      err.status = 400;
      throw err;
    }
    if (existingUser.companyId && String(existingUser.companyId) !== String(companyId)) {
      const err = new Error("Email này đã thuộc về một công ty khác trong hệ thống.");
      err.status = 400;
      throw err;
    }
  }

  // Vô hiệu hóa lời mời cũ đang pending nếu có
  await CompanyInvite.updateMany(
    { companyId, email: cleanEmail, status: "pending" },
    { $set: { status: "revoked" } }
  );

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ngày

  const invite = await CompanyInvite.create({
    companyId,
    email: cleanEmail,
    tokenHash,
    status: "pending",
    expiresAt,
    invitedBy: invitedByUserId,
  });

  return {
    invite,
    rawToken,
    expiresAt,
  };
}

export async function verifyInviteToken(rawToken) {
  if (!rawToken || typeof rawToken !== "string") {
    const err = new Error("Mã mời không hợp lệ.");
    err.status = 400;
    throw err;
  }

  const tokenHash = hashToken(rawToken.trim());
  const invite = await CompanyInvite.findOne({
    tokenHash,
    status: "pending",
  }).populate("companyId", "name slug logo website industry status");

  if (!invite) {
    const err = new Error("Lời mời không tồn tại, đã được sử dụng hoặc đã bị thu hồi.");
    err.status = 400;
    throw err;
  }

  if (new Date() > invite.expiresAt) {
    invite.status = "expired";
    await invite.save();
    const err = new Error("Lời mời đã hết hạn sau 7 ngày. Vui lòng yêu cầu quản trị viên gửi lại lời mời.");
    err.status = 400;
    throw err;
  }

  if (invite.companyId?.status === "suspended") {
    const err = new Error("Công ty này hiện đang bị tạm khóa.");
    err.status = 403;
    throw err;
  }

  return invite;
}

export async function acceptInvite({ rawToken, name, password }) {
  const invite = await verifyInviteToken(rawToken);

  const cleanName = (name || "").trim();
  if (!cleanName) {
    const err = new Error("Họ và tên không được để trống.");
    err.status = 400;
    throw err;
  }

  if (!password || password.length < 6) {
    const err = new Error("Mật khẩu phải có ít nhất 6 ký tự.");
    err.status = 400;
    throw err;
  }

  // Quyết định 14: kiểm tra lại email
  const existingUser = await User.findOne({ email: invite.email });
  if (existingUser && existingUser.role !== "company_moderator") {
    const err = new Error("Email này đã được dùng cho tài khoản vai trò khác.");
    err.status = 400;
    throw err;
  }

  let user = existingUser;
  const passwordHash = await bcrypt.hash(password, 10);

  if (!user) {
    user = await User.create({
      name: cleanName,
      email: invite.email,
      password: passwordHash,
      role: "company_moderator",
      companyId: invite.companyId._id,
      isEmailVerified: true,
      isActive: true,
    });
  } else {
    user.name = cleanName;
    user.password = passwordHash;
    user.companyId = invite.companyId._id;
    user.role = "company_moderator";
    await user.save();
  }

  // Token dùng 1 lần: chuyển trạng thái accepted
  invite.status = "accepted";
  invite.acceptedAt = new Date();
  await invite.save();

  return user;
}
