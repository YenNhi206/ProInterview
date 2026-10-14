import { invoiceHandler } from "../controllers/invoiceController.js";
import { Router } from "express";
import { authJwt } from "../middleware/authJwt.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { getCart, addCartCourse, removeCartCourse, checkoutCart, getCartOrder, cancelCartOrder } from "../services/cartService.js";

export const cartRouter = Router();
cartRouter.use(authJwt);
cartRouter.get("/", asyncHandler(async (req, res) => res.json({ success: true, cart: await getCart(req.userId) })));
cartRouter.post("/items", asyncHandler(async (req, res) => res.json({ success: true, cart: await addCartCourse(req.userId, req.body?.courseId) })));
cartRouter.delete("/items/:courseId", asyncHandler(async (req, res) => res.json({ success: true, cart: await removeCartCourse(req.userId, req.params.courseId) })));
cartRouter.post("/checkout", asyncHandler(async (req, res) => res.json({ success: true, order: await checkoutCart(req.userId, req.body) })));
cartRouter.get("/orders/:id", asyncHandler(async (req, res) => res.json({ success: true, order: await getCartOrder(req.userId, req.params.id) })));
cartRouter.delete("/orders/:id", asyncHandler(async (req, res) => {
  await cancelCartOrder(req.userId, req.params.id);
  res.json({ success: true, cart: await getCart(req.userId) });
}));

cartRouter.get("/orders/:id/invoice", authJwt, asyncHandler(invoiceHandler("cart")));
