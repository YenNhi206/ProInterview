import { validateCoupon } from "../services/couponService.js";

const ALLOWED_TYPES = ["booking", "enrollment", "subscription"];

export const CouponsController = {
  validate: async (req, res, next) => {
    try {
      const { code, type, amount } = req.body || {};
      const normalizedType = ALLOWED_TYPES.includes(type) ? type : "booking";

      const result = await validateCoupon({
        code,
        userId: req.userId,
        type: normalizedType,
        amount,
      });
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }

      res.json({
        success: true,
        coupon: {
          code: result.coupon.code,
          discountType: result.coupon.discountType,
          discountValue: result.coupon.discountValue,
        },
        discountAmount: result.discountAmount,
      });
    } catch (err) {
      next(err);
    }
  },
};
