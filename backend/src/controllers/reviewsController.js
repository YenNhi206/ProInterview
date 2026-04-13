import * as reviewsService from "../services/reviewsService.js";

export class ReviewsController {
  static async list(req, res, next) {
    try {
      const result = await reviewsService.listReviews(req.query ?? {});
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      res.json({ success: true, reviews: result.reviews });
    } catch (e) {
      next(e);
    }
  }

  static async create(req, res, next) {
    try {
      const result = await reviewsService.createReview(req.userId, req.body ?? {});
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      res.status(201).json({ success: true, review: result.review });
    } catch (e) {
      next(e);
    }
  }

  static async reply(req, res, next) {
    try {
      const result = await reviewsService.replyToReview(req.userId, req.params.id, req.body ?? {});
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      res.json({ success: true, review: result.review });
    } catch (e) {
      next(e);
    }
  }

  static async remove(req, res, next) {
    try {
      const result = await reviewsService.deleteReview(req.userId, req.params.id);
      if (!result.ok) return res.status(result.status).json({ success: false, error: result.error });
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  }
}

