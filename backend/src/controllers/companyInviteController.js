import * as companyService from "../services/companyService.js";
import { issueAccessToken, pushNewSession } from "../services/authService.js";
import { toPublicUser } from "../models/User.js";

export const CompanyInviteController = {
  async verify(req, res) {
    const invite = await companyService.verifyInviteToken(req.params.token);
    return res.json({
      success: true,
      invite: {
        id: invite._id,
        email: invite.email,
        company: {
          id: invite.companyId._id,
          name: invite.companyId.name,
          slug: invite.companyId.slug,
          logo: invite.companyId.logo,
          industry: invite.companyId.industry,
        },
        expiresAt: invite.expiresAt,
      },
    });
  },

  async accept(req, res) {
    const { token, name, password } = req.body;
    const user = await companyService.acceptInvite({
      rawToken: token,
      name,
      password,
    });

    const { refreshToken } = pushNewSession(user, req);
    await user.save();
    const access = issueAccessToken(user);

    return res.status(201).json({
      success: true,
      message: "Kích hoạt tài khoản kiểm duyệt viên công ty thành công.",
      user: toPublicUser(user),
      token: access.token,
      refreshToken,
    });
  },
};
