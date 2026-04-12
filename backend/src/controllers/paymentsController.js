import * as paymentsService from "../services/paymentsService.js";

export class PaymentsController {
  static async initiate(req, res, next) {
    try {
      const result = await paymentsService.initiatePayment(req.userId, req.body ?? {});
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.status(201).json({
        success: true,
        paymentId: result.paymentId,
        providerRef: result.providerRef,
        payUrl: result.payUrl,
        qrBase64: result.qrBase64,
        deepLink: result.deepLink,
        mock: result.mock,
        message: result.message,
      });
    } catch (err) {
      next(err);
    }
  }

  static async history(req, res, next) {
    try {
      const limit = req.query.limit;
      const result = await paymentsService.listPaymentHistory(req.userId, limit);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true, payments: result.payments });
    } catch (err) {
      next(err);
    }
  }

  static async webhookMomo(req, res, next) {
    try {
      const secret = req.headers["x-payment-secret"] ?? req.headers["X-Payment-Secret"];
      const result = await paymentsService.handleWebhookMomo(req.body ?? {}, secret);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async webhookZalopay(req, res, next) {
    try {
      const secret = req.headers["x-payment-secret"] ?? req.headers["X-Payment-Secret"];
      const result = await paymentsService.handleWebhookZalopay(req.body ?? {}, secret);
      if (!result.ok) {
        return res.status(result.status).json({ success: false, error: result.error });
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
