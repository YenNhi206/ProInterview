import * as mentorMeService from "../services/mentorMeService.js";

export class MentorMeController {
  static async patchMe(req, res, next) {
    try {
      const result = await mentorMeService.patchMyMentorProfile(req.userId, req.body ?? {});
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      res.json({ success: true, mentor: result.mentor });
    } catch (e) {
      next(e);
    }
  }

  static async patchAvailability(req, res, next) {
    try {
      const result = await mentorMeService.patchMyAvailability(req.userId, req.body ?? {});
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      res.json({ success: true, availability: result.availability });
    } catch (e) {
      next(e);
    }
  }

  static async blockDates(req, res, next) {
    try {
      const result = await mentorMeService.blockDates(req.userId, req.body ?? {});
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      res.json({ success: true, blockedDates: result.blockedDates });
    } catch (e) {
      next(e);
    }
  }
}

