import { Router } from "express";
import { CompetenciesController } from "../controllers/competenciesController.js";
import { authJwt } from "../middleware/authJwt.js";
import { requireRole } from "../middleware/requireRole.js";
import { asyncHandler } from "../middleware/asyncHandler.js";

export const competenciesRouter = Router();

// Cả 5 role đều đọc được. `enterprise` sẽ đổi thành `company_moderator` ở N-02/N-03;
// liệt kê cả hai để route không phải sửa khi đổi role.
export const COMPETENCY_READER_ROLES = [
  "customer",
  "mentor",
  "admin",
  "moderator",
  "company_moderator",
  "enterprise",
];

competenciesRouter.get(
  "/",
  authJwt,
  requireRole(...COMPETENCY_READER_ROLES),
  asyncHandler(CompetenciesController.getFramework),
);
