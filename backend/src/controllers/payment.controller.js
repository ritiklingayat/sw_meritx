import { PaymentService } from '../services/payment.service.js';

export class PaymentController {
  static async getConfiguration(req, res, next) {
    try {
      const config = PaymentService.getConfiguration();
      return res.status(200).json(config);
    } catch (err) {
      next(err);
    }
  }

  static async createOrder(req, res, next) {
    try {
      const result = await PaymentService.createOrder({
        userId: req.user?.id || 'demo_user',
        examId: req.body.examId,
        amount: req.body.amount
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async verify(req, res, next) {
    try {
      const result = await PaymentService.verifyPayment({
        userId: req.user?.id,
        examId: req.body.examId,
        examTitle: req.body.examTitle,
        razorpayOrderId: req.body.razorpayOrderId || req.body.orderId,
        razorpayPaymentId: req.body.razorpayPaymentId || req.body.paymentId,
        razorpaySignature: req.body.razorpaySignature,
        amount: req.body.amount
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  static async failure(req, res, next) {
    try {
      const result = await PaymentService.recordFailure({
        orderId: req.body.orderId,
        reason: req.body.reason
      });
      return res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}
