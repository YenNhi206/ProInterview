import * as mentorsService from "../services/mentorsService.js";

/**
 * HTTP layer — gọi `mentorsService`.
 */
export class MentorsController {
  static async list(_req, res, next) {
    try {
      const result = await mentorsService.listMentors();
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, mentors: result.mentors });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req, res, next) {
    try {
      const result = await mentorsService.getMentorById(req.params.id);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, mentor: result.mentor });
    } catch (err) {
      next(err);
    }
  }
}
