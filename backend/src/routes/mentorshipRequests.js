import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { authJwt } from "../middleware/authJwt.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { listOwnedDocuments } from "../services/mentorshipDocumentsService.js";
import * as service from "../services/mentorshipRequestsService.js";

export const mentorshipRequestsRouter = Router();
mentorshipRequestsRouter.use(authJwt, asyncHandler(async (req, res, next) => { req.requestActor = await service.requestActor(req.userId); next(); }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 2, fields: 8, fieldSize: 16000 }, fileFilter: (req, file, cb) => {
  if (!/\.(pdf|doc|docx|txt)$/i.test(file.originalname)) return cb(new Error("Chỉ hỗ trợ PDF, DOC, DOCX, TXT."));
  cb(null, true);
} }).fields([{ name: "cv", maxCount: 1 }, { name: "jd", maxCount: 1 }]);
const uploadFiles = (req, res, next) => upload(req, res, error => error ? res.status(400).json({ success: false, error: error.code === "LIMIT_FILE_SIZE" ? "Mỗi tài liệu tối đa 5MB." : "Cần hai tài liệu CV/JD hợp lệ (PDF, DOC, DOCX, TXT), tối đa 5MB mỗi file." }) : next());
const mutationLimit = rateLimit({ windowMs: 60 * 60 * 1000, max: 40, standardHeaders: true, legacyHeaders: false, keyGenerator: req => req.userId, message: { success: false, error: "Bạn thao tác quá nhiều. Vui lòng thử lại sau." } });
const result = async (req, res, row, status = 200) => res.status(status).json({ success: true, request: await service.requestDTO(row, req.requestActor) });
mentorshipRequestsRouter.get("/", asyncHandler(async (req, res) => res.json({ success: true, requests: await service.listRequests(req.requestActor, req.query.scope) })));
mentorshipRequestsRouter.post("/", mutationLimit, uploadFiles, asyncHandler(async (req, res) => result(req, res, await service.createRequest(req.requestActor, req.body, req.files), 201)));
mentorshipRequestsRouter.get("/documents", asyncHandler(async (req, res) => {
  if (req.requestActor.mentor) return res.status(403).json({ success: false, error: "Chỉ mentee được chọn tài liệu đã lưu." });
  res.json({ success: true, documents: await listOwnedDocuments(req.userId) });
}));
mentorshipRequestsRouter.get("/:id", asyncHandler(async (req, res) => result(req, res, await service.loadRequest(req.params.id))));
mentorshipRequestsRouter.post("/:id/offers", mutationLimit, asyncHandler(async (req, res) => result(req, res, await service.sendOffer(req.requestActor, req.params.id, req.body), 201)));
mentorshipRequestsRouter.post("/:id/offers/:offerId/select", mutationLimit, asyncHandler(async (req, res) => result(req, res, await service.selectOffer(req.requestActor, req.params.id, req.params.offerId))));
mentorshipRequestsRouter.post("/:id/offers/:offerId/withdraw", mutationLimit, asyncHandler(async (req, res) => result(req, res, await service.withdrawOffer(req.requestActor, req.params.id, req.params.offerId))));
mentorshipRequestsRouter.post("/:id/close", mutationLimit, asyncHandler(async (req, res) => result(req, res, await service.closeRequest(req.requestActor, req.params.id))));
mentorshipRequestsRouter.get("/:id/files/:kind", asyncHandler(async (req, res) => {
  const file = await service.getRequestFile(req.requestActor, req.params.id, req.params.kind);
  res.set({ "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g, "%27")}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
  res.send(Buffer.from(file.data));
}));
