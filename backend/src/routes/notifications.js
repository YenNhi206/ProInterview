import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { NotificationsController } from "../controllers/notificationsController.js";

export const notificationsRouter = Router();

notificationsRouter.get("/", authJwt, NotificationsController.list);
notificationsRouter.get("/unread-count", authJwt, NotificationsController.getUnreadCount);
notificationsRouter.patch("/:id/read", authJwt, NotificationsController.markAsRead);
notificationsRouter.post("/read-all", authJwt, NotificationsController.markAllRead);
notificationsRouter.delete("/:id", authJwt, NotificationsController.delete);
