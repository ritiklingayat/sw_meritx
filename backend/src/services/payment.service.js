import crypto from 'crypto';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';

export class PaymentService {
  static getConfiguration() {
    return {
      configured: true,
      keyId: env.RAZORPAY_KEY_ID || 'rzp_test_meritx_demo',
      mode: 'test'
    };
  }

  static async createOrder({ userId, examId, amount }) {
    let payablePaise = BigInt(0);
    let itemName = 'Competitive Examination';

    if (examId) {
      const exam = await prisma.exam.findUnique({ where: { id: examId } });
      if (!exam) throw new NotFoundError('Exam not found.');
      payablePaise = BigInt(exam.fee || 9900);
      itemName = exam.title;
    } else if (amount) {
      payablePaise = BigInt(Math.round(Number(amount) * 100));
    }

    const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const payment = await prisma.payment.create({
      data: {
        userId,
        purpose: examId ? 'exam_registration' : 'wallet_deposit',
        targetId: examId || null,
        amountPaise: payablePaise,
        currency: 'INR',
        gateway: 'Razorpay Standalone',
        gatewayOrderId: orderId,
        status: 'created'
      }
    });

    return {
      configured: true,
      keyId: env.RAZORPAY_KEY_ID || 'rzp_test_meritx_demo',
      mode: 'test',
      orderId,
      order: {
        id: orderId,
        amount: Number(payablePaise),
        currency: 'INR'
      },
      exam: {
        name: itemName
      }
    };
  }

  static async verifyPayment({ userId, examId, examTitle, razorpayOrderId, razorpayPaymentId, razorpaySignature, amount }) {
    if (env.RAZORPAY_KEY_SECRET && razorpaySignature && razorpayOrderId && razorpayPaymentId) {
      const expectedSignature = crypto
        .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');

      if (expectedSignature !== razorpaySignature) {
        throw new BadRequestError('Invalid Razorpay payment signature verification.');
      }
    }

    // Check payment order in DB
    const existingPayment = await prisma.payment.findFirst({
      where: {
        OR: [
          { gatewayOrderId: razorpayOrderId },
          { gatewayPaymentId: razorpayPaymentId }
        ]
      }
    });

    if (existingPayment) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          gatewayPaymentId: razorpayPaymentId,
          gatewaySignature: razorpaySignature,
          status: 'captured',
          verifiedAt: new Date()
        }
      });
    }

    // Register exam if applicable
    if (examId && userId) {
      await prisma.examRegistration.upsert({
        where: {
          studentId_examId: {
            studentId: userId,
            examId
          }
        },
        update: {
          status: 'confirmed',
          paymentStatus: 'successful'
        },
        create: {
          studentId: userId,
          examId,
          amountPaid: Number(existingPayment?.amountPaise || 9900),
          paymentStatus: 'successful',
          status: 'confirmed'
        }
      });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    return {
      verified: true,
      enrollmentConfirmed: true,
      studentName: user?.name || 'Candidate',
      courseName: examTitle || 'Competitive Examination',
      payment: {
        paymentId: razorpayPaymentId || `pay_${Date.now()}`,
        orderId: razorpayOrderId || `order_${Date.now()}`,
        amount: amount || (existingPayment ? Number(existingPayment.amountPaise) / 100 : 99),
        date: new Date().toISOString()
      }
    };
  }

  static async recordFailure({ orderId, reason }) {
    if (orderId) {
      await prisma.payment.updateMany({
        where: { gatewayOrderId: orderId },
        data: {
          status: 'failed',
          failureReason: reason || 'Transaction cancelled or gateway failure'
        }
      });
    }
    return { status: 'recorded' };
  }
}
