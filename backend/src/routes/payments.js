import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { PaymentsController } from "../controllers/paymentsController.js";

export const paymentsRouter = Router();

paymentsRouter.post("/initiate", authJwt, PaymentsController.initiate);
paymentsRouter.get("/history", authJwt, PaymentsController.history);
paymentsRouter.post("/webhook/momo", PaymentsController.webhookMomo);
paymentsRouter.post("/webhook/zalopay", PaymentsController.webhookZalopay);
