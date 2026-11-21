/**
 * Helper N-04: Đảm bảo tài khoản thao tác thuộc đúng công ty của tài nguyên.
 *
 * Dùng cho các route Company Moderator:
 *   assertSameCompany(req, resource.companyId);
 *
 * @param {import("express").Request} req - Express request đã qua authJwt/requireCompanyModerator
 * @param {string|import("mongoose").Types.ObjectId|{ _id: any }} targetCompanyId - ID công ty của tài nguyên cần thao tác
 * @throws {Error} 403 nếu không cùng công ty hoặc thiếu thông tin công ty
 * @returns {true} khi cùng công ty
 */
export function assertSameCompany(req, targetCompanyId) {
  const rawUserCompanyId =
    req?.user?.companyId ??
    req?.companyId ??
    req?.userCompanyId;

  const userCompanyStr = rawUserCompanyId?._id
    ? String(rawUserCompanyId._id)
    : rawUserCompanyId
      ? String(rawUserCompanyId)
      : "";

  const targetCompanyStr = targetCompanyId?._id
    ? String(targetCompanyId._id)
    : targetCompanyId
      ? String(targetCompanyId)
      : "";

  if (!userCompanyStr || !targetCompanyStr || userCompanyStr !== targetCompanyStr) {
    const error = new Error("Không có quyền truy cập dữ liệu của công ty khác.");
    error.status = 403;
    error.statusCode = 403;
    throw error;
  }

  return true;
}
