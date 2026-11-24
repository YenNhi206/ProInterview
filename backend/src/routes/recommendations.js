/**
 * /api/recommendations — gợi ý mentor, khóa học, job cho ứng viên (AI-10, REQ AIS-07, C-09).
 */
import { Router } from "express";
import Joi from "joi";
import { authJwt } from "../middleware/authJwt.js";
import { requireRole } from "../middleware/requireRole.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { getRecommendations, DEFAULT_LIMIT } from "../services/recommendationsService.js";

export const recommendationsRouter = Router();

const query = Joi.object({ limit: Joi.number().integer().min(1).max(10).default(DEFAULT_LIMIT) });

recommendationsRouter.get("/me", authJwt, requireRole("customer"), asyncHandler(async (req, res) => {
  const { value, error } = query.validate(req.query ?? {}, { stripUnknown: true, convert: true });
  if (error) return res.status(400).json({ success: false, error: "Số lượng gợi ý phải từ 1 đến 10." });
  const recommendations = await getRecommendations(req.userId, { limit: value.limit });
  res.json({ success: true, recommendations });
}));
