import express from "express";
import { MentorsController } from "../controllers/mentorsController.js";

export const mentorsRouter = express.Router();

mentorsRouter.get("/", MentorsController.list);
mentorsRouter.get("/:id", MentorsController.getById);
