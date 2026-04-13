import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { AdminController } from "../controllers/adminController.js";

export const adminRouter = Router();

// Tất cả các route admin đều yêu cầu Đăng nhập + Quyền Admin
adminRouter.use(authJwt, requireAdmin);

adminRouter.get("/stats", AdminController.getStats);
adminRouter.get("/mentors", AdminController.getAllMentors);
adminRouter.patch("/mentors/:id/status", AdminController.toggleMentorStatus);

adminRouter.get("/users", AdminController.getAllUsers);
adminRouter.patch("/users/:id/status", AdminController.toggleUserStatus);

adminRouter.get("/bookings", AdminController.getAllBookings);
