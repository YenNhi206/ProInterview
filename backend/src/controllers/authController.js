import * as authService from "../services/authService.js";

/**
 * HTTP layer — gọi `authService`, map `{ ok, status?, error? }` → status + JSON.
 */
export class AuthController {
  static async register(req, res, next) {
    try {
      const result = await authService.registerUser(req.body ?? {});
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.status(201).json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async login(req, res, next) {
    try {
      const result = await authService.loginUser(req.body ?? {});
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, token: result.token, user: result.user });
    } catch (err) {
      next(err);
    }
  }

  static async google(req, res, next) {
    try {
      const result = await authService.loginWithGoogle(req.body ?? {});
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, token: result.token, user: result.user });
    } catch (err) {
      next(err);
    }
  }

  static async me(req, res, next) {
    try {
      const result = await authService.getMeUser(req.userId);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, user: result.user });
    } catch (err) {
      next(err);
    }
  }

  static async patchMe(req, res, next) {
    try {
      const result = await authService.patchMeUser(req.userId, req.body ?? {});
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, user: result.user });
    } catch (err) {
      next(err);
    }
  }
}
