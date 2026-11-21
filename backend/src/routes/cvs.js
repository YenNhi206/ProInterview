import { Router } from "express";
import multer from "multer";
import { authJwt } from "../middleware/authJwt.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { CVDocumentController } from "../controllers/cvDocumentController.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const cvsRouter = Router();

// Mọi route quản lý CV yêu cầu đăng nhập
cvsRouter.use(authJwt);

// PR-02: CRUD CVDocument
cvsRouter.get("/", asyncHandler(CVDocumentController.listCvs));
cvsRouter.post(
  "/",
  upload.single("file"),
  asyncHandler(CVDocumentController.createCv)
);
cvsRouter.get("/:id", asyncHandler(CVDocumentController.getCv));
cvsRouter.patch("/:id", asyncHandler(CVDocumentController.updateCv));
cvsRouter.post("/:id/duplicate", asyncHandler(CVDocumentController.duplicateCv));
cvsRouter.post("/:id/set-default", asyncHandler(CVDocumentController.setDefaultCv));
cvsRouter.patch("/:id/default", asyncHandler(CVDocumentController.setDefaultCv)); // Alias
cvsRouter.delete("/:id", asyncHandler(CVDocumentController.deleteCv));

// PR-09: Xuất PDF bằng pdfkit + font DejaVu
cvsRouter.post("/:id/export-pdf", asyncHandler(CVDocumentController.exportPdf));
cvsRouter.get("/:id/export-pdf", asyncHandler(CVDocumentController.exportPdf));
